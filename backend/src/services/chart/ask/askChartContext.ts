import { prisma } from '../../../lib/prisma';
import { getOnboardingContext } from '../../v2/OnboardingContextService';
import { chartPlannerService } from '../ChartPlannerService';
import { DEFAULT_COACH_STYLE, COACH_STYLES, type CoachStyle } from './chartAgent';
import type { MemoryKey } from './askChartSchema';

/**
 * Read-only context assembly for one Ask Chart turn. Everything is scoped to the authenticated user and the one
 * Anchor (and its one active Chart) the conversation belongs to: nothing from another Anchor is ever read.
 */
export type AskMove = { id: string; title: string; status: 'ACTIVE' | 'COMPLETED' };
export type AskWaypoint = {
  id: string;
  title: string;
  state: 'REACHED' | 'CURRENT' | 'UPCOMING';
  completionCriteria: string | null;
  metric: string | null;
  moves: AskMove[];
};
export type AskChartState = {
  courseId: string;
  version: number;
  destination: string;
  currentWaypointId: string | null;
  currentMoveId: string | null;
  waypoints: AskWaypoint[];
  /** Newest first. */
  recentCompletedMoves: string[];
};

export type AskContext = {
  anchor: { id: string; intention: string; category: string };
  vision: { title: string | null; description: string | null; notes: string[]; captions: string[] } | null;
  onboarding: Awaited<ReturnType<typeof getOnboardingContext>>;
  practice: { practiceCount: number; lastPracticedAt: string | null } | null;
  chart: AskChartState | null;
  memories: Array<{ key: MemoryKey; value: string }>;
  style: CoachStyle;
};

export async function loadCoachStyle(userId: string): Promise<CoachStyle> {
  const profile = await prisma.chartCoachProfile.findUnique({ where: { userId }, select: { style: true } });
  return COACH_STYLES.find(style => style === profile?.style) ?? DEFAULT_COACH_STYLE;
}

export async function loadChartState(userId: string, anchorId: string): Promise<AskChartState | null> {
  const course = await prisma.course.findFirst({
    where: { userId, anchorId, status: 'ACTIVE', deletedAt: null },
    orderBy: { plottedAt: 'desc' },
    select: {
      id: true,
      version: true,
      destinationText: true,
      currentWaypointId: true,
      currentMoveId: true,
      waypoints: {
        where: { archivedAt: null, cancelledAt: null, skippedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          reachedAt: true,
          completionCriteria: true,
          metricLabel: true,
          metricTarget: true,
          metricCurrent: true,
          moves: {
            where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
            orderBy: { position: 'asc' },
            select: { id: true, title: true, status: true },
          },
        },
      },
    },
  });
  if (!course) return null;
  const recent = await prisma.move.findMany({
    where: { userId, courseId: course.id, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 8,
    select: { title: true },
  });
  return {
    courseId: course.id,
    version: course.version,
    destination: course.destinationText,
    currentWaypointId: course.currentWaypointId,
    currentMoveId: course.currentMoveId,
    waypoints: course.waypoints.map(waypoint => ({
      id: waypoint.id,
      title: waypoint.title,
      state: waypoint.reachedAt ? 'REACHED' : waypoint.id === course.currentWaypointId ? 'CURRENT' : 'UPCOMING',
      completionCriteria: waypoint.completionCriteria,
      metric:
        waypoint.metricTarget !== null
          ? `${waypoint.metricCurrent ?? 'unknown'} of ${waypoint.metricTarget}${waypoint.metricLabel ? ` ${waypoint.metricLabel}` : ''}`
          : null,
      moves: waypoint.moves.map(move => ({ id: move.id, title: move.title, status: move.status as AskMove['status'] })),
    })),
    recentCompletedMoves: recent.map(move => move.title),
  };
}

export async function loadMemories(userId: string, anchorId: string) {
  const rows = await prisma.chartMemory.findMany({
    where: { userId, anchorId },
    orderBy: { updatedAt: 'desc' },
    select: { key: true, value: true },
  });
  return rows as Array<{ key: MemoryKey; value: string }>;
}

export async function loadAskContext(userId: string, anchorId: string): Promise<AskContext> {
  // Throws ANCHOR_NOT_FOUND / ANCHOR_UNAVAILABLE for a foreign or released Anchor.
  const { anchor, vision } = await chartPlannerService.loadAnchorContext(userId, anchorId);
  const [onboarding, chart, memories, style] = await Promise.all([
    getOnboardingContext(userId).catch(() => null),
    loadChartState(userId, anchorId),
    loadMemories(userId, anchorId),
    loadCoachStyle(userId),
  ]);
  const recent = anchor.practiceSessions?.[0];
  const practiceCount = anchor.activationCount || anchor.practiceSessions?.length || 0;
  return {
    anchor: { id: anchor.id, intention: anchor.intentionText, category: anchor.category },
    vision:
      vision && (vision.title || vision.description || vision.notes?.length || vision.scenes?.length)
        ? {
            title: vision.title,
            description: vision.description,
            notes: vision.notes?.map(note => note.text).filter(Boolean) ?? [],
            captions: (vision.scenes?.map(scene => scene.caption || scene.prompt).filter(Boolean) as string[]) ?? [],
          }
        : null,
    onboarding,
    practice: practiceCount
      ? { practiceCount, lastPracticedAt: recent?.completedAt?.toISOString() ?? null }
      : null,
    chart,
    memories,
    style,
  };
}
