import { randomUUID } from 'crypto';
import { Prisma, CourseStatus, CourseEventType, CourseAnchorRole } from '@prisma/client';
import { AppError } from '../api/middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  buildWaypointSummary,
  deriveBlockedReason,
  isTerminal,
  selectNextWaypoint,
  toAnchorLinkSummary,
  validateCourseInvariants,
} from './WaypointStateService';
import { COURSE_EVENT_MESSAGES, courseEventService } from './CourseEventService';
import type {
  AnchorSnapshot,
  AddWaypointRequest,
  AnchorLinkSummary,
  BlockedReason,
  CancelWaypointRequest,
  CompleteWaypointRequest,
  CompleteWaypointResponse,
  CourseDetail,
  CourseLogEntry,
  CourseObservation,
  CourseSummary,
  CreateCourseRequest,
  LinkAnchorRequest,
  ReorderWaypointsRequest,
  SkipWaypointRequest,
  UpdateCourseRequest,
  WaypointSummary,
} from '../types/chart';

const COURSE_INCLUDE = {
  waypoints: { orderBy: { position: 'asc' as const } },
  anchorLinks: {
    include: {
      anchor: {
        select: {
          id: true,
          isArchived: true,
          intentionText: true,
          category: true,
          planetaryTier: true,
          enhancedImageUrl: true,
        },
      },
    },
  },
} as const;

type CourseRow = Prisma.CourseGetPayload<{ include: typeof COURSE_INCLUDE }>;
type DbClient = typeof prisma;
type TxClient = Prisma.TransactionClient;
type CourseClient = DbClient | TxClient;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function truncateIntention(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 200 ? trimmed : `${trimmed.slice(0, 197)}...`;
}

export function buildAnchorSnapshot(
  anchor: {
    id: string;
    intentionText: string;
    category: string;
    planetaryTier: string | null;
    enhancedImageUrl: string | null;
  },
  releasedAtUnlink: boolean,
  capturedAt = new Date()
): AnchorSnapshot {
  return {
    snapshotVersion: 1,
    anchorId: anchor.id,
    intentionText: truncateIntention(anchor.intentionText),
    category: anchor.category,
    planetaryTier: anchor.planetaryTier,
    enhancedImageUrl: anchor.enhancedImageUrl,
    releasedAtUnlink,
    capturedAt: capturedAt.toISOString(),
  };
}

function anchorFromLink(
  link: CourseRow['anchorLinks'][number] | null
): CourseRow['anchorLinks'][number]['anchor'] | null {
  return link?.anchor ?? null;
}

function activeLinkForWaypoint(
  row: CourseRow,
  waypointId: string
): CourseRow['anchorLinks'][number] | null {
  return (
    row.anchorLinks.find(
      link =>
        link.role === CourseAnchorRole.WAYPOINT_PRIMARY &&
        link.waypointId === waypointId &&
        link.unlinkedAt === null
    ) ?? null
  );
}

function stateLinkForWaypoint(
  row: CourseRow,
  waypointId: string
): CourseRow['anchorLinks'][number] | null {
  const active = activeLinkForWaypoint(row, waypointId);
  if (active) return active;

  // A closed link remains the authoritative historical reason that a current
  // waypoint is blocked. The live Anchor may have been hard-deleted, so the
  // snapshot and null anchorId must remain usable after the transaction.
  return (
    row.anchorLinks
      .filter(
        link =>
          link.role === CourseAnchorRole.WAYPOINT_PRIMARY &&
          link.waypointId === waypointId &&
          link.unlinkedAt !== null
      )
      .sort((left, right) => right.unlinkedAt!.getTime() - left.unlinkedAt!.getTime())[0] ?? null
  );
}

function activeDestinationLink(row: CourseRow): CourseRow['anchorLinks'][number] | null {
  return (
    row.anchorLinks.find(
      link => link.role === CourseAnchorRole.DESTINATION && link.unlinkedAt === null
    ) ?? null
  );
}

function toSummary(row: CourseRow, observations?: CourseObservation[]): CourseSummary {
  const reachedCount = row.waypoints.filter(waypoint => waypoint.reachedAt !== null).length;
  const summary: CourseSummary = {
    id: row.id,
    destinationText: row.destinationText,
    status: row.status,
    version: row.version,
    currentWaypointId: row.currentWaypointId,
    waypointCount: row.waypoints.length,
    reachedCount,
    plottedAt: row.plottedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    destinationAnchorLink: destinationSummary(row),
  };
  if (observations) summary.observations = observations.slice(0, 2);
  return summary;
}

function destinationSummary(row: CourseRow): AnchorLinkSummary | null {
  const link = activeDestinationLink(row);
  if (!link) return null;
  return toAnchorLinkSummary(link, anchorFromLink(link));
}

function projection(row: CourseRow, observations?: CourseObservation[]): CourseDetail {
  const violations = validateCourseInvariants(row, row.waypoints);
  const isCorrupt = violations.length > 0;
  const pointer = isCorrupt ? null : row.currentWaypointId;
  const courseForDerivation = { ...row, currentWaypointId: pointer };

  const waypoints: WaypointSummary[] = row.waypoints.map(waypoint => {
    const link = stateLinkForWaypoint(row, waypoint.id);
    return buildWaypointSummary(courseForDerivation, waypoint, link, anchorFromLink(link));
  });

  const result: CourseDetail = {
    ...toSummary(row, observations),
    waypoints,
  };
  if (isCorrupt) result.needsRepair = true;
  return result;
}

function assertExpectedVersion(row: CourseRow, expected: number): void {
  if (row.version !== expected) {
    throw new AppError('Course has changed on another device', 409, 'COURSE_VERSION_CONFLICT', {
      course: projection(row),
    });
  }
}

function assertCourseWritable(row: CourseRow): void {
  if (row.deletedAt) throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  if (row.status === CourseStatus.ARCHIVED || row.status === CourseStatus.COMPLETED) {
    throw new AppError('Course is not editable', 409, 'COURSE_NOT_ACTIVE');
  }
}

function assertCourseActive(row: CourseRow): void {
  if (row.status !== CourseStatus.ACTIVE || row.deletedAt) {
    throw new AppError('Course is not active', 409, 'COURSE_NOT_ACTIVE');
  }
}

function assertWaypointBelongs(row: CourseRow, waypointId: string): CourseRow['waypoints'][number] {
  const waypoint = row.waypoints.find(item => item.id === waypointId);
  if (!waypoint) throw new AppError('Waypoint not found', 404, 'WAYPOINT_NOT_FOUND');
  return waypoint;
}

function ensureNoCorruption(row: CourseRow): void {
  if (validateCourseInvariants(row, row.waypoints).length > 0) {
    throw new AppError(
      'Course needs repair before it can be changed',
      409,
      'WAYPOINT_TRANSITION_INVALID'
    );
  }
}

function eventKey(prefix: string, idempotencyKey: string): string {
  return `chart:${prefix}:${idempotencyKey}`;
}

async function findCourse(
  client: CourseClient,
  userId: string,
  courseId: string,
  includeDeleted = false
): Promise<CourseRow> {
  const row = await client.course.findFirst({
    where: { id: courseId, userId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: COURSE_INCLUDE,
  });
  if (!row) throw new AppError('Course not found', 404, 'COURSE_NOT_FOUND');
  return row;
}

async function findCourseByIdempotency(
  client: CourseClient,
  userId: string,
  key: string
): Promise<CourseRow | null> {
  const row = await client.course.findUnique({
    where: { idempotencyKey: key },
    include: COURSE_INCLUDE,
  });
  if (!row) return null;
  if (row.userId !== userId)
    throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
  return row;
}

async function runSerializable<T>(work: (tx: TxClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new AppError('Chart transaction could not be serialized', 409, 'SYNC_CONFLICT');
}

export class CourseService {
  async initializeChartForUser(userId: string): Promise<{ chartSchemaVersion: number }> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { chartSchemaVersion: 1 },
      select: { chartSchemaVersion: true },
    });
    return user;
  }

  async listCourses(userId: string, status?: CourseStatus): Promise<CourseSummary[]> {
    const rows = await prisma.course.findMany({
      where: { userId, deletedAt: null, ...(status ? { status } : {}) },
      include: COURSE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(row => toSummary(row));
  }

  async getCourse(userId: string, courseId: string): Promise<CourseDetail> {
    const row = await findCourse(prisma, userId, courseId);
    const violations = validateCourseInvariants(row, row.waypoints);
    if (violations.length > 0) {
      // IDs only: the course and pointer are structural metadata, never text.
      logger.error('Chart current waypoint corruption detected', undefined, {
        courseId: row.id,
        currentWaypointId: row.currentWaypointId,
      });
    }
    const observations = await this.buildObservations(userId, row);
    return projection(row, observations);
  }

  async createCourse(userId: string, input: CreateCourseRequest): Promise<CourseDetail> {
    const existing = await findCourseByIdempotency(prisma, userId, input.idempotencyKey);
    if (existing) {
      if (existing.destinationText !== input.destinationText.trim()) {
        throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
      }
      return projection(existing);
    }
    if ((input.waypoints?.length ?? 0) > 7) {
      throw new AppError('A Course may contain at most 7 waypoints', 400, 'VALIDATION_ERROR');
    }

    try {
      return await runSerializable(async tx => {
        const active = await tx.course.findFirst({
          where: { userId, status: CourseStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        });
        // DRAFT creation is allowed even with an active Course; the DB index
        // remains the authority at publish time.
        void active;
        const courseId = randomUUID();
        const created = await tx.course.create({
          data: {
            id: courseId,
            userId,
            destinationText: input.destinationText.trim(),
            idempotencyKey: input.idempotencyKey,
            createdFromProposalId: input.fromProposalId ?? null,
            schemaVersion: 1,
          },
        });
        const waypoints: Array<{
          id: string;
          courseId: string;
          userId: string;
          position: number;
          title: string;
          description: string | null;
        }> = [];
        for (const [index, waypoint] of (input.waypoints ?? []).entries()) {
          const createdWaypoint = await tx.waypoint.create({
            data: {
              id: randomUUID(),
              userId,
              courseId,
              position: (index + 1) * 100,
              title: waypoint.title.trim(),
              description: waypoint.description?.trim() || null,
            },
          });
          waypoints.push(createdWaypoint);
        }
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.COURSE_CREATED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          idempotencyKey: eventKey('course-created', input.idempotencyKey),
        });
        for (const waypoint of waypoints) {
          await courseEventService.append(tx, {
            userId,
            courseId,
            waypointId: waypoint.id,
            eventType: CourseEventType.WAYPOINT_ADDED,
            sourceEntityType: 'Waypoint',
            sourceEntityId: waypoint.id,
            snapshot: { waypointTitle: waypoint.title },
            idempotencyKey: eventKey(`waypoint-added:${waypoint.id}`, input.idempotencyKey),
          });
        }
        return projection(await findCourse(tx, userId, created.id));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('An active Course already exists', 409, 'ACTIVE_COURSE_EXISTS');
      }
      throw error;
    }
  }

  async updateCourse(
    userId: string,
    courseId: string,
    input: UpdateCourseRequest
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      ensureNoCorruption(row);
      const destinationChanged = input.destinationText !== undefined;
      const publishing = input.status === 'ACTIVE';
      if (!destinationChanged && !publishing) return projection(row);
      if (publishing) {
        if (row.status !== CourseStatus.DRAFT) {
          throw new AppError(
            'Only DRAFT Courses can be published',
            409,
            'WAYPOINT_TRANSITION_INVALID'
          );
        }
        const nonTerminal = row.waypoints.filter(waypoint => !isTerminal(waypoint));
        if (nonTerminal.length === 0)
          throw new AppError('A Course needs a waypoint', 422, 'WAYPOINT_NOT_FOUND');
        const existingActive = await tx.course.findFirst({
          where: { userId, status: CourseStatus.ACTIVE, deletedAt: null, id: { not: courseId } },
          select: { id: true },
        });
        if (existingActive)
          throw new AppError('An active Course already exists', 409, 'ACTIVE_COURSE_EXISTS');
      }
      try {
        await tx.course.update({
          where: { id: courseId },
          data: {
            ...(destinationChanged ? { destinationText: input.destinationText!.trim() } : {}),
            ...(publishing
              ? {
                  status: CourseStatus.ACTIVE,
                  currentWaypointId: selectNextWaypoint(row.waypoints, -Infinity)?.id ?? null,
                }
              : {}),
            version: { increment: 1 },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new AppError('An active Course already exists', 409, 'ACTIVE_COURSE_EXISTS');
        throw error;
      }
      if (destinationChanged) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.DESTINATION_CHANGED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          idempotencyKey: eventKey(
            'destination-changed',
            `${courseId}:${input.expectedCourseVersion}`
          ),
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async archiveCourse(
    userId: string,
    courseId: string,
    expectedCourseVersion: number
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, expectedCourseVersion);
      if (row.status === CourseStatus.ARCHIVED) return projection(row);
      if (![CourseStatus.DRAFT, CourseStatus.ACTIVE, CourseStatus.COMPLETED].includes(row.status)) {
        throw new AppError('Course cannot be archived', 409, 'WAYPOINT_TRANSITION_INVALID');
      }
      await tx.course.update({
        where: { id: row.id },
        data: {
          status: CourseStatus.ARCHIVED,
          archivedAt: new Date(),
          currentWaypointId: null,
          version: { increment: 1 },
        },
      });
      await courseEventService.append(tx, {
        userId,
        courseId,
        eventType: CourseEventType.COURSE_ARCHIVED,
        sourceEntityType: 'Course',
        sourceEntityId: courseId,
        snapshot: { previousStatus: row.status, newStatus: CourseStatus.ARCHIVED },
        idempotencyKey: eventKey('archive', `${courseId}:${row.version}`),
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async restoreCourse(
    userId: string,
    courseId: string,
    expectedCourseVersion: number
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId, true);
      assertExpectedVersion(row, expectedCourseVersion);
      let target: CourseStatus = row.status;
      if (row.status === CourseStatus.ARCHIVED) {
        const archive = await tx.courseEvent.findFirst({
          where: { courseId, eventType: CourseEventType.COURSE_ARCHIVED },
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        });
        const previous =
          archive?.snapshot && typeof archive.snapshot === 'object'
            ? (archive.snapshot as Record<string, unknown>).previousStatus
            : null;
        target =
          previous === CourseStatus.ACTIVE ||
          previous === CourseStatus.COMPLETED ||
          previous === CourseStatus.DRAFT
            ? previous
            : CourseStatus.DRAFT;
      }
      if (target === CourseStatus.ACTIVE) {
        const active = await tx.course.findFirst({
          where: { userId, status: CourseStatus.ACTIVE, deletedAt: null, id: { not: courseId } },
          select: { id: true },
        });
        if (active)
          throw new AppError('An active Course already exists', 409, 'ACTIVE_COURSE_EXISTS');
        const next = selectNextWaypoint(row.waypoints, -Infinity);
        if (!next) throw new AppError('A Course needs a waypoint', 422, 'WAYPOINT_NOT_FOUND');
      }
      const current =
        target === CourseStatus.ACTIVE
          ? (selectNextWaypoint(row.waypoints, -Infinity)?.id ?? null)
          : null;
      await tx.course.update({
        where: { id: row.id },
        data: {
          deletedAt: null,
          status: target,
          archivedAt: target === CourseStatus.ARCHIVED ? row.archivedAt : null,
          currentWaypointId: current,
          version: { increment: 1 },
        },
      });
      await courseEventService.append(tx, {
        userId,
        courseId,
        eventType: CourseEventType.COURSE_RESTORED,
        sourceEntityType: 'Course',
        sourceEntityId: courseId,
        snapshot: { previousStatus: row.status, newStatus: target },
        idempotencyKey: eventKey('restore', `${courseId}:${row.version}`),
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async softDeleteCourse(
    userId: string,
    courseId: string,
    expectedCourseVersion: number
  ): Promise<void> {
    await runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, expectedCourseVersion);
      await tx.course.update({
        where: { id: row.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }

  async addWaypoint(
    userId: string,
    courseId: string,
    input: AddWaypointRequest
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      ensureNoCorruption(row);
      if (row.waypoints.length >= 7)
        throw new AppError('A Course may contain at most 7 waypoints', 400, 'VALIDATION_ERROR');
      const nonTerminal = row.waypoints.filter(waypoint => !isTerminal(waypoint));
      const terminal = row.waypoints.filter(waypoint => isTerminal(waypoint));
      const afterIndex = input.afterWaypointId
        ? nonTerminal.findIndex(waypoint => waypoint.id === input.afterWaypointId)
        : nonTerminal.length - 1;
      if (input.afterWaypointId && afterIndex < 0)
        throw new AppError('Waypoint not found', 404, 'WAYPOINT_NOT_FOUND');
      const orderedIds = nonTerminal.map(waypoint => waypoint.id);
      orderedIds.splice(afterIndex + 1, 0, '__new__');
      const start = terminal.length
        ? Math.max(...terminal.map(waypoint => waypoint.position)) + 100
        : 100;
      const newWaypointId = randomUUID();
      await tx.waypoint.create({
        data: {
          id: newWaypointId,
          userId,
          courseId,
          position: -1000000,
          title: input.title.trim(),
          description: input.description?.trim() || null,
        },
      });
      const updates = orderedIds.map(id => (id === '__new__' ? newWaypointId : id));
      for (const [index, id] of updates.entries()) {
        await tx.waypoint.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of updates.entries()) {
        await tx.waypoint.update({ where: { id }, data: { position: start + index * 100 } });
      }
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId: newWaypointId,
        eventType: CourseEventType.WAYPOINT_ADDED,
        sourceEntityType: 'Waypoint',
        sourceEntityId: newWaypointId,
        snapshot: { waypointTitle: input.title.trim() },
        idempotencyKey: eventKey('waypoint-add', input.idempotencyKey),
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async editWaypoint(
    userId: string,
    courseId: string,
    waypointId: string,
    input: { expectedCourseVersion: number; title?: string; description?: string | null }
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      const waypoint = assertWaypointBelongs(row, waypointId);
      if (isTerminal(waypoint))
        throw new AppError('Terminal waypoints are immutable', 409, 'WAYPOINT_TRANSITION_INVALID');
      await tx.waypoint.update({
        where: { id: waypointId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
        },
      });
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async reorderWaypoints(
    userId: string,
    courseId: string,
    input: ReorderWaypointsRequest
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      const nonTerminal = row.waypoints.filter(waypoint => !isTerminal(waypoint));
      const expected = nonTerminal.map(waypoint => waypoint.id).sort();
      const received = [...input.orderedWaypointIds].sort();
      if (
        expected.length !== received.length ||
        expected.some((id, index) => id !== received[index])
      ) {
        throw new AppError(
          'Reorder must include every non-terminal waypoint exactly once',
          422,
          'VALIDATION_ERROR'
        );
      }
      const terminal = row.waypoints.filter(waypoint => isTerminal(waypoint));
      const start = terminal.length
        ? Math.max(...terminal.map(waypoint => waypoint.position)) + 100
        : 100;
      for (const [index, id] of input.orderedWaypointIds.entries()) {
        await tx.waypoint.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of input.orderedWaypointIds.entries()) {
        await tx.waypoint.update({ where: { id }, data: { position: start + index * 100 } });
      }
      const changed = input.orderedWaypointIds.some((id, index) => nonTerminal[index]?.id !== id);
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      if (changed) {
        const from =
          nonTerminal.find(item => item.id === input.orderedWaypointIds[0])?.position ?? start;
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.WAYPOINT_REORDERED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          snapshot: { fromPosition: from, toPosition: start },
          idempotencyKey: eventKey('waypoint-reorder', `${courseId}:${row.version}`),
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async completeWaypoint(
    userId: string,
    courseId: string,
    waypointId: string,
    input: CompleteWaypointRequest
  ): Promise<CompleteWaypointResponse> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      const reachedKey = eventKey('waypoint-complete', `${input.idempotencyKey}:reached`);
      const existing = await tx.courseEvent.findUnique({ where: { idempotencyKey: reachedKey } });
      if (existing) {
        const replayRow = await findCourse(tx, userId, courseId);
        const completed = assertWaypointBelongs(replayRow, waypointId);
        const next = replayRow.currentWaypointId
          ? (replayRow.waypoints.find(item => item.id === replayRow.currentWaypointId) ?? null)
          : null;
        return {
          course: toSummary(replayRow),
          completedWaypoint: buildWaypointSummary(
            replayRow,
            completed,
            activeLinkForWaypoint(replayRow, completed.id),
            anchorFromLink(activeLinkForWaypoint(replayRow, completed.id))
          ),
          nextWaypoint: next
            ? buildWaypointSummary(
                replayRow,
                next,
                activeLinkForWaypoint(replayRow, next.id),
                anchorFromLink(activeLinkForWaypoint(replayRow, next.id))
              )
            : null,
          courseCompleted: replayRow.status === CourseStatus.COMPLETED,
          completionEventId: existing.id,
          replayed: true,
        };
      }
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseActive(row);
      ensureNoCorruption(row);
      const waypoint = assertWaypointBelongs(row, waypointId);
      if (waypoint.reachedAt)
        throw new AppError('Waypoint is already reached', 409, 'WAYPOINT_ALREADY_REACHED');
      if (isTerminal(waypoint))
        throw new AppError('Waypoint transition is invalid', 409, 'WAYPOINT_TRANSITION_INVALID');
      if (row.currentWaypointId !== waypointId)
        throw new AppError('Waypoint is not current', 409, 'WAYPOINT_NOT_CURRENT');
      const activeLink = activeLinkForWaypoint(row, waypointId);
      // The guard must read the same link the projection reads, otherwise the
      // server can refuse a transition the client was never shown as blocked
      // (or allow one it was). See D10.
      const stateLink = stateLinkForWaypoint(row, waypointId);
      const blockedReason = deriveBlockedReason(stateLink, anchorFromLink(stateLink));
      if (blockedReason) throw new AppError('Waypoint is blocked', 409, 'WAYPOINT_BLOCKED');

      if (input.supportingPracticeSessionId) {
        const session = await tx.practiceSession.findUnique({
          where: { id: input.supportingPracticeSessionId },
        });
        if (!session)
          throw new AppError(
            'Supporting practice session is invalid',
            422,
            'PRACTICE_SESSION_INVALID'
          );
        if (session.userId !== userId)
          throw new AppError(
            'Supporting practice session belongs to another account',
            403,
            'PRACTICE_SESSION_ACCOUNT_MISMATCH'
          );
        if (session.completedAt.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
          throw new AppError(
            'Supporting practice session is invalid',
            422,
            'PRACTICE_SESSION_INVALID'
          );
        }
      }

      const now = new Date();
      const next = selectNextWaypoint(row.waypoints, waypoint.position);
      const courseCompleted = !next;
      await tx.waypoint.update({
        where: { id: waypointId },
        data: {
          reachedAt: now,
          supportingPracticeSessionId: input.supportingPracticeSessionId ?? null,
        },
      });
      await tx.course.update({
        where: { id: courseId },
        data: {
          currentWaypointId: next?.id ?? null,
          ...(courseCompleted ? { status: CourseStatus.COMPLETED, completedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      const reachedEvent = await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId,
        eventType: CourseEventType.WAYPOINT_REACHED,
        sourceEntityType: 'Waypoint',
        sourceEntityId: waypointId,
        snapshot: { waypointTitle: waypoint.title },
        occurredAt: now,
        idempotencyKey: reachedKey,
      });
      let reflectionId: string | undefined;
      if (input.reflection) {
        const reflectionData = normalizeCompletionReflection(input.reflection);
        if (reflectionData) {
          const reflection = await tx.reflection.create({
            data: {
              id: randomUUID(),
              userId,
              source: 'WAYPOINT_COMPLETION',
              promptType: 'WAYPOINT_COMPLETION',
              promptVersion: input.reflection.promptVersion,
              body: null,
              structuredContent: reflectionData as Prisma.InputJsonValue,
              moodAfter: input.reflection.moodAfter ?? null,
              practiceSessionId: null,
              anchorId: activeLink?.anchorId ?? null,
              courseId,
              waypointId,
              aiConsentGrantedAt: null,
              idempotencyKey: input.reflection.idempotencyKey,
              schemaVersion: 1,
            },
          });
          reflectionId = reflection.id;
          await courseEventService.append(tx, {
            userId,
            courseId,
            waypointId,
            eventType: CourseEventType.REFLECTION_ADDED,
            sourceEntityType: 'Reflection',
            sourceEntityId: reflection.id,
            snapshot: { reflectionPromptType: 'WAYPOINT_COMPLETION' },
            occurredAt: now,
            idempotencyKey: eventKey('reflection-added', input.reflection.idempotencyKey),
          });
        }
      }
      if (courseCompleted) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.COURSE_COMPLETED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          occurredAt: now,
          idempotencyKey: eventKey('course-completed', input.idempotencyKey),
        });
      }
      const updated = await findCourse(tx, userId, courseId);
      const completed = assertWaypointBelongs(updated, waypointId);
      const nextSummary = next
        ? buildWaypointSummary(
            updated,
            assertWaypointBelongs(updated, next.id),
            activeLinkForWaypoint(updated, next.id),
            anchorFromLink(activeLinkForWaypoint(updated, next.id))
          )
        : null;
      return {
        course: toSummary(updated),
        completedWaypoint: buildWaypointSummary(
          updated,
          completed,
          activeLinkForWaypoint(updated, completed.id),
          anchorFromLink(activeLinkForWaypoint(updated, completed.id))
        ),
        nextWaypoint: nextSummary,
        courseCompleted,
        completionEventId: reachedEvent.id,
        replayed: false,
        ...(reflectionId ? { reflectionId } : {}),
      };
    });
  }

  async skipWaypoint(
    userId: string,
    courseId: string,
    waypointId: string,
    input: SkipWaypointRequest
  ): Promise<CourseDetail> {
    return this.transitionWaypoint(
      userId,
      courseId,
      waypointId,
      input.expectedCourseVersion,
      input.idempotencyKey,
      'SKIPPED'
    );
  }

  async cancelWaypoint(
    userId: string,
    courseId: string,
    waypointId: string,
    input: CancelWaypointRequest
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      const waypoint = assertWaypointBelongs(row, waypointId);
      const eventKeyValue = eventKey('waypoint-cancelled', input.idempotencyKey);
      const existing = await tx.courseEvent.findUnique({
        where: { idempotencyKey: eventKeyValue },
      });
      if (existing) {
        if (
          existing.userId !== userId ||
          existing.courseId !== courseId ||
          existing.waypointId !== waypointId ||
          existing.eventType !== CourseEventType.WAYPOINT_CANCELLED
        ) {
          throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
        }
        return projection(await findCourse(tx, userId, courseId));
      }

      // findCourse scopes by authenticated ownership before any state mutation.
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseActive(row);
      ensureNoCorruption(row);
      if (row.currentWaypointId === waypointId) {
        throw new AppError(
          'Current waypoints cannot be cancelled',
          409,
          'WAYPOINT_TRANSITION_INVALID'
        );
      }
      if (isTerminal(waypoint)) {
        throw new AppError(
          'Terminal waypoints cannot be cancelled',
          409,
          'WAYPOINT_TRANSITION_INVALID'
        );
      }

      const now = new Date();
      await tx.waypoint.update({
        where: { id: waypointId },
        data: { cancelledAt: now },
      });
      await tx.course.update({
        where: { id: courseId },
        data: { version: { increment: 1 } },
      });
      await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId,
        eventType: CourseEventType.WAYPOINT_CANCELLED,
        sourceEntityType: 'Waypoint',
        sourceEntityId: waypointId,
        snapshot: { waypointTitle: waypoint.title },
        occurredAt: now,
        idempotencyKey: eventKeyValue,
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  private async transitionWaypoint(
    userId: string,
    courseId: string,
    waypointId: string,
    expectedVersion: number,
    idempotencyKey: string,
    transition: 'SKIPPED'
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      const eventType =
        transition === 'SKIPPED'
          ? CourseEventType.WAYPOINT_SKIPPED
          : CourseEventType.WAYPOINT_REACHED;
      const eventKeyValue = eventKey('waypoint-transition', idempotencyKey);
      const existing = await tx.courseEvent.findUnique({
        where: { idempotencyKey: eventKeyValue },
      });
      if (existing) return projection(await findCourse(tx, userId, courseId));
      assertExpectedVersion(row, expectedVersion);
      assertCourseActive(row);
      ensureNoCorruption(row);
      const waypoint = assertWaypointBelongs(row, waypointId);
      if (isTerminal(waypoint))
        throw new AppError('Waypoint transition is invalid', 409, 'WAYPOINT_TRANSITION_INVALID');
      if (row.currentWaypointId !== waypointId)
        throw new AppError('Waypoint is not current', 409, 'WAYPOINT_NOT_CURRENT');
      const skipStateLink = stateLinkForWaypoint(row, waypointId);
      const blockedReason = deriveBlockedReason(skipStateLink, anchorFromLink(skipStateLink));
      if (blockedReason) throw new AppError('Waypoint is blocked', 409, 'WAYPOINT_BLOCKED');
      const next = selectNextWaypoint(row.waypoints, waypoint.position);
      const completed = !next;
      const now = new Date();
      await tx.waypoint.update({ where: { id: waypointId }, data: { skippedAt: now } });
      await tx.course.update({
        where: { id: courseId },
        data: {
          currentWaypointId: next?.id ?? null,
          ...(completed ? { status: CourseStatus.COMPLETED, completedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId,
        eventType,
        sourceEntityType: 'Waypoint',
        sourceEntityId: waypointId,
        snapshot: { waypointTitle: waypoint.title },
        occurredAt: now,
        idempotencyKey: eventKeyValue,
      });
      if (completed) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.COURSE_COMPLETED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          occurredAt: now,
          idempotencyKey: eventKey('course-completed', idempotencyKey),
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async linkAnchor(
    userId: string,
    courseId: string,
    input: LinkAnchorRequest
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      ensureNoCorruption(row);
      const waypoint =
        input.role === CourseAnchorRole.WAYPOINT_PRIMARY
          ? assertWaypointBelongs(row, input.waypointId ?? '')
          : null;
      if (input.role === CourseAnchorRole.DESTINATION && input.waypointId)
        throw new AppError(
          'Destination links cannot specify a waypoint',
          422,
          'ANCHOR_LINK_INVALID'
        );
      if (input.role === CourseAnchorRole.WAYPOINT_PRIMARY && !input.waypointId)
        throw new AppError('Waypoint links require a waypoint', 422, 'ANCHOR_LINK_INVALID');
      const anchor = await tx.anchor.findFirst({
        where: { id: input.anchorId, userId },
        select: {
          id: true,
          isArchived: true,
          intentionText: true,
          category: true,
          planetaryTier: true,
          enhancedImageUrl: true,
        },
      });
      if (!anchor) throw new AppError('Anchor link is invalid', 422, 'ANCHOR_LINK_INVALID');
      if (anchor.isArchived) throw new AppError('Anchor is unavailable', 409, 'ANCHOR_UNAVAILABLE');
      const activeLink =
        input.role === CourseAnchorRole.DESTINATION
          ? activeDestinationLink(row)
          : activeLinkForWaypoint(row, input.waypointId!);
      if (activeLink && activeLink.id !== input.replaceLinkId)
        throw new AppError(
          'An active link already exists; use replacement',
          422,
          'ANCHOR_LINK_INVALID'
        );
      if (input.replaceLinkId && (!activeLink || activeLink.id !== input.replaceLinkId))
        throw new AppError('Anchor link is invalid', 422, 'ANCHOR_LINK_INVALID');
      // WAYPOINT_UNBLOCKED may only be emitted where a WAYPOINT_BLOCKED could
      // have been: on the current waypoint, and only when a prior link exists to
      // have been broken. Deriving this from the active link alone made the
      // first-ever link on a current waypoint log "Waypoint is available again."
      // for a waypoint that was never blocked. See D10.
      const priorStateLink = waypoint ? stateLinkForWaypoint(row, waypoint.id) : null;
      const wasBlocked =
        waypoint !== null &&
        row.currentWaypointId === waypoint.id &&
        deriveBlockedReason(priorStateLink, anchorFromLink(priorStateLink)) !== null;
      if (input.replaceLinkId && activeLink) {
        const oldAnchor = activeLink.anchor;
        await tx.courseAnchorLink.update({
          where: { id: activeLink.id },
          data: {
            unlinkedAt: new Date(),
            anchorSnapshot: buildAnchorSnapshot(
              oldAnchor ?? {
                id: activeLink.anchorId ?? '',
                intentionText: '',
                category: '',
                planetaryTier: null,
                enhancedImageUrl: null,
              },
              !oldAnchor || oldAnchor.isArchived
            ) as Prisma.InputJsonValue,
          },
        });
      }
      const link = await tx.courseAnchorLink.create({
        data: {
          id: randomUUID(),
          userId,
          courseId,
          waypointId: waypoint?.id ?? null,
          anchorId: anchor.id,
          role: input.role,
          anchorSnapshot: buildAnchorSnapshot(anchor, false) as Prisma.InputJsonValue,
        },
      });
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId: waypoint?.id ?? null,
        eventType:
          input.role === CourseAnchorRole.DESTINATION
            ? CourseEventType.DESTINATION_ANCHOR_LINKED
            : CourseEventType.WAYPOINT_ANCHOR_LINKED,
        sourceEntityType: 'CourseAnchorLink',
        sourceEntityId: link.id,
        snapshot: { anchorRole: input.role },
        idempotencyKey: eventKey('anchor-link', input.idempotencyKey),
      });
      if (wasBlocked && waypoint) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          waypointId: waypoint.id,
          eventType: CourseEventType.WAYPOINT_UNBLOCKED,
          sourceEntityType: 'CourseAnchorLink',
          sourceEntityId: link.id,
          idempotencyKey: eventKey('waypoint-unblocked', input.idempotencyKey),
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async unlinkAnchor(
    userId: string,
    courseId: string,
    linkId: string,
    expectedCourseVersion: number
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, expectedCourseVersion);
      assertCourseWritable(row);
      const link = row.anchorLinks.find(item => item.id === linkId && item.unlinkedAt === null);
      if (!link) throw new AppError('Anchor link is invalid', 422, 'ANCHOR_LINK_INVALID');
      const released = !link.anchor || link.anchor.isArchived;
      await tx.courseAnchorLink.update({
        where: { id: link.id },
        data: {
          unlinkedAt: new Date(),
          anchorSnapshot: buildAnchorSnapshot(
            link.anchor ?? {
              id: link.anchorId ?? '',
              intentionText: '',
              category: '',
              planetaryTier: null,
              enhancedImageUrl: null,
            },
            released
          ) as Prisma.InputJsonValue,
        },
      });
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      if (link.waypointId === row.currentWaypointId) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          waypointId: link.waypointId,
          eventType: CourseEventType.WAYPOINT_BLOCKED,
          sourceEntityType: 'CourseAnchorLink',
          sourceEntityId: link.id,
          snapshot: { blockedReason: released ? 'ANCHOR_RELEASED' : 'ANCHOR_UNLINKED' },
          idempotencyKey: eventKey('anchor-unlink-blocked', `${link.id}:${row.version}`),
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async closeLinksForUnavailableAnchor(
    tx: TxClient,
    userId: string,
    anchorId: string,
    blockedReason: BlockedReason = 'ANCHOR_RELEASED'
  ): Promise<void> {
    const links = await tx.courseAnchorLink.findMany({
      where: { userId, anchorId, unlinkedAt: null },
      include: {
        anchor: {
          select: {
            id: true,
            intentionText: true,
            category: true,
            planetaryTier: true,
            enhancedImageUrl: true,
            isArchived: true,
          },
        },
        course: { select: { id: true, currentWaypointId: true, version: true } },
      },
    });
    const now = new Date();
    const affectedCourses = new Map<string, typeof links>();
    for (const link of links) {
      await tx.courseAnchorLink.update({
        where: { id: link.id },
        data: {
          unlinkedAt: now,
          anchorSnapshot: buildAnchorSnapshot(
            link.anchor ?? {
              id: anchorId,
              intentionText: '',
              category: '',
              planetaryTier: null,
              enhancedImageUrl: null,
            },
            true
          ) as Prisma.InputJsonValue,
        },
      });
      const courseLinks = affectedCourses.get(link.courseId) ?? [];
      courseLinks.push(link);
      affectedCourses.set(link.courseId, courseLinks);
    }

    for (const [courseId, courseLinks] of affectedCourses) {
      for (const link of courseLinks) {
        if (link.waypointId && link.course.currentWaypointId === link.waypointId) {
          await courseEventService.append(tx, {
            userId,
            courseId,
            waypointId: link.waypointId,
            eventType: CourseEventType.WAYPOINT_BLOCKED,
            sourceEntityType: 'CourseAnchorLink',
            sourceEntityId: link.id,
            snapshot: { blockedReason },
            idempotencyKey: eventKey('anchor-release-blocked', link.id),
          });
        }
      }
      await tx.course.update({
        where: { id: courseId },
        data: { version: { increment: 1 } },
      });
    }
  }

  async listLog(
    userId: string,
    courseId: string,
    limit: number,
    cursor?: string
  ): Promise<{
    data: CourseLogEntry[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }> {
    await findCourse(prisma, userId, courseId);
    const events = await prisma.courseEvent.findMany({
      where: { userId, courseId },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;
    const reflectionIds = page
      .filter(event => event.sourceEntityType === 'Reflection')
      .map(event => event.sourceEntityId)
      .filter((id): id is string => Boolean(id));
    const sessionIds = page
      .filter(event => event.sourceEntityType === 'PracticeSession')
      .map(event => event.sourceEntityId)
      .filter((id): id is string => Boolean(id));
    const linkIds = page
      .filter(event => event.sourceEntityType === 'CourseAnchorLink')
      .map(event => event.sourceEntityId)
      .filter((id): id is string => Boolean(id));
    const [reflections, sessions, links] = await Promise.all([
      reflectionIds.length
        ? prisma.reflection.findMany({ where: { userId, id: { in: reflectionIds } } })
        : [],
      sessionIds.length
        ? prisma.practiceSession.findMany({
            where: { userId, id: { in: sessionIds } },
            select: { id: true, practiceMode: true, completedDurationSeconds: true },
          })
        : [],
      linkIds.length
        ? prisma.courseAnchorLink.findMany({
            where: { userId, id: { in: linkIds } },
            select: {
              id: true,
              role: true,
              anchorId: true,
              anchorSnapshot: true,
              linkedAt: true,
              unlinkedAt: true,
              anchor: { select: { id: true, isArchived: true } },
            },
          })
        : [],
    ]);
    const reflectionById = new Map(reflections.map(reflection => [reflection.id, reflection]));
    const sessionById = new Map(sessions.map(session => [session.id, session]));
    const linkById = new Map(links.map(link => [link.id, link]));
    const data: CourseLogEntry[] = page.map(event => {
      const reflection =
        event.sourceEntityId && event.sourceEntityType === 'Reflection'
          ? reflectionById.get(event.sourceEntityId)
          : undefined;
      const session =
        event.sourceEntityId && event.sourceEntityType === 'PracticeSession'
          ? sessionById.get(event.sourceEntityId)
          : undefined;
      const anchorLink =
        event.sourceEntityId && event.sourceEntityType === 'CourseAnchorLink'
          ? linkById.get(event.sourceEntityId)
          : undefined;
      return {
        id: event.id,
        eventType: event.eventType,
        message: COURSE_EVENT_MESSAGES[event.eventType],
        waypointId: event.waypointId,
        occurredAt: event.occurredAt.toISOString(),
        recordedAt: event.recordedAt.toISOString(),
        snapshot: isSafeSnapshot(event.snapshot) ? event.snapshot : null,
        reflection:
          reflection && !reflection.deletedAt
            ? {
                id: reflection.id,
                promptType: reflection.promptType,
                body: reflection.body,
                structuredContent: (reflection.structuredContent as object | null) ?? null,
                moodAfter: reflection.moodAfter,
              }
            : null,
        practiceSession: session ?? null,
        anchorLink: anchorLink ? toAnchorLinkSummary(anchorLink, anchorLink.anchor) : null,
      };
    });
    return {
      data,
      pagination: { nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore },
    };
  }

  private async buildObservations(userId: string, row: CourseRow): Promise<CourseObservation[]> {
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [sessions, reflections] = await Promise.all([
      prisma.practiceSession.findMany({
        where: { userId, courseId: row.id, completedAt: { gte: sinceMonth } },
        select: { waypointId: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 500,
      }),
      prisma.reflection.findMany({
        where: { userId, courseId: row.id, deletedAt: null, createdAt: { gte: sinceMonth } },
        select: { body: true, structuredContent: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);
    const observations: CourseObservation[] = [];
    const current = row.currentWaypointId
      ? row.waypoints.find(waypoint => waypoint.id === row.currentWaypointId)
      : null;
    if (current) {
      const weekCount = sessions.filter(
        session => session.waypointId === current.id && session.completedAt >= sinceWeek
      ).length;
      if (weekCount >= 2)
        observations.push({
          type: 'PRACTICE_COUNT_WEEK',
          text: `You completed ${weekCount} practices for this waypoint this week.`,
        });
      const durationDays = Math.floor(
        (Date.now() - current.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (durationDays >= 21)
        observations.push({
          type: 'WAYPOINT_DURATION',
          text: `You've been at this waypoint since ${current.updatedAt.toISOString().slice(0, 10)}.`,
        });
    }
    const uniqueDays = new Set(
      sessions.map(session => session.completedAt.toISOString().slice(0, 10))
    );
    let streak = 0;
    for (let index = 0; index < 31; index += 1) {
      const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!uniqueDays.has(date)) break;
      streak += 1;
    }
    if (streak >= 3)
      observations.push({
        type: 'PRACTICE_STREAK',
        text: `You've kept the thread ${streak} days running.`,
      });
    if (sessions.length >= 5 && reflections.length === 0)
      observations.push({
        type: 'REFLECTION_GAP',
        text: `You've practiced ${sessions.length} times here without writing anything down.`,
      });
    const reflectionTexts = reflections.map(reflection => {
      const structured = reflection.structuredContent as {
        whatHelped?: unknown;
        whatLearned?: unknown;
      } | null;
      return [
        reflection.body,
        typeof structured?.whatHelped === 'string' ? structured.whatHelped : null,
        typeof structured?.whatLearned === 'string' ? structured.whatLearned : null,
      ]
        .filter(Boolean)
        .join(' ');
    });
    const words = new Map<string, Set<number>>();
    reflectionTexts.forEach((text, index) => {
      const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 4 && !STOP_WORDS.has(word));
      const candidates = new Set(tokens);
      for (let tokenIndex = 0; tokenIndex < tokens.length - 1; tokenIndex += 1) {
        candidates.add(`${tokens[tokenIndex]} ${tokens[tokenIndex + 1]}`);
      }
      for (const candidate of candidates) {
        const set = words.get(candidate) ?? new Set<number>();
        set.add(index);
        words.set(candidate, set);
      }
    });
    const theme = [...words.entries()]
      .sort(([left], [right]) => Number(right.includes(' ')) - Number(left.includes(' ')))
      .find(([, indexes]) => indexes.size >= 3);
    if (theme)
      observations.push({
        type: 'THEME_REPEAT',
        text: `You've mentioned ${theme[0]} in ${theme[1].size} reflections this month.`,
      });
    return observations.slice(0, 2);
  }
}

function normalizeCompletionReflection(
  input: NonNullable<CompleteWaypointRequest['reflection']>
): { whatHelped?: string; whatLearned?: string } | null {
  const content = input.structuredContent;
  if (!content) return null;
  const whatHelped = content.whatHelped?.trim().slice(0, 1000);
  const whatLearned = content.whatLearned?.trim().slice(0, 1000);
  if (!whatHelped && !whatLearned) return null;
  return {
    ...(whatHelped ? { whatHelped } : {}),
    ...(whatLearned ? { whatLearned } : {}),
  };
}

function isSafeSnapshot(value: unknown): value is Record<string, string | number> | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every(key =>
    [
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
    ].includes(key)
  );
}

const STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'been',
  'your',
  'you',
  'they',
  'them',
  'what',
  'when',
  'where',
  'which',
  'will',
  'would',
  'could',
  'should',
  'into',
  'about',
  'after',
  'before',
  'there',
  'their',
  'just',
  'more',
  'some',
  'like',
  'felt',
  'feel',
  'were',
]);

export const courseService = new CourseService();
