/**
 * Real-PostgreSQL race and replay suite for Chart.
 *
 * Race-sensitive behaviour cannot be proven against a mocked transaction
 * client, so these run against a live PostgreSQL instance. They are skipped
 * unless CHART_PG_DATABASE_URL is set, which keeps the standard suite totals
 * accurate on a machine with no database.
 *
 *   CHART_PG_DATABASE_URL="postgresql://..." npx jest src/__pg__ --runInBand
 *
 * The quota and active-Course races are carried over from the Workstream H
 * Stage 1 harness, which passed 7/7 at baseline a9a302f. The replay-ownership
 * and lifecycle-conflict races are new: they exercise the H-002/H-003 fix and
 * the conflict paths H recorded as NOT EXECUTED.
 *
 * No provider key is configured here, so the planner's deterministic fallback
 * is persisted — per amendment F1 that consumes exactly one quota unit, which
 * is the accounting under test.
 */

import { randomUUID } from 'crypto';

const PG_URL = process.env.CHART_PG_DATABASE_URL;
const describePg = PG_URL ? describe : describe.skip;

if (PG_URL) process.env.DATABASE_URL = PG_URL;

import { PrismaClient } from '@prisma/client';
import { coursePlannerService } from '../services/CoursePlannerService';
import { courseService } from '../services/CourseService';
import { reflectionService } from '../services/ReflectionService';
import type { PlannerEntitlementUser } from '../services/PlannerEntitlementService';

const prisma = new PrismaClient();

const TRIAL_CAP = 3;
const PRO_CAP = 10;

async function makeUser(kind: 'trial' | 'pro'): Promise<PlannerEntitlementUser> {
  const id = `pg-${kind}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      email: `${id}@chart-pg.test`,
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

const persisted = (userId: string) => prisma.aIPlanProposal.count({ where: { userId } });

function settledOutcomes<T>(results: PromiseSettledResult<T>[]) {
  return {
    fulfilled: results.filter(r => r.status === 'fulfilled').length,
    rejected: results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    ),
  };
}

async function makeAnchor(userId: string) {
  return prisma.anchor.create({
    data: {
      id: randomUUID(),
      userId,
      intentionText: 'chart pg anchor',
      category: 'health',
      distilledLetters: ['C', 'P'],
    },
  });
}

/**
 * A published two-waypoint Course whose current waypoint has a primary Anchor,
 * so it is reachable rather than BLOCKED.
 */
async function publishedCourse(userId: string) {
  const draft = await courseService.createCourse(userId, {
    idempotencyKey: randomUUID(),
    destinationText: 'pg race destination',
    waypoints: [
      { title: 'First waypoint', description: 'one' },
      { title: 'Second waypoint', description: 'two' },
    ],
  });
  const published = await courseService.updateCourse(userId, draft.id, {
    expectedCourseVersion: draft.version,
    status: 'ACTIVE',
  });
  const currentId = published.currentWaypointId!;
  const anchor = await makeAnchor(userId);
  const linked = await courseService.linkAnchor(userId, draft.id, {
    idempotencyKey: randomUUID(),
    expectedCourseVersion: published.version,
    anchorId: anchor.id,
    role: 'WAYPOINT_PRIMARY',
    waypointId: currentId,
  });
  const nextId = linked.waypoints.find(item => item.id !== currentId)!.id;
  return { courseId: draft.id, currentId, nextId, version: linked.version, anchor };
}

const eventCount = (courseId: string, eventType: string) =>
  prisma.courseEvent.count({ where: { courseId, eventType: eventType as never } });

describePg('Chart — real PostgreSQL races and replays', () => {
  jest.setTimeout(300_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Carried over from Workstream H Stage 1 ────────────────────────────────

  describe('planner quota races (amendment F1)', () => {
    it('two concurrent trial requests cannot both take the third lifetime slot', async () => {
      const user = await makeUser('trial');
      for (let i = 0; i < TRIAL_CAP - 1; i += 1) {
        await coursePlannerService.generate(user, {
          destinationText: `warm up ${i}`,
          idempotencyKey: randomUUID(),
        });
      }
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
      expect((rejected[0].reason as { code?: string }).code).toBe('PLANNER_QUOTA_EXCEEDED');
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

      expect(settledOutcomes(results).fulfilled).toBe(1);
      expect(await persisted(user.id)).toBe(PRO_CAP);
    });

    it('duplicate planner idempotency keys consume exactly one unit under concurrency', async () => {
      const user = await makeUser('trial');
      const key = randomUUID();
      const results = await Promise.allSettled([
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
        coursePlannerService.generate(user, { destinationText: 'same input', idempotencyKey: key }),
      ]);

      expect(settledOutcomes(results).fulfilled).toBe(3);
      const ids = new Set(
        results.flatMap(r => (r.status === 'fulfilled' ? [r.value.proposalId] : []))
      );
      expect(ids.size).toBe(1);
      expect(await persisted(user.id)).toBe(1);
    });

    it('a replayed planner key still returns the proposal after quota is exhausted', async () => {
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
      const replay = await coursePlannerService.generate(user, {
        destinationText: 'first plan',
        idempotencyKey: firstKey,
      });
      expect(replay.proposalId).toBe(first.proposalId);
      expect(await persisted(user.id)).toBe(TRIAL_CAP);
    });
  });

  describe('Course publication and completion races', () => {
    it('two concurrent publishes cannot create two active Courses', async () => {
      const user = await makeUser('pro');
      const courses = await Promise.all(
        [0, 1].map(i =>
          courseService.createCourse(user.id, {
            idempotencyKey: randomUUID(),
            destinationText: `destination ${i}`,
            waypoints: [{ title: `Waypoint ${i}`, description: 'desc' }],
          })
        )
      );
      const results = await Promise.allSettled(
        courses.map(course =>
          courseService.updateCourse(user.id, course.id, {
            expectedCourseVersion: course.version,
            status: 'ACTIVE',
          })
        )
      );

      expect(settledOutcomes(results).fulfilled).toBe(1);
      expect(
        await prisma.course.count({
          where: { userId: user.id, status: 'ACTIVE', deletedAt: null },
        })
      ).toBe(1);
    });

    it('double waypoint completion produces exactly one WAYPOINT_REACHED event', async () => {
      const user = await makeUser('pro');
      const { courseId, currentId, version } = await publishedCourse(user.id);

      const key = randomUUID();
      const results = await Promise.allSettled([
        courseService.completeWaypoint(user.id, courseId, currentId, {
          idempotencyKey: key,
          expectedCourseVersion: version,
        }),
        courseService.completeWaypoint(user.id, courseId, currentId, {
          idempotencyKey: key,
          expectedCourseVersion: version,
        }),
      ]);
      expect(settledOutcomes(results).fulfilled).toBeGreaterThanOrEqual(1);

      expect(await eventCount(courseId, 'WAYPOINT_REACHED')).toBe(1);
      expect((await prisma.waypoint.findUnique({ where: { id: currentId } }))?.reachedAt).not.toBeNull();
    });
  });

  // ── New: replay ownership (H-002 / H-003 fix) ─────────────────────────────

  describe('replay ownership across accounts', () => {
    it('completion replay is denied when the key belongs to another account', async () => {
      const victim = await makeUser('pro');
      const attacker = await makeUser('pro');
      const victimCourse = await publishedCourse(victim.id);
      const attackerCourse = await publishedCourse(attacker.id);

      const sharedKey = randomUUID();
      await courseService.completeWaypoint(victim.id, victimCourse.courseId, victimCourse.currentId, {
        idempotencyKey: sharedKey,
        expectedCourseVersion: victimCourse.version,
      });
      const victimEvent = await prisma.courseEvent.findFirst({
        where: { courseId: victimCourse.courseId, eventType: 'WAYPOINT_REACHED' },
      });

      await expect(
        courseService.completeWaypoint(
          attacker.id,
          attackerCourse.courseId,
          attackerCourse.currentId,
          { idempotencyKey: sharedKey, expectedCourseVersion: attackerCourse.version }
        )
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      // Nothing moved on either side.
      expect(
        (await prisma.waypoint.findUnique({ where: { id: attackerCourse.currentId } }))?.reachedAt
      ).toBeNull();
      expect(await eventCount(attackerCourse.courseId, 'WAYPOINT_REACHED')).toBe(0);
      expect(await eventCount(victimCourse.courseId, 'WAYPOINT_REACHED')).toBe(1);
      expect(
        (await prisma.waypoint.findUnique({ where: { id: victimCourse.currentId } }))?.reachedAt
      ).not.toBeNull();
      expect(victimEvent?.userId).toBe(victim.id);
    });

    it('skip replay is denied when the key belongs to another account', async () => {
      const victim = await makeUser('pro');
      const attacker = await makeUser('pro');
      const victimCourse = await publishedCourse(victim.id);
      const attackerCourse = await publishedCourse(attacker.id);

      const sharedKey = randomUUID();
      await courseService.skipWaypoint(victim.id, victimCourse.courseId, victimCourse.currentId, {
        idempotencyKey: sharedKey,
        expectedCourseVersion: victimCourse.version,
      });

      await expect(
        courseService.skipWaypoint(attacker.id, attackerCourse.courseId, attackerCourse.currentId, {
          idempotencyKey: sharedKey,
          expectedCourseVersion: attackerCourse.version,
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      expect(
        (await prisma.waypoint.findUnique({ where: { id: attackerCourse.currentId } }))?.skippedAt
      ).toBeNull();
      expect(await eventCount(attackerCourse.courseId, 'WAYPOINT_SKIPPED')).toBe(0);
      expect(await eventCount(victimCourse.courseId, 'WAYPOINT_SKIPPED')).toBe(1);
    });

    it('cancel replay is denied when the key belongs to another account', async () => {
      const victim = await makeUser('pro');
      const attacker = await makeUser('pro');
      const victimCourse = await publishedCourse(victim.id);
      const attackerCourse = await publishedCourse(attacker.id);

      const sharedKey = randomUUID();
      await courseService.cancelWaypoint(victim.id, victimCourse.courseId, victimCourse.nextId, {
        idempotencyKey: sharedKey,
        expectedCourseVersion: victimCourse.version,
      });

      await expect(
        courseService.cancelWaypoint(attacker.id, attackerCourse.courseId, attackerCourse.nextId, {
          idempotencyKey: sharedKey,
          expectedCourseVersion: attackerCourse.version,
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      expect(
        (await prisma.waypoint.findUnique({ where: { id: attackerCourse.nextId } }))?.cancelledAt
      ).toBeNull();
      expect(await eventCount(attackerCourse.courseId, 'WAYPOINT_CANCELLED')).toBe(0);
    });

    it('same-account key reuse across two different waypoints is denied', async () => {
      const user = await makeUser('pro');
      const course = await publishedCourse(user.id);
      const key = randomUUID();

      await courseService.skipWaypoint(user.id, course.courseId, course.currentId, {
        idempotencyKey: key,
        expectedCourseVersion: course.version,
      });
      const afterFirst = await prisma.course.findUnique({ where: { id: course.courseId } });

      await expect(
        courseService.skipWaypoint(user.id, course.courseId, course.nextId, {
          idempotencyKey: key,
          expectedCourseVersion: afterFirst!.version,
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      expect(
        (await prisma.waypoint.findUnique({ where: { id: course.nextId } }))?.skippedAt
      ).toBeNull();
      expect(await eventCount(course.courseId, 'WAYPOINT_SKIPPED')).toBe(1);
    });
  });

  // ── New: lifecycle-conflict races H recorded as NOT EXECUTED ──────────────

  describe('lifecycle-conflict races', () => {
    it('completion and skip of the same waypoint resolve to exactly one outcome', async () => {
      const user = await makeUser('pro');
      const { courseId, currentId, version } = await publishedCourse(user.id);

      await Promise.allSettled([
        courseService.completeWaypoint(user.id, courseId, currentId, {
          idempotencyKey: randomUUID(),
          expectedCourseVersion: version,
        }),
        courseService.skipWaypoint(user.id, courseId, currentId, {
          idempotencyKey: randomUUID(),
          expectedCourseVersion: version,
        }),
      ]);

      const reached = await eventCount(courseId, 'WAYPOINT_REACHED');
      const skipped = await eventCount(courseId, 'WAYPOINT_SKIPPED');
      expect(reached + skipped).toBe(1);

      const waypoint = await prisma.waypoint.findUnique({ where: { id: currentId } });
      // A waypoint is never both reached and skipped.
      expect(Boolean(waypoint?.reachedAt) && Boolean(waypoint?.skippedAt)).toBe(false);
    });

    it('completion and cancel cannot both apply to the same Course move', async () => {
      const user = await makeUser('pro');
      const { courseId, currentId, nextId, version } = await publishedCourse(user.id);

      await Promise.allSettled([
        courseService.completeWaypoint(user.id, courseId, currentId, {
          idempotencyKey: randomUUID(),
          expectedCourseVersion: version,
        }),
        courseService.cancelWaypoint(user.id, courseId, nextId, {
          idempotencyKey: randomUUID(),
          expectedCourseVersion: version,
        }),
      ]);

      expect(await eventCount(courseId, 'WAYPOINT_REACHED')).toBeLessThanOrEqual(1);
      expect(await eventCount(courseId, 'WAYPOINT_CANCELLED')).toBeLessThanOrEqual(1);

      // The current waypoint pointer stays consistent with the waypoints table.
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { waypoints: true },
      });
      if (course?.currentWaypointId) {
        const current = course.waypoints.find(item => item.id === course.currentWaypointId);
        expect(current).toBeDefined();
        expect(current?.reachedAt).toBeNull();
        expect(current?.skippedAt).toBeNull();
        expect(current?.cancelledAt).toBeNull();
      }
    });

    it('burning the supporting Anchor concurrently with completion stays consistent', async () => {
      const user = await makeUser('pro');
      const { courseId, currentId, version, anchor } = await publishedCourse(user.id);

      await Promise.allSettled([
        courseService.completeWaypoint(user.id, courseId, currentId, {
          idempotencyKey: randomUUID(),
          expectedCourseVersion: version,
        }),
        prisma.anchor.delete({ where: { id: anchor.id } }),
      ]);

      // Whichever won, the completion is recorded at most once and the link's
      // anchorId is SET NULL rather than dangling (A2).
      expect(await eventCount(courseId, 'WAYPOINT_REACHED')).toBeLessThanOrEqual(1);
      const links = await prisma.courseAnchorLink.findMany({ where: { courseId } });
      for (const link of links) {
        if (link.anchorId) {
          expect(await prisma.anchor.count({ where: { id: link.anchorId } })).toBe(1);
        }
        // The snapshot survives the Anchor so the Course Log stays readable.
        expect(link.anchorSnapshot).not.toBeNull();
      }
    });
  });

  // ── New: Reflection create idempotency at the backend boundary ────────────

  describe('Reflection persistence against the real schema', () => {
    it('creates a body reflection without violating the content check constraints', async () => {
      // The service used to write Prisma.JsonNull into structured_content, which
      // stores the JSON scalar `null` rather than SQL NULL, so
      // reflections_exactly_one_content_check rejected every body reflection.
      const user = await makeUser('pro');
      const { courseId } = await publishedCourse(user.id);

      const created = await reflectionService.create(user.id, {
        idempotencyKey: randomUUID(),
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
        body: 'a body reflection that must persist',
        courseId,
      });

      expect(created).not.toBeNull();
      const row = await prisma.reflection.findUnique({
        where: { id: (created as { id: string }).id },
      });
      expect(row?.body).toBe('a body reflection that must persist');
      // SQL NULL, not a JSON null.
      const [{ is_sql_null: isSqlNull }] = (await prisma.$queryRawUnsafe(
        `SELECT structured_content IS NULL AS is_sql_null FROM reflections WHERE id = '${row!.id}'`
      )) as Array<{ is_sql_null: boolean }>;
      expect(isSqlNull).toBe(true);
    });

    it('creates a structured completion reflection', async () => {
      const user = await makeUser('pro');
      const { courseId, currentId } = await publishedCourse(user.id);

      const created = await reflectionService.create(user.id, {
        idempotencyKey: randomUUID(),
        source: 'WAYPOINT_COMPLETION',
        promptType: 'WAYPOINT_COMPLETION',
        promptVersion: 1,
        structuredContent: { whatHelped: 'steady practice', whatLearned: 'patience' },
        courseId,
        waypointId: currentId,
      });

      expect(created).not.toBeNull();
      const row = await prisma.reflection.findUnique({
        where: { id: (created as { id: string }).id },
      });
      expect(row?.body).toBeNull();
      expect(row?.structuredContent).toMatchObject({ whatHelped: 'steady practice' });
    });

    it('deletes a reflection by erasing its text in place', async () => {
      const user = await makeUser('pro');
      const { courseId } = await publishedCourse(user.id);
      const key = randomUUID();
      const created = (await reflectionService.create(user.id, {
        idempotencyKey: key,
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
        body: 'text that must be destroyed',
        courseId,
      })) as { id: string };

      await reflectionService.delete(user.id, created.id);

      const row = await prisma.reflection.findUnique({ where: { id: created.id } });
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.body).toBe('');

      // The tombstone is authoritative: replaying the original create must not
      // resurrect the destroyed text.
      const replay = (await reflectionService.create(user.id, {
        idempotencyKey: key,
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
        body: 'text that must be destroyed',
        courseId,
      })) as { id: string; body?: string | null; deletedAt?: Date | null };
      expect(replay.id).toBe(created.id);
      expect(replay.body ?? '').toBe('');
      expect(await prisma.reflection.count({ where: { userId: user.id, deletedAt: null } })).toBe(0);
    });
  });

  describe('Reflection queued-create idempotency', () => {
    it('three concurrent creates with one key produce exactly one Reflection', async () => {
      const user = await makeUser('pro');
      const { courseId } = await publishedCourse(user.id);
      const key = randomUUID();
      const input = {
        idempotencyKey: key,
        source: 'MANUAL_COURSE' as const,
        promptType: 'COURSE_STATUS' as const,
        promptVersion: 1,
        body: 'a queued reflection replayed three times',
        courseId,
      };

      const results = await Promise.allSettled([
        reflectionService.create(user.id, input),
        reflectionService.create(user.id, input),
        reflectionService.create(user.id, input),
      ]);
      const { fulfilled, rejected } = settledOutcomes(results);
      expect(rejected.map(entry => (entry.reason as Error).message)).toEqual([]);
      expect(fulfilled).toBe(3);

      expect(await prisma.reflection.count({ where: { userId: user.id, idempotencyKey: key } })).toBe(1);
    });

    it('another account replaying the same Reflection key is denied', async () => {
      const victim = await makeUser('pro');
      const attacker = await makeUser('pro');
      const victimCourse = await publishedCourse(victim.id);
      const attackerCourse = await publishedCourse(attacker.id);
      const key = randomUUID();

      await reflectionService.create(victim.id, {
        idempotencyKey: key,
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
        body: 'private to the victim',
        courseId: victimCourse.courseId,
      });

      await expect(
        reflectionService.create(attacker.id, {
          idempotencyKey: key,
          source: 'MANUAL_COURSE',
          promptType: 'COURSE_STATUS',
          promptVersion: 1,
          body: 'attacker text',
          courseId: attackerCourse.courseId,
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      expect(await prisma.reflection.count({ where: { userId: attacker.id } })).toBe(0);
    });
  });
});
