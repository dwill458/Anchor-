import { randomUUID } from 'crypto';
import { CourseAnchorRole, CourseEventType, CourseStatus, Prisma } from '@prisma/client';
import { AppError } from '../../api/middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { courseEventService } from '../CourseEventService';
import {
  MAX_COURSE_WAYPOINTS,
  appendChartLedgerEvent,
  assertCourseActive,
  assertCourseWritable,
  assertExpectedVersion,
  assertWaypointBelongs,
  buildAnchorSnapshot,
  ensureNoCorruption,
  eventKey,
  findCourse,
  isUniqueViolation,
  projection,
  runSerializable,
  selectNextActiveMove,
  toSummary,
  waypointMetricCreateData,
  waypointMetricData,
  type CourseRow,
} from '../CourseService';
import { isTerminal } from '../WaypointStateService';
import type { CourseDetail, CourseSummary } from '../../types/chart';

type Tx = Prisma.TransactionClient;

export type RouteWaypointInput = {
  /** Present when the waypoint already exists on the Chart. */
  id?: string | null;
  title: string;
  rationale?: string | null;
  kind?: 'MILESTONE' | 'METRIC' | 'CAPABILITY';
  metricLabel?: string | null;
  metricBaseline?: number | null;
  metricTarget?: number | null;
};

export type ChartAnchorSummary = {
  id: string;
  intentionText: string;
  category: string;
  enhancedImageUrl: string | null;
  released: boolean;
};

export type ChartForAnchor = {
  anchor: ChartAnchorSummary;
  /** The live route (ACTIVE), or the most recent reached one (COMPLETED). */
  chart: CourseDetail | null;
  /** Earlier routes for this Anchor, newest first. Read-only history. */
  history: CourseSummary[];
  stats: {
    completedMoveCount: number;
    practiceCount: number;
  } | null;
};

export type MoveCompletionResult = {
  chart: CourseDetail;
  completedMoveId: string;
  nextMoveId: string | null;
  replayed: boolean;
};

function cleanTitle(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanOptional(value: string | null | undefined, max: number): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function validateRoute(waypoints: RouteWaypointInput[], min: number): void {
  if (waypoints.length < min) {
    throw new AppError('A route needs at least one waypoint', 422, 'VALIDATION_ERROR');
  }
  if (waypoints.length > MAX_COURSE_WAYPOINTS) {
    throw new AppError(
      `A route may contain at most ${MAX_COURSE_WAYPOINTS} waypoints`,
      400,
      'VALIDATION_ERROR'
    );
  }
  for (const waypoint of waypoints) {
    if (!cleanTitle(waypoint.title, 60)) {
      throw new AppError('Every waypoint needs a title', 422, 'VALIDATION_ERROR');
    }
    if (
      waypoint.metricTarget !== undefined &&
      waypoint.metricTarget !== null &&
      !(Number.isFinite(waypoint.metricTarget) && waypoint.metricTarget > 0)
    ) {
      throw new AppError('Metric targets must be positive numbers', 422, 'VALIDATION_ERROR');
    }
  }
}

function metricInput(waypoint: RouteWaypointInput) {
  return {
    kind: waypoint.kind,
    metricLabel: waypoint.metricLabel,
    metricBaseline: waypoint.metricBaseline,
    metricTarget: waypoint.metricTarget,
  };
}

async function loadOwnedAnchor(client: Tx | typeof prisma, userId: string, anchorId: string) {
  const anchor = await client.anchor.findFirst({
    where: { id: anchorId, userId },
    select: {
      id: true,
      intentionText: true,
      category: true,
      planetaryTier: true,
      enhancedImageUrl: true,
      releasedAt: true,
      isArchived: true,
    },
  });
  if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
  return anchor;
}

async function nextMovePosition(tx: Tx, waypointId: string): Promise<number> {
  const last = await tx.move.findFirst({
    where: { waypointId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? 0) + 100;
}

export class ChartService {
  async getChartForAnchor(userId: string, anchorId: string): Promise<ChartForAnchor> {
    const anchor = await loadOwnedAnchor(prisma, userId, anchorId);
    const courses = await prisma.course.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: [CourseStatus.ACTIVE, CourseStatus.COMPLETED, CourseStatus.ARCHIVED] },
        OR: [
          { anchorId },
          // Pre-2.0 Courses reached their Anchor only through a DESTINATION link.
          { anchorId: null, anchorLinks: { some: { anchorId, role: CourseAnchorRole.DESTINATION } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, status: true, completedAt: true, archivedAt: true, updatedAt: true },
    });
    const live =
      courses.find(course => course.status === CourseStatus.ACTIVE) ??
      courses
        .filter(course => course.status === CourseStatus.COMPLETED)
        .sort((left, right) => (right.completedAt?.getTime() ?? 0) - (left.completedAt?.getTime() ?? 0))[0] ??
      null;

    let chart: CourseDetail | null = null;
    let stats: ChartForAnchor['stats'] = null;
    if (live) {
      chart = projection(await findCourse(prisma, userId, live.id));
      const [completedMoveCount, practiceCount] = await Promise.all([
        prisma.move.count({ where: { courseId: live.id, status: 'COMPLETED' } }),
        prisma.practiceSession.count({
          where: { userId, anchorId, completedAt: { gte: new Date(chart.plottedAt) } },
        }),
      ]);
      stats = { completedMoveCount, practiceCount };
    }
    const historyIds = courses.filter(course => course.id !== live?.id).map(course => course.id);
    const history = historyIds.length
      ? await Promise.all(historyIds.slice(0, 10).map(async id => toSummary(await findCourse(prisma, userId, id))))
      : [];
    return {
      anchor: {
        id: anchor.id,
        intentionText: anchor.intentionText,
        category: anchor.category,
        enhancedImageUrl: anchor.enhancedImageUrl,
        released: Boolean(anchor.releasedAt || anchor.isArchived),
      },
      chart,
      history,
      stats,
    };
  }

  /**
   * Saves a reviewed route as the Anchor's live Chart in one transaction:
   * Course (ACTIVE) + waypoints + DESTINATION link + optional One Move.
   * Replaying the same idempotency key returns the original Chart.
   */
  async createChart(
    userId: string,
    input: {
      anchorId: string;
      idempotencyKey: string;
      destinationText: string;
      startingContext?: string | null;
      proposalId?: string | null;
      complexity?: string | null;
      waypoints: RouteWaypointInput[];
      oneMove?: { title: string; rationale?: string | null } | null;
    }
  ): Promise<CourseDetail> {
    const destinationText = cleanTitle(input.destinationText, 140);
    if (!destinationText) throw new AppError('A destination is required', 422, 'VALIDATION_ERROR');
    validateRoute(input.waypoints, 1);

    const existing = await prisma.course.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, userId: true },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
      }
      return projection(await findCourse(prisma, userId, existing.id));
    }

    try {
      return await runSerializable(async tx => {
        const anchor = await loadOwnedAnchor(tx, userId, input.anchorId);
        if (anchor.releasedAt || anchor.isArchived) {
          throw new AppError('This Anchor has been released', 409, 'ANCHOR_UNAVAILABLE');
        }
        const active = await tx.course.findFirst({
          where: { userId, anchorId: anchor.id, status: CourseStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        });
        if (active) {
          throw new AppError('This Anchor already has a Chart', 409, 'ACTIVE_COURSE_EXISTS', {
            courseId: active.id,
          });
        }
        const vision = await tx.vision.findFirst({
          where: { anchorId: anchor.id, userId, status: 'ACTIVE' },
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
        });

        const courseId = randomUUID();
        await tx.course.create({
          data: {
            id: courseId,
            userId,
            anchorId: anchor.id,
            visionId: vision?.id ?? null,
            destinationText,
            startingContext: cleanOptional(input.startingContext, 500),
            complexity: cleanOptional(input.complexity, 16),
            idempotencyKey: input.idempotencyKey,
            createdFromProposalId: input.proposalId ?? null,
            schemaVersion: 1,
          },
        });

        const waypointIds: string[] = [];
        for (const [index, waypoint] of input.waypoints.entries()) {
          const id = randomUUID();
          waypointIds.push(id);
          await tx.waypoint.create({
            data: {
              id,
              userId,
              courseId,
              position: (index + 1) * 100,
              title: cleanTitle(waypoint.title, 60),
              description: cleanOptional(waypoint.rationale, 400),
              ...waypointMetricCreateData(metricInput(waypoint)),
            },
          });
        }

        let oneMoveId: string | null = null;
        const oneMoveTitle = input.oneMove ? cleanTitle(input.oneMove.title, 120) : '';
        if (oneMoveTitle) {
          oneMoveId = randomUUID();
          await tx.move.create({
            data: {
              id: oneMoveId,
              userId,
              courseId,
              waypointId: waypointIds[0],
              title: oneMoveTitle,
              rationale: cleanOptional(input.oneMove?.rationale, 280),
              source: input.proposalId ? 'AI' : 'USER',
              status: 'ACTIVE',
              position: 100,
            },
          });
        }

        await tx.course.update({
          where: { id: courseId },
          data: {
            status: CourseStatus.ACTIVE,
            currentWaypointId: waypointIds[0],
            currentMoveId: oneMoveId,
          },
        });
        await tx.courseAnchorLink.create({
          data: {
            userId,
            courseId,
            anchorId: anchor.id,
            role: CourseAnchorRole.DESTINATION,
            anchorSnapshot: buildAnchorSnapshot(anchor, false) as unknown as Prisma.InputJsonValue,
          },
        });
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.COURSE_CREATED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          snapshot: { waypointCount: waypointIds.length },
          idempotencyKey: eventKey('chart-created', input.idempotencyKey),
        });
        for (const [index, id] of waypointIds.entries()) {
          await courseEventService.append(tx, {
            userId,
            courseId,
            waypointId: id,
            eventType: CourseEventType.WAYPOINT_ADDED,
            sourceEntityType: 'Waypoint',
            sourceEntityId: id,
            snapshot: { waypointTitle: cleanTitle(input.waypoints[index].title, 60) },
            idempotencyKey: eventKey(`chart-waypoint:${id}`, input.idempotencyKey),
          });
        }
        if (input.proposalId) {
          await tx.aIPlanProposal.updateMany({
            where: { id: input.proposalId, userId, status: 'PENDING' },
            data: { status: 'ACCEPTED', acceptedAt: new Date(), courseId },
          });
        }
        return projection(await findCourse(tx, userId, courseId));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Either the idempotency key raced (replay) or another request created
        // the Anchor's Chart first. Both resolve to the persisted Chart.
        const replay = await prisma.course.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true, userId: true },
        });
        if (replay?.userId === userId) return projection(await findCourse(prisma, userId, replay.id));
        throw new AppError('This Anchor already has a Chart', 409, 'ACTIVE_COURSE_EXISTS');
      }
      throw error;
    }
  }

  // ─── Moves ────────────────────────────────────────────────────────────────

  async addMove(
    userId: string,
    courseId: string,
    input: {
      waypointId: string;
      title: string;
      rationale?: string | null;
      source?: 'AI' | 'USER';
      /** SUGGESTED keeps an AI idea out of the user's commitments until accepted. */
      status?: 'SUGGESTED' | 'ACTIVE';
      makeCurrent?: boolean;
      idempotencyKey: string;
    }
  ): Promise<CourseDetail> {
    const title = cleanTitle(input.title, 120);
    if (!title) throw new AppError('A Move needs a title', 422, 'VALIDATION_ERROR');
    return runSerializable(async tx => {
      const replay = await tx.move.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) {
        if (replay.userId !== userId) {
          throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
        }
        return projection(await findCourse(tx, userId, courseId));
      }
      const row = await findCourse(tx, userId, courseId);
      assertCourseActive(row);
      const waypoint = assertWaypointBelongs(row, input.waypointId);
      if (isTerminal(waypoint)) {
        throw new AppError('This waypoint is already behind you', 409, 'WAYPOINT_TRANSITION_INVALID');
      }
      const status = input.status ?? 'ACTIVE';
      const moveId = randomUUID();
      await tx.move.create({
        data: {
          id: moveId,
          userId,
          courseId,
          waypointId: waypoint.id,
          title,
          rationale: cleanOptional(input.rationale, 280),
          source: input.source ?? 'USER',
          status,
          position: await nextMovePosition(tx, waypoint.id),
          idempotencyKey: input.idempotencyKey,
        },
      });
      const becomesCurrent =
        status === 'ACTIVE' &&
        waypoint.id === row.currentWaypointId &&
        (input.makeCurrent || !row.currentMoveId);
      await tx.course.update({
        where: { id: courseId },
        data: { version: { increment: 1 }, ...(becomesCurrent ? { currentMoveId: moveId } : {}) },
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  /** Persists AI suggestions for a waypoint, replacing earlier unaccepted ones. */
  async replaceSuggestedMoves(
    userId: string,
    courseId: string,
    waypointId: string,
    moves: Array<{ title: string; rationale: string | null }>
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertCourseActive(row);
      const waypoint = assertWaypointBelongs(row, waypointId);
      if (isTerminal(waypoint)) {
        throw new AppError('This waypoint is already behind you', 409, 'WAYPOINT_TRANSITION_INVALID');
      }
      const now = new Date();
      await tx.move.updateMany({
        where: { courseId, waypointId, status: 'SUGGESTED' },
        data: { status: 'DISMISSED', dismissedAt: now },
      });
      let position = await nextMovePosition(tx, waypointId);
      for (const move of moves) {
        await tx.move.create({
          data: {
            userId,
            courseId,
            waypointId,
            title: cleanTitle(move.title, 120),
            rationale: cleanOptional(move.rationale, 280),
            source: 'AI',
            status: 'SUGGESTED',
            position,
          },
        });
        position += 100;
      }
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async updateMove(
    userId: string,
    courseId: string,
    moveId: string,
    input: { title?: string; rationale?: string | null; accept?: boolean; makeCurrent?: boolean }
  ): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertCourseActive(row);
      const move = row.moves.find(item => item.id === moveId);
      if (!move) throw new AppError('Move not found', 404, 'MOVE_NOT_FOUND');
      if (move.status === 'COMPLETED' || move.status === 'DISMISSED') {
        throw new AppError('This Move can no longer be changed', 409, 'MOVE_TRANSITION_INVALID');
      }
      const title = input.title !== undefined ? cleanTitle(input.title, 120) : undefined;
      if (title === '') throw new AppError('A Move needs a title', 422, 'VALIDATION_ERROR');
      const status = input.accept ? 'ACTIVE' : move.status;
      await tx.move.update({
        where: { id: moveId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(input.rationale !== undefined ? { rationale: cleanOptional(input.rationale, 280) } : {}),
          status,
        },
      });
      const onCurrentWaypoint = move.waypointId === row.currentWaypointId;
      const becomesCurrent =
        status === 'ACTIVE' && onCurrentWaypoint && (input.makeCurrent || !row.currentMoveId);
      await tx.course.update({
        where: { id: courseId },
        data: { version: { increment: 1 }, ...(becomesCurrent ? { currentMoveId: moveId } : {}) },
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  async dismissMove(userId: string, courseId: string, moveId: string): Promise<CourseDetail> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertCourseActive(row);
      const move = row.moves.find(item => item.id === moveId);
      if (!move) throw new AppError('Move not found', 404, 'MOVE_NOT_FOUND');
      if (move.status === 'COMPLETED') {
        throw new AppError('Completed Moves are part of your history', 409, 'MOVE_TRANSITION_INVALID');
      }
      if (move.status !== 'DISMISSED') {
        await tx.move.update({ where: { id: moveId }, data: { status: 'DISMISSED', dismissedAt: new Date() } });
      }
      const replacement =
        row.currentMoveId === moveId ? selectNextActiveMove(row.moves, row.currentWaypointId, moveId) : undefined;
      await tx.course.update({
        where: { id: courseId },
        data: {
          version: { increment: 1 },
          ...(replacement !== undefined ? { currentMoveId: replacement?.id ?? null } : {}),
        },
      });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  /**
   * Completes a Move. Idempotent: completing an already-completed Move returns
   * the current Chart without new events, so double taps cannot duplicate
   * Progress evidence. Never completes the waypoint.
   */
  async completeMove(userId: string, courseId: string, moveId: string): Promise<MoveCompletionResult> {
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      const move = row.moves.find(item => item.id === moveId);
      if (!move) throw new AppError('Move not found', 404, 'MOVE_NOT_FOUND');
      if (move.status === 'COMPLETED') {
        return {
          chart: projection(row),
          completedMoveId: moveId,
          nextMoveId: row.currentMoveId,
          replayed: true,
        };
      }
      assertCourseActive(row);
      if (move.status === 'DISMISSED') {
        throw new AppError('This Move was removed', 409, 'MOVE_TRANSITION_INVALID');
      }
      const now = new Date();
      await tx.move.update({ where: { id: moveId }, data: { status: 'COMPLETED', completedAt: now } });
      const wasCurrent = row.currentMoveId === moveId;
      const nextMove = wasCurrent ? selectNextActiveMove(row.moves, row.currentWaypointId, moveId) : null;
      await tx.course.update({
        where: { id: courseId },
        data: {
          version: { increment: 1 },
          ...(wasCurrent ? { currentMoveId: nextMove?.id ?? null } : {}),
        },
      });
      const event = await courseEventService.append(tx, {
        userId,
        courseId,
        waypointId: move.waypointId,
        eventType: CourseEventType.MOVE_COMPLETED,
        sourceEntityType: 'Move',
        sourceEntityId: moveId,
        snapshot: { moveTitle: move.title.slice(0, 120) },
        occurredAt: now,
        idempotencyKey: eventKey('move-completed', moveId),
      });
      await appendChartLedgerEvent(tx, {
        userId,
        anchorId: row.anchorId,
        eventType: 'ONE_MOVE_COMPLETED',
        significance: 'LOW',
        courseEventId: event.id,
        courseId,
        occurredAt: now,
        metadata: { courseId, moveId, moveTitle: move.title.slice(0, 120), waypointId: move.waypointId },
      });
      return {
        chart: projection(await findCourse(tx, userId, courseId)),
        completedMoveId: moveId,
        nextMoveId: wasCurrent ? (nextMove?.id ?? null) : row.currentMoveId,
        replayed: false,
      };
    });
  }

  // ─── Waypoints ─────────────────────────────────────────────────────────────

  async updateWaypointProgress(
    userId: string,
    courseId: string,
    waypointId: string,
    input: { expectedCourseVersion: number; metricCurrent: number | null }
  ): Promise<CourseDetail> {
    if (input.metricCurrent !== null && !(Number.isFinite(input.metricCurrent) && input.metricCurrent >= 0)) {
      throw new AppError('Progress must be zero or more', 422, 'VALIDATION_ERROR');
    }
    return runSerializable(async tx => {
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseActive(row);
      const waypoint = assertWaypointBelongs(row, waypointId);
      if (isTerminal(waypoint)) {
        throw new AppError('This waypoint is already behind you', 409, 'WAYPOINT_TRANSITION_INVALID');
      }
      if (waypoint.metricTarget === null) {
        throw new AppError('This waypoint has no measure', 422, 'VALIDATION_ERROR');
      }
      await tx.waypoint.update({ where: { id: waypointId }, data: { metricCurrent: input.metricCurrent } });
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
      return projection(await findCourse(tx, userId, courseId));
    });
  }

  /**
   * Replaces the route AHEAD of the user. Reached waypoints are history and
   * are never touched. Removing the current waypoint, or a waypoint with
   * completed Moves, rewrites history the user has lived through, so it
   * requires explicit confirmation.
   */
  async applyRoute(
    userId: string,
    courseId: string,
    input: {
      expectedCourseVersion: number;
      idempotencyKey: string;
      destinationText?: string | null;
      waypoints: RouteWaypointInput[];
      proposalId?: string | null;
      adjustmentReason?: string | null;
      confirmRewrite?: boolean;
    }
  ): Promise<CourseDetail> {
    const adjustedKey = eventKey('route-adjusted', input.idempotencyKey);
    return runSerializable(async tx => {
      const replay = await tx.courseEvent.findUnique({ where: { idempotencyKey: adjustedKey } });
      if (replay) {
        if (replay.userId !== userId || replay.courseId !== courseId) {
          throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
        }
        return projection(await findCourse(tx, userId, courseId));
      }
      const row = await findCourse(tx, userId, courseId);
      assertExpectedVersion(row, input.expectedCourseVersion);
      assertCourseWritable(row);
      assertCourseActive(row);
      ensureNoCorruption(row);

      const reached = row.waypoints.filter(waypoint => waypoint.reachedAt);
      const ahead = row.waypoints.filter(waypoint => !isTerminal(waypoint));
      validateRoute(input.waypoints, 1);
      if (reached.length + input.waypoints.length > MAX_COURSE_WAYPOINTS) {
        throw new AppError(
          `A route may contain at most ${MAX_COURSE_WAYPOINTS} waypoints`,
          400,
          'VALIDATION_ERROR'
        );
      }
      const keptIds = new Set(input.waypoints.map(waypoint => waypoint.id).filter(Boolean) as string[]);
      for (const id of keptIds) {
        const existing = row.waypoints.find(waypoint => waypoint.id === id);
        if (!existing) throw new AppError('Waypoint not found', 404, 'WAYPOINT_NOT_FOUND');
        if (isTerminal(existing)) {
          throw new AppError('Reached waypoints are part of your history', 409, 'WAYPOINT_TRANSITION_INVALID');
        }
      }
      const removed = ahead.filter(waypoint => !keptIds.has(waypoint.id));
      const removesCurrent = removed.some(waypoint => waypoint.id === row.currentWaypointId);
      const removesWorkedWaypoint = removed.some(waypoint =>
        row.moves.some(move => move.waypointId === waypoint.id && move.status === 'COMPLETED')
      );
      if ((removesCurrent || removesWorkedWaypoint) && !input.confirmRewrite) {
        throw new AppError(
          'This change removes a waypoint you have already worked on',
          409,
          'ROUTE_REWRITE_CONFIRMATION_REQUIRED',
          { removesCurrent, removesWorkedWaypoint }
        );
      }

      const now = new Date();
      for (const waypoint of removed) {
        await tx.waypoint.update({ where: { id: waypoint.id }, data: { cancelledAt: now } });
        await tx.move.updateMany({
          where: { waypointId: waypoint.id, status: { in: ['SUGGESTED', 'ACTIVE'] } },
          data: { status: 'DISMISSED', dismissedAt: now },
        });
        await courseEventService.append(tx, {
          userId,
          courseId,
          waypointId: waypoint.id,
          eventType: CourseEventType.WAYPOINT_CANCELLED,
          sourceEntityType: 'Waypoint',
          sourceEntityId: waypoint.id,
          snapshot: { waypointTitle: waypoint.title },
          occurredAt: now,
          idempotencyKey: eventKey(`route-cancel:${waypoint.id}`, input.idempotencyKey),
        });
      }

      // Two-phase positions keep (courseId, position) unique while reordering.
      const terminalMax = Math.max(
        0,
        ...row.waypoints.filter(waypoint => isTerminal(waypoint)).map(waypoint => waypoint.position),
        ...removed.map(waypoint => waypoint.position)
      );
      const orderedIds: string[] = [];
      for (const [index, waypoint] of input.waypoints.entries()) {
        if (waypoint.id) {
          await tx.waypoint.update({
            where: { id: waypoint.id },
            data: {
              position: -(index + 1),
              title: cleanTitle(waypoint.title, 60),
              description: cleanOptional(waypoint.rationale, 400),
              ...waypointMetricData(metricInput(waypoint)),
            },
          });
          orderedIds.push(waypoint.id);
        } else {
          const id = randomUUID();
          await tx.waypoint.create({
            data: {
              id,
              userId,
              courseId,
              position: -(index + 1),
              title: cleanTitle(waypoint.title, 60),
              description: cleanOptional(waypoint.rationale, 400),
              ...waypointMetricCreateData(metricInput(waypoint)),
            },
          });
          orderedIds.push(id);
          await courseEventService.append(tx, {
            userId,
            courseId,
            waypointId: id,
            eventType: CourseEventType.WAYPOINT_ADDED,
            sourceEntityType: 'Waypoint',
            sourceEntityId: id,
            snapshot: { waypointTitle: cleanTitle(waypoint.title, 60) },
            occurredAt: now,
            idempotencyKey: eventKey(`route-add:${id}`, input.idempotencyKey),
          });
        }
      }
      for (const [index, id] of orderedIds.entries()) {
        await tx.waypoint.update({ where: { id }, data: { position: terminalMax + (index + 1) * 100 } });
      }

      // The first waypoint ahead is current. If it changed, the One Move follows it.
      const nextCurrentId = orderedIds[0];
      const currentMoveStillValid = row.moves.some(
        move => move.id === row.currentMoveId && move.waypointId === nextCurrentId && move.status === 'ACTIVE'
      );
      const refreshedMoves = await tx.move.findMany({ where: { courseId } });
      const nextMove = currentMoveStillValid
        ? { id: row.currentMoveId! }
        : selectNextActiveMove(refreshedMoves, nextCurrentId);
      const destinationText = input.destinationText ? cleanTitle(input.destinationText, 140) : null;
      await tx.course.update({
        where: { id: courseId },
        data: {
          currentWaypointId: nextCurrentId,
          currentMoveId: nextMove?.id ?? null,
          ...(destinationText && destinationText !== row.destinationText ? { destinationText } : {}),
          version: { increment: 1 },
        },
      });
      if (destinationText && destinationText !== row.destinationText) {
        await courseEventService.append(tx, {
          userId,
          courseId,
          eventType: CourseEventType.DESTINATION_CHANGED,
          sourceEntityType: 'Course',
          sourceEntityId: courseId,
          occurredAt: now,
          idempotencyKey: eventKey('route-destination', input.idempotencyKey),
        });
      }
      await courseEventService.append(tx, {
        userId,
        courseId,
        eventType: CourseEventType.ROUTE_ADJUSTED,
        sourceEntityType: 'Course',
        sourceEntityId: courseId,
        snapshot: {
          waypointCount: reached.length + orderedIds.length,
          ...(input.adjustmentReason ? { adjustmentReason: input.adjustmentReason.slice(0, 32) } : {}),
        },
        occurredAt: now,
        idempotencyKey: adjustedKey,
      });
      if (input.proposalId) {
        await tx.aIPlanProposal.updateMany({
          where: { id: input.proposalId, userId, status: 'PENDING' },
          data: { status: 'ACCEPTED', acceptedAt: now, courseId },
        });
      }
      return projection(await findCourse(tx, userId, courseId));
    });
  }
}

export const chartService = new ChartService();

// Re-exported for route handlers that need the raw row type in tests.
export type { CourseRow };
