import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { CourseEventType } from '@prisma/client';
import { AppError } from '../api/middleware/errorHandler';

export const COURSE_EVENT_SNAPSHOT_KEYS = [
  'waypointTitle',
  'previousStatus',
  'newStatus',
  'practiceMode',
  'durationSeconds',
  'reflectionPromptType',
  'anchorRole',
  'fromPosition',
  'toPosition',
  'blockedReason',
  // A one-way digest of the logical mutation request. This lets mutation
  // services bind an idempotency key to intent without putting private text in
  // the immutable Course Log.
  'requestFingerprint',
] as const;

type SnapshotKey = (typeof COURSE_EVENT_SNAPSHOT_KEYS)[number];
type SnapshotValue = string | number;
export type CourseEventSnapshot = Partial<Record<SnapshotKey, SnapshotValue>>;

export const COURSE_EVENT_MESSAGES: Record<CourseEventType, string> = {
  COURSE_CREATED: 'Course created.',
  DESTINATION_CHANGED: 'Course destination changed.',
  WAYPOINT_ADDED: 'Waypoint added to the course.',
  WAYPOINT_REORDERED: 'Course waypoints reordered.',
  DESTINATION_ANCHOR_LINKED: 'Destination anchor linked.',
  WAYPOINT_ANCHOR_LINKED: 'Waypoint anchor linked.',
  PRACTICE_COMPLETED: 'Practice completed.',
  REFLECTION_ADDED: 'Reflection added.',
  WAYPOINT_REACHED: 'Waypoint reached.',
  WAYPOINT_SKIPPED: 'Waypoint skipped.',
  WAYPOINT_CANCELLED: 'Waypoint removed from the course.',
  WAYPOINT_BLOCKED: 'Waypoint blocked.',
  WAYPOINT_UNBLOCKED: 'Waypoint unblocked.',
  COURSE_COMPLETED: 'Course completed.',
  COURSE_ARCHIVED: 'Course archived.',
  COURSE_RESTORED: 'Course restored.',
};

export type CreateCourseEventInput = {
  userId: string;
  courseId: string;
  waypointId?: string | null;
  eventType: CourseEventType;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  snapshot?: CourseEventSnapshot | null;
  occurredAt?: Date;
  idempotencyKey: string;
  eventVersion?: number;
};

function sanitizeSnapshot(
  snapshot: CourseEventSnapshot | null | undefined
): Prisma.InputJsonValue | null {
  if (!snapshot) return null;
  const keys = Object.keys(snapshot);
  const invalid = keys.filter(
    key => !(COURSE_EVENT_SNAPSHOT_KEYS as readonly string[]).includes(key)
  );
  if (invalid.length > 0) {
    throw new AppError('Course event snapshot contains forbidden keys', 500, 'VALIDATION_ERROR', {
      invalidKeys: invalid,
    });
  }

  const result: Record<string, SnapshotValue> = {};
  for (const key of COURSE_EVENT_SNAPSHOT_KEYS) {
    const value = snapshot[key];
    if (value !== undefined) result[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 512) {
    throw new AppError('Course event snapshot is too large', 500, 'VALIDATION_ERROR');
  }
  return result as Prisma.InputJsonValue;
}

function snapshotSignature(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value);
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return JSON.stringify(Object.fromEntries(entries));
}

export class CourseEventService {
  async append(
    tx: Prisma.TransactionClient,
    input: CreateCourseEventInput
  ): Promise<Prisma.CourseEventGetPayload<Prisma.CourseEventDefaultArgs>> {
    // Sanitize before the replay lookup as well as before insertion. Otherwise
    // an invalid snapshot can bypass validation merely by reusing a committed
    // key.
    const snapshot = sanitizeSnapshot(input.snapshot);
    const existing = await tx.courseEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (
        existing.userId !== input.userId ||
        existing.courseId !== input.courseId ||
        (existing.waypointId ?? null) !== (input.waypointId ?? null) ||
        existing.eventType !== input.eventType ||
        (existing.sourceEntityType ?? null) !== (input.sourceEntityType ?? null) ||
        (existing.sourceEntityId ?? null) !== (input.sourceEntityId ?? null) ||
        (existing.eventVersion ?? 1) !== (input.eventVersion ?? 1) ||
        snapshotSignature(existing.snapshot) !== snapshotSignature(snapshot)
      ) {
        throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }

    return tx.courseEvent.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        courseId: input.courseId,
        waypointId: input.waypointId ?? null,
        eventType: input.eventType,
        sourceEntityType: input.sourceEntityType ?? null,
        sourceEntityId: input.sourceEntityId ?? null,
        snapshot: snapshot === null ? Prisma.JsonNull : snapshot,
        occurredAt: input.occurredAt ?? new Date(),
        idempotencyKey: input.idempotencyKey,
        eventVersion: input.eventVersion ?? 1,
      },
    });
  }
}

export const courseEventService = new CourseEventService();
