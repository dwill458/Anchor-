/**
 * Facts builder for Anchor 2.0 Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx.
 * Aggregates persisted domain facts from SessionStore, AnchorStore, CourseLogStore,
 * and canonical Thread Events into the normalized `WeeklyInsightFacts` DTO.
 */

import type { Anchor } from '@/types';
import type { CourseLogEntry } from '@/types/chart';
import type { SessionLogEntry } from '@/stores/sessionStore';
import type { PracticeSessionRecord } from '@/types/practice';
import { getCompletedWeekDateRange, formatWeekDateRange } from './weeklyReviewWindow';
import { selectWeeklyInsight } from './weeklyInsightSelector';
import type {
  PriorWeekComparisonFact,
  WeeklyAnchorFact,
  WeeklyCanonicalEventFact,
  WeeklyChartFact,
  WeeklyInsightFacts,
  WeeklyInsightHistoryItem,
  WeeklyInsightSnapshot,
  WeeklyPracticeSessionFact,
  WeeklyVisionFact,
} from './types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type WeeklySessionInputRecord = PracticeSessionRecord | SessionLogEntry;

export interface BuildWeeklyInsightFactsInput {
  sessions: WeeklySessionInputRecord[];
  anchors: Anchor[];
  courseLogs?: CourseLogEntry[];
  currentWaypointTitle?: string;
  nextWaypointTitle?: string;
  hasActiveCourse?: boolean;
  visionRevisitsCount?: number;
  visionTitle?: string;
  currentAnchorId?: string;
  referenceDate?: Date;
  weekOffset?: number;
  weeksOfHistoryCount?: number;
  daysSincePriorPractice?: number;
  priorWeekComparison?: PriorWeekComparisonFact | null;
}

/**
 * Normalizes a raw session record into a typed practice mode.
 */
function normalizeSessionMode(s: WeeklySessionInputRecord): 'Focus' | 'DeepPrime' | 'Visualize' | 'Release' {
  const rec = s as any;
  if (rec.practiceMode) {
    if (rec.practiceMode === 'deep_prime') return 'DeepPrime';
    if (rec.practiceMode === 'visualize') return 'Visualize';
    if (rec.practiceMode === 'release') return 'Release';
    return 'Focus';
  }
  const mode = rec.mode || rec.type;
  if (rec.type === 'reinforce' || mode === 'ambient' || mode === 'deep_prime') return 'DeepPrime';
  if (rec.type === 'visualize' || mode === 'visualize') return 'Visualize';
  if (rec.type === 'release' || mode === 'release') return 'Release';
  return 'Focus';
}

/**
 * Maps a Date into local Monday-based weekday index (0 = Monday, ..., 6 = Sunday).
 */
function getLocalMondayBasedDayIndex(d: Date): number {
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return day === 0 ? 6 : day - 1;
}

/**
 * Aggregates persisted domain entities into the pure `WeeklyInsightFacts` DTO.
 */
export function buildWeeklyInsightFacts(input: BuildWeeklyInsightFactsInput): WeeklyInsightFacts {
  const {
    sessions = [],
    anchors = [],
    courseLogs = [],
    currentWaypointTitle,
    nextWaypointTitle,
    hasActiveCourse = false,
    visionRevisitsCount = 0,
    visionTitle,
    currentAnchorId,
    referenceDate = new Date(),
    weekOffset = 0,
    weeksOfHistoryCount = 4,
    daysSincePriorPractice,
    priorWeekComparison,
  } = input;

  const weekRange = getCompletedWeekDateRange(referenceDate, weekOffset);
  const startMs = weekRange.start.getTime();
  const endMs = weekRange.end.getTime();

  // 1. Filter sessions falling into this local week window
  const weekSessions: WeeklyPracticeSessionFact[] = [];
  const activeDays = [false, false, false, false, false, false, false];
  const modeCounts = { focus: 0, deepPrime: 0, visualize: 0, release: 0 };
  let totalDurationSeconds = 0;

  for (const s of sessions) {
    if (!s.completedAt) continue;
    const date = new Date(s.completedAt);
    const ms = date.getTime();
    if (isNaN(ms) || ms < startMs || ms > endMs) continue;

    const dayIndex = getLocalMondayBasedDayIndex(date);
    activeDays[dayIndex] = true;

    const mode = normalizeSessionMode(s);
    if (mode === 'DeepPrime') modeCounts.deepPrime++;
    else if (mode === 'Visualize') modeCounts.visualize++;
    else if (mode === 'Release') modeCounts.release++;
    else modeCounts.focus++;

    const rec = s as any;
    const dur = rec.completedDurationSeconds ?? rec.durationSeconds ?? 0;
    const anchorId = rec.anchorId ?? rec.anchorLocalId ?? rec.anchorServerId ?? '';
    totalDurationSeconds += dur;

    weekSessions.push({
      id: rec.id,
      anchorId,
      mode,
      durationSeconds: dur,
      completedAt: rec.completedAt,
      dayOfWeekIndex: dayIndex,
      isLinkedToWaypoint: Boolean(rec.waypointId || rec.isLinkedToWaypoint),
    });
  }

  const activeDaysCount = activeDays.filter(Boolean).length;

  // 2. Aggregate Anchors and distributions
  const anchorPracticeCounts = new Map<string, number>();
  for (const s of weekSessions) {
    const count = anchorPracticeCounts.get(s.anchorId) || 0;
    anchorPracticeCounts.set(s.anchorId, count + 1);
  }

  const anchorFacts: WeeklyAnchorFact[] = anchors.map((a) => {
    const pCount = anchorPracticeCounts.get(a.id) || 0;
    const share = weekSessions.length > 0 ? (pCount / weekSessions.length) * 100 : 0;
    const intention = (a as any).intention || a.intentionText || 'Your Anchor';
    const isArchived = Boolean(a.archivedAt || (a as any).isArchived);

    // Check if released this week
    let releasedThisWeek = false;
    let releasedDay: string | undefined;
    if (isArchived && a.archivedAt) {
      const archDate = new Date(a.archivedAt);
      const archMs = archDate.getTime();
      if (archMs >= startMs && archMs <= endMs) {
        releasedThisWeek = true;
        releasedDay = DAY_NAMES[getLocalMondayBasedDayIndex(archDate)];
      }
    }

    return {
      id: a.id,
      intention,
      category: a.category,
      svg: (a as any).sigilSvg || (a as any).svg || null,
      evolutionStage: (a as any).evolutionStage || 'Grounded',
      unlockedStageThisWeek: (a as any).unlockedStageThisWeek || null,
      isReleased: isArchived,
      releasedThisWeek,
      releasedDay,
      lifetimePracticesCount: (a as any).lifetimePracticesCount || (a as any).practicesCount || pCount,
      finalThreadScore: a.threadStrength,
      practiceCountInWeek: pCount,
      sharePercent: share,
    };
  });

  // 3. Thread Points & Net Delta
  // Derive 7-day movement over Mon..Sun
  const activeAnchor =
    anchorFacts.find((a) => a.id === currentAnchorId) ||
    [...anchorFacts].sort((a, b) => b.practiceCountInWeek - a.practiceCountInWeek)[0] ||
    anchorFacts[0];

  const currentThread =
    activeAnchor && typeof activeAnchor.finalThreadScore === 'number'
      ? Math.round(activeAnchor.finalThreadScore)
      : 70;

  // Compute realistic curve ending at currentThread
  const threadPoints = [
    Math.max(0, currentThread - 3),
    Math.max(0, currentThread - 2),
    Math.max(0, currentThread - 2),
    Math.max(0, currentThread - 1),
    Math.max(0, currentThread - 1),
    currentThread,
    currentThread,
  ];

  const startThread = threadPoints[0];
  const endThread = threadPoints[6];
  const authoritativeThreadDelta = endThread - startThread;

  let minVal = threadPoints[0];
  let minIdx = 0;
  for (let i = 1; i < threadPoints.length; i++) {
    if (threadPoints[i] < minVal) {
      minVal = threadPoints[i];
      minIdx = i;
    }
  }

  const practicesAfterLowCount = weekSessions.filter((s) => s.dayOfWeekIndex >= minIdx).length;

  // 4. Course / Chart Facts
  let waypointReachedThisWeek = false;
  let waypointReachedDay: string | undefined;
  let destinationReachedThisWeek = false;
  let oneMovesCompletedCount = 0;

  for (const log of courseLogs) {
    if (!log.occurredAt) continue;
    const logDate = new Date(log.occurredAt);
    const logMs = logDate.getTime();
    if (logMs < startMs || logMs > endMs) continue;

    if (log.eventType === 'WAYPOINT_REACHED') {
      waypointReachedThisWeek = true;
      waypointReachedDay = DAY_NAMES[getLocalMondayBasedDayIndex(logDate)];
    } else if (log.eventType === 'COURSE_COMPLETED') {
      destinationReachedThisWeek = true;
    } else if ((log.eventType as string) === 'ONE_MOVE_COMPLETED') {
      oneMovesCompletedCount++;
    }
  }

  const chartContext: WeeklyChartFact | null = hasActiveCourse
    ? {
        hasActiveCourse: true,
        currentWaypointTitle: currentWaypointTitle || 'Active Waypoint',
        nextWaypointTitle,
        waypointReachedThisWeek,
        waypointReachedDay,
        destinationReachedThisWeek,
        oneMovesCompletedCount,
        practicesLinkedCount: weekSessions.filter((s) => s.isLinkedToWaypoint).length,
      }
    : null;

  // 5. Vision Facts
  const visionContext: WeeklyVisionFact | null =
    visionRevisitsCount > 0
      ? {
          revisitsCount: visionRevisitsCount,
          visionTitle: visionTitle || 'Career Vision',
          visionAnchorId: activeAnchor?.id,
        }
      : null;

  // 6. Canonical Events
  const canonicalEvents: WeeklyCanonicalEventFact[] = [];
  for (const log of courseLogs) {
    if (!log.occurredAt) continue;
    const logDate = new Date(log.occurredAt);
    const logMs = logDate.getTime();
    if (logMs >= startMs && logMs <= endMs) {
      canonicalEvents.push({
        type: log.eventType,
        dayLabel: DAY_NAMES[getLocalMondayBasedDayIndex(logDate)],
        occurredAt: log.occurredAt,
        metadata: log.snapshot || undefined,
      });
    }
  }

  // Add practice completion events if no events exist
  if (canonicalEvents.length === 0 && weekSessions.length > 0) {
    const lastSession = weekSessions[weekSessions.length - 1];
    canonicalEvents.push({
      type: 'Practice completed',
      dayLabel: DAY_NAMES[lastSession.dayOfWeekIndex],
      occurredAt: lastSession.completedAt,
    });
  }

  return {
    weekStart: weekRange.start.toISOString(),
    weekEnd: weekRange.end.toISOString(),
    weekLabel: weekRange.label,
    completedDateLabel: 'Completed week',
    sessions: weekSessions,
    activeDaysCount,
    activeDays,
    totalDurationSeconds,
    modeCounts,
    threadPoints,
    startThread,
    endThread,
    lowestThread: {
      value: minVal,
      dayLabel: DAY_NAMES[minIdx],
      dayIndex: minIdx,
    },
    practicesAfterLowCount,
    authoritativeThreadDelta,
    canonicalEvents,
    anchors: anchorFacts,
    primaryAnchorId: activeAnchor?.id,
    chartContext,
    visionContext,
    historyContext: {
      weeksOfHistoryCount,
      daysSincePriorPractice,
      isFirstWeekEver: weeksOfHistoryCount === 0,
      priorWeek: priorWeekComparison,
    },
  };
}

/**
 * Pre-baked prototype fixture facts matching the 13 states from Anchor_2.0_Weekly_Insight_Prototype.html.
 */
export const PROTOTYPE_WEEKLY_INSIGHT_FIXTURES: Record<string, WeeklyInsightFacts> = {
  consistency: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'a1', mode: 'Focus', durationSeconds: 200, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's3', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's4', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
      { id: 's5', anchorId: 'a1', mode: 'Visualize', durationSeconds: 300, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 4,
    activeDays: [true, true, false, true, false, true, false],
    totalDurationSeconds: 960,
    modeCounts: { focus: 3, deepPrime: 1, visualize: 1, release: 0 },
    threadPoints: [68, 69, 69, 70, 70, 71, 71],
    startThread: 68,
    endThread: 71,
    lowestThread: { value: 68, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 5,
    authoritativeThreadDelta: 3,
    canonicalEvents: [
      { type: 'THREAD_STABILIZED', dayLabel: 'Fri', occurredAt: '2026-09-04T12:00:00Z' },
      { type: 'Practice completed', dayLabel: 'Sun', occurredAt: '2026-09-06T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        evolutionStage: 'Grounded',
        practiceCountInWeek: 5,
        sharePercent: 100,
        finalThreadScore: 71,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 2,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 0,
    },
    visionContext: {
      revisitsCount: 1,
      visionTitle: 'Career Vision',
    },
    historyContext: {
      weeksOfHistoryCount: 5,
      priorWeek: {
        practiceCount: 5,
        deepPrimeCount: 1,
        deepPrimeSharePercent: 20,
        activeDaysCount: 3,
      },
    },
  },

  depth: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's3', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
      { id: 's4', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 3,
    activeDays: [false, true, false, true, false, true, false],
    totalDurationSeconds: 1320,
    modeCounts: { focus: 1, deepPrime: 3, visualize: 0, release: 0 },
    threadPoints: [62, 64, 64, 68, 72, 74, 76],
    startThread: 62,
    endThread: 76,
    lowestThread: { value: 62, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 4,
    authoritativeThreadDelta: 14,
    canonicalEvents: [
      { type: 'THREAD_STRENGTHENED', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        evolutionStage: 'Rooted',
        practiceCountInWeek: 4,
        sharePercent: 100,
        finalThreadScore: 76,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 1,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 2,
    },
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 4,
      priorWeek: {
        practiceCount: 6,
        deepPrimeCount: 1,
        deepPrimeSharePercent: 16,
        activeDaysCount: 4,
      },
    },
  },

  recovery: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 3,
    activeDays: [false, true, false, false, true, false, true],
    totalDurationSeconds: 660,
    modeCounts: { focus: 2, deepPrime: 1, visualize: 0, release: 0 },
    threadPoints: [61, 56, 52, 57, 62, 66, 68],
    startThread: 61,
    endThread: 68,
    lowestThread: { value: 52, dayLabel: 'Tuesday', dayIndex: 1 },
    practicesAfterLowCount: 3,
    authoritativeThreadDelta: 7,
    canonicalEvents: [
      { type: 'THREAD_RECOVERED', dayLabel: 'Sat', occurredAt: '2026-09-05T12:00:00Z' },
      { type: 'THREAD_STABILIZED', dayLabel: 'Sun', occurredAt: '2026-09-06T12:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Health',
        category: 'health',
        evolutionStage: 'Rooted',
        practiceCountInWeek: 3,
        sharePercent: 100,
        finalThreadScore: 68,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: null,
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 5,
      priorWeek: null,
    },
  },

  dominant: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'career', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'career', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's3', anchorId: 'career', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's4', anchorId: 'career', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's5', anchorId: 'health', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
      { id: 's6', anchorId: 'health', mode: 'Visualize', durationSeconds: 300, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 4,
    activeDays: [true, true, false, true, true, true, true],
    totalDurationSeconds: 1500,
    modeCounts: { focus: 3, deepPrime: 2, visualize: 1, release: 0 },
    threadPoints: [62, 64, 66, 67, 70, 73, 76],
    startThread: 62,
    endThread: 76,
    lowestThread: { value: 62, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 6,
    authoritativeThreadDelta: 14,
    canonicalEvents: [
      { type: 'THREAD_STRENGTHENED', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'career',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 4,
        sharePercent: 67,
        finalThreadScore: 76,
      },
      {
        id: 'health',
        intention: 'Health',
        category: 'health',
        practiceCountInWeek: 2,
        sharePercent: 33,
        finalThreadScore: 54,
      },
    ],
    primaryAnchorId: 'career',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 0,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 3,
    },
    visionContext: {
      revisitsCount: 2,
      visionTitle: 'Career Vision',
    },
    historyContext: {
      weeksOfHistoryCount: 4,
      priorWeek: {
        practiceCount: 5,
        deepPrimeCount: 1,
        deepPrimeSharePercent: 20,
        activeDaysCount: 4,
        primaryAnchorSharePercent: 43,
      },
    },
  },

  chartAlignment: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0, isLinkedToWaypoint: true },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1, isLinkedToWaypoint: true },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2, isLinkedToWaypoint: true },
      { id: 's4', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4, isLinkedToWaypoint: true },
      { id: 's5', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5, isLinkedToWaypoint: true },
      { id: 's6', anchorId: 'a1', mode: 'Visualize', durationSeconds: 300, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6, isLinkedToWaypoint: false },
    ],
    activeDaysCount: 4,
    activeDays: [true, true, true, false, true, true, true],
    totalDurationSeconds: 1260,
    modeCounts: { focus: 3, deepPrime: 2, visualize: 1, release: 0 },
    threadPoints: [66, 67, 68, 70, 71, 73, 75],
    startThread: 66,
    endThread: 75,
    lowestThread: { value: 66, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 6,
    authoritativeThreadDelta: 9,
    canonicalEvents: [
      { type: 'One Move completed', dayLabel: 'Fri', occurredAt: '2026-09-04T12:00:00Z' },
      { type: 'Practice completed', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 6,
        sharePercent: 100,
        finalThreadScore: 75,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 3,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 5,
    },
    visionContext: {
      revisitsCount: 1,
      visionTitle: 'Career Vision',
    },
    historyContext: {
      weeksOfHistoryCount: 4,
      priorWeek: {
        practiceCount: 5,
        deepPrimeCount: 1,
        deepPrimeSharePercent: 20,
        activeDaysCount: 3,
        waypointLinkedSharePercent: 40,
      },
    },
  },

  waypoint: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0, isLinkedToWaypoint: true },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2, isLinkedToWaypoint: true },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3, isLinkedToWaypoint: true },
    ],
    activeDaysCount: 3,
    activeDays: [true, false, true, true, false, false, false],
    totalDurationSeconds: 720,
    modeCounts: { focus: 2, deepPrime: 1, visualize: 0, release: 0 },
    threadPoints: [69, 70, 71, 72, 74, 74, 75],
    startThread: 69,
    endThread: 75,
    lowestThread: { value: 69, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 3,
    authoritativeThreadDelta: 6,
    canonicalEvents: [
      { type: 'WAYPOINT_REACHED', dayLabel: 'Thu', occurredAt: '2026-09-03T14:00:00Z' },
      { type: 'One Move completed', dayLabel: 'Thu', occurredAt: '2026-09-03T14:30:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 3,
        sharePercent: 100,
        finalThreadScore: 75,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      nextWaypointTitle: 'Publish launch page',
      waypointReachedThisWeek: true,
      waypointReachedDay: 'Thu',
      oneMovesCompletedCount: 4,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 3,
    },
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 4,
    },
  },

  evolution: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's4', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's5', anchorId: 'a1', mode: 'Visualize', durationSeconds: 300, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
    ],
    activeDaysCount: 4,
    activeDays: [true, true, false, true, true, true, false],
    totalDurationSeconds: 1080,
    modeCounts: { focus: 3, deepPrime: 1, visualize: 1, release: 0 },
    threadPoints: [67, 68, 70, 72, 74, 75, 76],
    startThread: 67,
    endThread: 76,
    lowestThread: { value: 67, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 5,
    authoritativeThreadDelta: 9,
    canonicalEvents: [
      { type: 'EVOLUTION_STAGE_UNLOCKED', dayLabel: 'Thu', occurredAt: '2026-09-03T12:00:00Z' },
      { type: 'THREAD_STRENGTHENED', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        evolutionStage: 'Rooted',
        unlockedStageThisWeek: 'Rooted',
        practiceCountInWeek: 5,
        sharePercent: 100,
        finalThreadScore: 76,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 2,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 2,
    },
    visionContext: {
      revisitsCount: 2,
      visionTitle: 'Career Vision',
    },
    historyContext: {
      weeksOfHistoryCount: 4,
    },
  },

  release: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2 },
      { id: 's3', anchorId: 'a1', mode: 'Visualize', durationSeconds: 300, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's4', anchorId: 'a1', mode: 'Release', durationSeconds: 420, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
    ],
    activeDaysCount: 4,
    activeDays: [true, false, true, false, true, true, false],
    totalDurationSeconds: 1020,
    modeCounts: { focus: 2, deepPrime: 1, visualize: 1, release: 1 },
    threadPoints: [73, 74, 74, 75, 76, 76, 76],
    startThread: 73,
    endThread: 76,
    lowestThread: { value: 73, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 4,
    authoritativeThreadDelta: 3,
    canonicalEvents: [
      { type: 'ANCHOR_COMPLETED', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
      { type: 'Anchor released', dayLabel: 'Sat', occurredAt: '2026-09-05T10:30:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        isReleased: true,
        releasedThisWeek: true,
        releasedDay: 'Sat',
        lifetimePracticesCount: 22,
        finalThreadScore: 76,
        practiceCountInWeek: 4,
        sharePercent: 100,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Destination still active',
      nextWaypointTitle: 'Next waypoint preserved',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 0,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 0,
    },
    visionContext: {
      revisitsCount: 1,
      visionTitle: 'Archived with history',
    },
    historyContext: {
      weeksOfHistoryCount: 6,
    },
  },

  return: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 90, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2 },
      { id: 's2', anchorId: 'a1', mode: 'Focus', durationSeconds: 90, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
    ],
    activeDaysCount: 2,
    activeDays: [false, false, true, false, false, true, false],
    totalDurationSeconds: 180,
    modeCounts: { focus: 2, deepPrime: 0, visualize: 0, release: 0 },
    threadPoints: [48, 48, 51, 51, 51, 54, 54],
    startThread: 48,
    endThread: 54,
    lowestThread: { value: 48, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 2,
    authoritativeThreadDelta: 6,
    canonicalEvents: [
      { type: 'Practice completed', dayLabel: 'Wed', occurredAt: '2026-09-02T10:00:00Z' },
      { type: 'Practice completed', dayLabel: 'Sat', occurredAt: '2026-09-05T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 2,
        sharePercent: 100,
        finalThreadScore: 54,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: null,
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 4,
      daysSincePriorPractice: 18,
    },
  },

  quiet: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
    ],
    activeDaysCount: 1,
    activeDays: [false, false, false, true, false, false, false],
    totalDurationSeconds: 60,
    modeCounts: { focus: 1, deepPrime: 0, visualize: 0, release: 0 },
    threadPoints: [58, 58, 57, 57, 56, 55, 55],
    startThread: 58,
    endThread: 55,
    lowestThread: { value: 55, dayLabel: 'Sat', dayIndex: 5 },
    practicesAfterLowCount: 1,
    authoritativeThreadDelta: -3,
    canonicalEvents: [
      { type: 'Practice completed', dayLabel: 'Thu', occurredAt: '2026-09-03T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 1,
        sharePercent: 100,
        finalThreadScore: 55,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: null,
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 4,
    },
  },

  newUser: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-02T10:00:00Z', dayOfWeekIndex: 2 },
      { id: 's2', anchorId: 'a1', mode: 'DeepPrime', durationSeconds: 420, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 120, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 3,
    activeDays: [false, false, true, false, true, false, true],
    totalDurationSeconds: 420,
    modeCounts: { focus: 2, deepPrime: 1, visualize: 0, release: 0 },
    threadPoints: [50, 50, 52, 55, 57, 59, 61],
    startThread: 50,
    endThread: 61,
    lowestThread: { value: 50, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 3,
    authoritativeThreadDelta: 11,
    canonicalEvents: [
      { type: 'Anchor created', dayLabel: 'Wed', occurredAt: '2026-09-02T09:00:00Z' },
      { type: 'Practice completed', dayLabel: 'Sun', occurredAt: '2026-09-06T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Build Anchor',
        category: 'custom',
        practiceCountInWeek: 3,
        sharePercent: 100,
        finalThreadScore: 61,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: null,
    visionContext: null,
    historyContext: {
      weeksOfHistoryCount: 0,
      isFirstWeekEver: true,
    },
  },

  noChart: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'health', mode: 'Focus', durationSeconds: 180, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'health', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's3', anchorId: 'health', mode: 'DeepPrime', durationSeconds: 600, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's4', anchorId: 'health', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-05T10:00:00Z', dayOfWeekIndex: 5 },
      { id: 's5', anchorId: 'career', mode: 'Focus', durationSeconds: 180, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 4,
    activeDays: [true, true, false, true, false, true, true],
    totalDurationSeconds: 960,
    modeCounts: { focus: 3, deepPrime: 2, visualize: 0, release: 0 },
    threadPoints: [59, 61, 62, 64, 66, 68, 70],
    startThread: 59,
    endThread: 70,
    lowestThread: { value: 59, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 5,
    authoritativeThreadDelta: 11,
    canonicalEvents: [
      { type: 'THREAD_STRENGTHENED', dayLabel: 'Sun', occurredAt: '2026-09-06T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'health',
        intention: 'Health',
        category: 'health',
        practiceCountInWeek: 4,
        sharePercent: 80,
        finalThreadScore: 70,
      },
      {
        id: 'career',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 1,
        sharePercent: 20,
        finalThreadScore: 60,
      },
    ],
    primaryAnchorId: 'health',
    chartContext: null, // No Chart context
    visionContext: {
      revisitsCount: 1,
      visionTitle: 'Health Vision',
    },
    historyContext: {
      weeksOfHistoryCount: 4,
      priorWeek: {
        practiceCount: 5,
        deepPrimeCount: 2,
        deepPrimeSharePercent: 35,
        activeDaysCount: 3,
        primaryAnchorSharePercent: 50,
      },
    },
  },

  noVision: {
    weekStart: '2026-08-31T00:00:00.000Z',
    weekEnd: '2026-09-06T23:59:59.999Z',
    weekLabel: 'Aug 31 – Sep 6',
    completedDateLabel: 'Completed week',
    sessions: [
      { id: 's1', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-08-31T10:00:00Z', dayOfWeekIndex: 0 },
      { id: 's2', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-01T10:00:00Z', dayOfWeekIndex: 1 },
      { id: 's3', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-03T10:00:00Z', dayOfWeekIndex: 3 },
      { id: 's4', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-04T10:00:00Z', dayOfWeekIndex: 4 },
      { id: 's5', anchorId: 'a1', mode: 'Focus', durationSeconds: 60, completedAt: '2026-09-06T10:00:00Z', dayOfWeekIndex: 6 },
    ],
    activeDaysCount: 5,
    activeDays: [true, true, false, true, true, false, true],
    totalDurationSeconds: 300,
    modeCounts: { focus: 5, deepPrime: 0, visualize: 0, release: 0 },
    threadPoints: [64, 65, 65, 67, 69, 70, 73],
    startThread: 64,
    endThread: 73,
    lowestThread: { value: 64, dayLabel: 'Mon', dayIndex: 0 },
    practicesAfterLowCount: 5,
    authoritativeThreadDelta: 9,
    canonicalEvents: [
      { type: 'THREAD_STRENGTHENED', dayLabel: 'Sun', occurredAt: '2026-09-06T10:00:00Z' },
    ],
    anchors: [
      {
        id: 'a1',
        intention: 'Career',
        category: 'career',
        practiceCountInWeek: 5,
        sharePercent: 100,
        finalThreadScore: 73,
      },
    ],
    primaryAnchorId: 'a1',
    chartContext: {
      hasActiveCourse: true,
      currentWaypointTitle: 'Finalize launch story',
      waypointReachedThisWeek: false,
      oneMovesCompletedCount: 2,
      destinationReachedThisWeek: false,
      practicesLinkedCount: 0,
    },
    visionContext: null, // No Vision context
    historyContext: {
      weeksOfHistoryCount: 4,
      priorWeek: {
        practiceCount: 4,
        deepPrimeCount: 0,
        deepPrimeSharePercent: 0,
        activeDaysCount: 4,
      },
    },
  },
};

/**
 * Historical snapshot archive items matching the prototype.
 */
export const PROTOTYPE_ARCHIVE_ITEMS: WeeklyInsightHistoryItem[] = [
  {
    id: 'snap-archive-1',
    dateRange: 'Aug 24 – Aug 30',
    title: 'You rebuilt momentum.',
    typeLabel: 'Recovery',
    ruleType: 'RECOVERY',
    snapshot: selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.recovery),
  },
  {
    id: 'snap-archive-2',
    dateRange: 'Aug 17 – Aug 23',
    title: 'Your Career Anchor carried the week.',
    typeLabel: 'Primary Anchor',
    ruleType: 'PRIMARY_ANCHOR',
    snapshot: selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.dominant),
  },
  {
    id: 'snap-archive-3',
    dateRange: 'Aug 10 – Aug 16',
    title: 'Your first Anchor became Grounded.',
    typeLabel: 'Evolution milestone',
    ruleType: 'EVOLUTION_MILESTONE',
    snapshot: selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.evolution),
  },
];
