import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import { calculateStreak } from '@/utils/streakHelpers';
import {
  TIME_OF_DAY_LABELS,
  WEEKDAY_NAMES,
  addDays,
  diffWeeksInclusive,
  getTimeOfDayBucket,
  isoWeekNumber,
  localDateString,
  localWeekStartString,
  startOfIsoWeek,
  type PrimingHistoryEntry,
  type TimeOfDayBucket,
} from '@/utils/primingAnalytics';

type DayLabel = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type DayState = 'primed' | 'missed' | 'recovered' | 'future' | 'today';
type PerformanceTier = 'strong' | 'fading' | 'recovering';

const DAY_LABELS: DayLabel[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_OF_DAY_ORDER: TimeOfDayBucket[] = ['morning', 'afternoon', 'evening', 'late_night'];

/**
 * One day in the current ISO week, ordered Monday through Sunday.
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
 * Derived weekly priming summary for the current ISO week.
 */
export interface WeeklyStats {
  /** User-relative week number, starting at week 1. */
  weekNumber: number;
  /** ISO calendar week number for the current local date. */
  calendarWeekNumber: number;
  /** Monday of the current ISO week in `YYYY-MM-DD` format. */
  weekStart: string;
  /** Sunday of the current ISO week in `YYYY-MM-DD` format. */
  weekEnd: string;
  /** Always seven nodes, Monday through Sunday. */
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

function isPrimingSession(entry: SessionLogEntry): boolean {
  return entry.type === 'activate' || entry.type === 'reinforce';
}

function getSessionGain(entry: { type: SessionLogEntry['type'] | PrimingHistoryEntry['type'] }): number {
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

/**
 * Returns the current ISO week's priming stats derived from the persisted
 * Zustand stores. The result is memoized and contains stable references until
 * the underlying store slices change.
 */
export function useWeeklyStats(): WeeklyStats {
  const anchors = useAnchorStore((state) => state.anchors);
  const primingHistory = useSessionStore((state) => state.primingHistory);
  const journeyWeekStart = useSessionStore((state) => state.journeyWeekStart);

  return useMemo(() => {
    const now = new Date();
    const todayKey = localDateString(now);
    const weekStartDate = startOfIsoWeek(now);
    const weekStart = localDateString(weekStartDate);
    const weekEndDate = addDays(weekStartDate, 6);
    const weekEnd = localDateString(weekEndDate);
    const anchorLookup = buildAnchorLookup(anchors);
    const currentWeekPrimingHistory = primingHistory.filter((entry) => entry.weekStart === weekStart);
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
      journeyWeekStart ??
      primingHistory[primingHistory.length - 1]?.weekStart ??
      localWeekStartString(now);

    let dominantAnchor: WeeklyStats['dominantAnchor'] = null;

    const dominantCandidate = totalPrimes > 0
      ? [...currentWeekSessionsByAnchor.entries()]
          .map(([anchorId, weeklySessions]) => {
            const anchor = anchorLookup.get(anchorId);
            if (!anchor) {
              return null;
            }

            const allPrimingSessions = primingSessionsByAnchor.get(anchor.id) ?? [];
            const distinctWeekDays = new Set(weeklySessions.map((session) => session.localDate));
            const currentStreak = calculateStreak(
              allPrimingSessions.map((session) => ({ createdAt: session.completedAt }))
            ).currentStreak;
            const threadStrength = clamp(
              Math.max(
                Math.round((distinctWeekDays.size / 7) * 100),
                allPrimingSessions.length > 0 ? Math.round((currentStreak / 7) * 100) : 0
              ),
              0,
              100
            );
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
              threadStrength,
              totalPrimeCount: allPrimingSessions.length,
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

            if (right.totalPrimeCount !== left.totalPrimeCount) {
              return right.totalPrimeCount - left.totalPrimeCount;
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
    }

    return {
      weekNumber: diffWeeksInclusive(effectiveJourneyWeekStart, weekStart),
      calendarWeekNumber: isoWeekNumber(now),
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
  }, [anchors, journeyWeekStart, primingHistory]);
}
