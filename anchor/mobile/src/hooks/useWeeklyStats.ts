import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import {
  TIME_OF_DAY_LABELS,
  WEEKDAY_NAMES,
  addDays,
  isoWeekNumber,
  localDateString,
  parseLocalDateString,
  type PrimingHistoryEntry,
  type TimeOfDayBucket,
} from '@/utils/primingAnalytics';

type DayLabel = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
type DayState = 'primed' | 'missed' | 'recovered' | 'future' | 'today';
type PerformanceTier = 'strong' | 'fading' | 'recovering';

const DAY_LABELS: DayLabel[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TIME_OF_DAY_ORDER: TimeOfDayBucket[] = ['morning', 'afternoon', 'evening', 'late_night'];

/**
 * One day in the active weekly summary review period, ordered Sunday through Saturday.
 */
export interface DayNode {
  /** ISO local date in `YYYY-MM-DD` format. */
  date: string;
  /** Three-letter weekday label. */
  dayLabel: DayLabel;
  /** Current weekly display state for the day. */
  state: DayState;
  /** Number of priming sessions recorded for the day. */
  primeCount: number;
}

/**
 * Derived weekly priming summary for the active review period.
 * Sundays review the previously completed Sunday-to-Saturday window.
 * Other days review the current Sunday-to-Saturday window.
 */
export interface WeeklyStats {
  /** User-relative week number, starting at week 1. */
  weekNumber: number;
  /** ISO calendar week number for the active review period. */
  calendarWeekNumber: number;
  /** Sunday of the active review period in `YYYY-MM-DD` format. */
  weekStart: string;
  /** Saturday of the active review period in `YYYY-MM-DD` format. */
  weekEnd: string;
  /** Always seven nodes, Sunday through Saturday. */
  days: DayNode[];
  /** Total priming sessions this week. */
  totalPrimes: number;
  /** Number of week days with at least one prime. */
  daysShownUp: number;
  /** Total positive thread gain earned from priming sessions this week. */
  threadDelta: number;
  /** Most-primed anchor for the current week, or `null` when there were no weekly primes. */
  dominantAnchor: {
    id: string;
    intention: string;
    threadStrength: number;
    weeklyPrimeCount: number;
    forgedAt: string;
  } | null;
  /** Lifetime day/time window the user primes most often. */
  peakPrimingWindow: {
    day: string;
    timeOfDay: string;
  };
  /** Weekly performance bucket derived from attendance and recovery pattern. */
  performanceTier: PerformanceTier;
}

function getSessionGain(entry: { type: PrimingHistoryEntry['type'] }): number {
  return entry.type === 'reinforce' ? 40 : 25;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveAnchorDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildAnchorLookup(anchors: Anchor[]): Map<string, Anchor> {
  const lookup = new Map<string, Anchor>();

  anchors.forEach((anchor) => {
    lookup.set(anchor.id, anchor);
    if (anchor.localId) {
      lookup.set(anchor.localId, anchor);
    }
  });

  return lookup;
}

function resolvePeakPrimingWindow(primingHistory: PrimingHistoryEntry[]): WeeklyStats['peakPrimingWindow'] {
  if (primingHistory.length === 0) {
    return { day: 'Monday', timeOfDay: 'mornings' };
  }

  const weekdayCounts = new Array<number>(7).fill(0);
  const timeOfDayCounts = new Map<TimeOfDayBucket, number>();

  primingHistory.forEach((entry) => {
    weekdayCounts[entry.weekdayIndex] += 1;
    timeOfDayCounts.set(entry.timeOfDay, (timeOfDayCounts.get(entry.timeOfDay) ?? 0) + 1);
  });

  const weekdayIndex = weekdayCounts.reduce((bestIndex, count, index) => {
    if (count > weekdayCounts[bestIndex]) {
      return index;
    }

    return bestIndex;
  }, 0);

  const timeOfDay = TIME_OF_DAY_ORDER.reduce((bestBucket, bucket) => {
    if ((timeOfDayCounts.get(bucket) ?? 0) > (timeOfDayCounts.get(bestBucket) ?? 0)) {
      return bucket;
    }

    return bestBucket;
  }, TIME_OF_DAY_ORDER[0]);

  return {
    day: WEEKDAY_NAMES[weekdayIndex],
    timeOfDay: TIME_OF_DAY_LABELS[timeOfDay],
  };
}

function startOfSundayWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function resolveSummaryWeekStartDate(now: Date): Date {
  const currentSundayWeekStart = startOfSundayWeek(now);

  // Sunday evening summaries review the previously completed Sunday-Saturday window.
  if (now.getDay() === 0) {
    return addDays(currentSundayWeekStart, -7);
  }

  return currentSundayWeekStart;
}

function normalizeToSundayWeekStart(value: string | null | undefined, fallback: Date): string {
  if (!value) {
    return localDateString(startOfSundayWeek(fallback));
  }

  const parsed = parseLocalDateString(value);
  if (!parsed) {
    return localDateString(startOfSundayWeek(fallback));
  }

  return localDateString(startOfSundayWeek(parsed));
}

function diffSundayWeeksInclusive(startWeekStart: string, endWeekStart: string): number {
  const start = parseLocalDateString(startWeekStart);
  const end = parseLocalDateString(endWeekStart);

  if (!start || !end) {
    return 1;
  }

  const diffMs = startOfSundayWeek(end).getTime() - startOfSundayWeek(start).getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 86_400_000)) + 1);
}

/**
 * Returns the active weekly summary review's priming stats derived from the persisted
 * Zustand stores. The result is memoized and contains stable references until
 * the underlying store slices change.
 */
export function useWeeklyStats(): WeeklyStats {
  const anchors = useAnchorStore((state) => state.anchors);
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const journeyWeekStart = useSessionStore((state) => state.journeyWeekStart);
  const threadStrength = useSessionStore((state) => state.threadStrength);

  return useMemo(() => {
    const now = new Date();
    const todayKey = localDateString(now);
    const weekStartDate = resolveSummaryWeekStartDate(now);
    const weekStart = localDateString(weekStartDate);
    const weekEndDate = addDays(weekStartDate, 6);
    const weekEnd = localDateString(weekEndDate);
    const anchorLookup = buildAnchorLookup(anchors);
    const activeAnchors = anchors.filter((anchor) => !anchor.isReleased && !anchor.archivedAt);
    const summaryThreadStrength = clamp(threadStrength, 0, 100);
    const currentWeekPrimingHistory = primingHistory.filter(
      (entry) => entry.localDate >= weekStart && entry.localDate <= weekEnd
    );
    const primeCountsByDate = new Map<string, number>();
    const primingSessionsByAnchor = new Map<string, PrimingHistoryEntry[]>();
    const currentWeekSessionsByAnchor = new Map<string, PrimingHistoryEntry[]>();
    let totalPrimes = 0;
    let threadDelta = 0;

    primingHistory.forEach((entry) => {
      const resolvedAnchor = anchorLookup.get(entry.anchorId);
      const canonicalAnchorId = resolvedAnchor?.id ?? entry.anchorId;
      const allSessions = primingSessionsByAnchor.get(canonicalAnchorId) ?? [];
      allSessions.push(entry);
      primingSessionsByAnchor.set(canonicalAnchorId, allSessions);
    });

    currentWeekPrimingHistory.forEach((entry) => {
      totalPrimes += 1;
      threadDelta += getSessionGain(entry);
      primeCountsByDate.set(entry.localDate, (primeCountsByDate.get(entry.localDate) ?? 0) + 1);

      const resolvedAnchor = anchorLookup.get(entry.anchorId);
      const canonicalAnchorId = resolvedAnchor?.id ?? entry.anchorId;
      const weeklySessions = currentWeekSessionsByAnchor.get(canonicalAnchorId) ?? [];
      weeklySessions.push(entry);
      currentWeekSessionsByAnchor.set(canonicalAnchorId, weeklySessions);
    });

    const days: DayNode[] = DAY_LABELS.map((dayLabel, index) => {
      const date = addDays(weekStartDate, index);
      const dateKey = localDateString(date);
      const primeCount = primeCountsByDate.get(dateKey) ?? 0;
      let state: DayState;

      if (dateKey > todayKey) {
        state = 'future';
      } else if (dateKey === todayKey) {
        state = 'today';
      } else if (primeCount === 0) {
        state = 'missed';
      } else if (index > 0 && primeCountsByDate.get(localDateString(addDays(weekStartDate, index - 1))) === 0) {
        state = 'recovered';
      } else {
        state = 'primed';
      }

      return {
        date: dateKey,
        dayLabel,
        state,
        primeCount,
      };
    });

    const daysShownUp = days.filter((day) => day.primeCount > 0).length;
    const hasMiss = days.some((day) => day.state === 'missed');
    const hasRecovery = days.some((day) => day.state === 'recovered');
    const performanceTier: PerformanceTier =
      daysShownUp >= 5
        ? 'strong'
        : hasMiss && hasRecovery
          ? 'recovering'
          : 'fading';

    const effectiveJourneyWeekStart =
      normalizeToSundayWeekStart(
        journeyWeekStart ?? primingHistory[primingHistory.length - 1]?.localDate,
        weekStartDate
      );

    let dominantAnchor: WeeklyStats['dominantAnchor'] = null;

    const dominantCandidate = totalPrimes > 0
      ? [...currentWeekSessionsByAnchor.entries()]
          .map(([anchorId, weeklySessions]) => {
            const anchor = anchorLookup.get(anchorId);
            if (!anchor) {
              return null;
            }

            const allPrimingSessions = primingSessionsByAnchor.get(anchor.id) ?? [];
            const latestCompletedAt = Math.max(
              ...allPrimingSessions.map((session) => new Date(session.completedAt).getTime())
            );
            const forgedAt = resolveAnchorDate(anchor.createdAt)?.toISOString();

            if (!forgedAt) {
              return null;
            }

            return {
              id: anchor.id,
              intention: anchor.intentionText,
              threadStrength: summaryThreadStrength,
              weeklyPrimeCount: weeklySessions.length,
              forgedAt,
              latestCompletedAt,
            };
          })
          .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
          .sort((left, right) => {
            if (right.weeklyPrimeCount !== left.weeklyPrimeCount) {
              return right.weeklyPrimeCount - left.weeklyPrimeCount;
            }

            if (right.latestCompletedAt !== left.latestCompletedAt) {
              return right.latestCompletedAt - left.latestCompletedAt;
            }

            return left.id.localeCompare(right.id);
          })[0]
      : null;

    if (dominantCandidate) {
      dominantAnchor = {
        id: dominantCandidate.id,
        intention: dominantCandidate.intention,
        threadStrength: dominantCandidate.threadStrength,
        weeklyPrimeCount: dominantCandidate.weeklyPrimeCount,
        forgedAt: dominantCandidate.forgedAt,
      };
    } else if (activeAnchors.length === 1) {
      const soleAnchor = activeAnchors[0];
      const forgedAt = resolveAnchorDate(soleAnchor.createdAt)?.toISOString();

      if (forgedAt) {
        dominantAnchor = {
          id: soleAnchor.id,
          intention: soleAnchor.intentionText,
          threadStrength: summaryThreadStrength,
          weeklyPrimeCount: 0,
          forgedAt,
        };
      }
    }

    return {
      weekNumber: diffSundayWeeksInclusive(effectiveJourneyWeekStart, weekStart),
      calendarWeekNumber: isoWeekNumber(weekEndDate),
      weekStart,
      weekEnd,
      days,
      totalPrimes,
      daysShownUp,
      threadDelta,
      dominantAnchor,
      peakPrimingWindow: resolvePeakPrimingWindow(primingHistory),
      performanceTier,
    };
  }, [anchors, journeyWeekStart, primingHistory, threadStrength]);
}
