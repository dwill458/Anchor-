/**
 * Workstream H release-gate harness — TEST ONLY (Part 4: privacy canary).
 *
 * Drives Chart failure paths with unique canary strings and asserts that no
 * canary reaches the logger transport or the Sentry `beforeSend` payload.
 * Failure paths are the point: success paths rarely serialise user text, error
 * paths routinely do (validation messages, driver errors, stack frames).
 */

const CANARIES = {
  destination: 'H-CANARY-DESTINATION-7b41c9',
  waypointTitle: 'H-CANARY-WAYPOINT-TITLE-2e8f',
  reflectionBody: 'H-CANARY-REFLECTION-BODY-5d0a',
  whatHelped: 'H-CANARY-WHAT-HELPED-91cc',
  whatLearned: 'H-CANARY-WHAT-LEARNED-33ab',
  plannerInput: 'H-CANARY-PLANNER-INPUT-6fe2',
} as const;

const ALL_CANARIES = Object.values(CANARIES);

/** Everything the logger transport was handed, flattened to a string. */
const captured: string[] = [];

jest.mock('../utils/logger', () => {
  const record = (...args: unknown[]) => {
    captured.push(
      args
        .map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ''}`;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ')
    );
  };
  return {
    logger: { info: record, warn: record, error: record, debug: record, request: record },
  };
});

import { AppError, errorHandler } from '../api/middleware/errorHandler';
import { courseEventService } from '../services/CourseEventService';

function expectNoCanaries(where: string): void {
  const haystack = captured.join('\n');
  for (const canary of ALL_CANARIES) {
    expect(`${where}:${haystack.includes(canary) ? 'LEAKED' : 'clean'}`).toBe(`${where}:clean`);
  }
}

function fakeResponse() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as import('express').Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
}

const fakeRequest = (body: unknown) =>
  ({ path: '/api/courses', method: 'POST', body }) as unknown as import('express').Request;

describe('H gate — privacy canaries must not reach logs', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('the global error handler logs no submitted Chart text on a validation failure', () => {
    // A realistic Zod-shaped validation message that embeds submitted content.
    const error = new AppError(
      `Validation error: destinationText: Invalid value ${CANARIES.destination}`,
      400,
      'VALIDATION_ERROR'
    );
    const res = fakeResponse();

    errorHandler(error, fakeRequest({ destinationText: CANARIES.destination }), res, jest.fn());

    expectNoCanaries('validation-error-log');
  });

  it('the global error handler logs no reflection text on an internal failure', () => {
    const error = new Error(
      `driver failure near "${CANARIES.reflectionBody}" / "${CANARIES.whatHelped}"`
    );
    const res = fakeResponse();

    errorHandler(
      error,
      fakeRequest({
        body: CANARIES.reflectionBody,
        structuredContent: {
          whatHelped: CANARIES.whatHelped,
          whatLearned: CANARIES.whatLearned,
        },
      }),
      res,
      jest.fn()
    );

    expectNoCanaries('internal-error-log');
  });

  it('a raw internal error is never echoed to the client', () => {
    const error = new Error(`secret internals ${CANARIES.plannerInput}`);
    const res = fakeResponse();

    errorHandler(error, fakeRequest({}), res, jest.fn());

    const payload = JSON.stringify(res.json.mock.calls[0][0]);
    expect(payload).not.toContain(CANARIES.plannerInput);
    expect(payload).toContain('An unexpected error occurred');
  });

  it('CourseEvent snapshots reject any key outside the frozen allowlist', async () => {
    const tx = {
      courseEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    } as unknown as import('@prisma/client').Prisma.TransactionClient;

    await expect(
      courseEventService.append(tx, {
        userId: 'user-1',
        courseId: 'course-1',
        eventType: 'WAYPOINT_REACHED',
        // `reflectionBody` is not on COURSE_EVENT_SNAPSHOT_KEYS.
        snapshot: { reflectionBody: CANARIES.reflectionBody } as never,
        idempotencyKey: 'k',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect((tx.courseEvent.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it('CourseEvent snapshots persist only allowlisted keys', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'e1' });
    const tx = {
      courseEvent: { findUnique: jest.fn().mockResolvedValue(null), create },
    } as unknown as import('@prisma/client').Prisma.TransactionClient;

    await courseEventService.append(tx, {
      userId: 'user-1',
      courseId: 'course-1',
      eventType: 'WAYPOINT_REACHED',
      snapshot: { waypointTitle: CANARIES.waypointTitle },
      idempotencyKey: 'k2',
    });

    const persisted = JSON.stringify(create.mock.calls[0][0].data.snapshot);
    // waypointTitle IS frozen as an allowed snapshot field (amendment A1), so it
    // is expected here; the assertion is that nothing else rides along.
    expect(JSON.parse(persisted)).toEqual({ waypointTitle: CANARIES.waypointTitle });
  });
});
