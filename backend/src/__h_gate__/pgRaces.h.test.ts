/**
 * Workstream H release-gate harness — TEST ONLY.
 *
 * Part 3 requires race-sensitive behaviour to be proven against a real
 * PostgreSQL instance rather than a mocked transaction client. These tests run
 * only when H_PG_DATABASE_URL is set and are otherwise skipped, so the normal
 * suite is unaffected.
 *
 * No provider key is configured in this environment, so `generateWithProvider`
 * fails fast and the deterministic fallback is persisted. Per amendment F1 a
 * persisted fallback consumes exactly one quota unit, which is precisely the
 * accounting under test.
 */

import { randomUUID } from 'crypto';

const PG_URL = process.env.H_PG_DATABASE_URL;
const describePg = PG_URL ? describe : describe.skip;

if (PG_URL) process.env.DATABASE_URL = PG_URL;

import { PrismaClient } from '@prisma/client';
import { coursePlannerService } from '../services/CoursePlannerService';
import { courseService } from '../services/CourseService';
import type { PlannerEntitlementUser } from '../services/PlannerEntitlementService';

const prisma = new PrismaClient();

const TRIAL_CAP = 3;
const PRO_CAP = 10;

async function makeUser(kind: 'trial' | 'pro'): Promise<PlannerEntitlementUser> {
  const id = `h-${kind}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      email: `${id}@h-gate.test`,
      authProvider: 'firebase',
      authUid: id,
      chartSchemaVersion: 1,
      subscriptionStatus: kind === 'pro' ? 'pro' : 'free',
      ...(kind === 'trial' ? { trialStartedAt: new Date() } : {}),
    },
  });
  return {
    id,
    isComped: false,
    subscriptionStatus: kind === 'pro' ? 'pro' : 'free',
    subscriptionId: null,
    trialStartedAt: kind === 'trial' ? new Date() : null,
  };
}

/** Counts only proposals that actually landed — the quota unit under F1. */
function persisted(userId: string) {
  return prisma.aIPlanProposal.count({ where: { userId } });
}

function settledOutcomes<T>(results: PromiseSettledResult<T>[]) {
  return {
    fulfilled: results.filter(r => r.status === 'fulfilled').length,
    rejected: results.filter(r => r.status === 'rejected'),
  };
}

describePg('H gate — real PostgreSQL races', () => {
  jest.setTimeout(180_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('planner quota races (amendment F1)', () => {
    it('two concurrent trial requests cannot both take the third lifetime slot', async () => {
      const user = await makeUser('trial');
      // Burn the first two of three lifetime slots serially.
      for (let i = 0; i < TRIAL_CAP - 1; i += 1) {
        await coursePlannerService.generate(user, {
          destinationText: `warm up ${i}`,
          idempotencyKey: randomUUID(),
        });
      }
      expect(await persisted(user.id)).toBe(TRIAL_CAP - 1);

      const results = await Promise.allSettled([
        coursePlannerService.generate(user, {
          destinationText: 'final slot A',
          idempotencyKey: randomUUID(),
        }),
        coursePlannerService.generate(user, {
          destinationText: 'final slot B',
          idempotencyKey: randomUUID(),
        }),
      ]);
      const { fulfilled, rejected } = settledOutcomes(results);

      expect(fulfilled).toBe(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0].reason as { code?: string }).code).toBe('PLANNER_QUOTA_EXCEEDED');
      // The decisive assertion: the cap is never exceeded.
      expect(await persisted(user.id)).toBe(TRIAL_CAP);
    });

    it('a fourth trial generation is denied and persists nothing', async () => {
      const user = await makeUser('trial');
      for (let i = 0; i < TRIAL_CAP; i += 1) {
        await coursePlannerService.generate(user, {
          destinationText: `plan ${i}`,
          idempotencyKey: randomUUID(),
        });
      }
      await expect(
        coursePlannerService.generate(user, {
          destinationText: 'one too many',
          idempotencyKey: randomUUID(),
        })
      ).rejects.toMatchObject({ code: 'PLANNER_QUOTA_EXCEEDED' });
      expect(await persisted(user.id)).toBe(TRIAL_CAP);
    });

    it('two concurrent Pro requests cannot both take the tenth rolling-day slot', async () => {
      const user = await makeUser('pro');
      for (let i = 0; i < PRO_CAP - 1; i += 1) {
        await coursePlannerService.generate(user, {
          destinationText: `pro warm up ${i}`,
          idempotencyKey: randomUUID(),
        });
      }
      expect(await persisted(user.id)).toBe(PRO_CAP - 1);

      const results = await Promise.allSettled([
        coursePlannerService.generate(user, {
          destinationText: 'pro final A',
          idempotencyKey: randomUUID(),
        }),
        coursePlannerService.generate(user, {
          destinationText: 'pro final B',
          idempotencyKey: randomUUID(),
        }),
      ]);
      const { fulfilled } = settledOutcomes(results);

      expect(fulfilled).toBe(1);
      expect(await persisted(user.id)).toBe(PRO_CAP);
    });

    it('duplicate idempotency keys consume exactly one unit under concurrency', async () => {
      const user = await makeUser('trial');
      const key = randomUUID();
      const results = await Promise.allSettled([
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
      ]);
      const { fulfilled } = settledOutcomes(results);

      expect(fulfilled).toBe(3);
      const ids = new Set(
        results.flatMap(r => (r.status === 'fulfilled' ? [r.value.proposalId] : []))
      );
      expect(ids.size).toBe(1);
      expect(await persisted(user.id)).toBe(1);
    });

    it('a replayed idempotency key still returns the proposal after quota is exhausted', async () => {
      const user = await makeUser('trial');
      const firstKey = randomUUID();
      const first = await coursePlannerService.generate(user, {
        destinationText: 'first plan',
        idempotencyKey: firstKey,
      });
      for (let i = 1; i < TRIAL_CAP; i += 1) {
        await coursePlannerService.generate(user, {
          destinationText: `filler ${i}`,
          idempotencyKey: randomUUID(),
        });
      }
      // Quota is now exhausted, but a replay is retrieval, not generation.
      const replay = await coursePlannerService.generate(user, {
        destinationText: 'first plan',
        idempotencyKey: firstKey,
      });
      expect(replay.proposalId).toBe(first.proposalId);
      expect(await persisted(user.id)).toBe(TRIAL_CAP);
    });
  });

  describe('course races', () => {
    it('two concurrent publishes cannot create two active Courses', async () => {
      const user = await makeUser('pro');
      const courses = await Promise.all(
        [0, 1].map(async i => {
          const course = await courseService.createCourse(user.id, {
            idempotencyKey: randomUUID(),
            destinationText: `destination ${i}`,
            waypoints: [{ title: `Waypoint ${i}`, description: 'desc' }],
          });
          return course;
        })
      );

      const results = await Promise.allSettled(
        courses.map(course =>
          courseService.updateCourse(user.id, course.id, {
            expectedCourseVersion: course.version,
            status: 'ACTIVE',
          })
        )
      );
      const { fulfilled } = settledOutcomes(results);

      expect(fulfilled).toBe(1);
      const active = await prisma.course.count({
        where: { userId: user.id, status: 'ACTIVE', deletedAt: null },
      });
      expect(active).toBe(1);
    });

    it('double waypoint completion produces exactly one WAYPOINT_REACHED event', async () => {
      const user = await makeUser('pro');
      const draft = await courseService.createCourse(user.id, {
        idempotencyKey: randomUUID(),
        destinationText: 'race destination',
        waypoints: [
          { title: 'First waypoint', description: 'one' },
          { title: 'Second waypoint', description: 'two' },
        ],
      });
      const published = await courseService.updateCourse(user.id, draft.id, {
        expectedCourseVersion: draft.version,
        status: 'ACTIVE',
      });
      const currentId = published.currentWaypointId!;
      expect(currentId).toBeTruthy();

      // Link an Anchor so the waypoint is not BLOCKED.
      const anchor = await prisma.anchor.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          intentionText: 'H race anchor',
          category: 'GROWTH',
        },
      });
      const linked = await courseService.linkAnchor(user.id, draft.id, {
        idempotencyKey: randomUUID(),
        expectedCourseVersion: published.version,
        anchorId: anchor.id,
        role: 'WAYPOINT_PRIMARY',
        waypointId: currentId,
      });

      const key = randomUUID();
      const results = await Promise.allSettled([
        courseService.completeWaypoint(user.id, draft.id, currentId, {
          idempotencyKey: key,
          expectedCourseVersion: linked.version,
        }),
        courseService.completeWaypoint(user.id, draft.id, currentId, {
          idempotencyKey: key,
          expectedCourseVersion: linked.version,
        }),
      ]);
      const { fulfilled } = settledOutcomes(results);
      expect(fulfilled).toBeGreaterThanOrEqual(1);

      const reached = await prisma.courseEvent.count({
        where: { courseId: draft.id, waypointId: currentId, eventType: 'WAYPOINT_REACHED' },
      });
      expect(reached).toBe(1);

      const waypoint = await prisma.waypoint.findUnique({ where: { id: currentId } });
      expect(waypoint?.reachedAt).not.toBeNull();
    });
  });
});
