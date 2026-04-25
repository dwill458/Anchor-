import { useMemo } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore, type ThreadStrengthSensitivity } from '@/stores/settingsStore';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';

export interface DayData {
  date: string;
  focusCount: number;
  deepCount: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface ThreadHistoryResult {
  weeks: DayData[][];
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  deepPrimePercent: number;
  focusCount: number;
  deepCount: number;
  threadStrength: number;
  sensitivityLabel: string;
  sensitivityNote: string;
  currentWeekDays: {
    label: string;
    date: string;
    hasFocus: boolean;
    hasDeep: boolean;
    isToday: boolean;
    isFuture: boolean;
  }[];
}

const WEEK_COUNT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 5 * 1000;

const SENSITIVITY_COPY: Record<
  ThreadStrengthSensitivity,
  { label: string; note: string }
> = {
  lenient: {
    label: 'Lenient',
    note: '2 grace days before decay begins.',
  },
  balanced: {
    label: 'Balanced',
    note: '1 grace day before decay begins.',
  },
  strict: {
    label: 'Strict',
    note: 'Any missed day begins decay.',
  },
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(left: string, right: string): number {
  return Math.round(
    (parseDateKey(right).getTime() - parseDateKey(left).getTime()) / DAY_MS
  );
}

type ClassifiedPrimingEntry = PrimingHistoryEntry & {
  dateKey: string;
  timestamp: number;
  displayType: 'focus' | 'deep';
};

function classifyPrimingEntries(entries: PrimingHistoryEntry[]): ClassifiedPrimingEntry[] {
  const seenIds = new Set<string>();
  const sorted = entries
    .map((entry) => {
      if (entry.type !== 'activate' && entry.type !== 'reinforce') {
        return null;
      }

      const parsed = new Date(entry.completedAt);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      const dateKey = localDateKey(parsed);
      return {
        ...entry,
        dateKey,
        timestamp: parsed.getTime(),
      };
    })
    .filter((entry): entry is PrimingHistoryEntry & { dateKey: string; timestamp: number } => entry !== null)
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      if (left.type !== right.type) {
        return left.type === 'activate' ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    });

  const anchorsWithPriorPrime = new Set<string>();
  const lastSignatureTime = new Map<string, number>();
  const classified: ClassifiedPrimingEntry[] = [];

  for (const entry of sorted) {
    if (seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);

    const signature = `${entry.anchorId}|${entry.type}`;
    const previousSignatureTime = lastSignatureTime.get(signature);
    if (
      previousSignatureTime != null &&
      Math.abs(entry.timestamp - previousSignatureTime) <= DUPLICATE_WINDOW_MS
    ) {
      continue;
    }
    lastSignatureTime.set(signature, entry.timestamp);

    // The initial first-prime completion is stored as "reinforce", but it is
    // not a user-initiated Deep Prime. Count it as non-deep for display stats.
    const displayType =
      entry.type === 'reinforce' && anchorsWithPriorPrime.has(entry.anchorId)
        ? 'deep'
        : 'focus';

    classified.push({ ...entry, displayType });
    anchorsWithPriorPrime.add(entry.anchorId);
  }

  return classified;
}

export function useThreadHistory(): ThreadHistoryResult {
  const primingHistory = useSessionStore((state) => state.primingHistory ?? []);
  const threadStrength = useSessionStore((state) => state.threadStrength);
  const sensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced'
  );

  return useMemo(() => {
    const today = startOfLocalDay(new Date());
    const todayKey = localDateKey(today);
    const entries = Array.isArray(primingHistory) ? primingHistory : [];
    const classifiedEntries = classifyPrimingEntries(entries);
    const countsByDate = new Map<string, { focusCount: number; deepCount: number }>();

    for (const entry of classifiedEntries) {
      const counts = countsByDate.get(entry.dateKey) ?? { focusCount: 0, deepCount: 0 };
      if (entry.displayType === 'focus') {
        counts.focusCount += 1;
      } else {
        counts.deepCount += 1;
      }
      countsByDate.set(entry.dateKey, counts);
    }

    let focusCount = 0;
    let deepCount = 0;
    countsByDate.forEach((counts) => {
      focusCount += counts.focusCount;
      deepCount += counts.deepCount;
    });

    const totalSessions = focusCount + deepCount;
    const deepPrimePercent =
      totalSessions > 0 ? Math.round((deepCount / totalSessions) * 100) : 0;

    const currentSunday = addDays(today, -today.getDay());
    const heatmapStart = addDays(currentSunday, -(WEEK_COUNT - 1) * 7);
    const weeks: DayData[][] = [];

    for (let weekIndex = 0; weekIndex < WEEK_COUNT; weekIndex += 1) {
      const week: DayData[] = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = addDays(heatmapStart, weekIndex * 7 + dayIndex);
        const dateKey = localDateKey(date);
        const counts = countsByDate.get(dateKey) ?? { focusCount: 0, deepCount: 0 };
        week.push({
          date: dateKey,
          focusCount: counts.focusCount,
          deepCount: counts.deepCount,
          isToday: dateKey === todayKey,
          isFuture: date.getTime() > today.getTime(),
        });
      }
      weeks.push(week);
    }

    const hasSession = (dateKey: string): boolean => {
      const counts = countsByDate.get(dateKey);
      return !!counts && counts.focusCount + counts.deepCount > 0;
    };

    let currentStreak = 0;
    let cursor = today;
    if (!hasSession(todayKey)) {
      cursor = addDays(today, -1);
      if (!hasSession(localDateKey(cursor))) {
        currentStreak = 0;
      }
    }

    if (hasSession(localDateKey(cursor))) {
      while (hasSession(localDateKey(cursor))) {
        currentStreak += 1;
        cursor = addDays(cursor, -1);
      }
    }

    const sessionDates = Array.from(countsByDate.keys()).sort();
    let longestStreak = 0;
    let runningStreak = 0;
    let previousDate: string | null = null;

    for (const dateKey of sessionDates) {
      if (!previousDate || daysBetween(previousDate, dateKey) !== 1) {
        runningStreak = 1;
      } else {
        runningStreak += 1;
      }
      longestStreak = Math.max(longestStreak, runningStreak);
      previousDate = dateKey;
    }

    const isoMonday = addDays(today, -((today.getDay() + 6) % 7));
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentWeekDays = labels.map((label, index) => {
      const date = addDays(isoMonday, index);
      const dateKey = localDateKey(date);
      const counts = countsByDate.get(dateKey) ?? { focusCount: 0, deepCount: 0 };
      return {
        label,
        date: dateKey,
        hasFocus: counts.focusCount > 0,
        hasDeep: counts.deepCount > 0,
        isToday: dateKey === todayKey,
        isFuture: date.getTime() > today.getTime(),
      };
    });

    const sensitivityCopy = SENSITIVITY_COPY[sensitivity] ?? SENSITIVITY_COPY.balanced;

    return {
      weeks,
      totalSessions,
      currentStreak,
      longestStreak,
      deepPrimePercent,
      focusCount,
      deepCount,
      threadStrength,
      sensitivityLabel: sensitivityCopy.label,
      sensitivityNote: sensitivityCopy.note,
      currentWeekDays,
    };
  }, [primingHistory, sensitivity, threadStrength]);
}
