import {
  PRACTICE_MODES,
  PRACTICE_THREAD_STRENGTH_GAINS,
  type PracticeMode,
  type PracticeSessionRecord,
} from "@/types/practice";
import { calculateThreadDecay } from "@/utils/threadStrength";
import { isValidLocalDateKey, localDateKey } from "@/utils/practiceTime";

export const PRACTICE_HEATMAP_WEEK_COUNT = 22;
export const PRACTICE_CONSTANCY_WINDOW_DAYS = 30;
export const PRACTICE_HEATMAP_DENSITY_THRESHOLDS = [0, 1, 2, 3, 4] as const;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ThreadStrengthSensitivity = "lenient" | "balanced" | "strict";

export interface PracticeModeBreakdown {
  mode: PracticeMode;
  count: number;
  fraction: number;
  percent: number;
}

export interface DailyPracticeAggregate {
  localDateKey: string;
  total: number;
  byMode: Record<PracticeMode, number>;
  latestCompletedAtUtc: string | null;
  dominantMode: PracticeMode | null;
  densityLevel: 0 | 1 | 2 | 3 | 4;
}

export interface WeeklyActivityDay {
  label: string;
  localDateKey: string;
  count: number;
  byMode: Record<PracticeMode, number>;
  isToday: boolean;
  isFuture: boolean;
}

export interface TodayPracticeGoalSnapshot {
  localDateKey: string;
  goal: number;
  completed: number;
  remaining: number;
  progress: number;
  isComplete: boolean;
}

export interface ThreadStrengthSnapshot {
  score: number;
  totalSessions: number;
  constancyPercent: number;
  primeRecordDays: number;
  deepPrimePercent: number;
  todayGoal: TodayPracticeGoalSnapshot;
  currentWeek: WeeklyActivityDay[];
  sessionBreakdown: PracticeModeBreakdown[];
  heatMap: DailyPracticeAggregate[][];
  dailyAggregates: ReadonlyMap<string, DailyPracticeAggregate>;
}

const emptyModeCounts = (): Record<PracticeMode, number> => ({
  deep_prime: 0,
  visualize: 0,
  focus: 0,
  release: 0,
});

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;
}

function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function dayDifference(fromExclusive: string, toInclusive: string): number {
  return Math.max(
    0,
    Math.round(
      (parseDateKey(toInclusive).getTime() -
        parseDateKey(fromExclusive).getTime()) /
        86_400_000,
    ),
  );
}

function countDecayEligibleDays(
  fromExclusive: string,
  toExclusive: string,
  restDays: readonly number[],
): number {
  const rest = new Set(restDays);
  let count = 0;
  // Excludes toExclusive itself: it's either the day of the next practice
  // (not a missed day) or the still-in-progress current day (not yet missed),
  // so only the fully-elapsed days strictly between the two count toward decay.
  const days = dayDifference(fromExclusive, toExclusive);
  for (let offset = 1; offset < days; offset += 1) {
    const day = parseDateKey(addDays(fromExclusive, offset)).getUTCDay();
    if (!rest.has(day)) count += 1;
  }
  return count;
}

function applyDecay(
  score: number,
  missedDays: number,
  sensitivity: ThreadStrengthSensitivity,
): number {
  let next = score;
  for (let day = 1; day <= missedDays; day += 1) {
    const delta =
      calculateThreadDecay(day, sensitivity) -
      calculateThreadDecay(day - 1, sensitivity);
    if (delta > 0) next = Math.max(5, next - delta);
  }
  return next;
}

export function selectCanonicalPracticeEvents(
  events: readonly PracticeSessionRecord[],
  accountId: string | null | undefined,
  now: Date = new Date(),
): PracticeSessionRecord[] {
  if (!accountId) return [];
  const seen = new Set<string>();
  const latestAllowed = now.getTime() + FUTURE_CLOCK_SKEW_MS;
  return events
    .filter((event) => {
      // 'legacy' marks pre-redesign entries that predate account-scoped
      // tracking and haven't yet been rebound by hydrateFromBackend. They can
      // only survive under the account that's currently signed in — sign-out
      // resets the whole session store — so treat them as this account's own
      // until rebinding catches up, instead of hiding them from Thread
      // Strength until a network rehydrate happens to run.
      if (
        (event.accountId !== accountId && event.accountId !== "legacy") ||
        event.completionStatus !== "completed" ||
        seen.has(event.id) ||
        !PRACTICE_MODES.includes(event.practiceMode) ||
        !isValidLocalDateKey(event.localDateKey)
      ) {
        return false;
      }
      const completedAt = new Date(event.completedAt).getTime();
      if (!Number.isFinite(completedAt) || completedAt > latestAllowed)
        return false;
      seen.add(event.id);
      return true;
    })
    .sort((left, right) => {
      const delta =
        new Date(left.completedAt).getTime() -
        new Date(right.completedAt).getTime();
      return delta || left.id.localeCompare(right.id);
    });
}

export function aggregatePracticeByDay(
  events: readonly PracticeSessionRecord[],
): Map<string, DailyPracticeAggregate> {
  const map = new Map<string, DailyPracticeAggregate>();
  for (const event of events) {
    const current = map.get(event.localDateKey) ?? {
      localDateKey: event.localDateKey,
      total: 0,
      byMode: emptyModeCounts(),
      latestCompletedAtUtc: null,
      dominantMode: null,
      densityLevel: 0 as const,
    };
    current.total += 1;
    current.byMode[event.practiceMode] += 1;
    if (
      !current.latestCompletedAtUtc ||
      new Date(event.completedAt).getTime() >=
        new Date(current.latestCompletedAtUtc).getTime()
    ) {
      current.latestCompletedAtUtc = event.completedAt;
    }
    map.set(event.localDateKey, current);
  }

  map.forEach((aggregate, key) => {
    const highest = Math.max(
      ...PRACTICE_MODES.map((mode) => aggregate.byMode[mode]),
    );
    const tied = PRACTICE_MODES.filter(
      (mode) => aggregate.byMode[mode] === highest,
    );
    if (highest > 0 && tied.length === 1) {
      aggregate.dominantMode = tied[0];
    } else if (highest > 0) {
      const latestMode = [...events]
        .filter(
          (event) =>
            event.localDateKey === key && tied.includes(event.practiceMode),
        )
        .sort(
          (left, right) =>
            new Date(right.completedAt).getTime() -
              new Date(left.completedAt).getTime() ||
            PRACTICE_MODES.indexOf(left.practiceMode) -
              PRACTICE_MODES.indexOf(right.practiceMode),
        )[0]?.practiceMode;
      aggregate.dominantMode = latestMode ?? tied[0] ?? null;
    }
    aggregate.densityLevel = Math.min(4, aggregate.total) as 0 | 1 | 2 | 3 | 4;
  });
  return map;
}

function largestRemainderBreakdown(
  events: readonly PracticeSessionRecord[],
): PracticeModeBreakdown[] {
  const total = events.length;
  const counts = emptyModeCounts();
  events.forEach((event) => {
    counts[event.practiceMode] += 1;
  });
  if (total === 0) {
    return PRACTICE_MODES.map((mode) => ({
      mode,
      count: 0,
      fraction: 0,
      percent: 0,
    }));
  }
  const rows = PRACTICE_MODES.map((mode, order) => {
    const exact = (counts[mode] / total) * 100;
    return {
      mode,
      order,
      count: counts[mode],
      fraction: counts[mode] / total,
      percent: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let points = 100 - rows.reduce((sum, row) => sum + row.percent, 0);
  [...rows]
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.order - right.order,
    )
    .forEach((row) => {
      if (points > 0) {
        row.percent += 1;
        points -= 1;
      }
    });
  return rows.map(({ mode, count, fraction, percent }) => ({
    mode,
    count,
    fraction,
    percent,
  }));
}

function calculatePrimeRecord(activeDates: readonly string[]): number {
  let record = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...new Set(activeDates)].sort()) {
    run = previous && dayDifference(previous, date) === 1 ? run + 1 : 1;
    record = Math.max(record, run);
    previous = date;
  }
  return record;
}

export function calculateThreadStrengthScore(
  events: readonly PracticeSessionRecord[],
  today: string,
  sensitivity: ThreadStrengthSensitivity,
  restDays: readonly number[],
): number {
  let score = 50;
  let lastDate: string | null = null;
  for (const event of events) {
    if (lastDate && event.localDateKey > lastDate) {
      score = applyDecay(
        score,
        countDecayEligibleDays(lastDate, event.localDateKey, restDays),
        sensitivity,
      );
    }
    score = Math.min(
      100,
      score + PRACTICE_THREAD_STRENGTH_GAINS[event.practiceMode],
    );
    lastDate = event.localDateKey;
  }
  if (lastDate && today > lastDate) {
    score = applyDecay(
      score,
      countDecayEligibleDays(lastDate, today, restDays),
      sensitivity,
    );
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildThreadStrengthSnapshot(params: {
  events: readonly PracticeSessionRecord[];
  accountId: string | null | undefined;
  dailyGoal: number;
  sensitivity: ThreadStrengthSensitivity;
  restDays: readonly number[];
  now?: Date;
  heatMapWeeks?: number;
}): ThreadStrengthSnapshot {
  const now = params.now ?? new Date();
  const today = localDateKey(now);
  const events = selectCanonicalPracticeEvents(
    params.events,
    params.accountId,
    now,
  );
  const daily = aggregatePracticeByDay(events);
  const breakdown = largestRemainderBreakdown(events);
  const goal = Math.max(0, Math.min(20, Math.round(params.dailyGoal)));
  const completed = daily.get(today)?.total ?? 0;
  const todayGoal: TodayPracticeGoalSnapshot = {
    localDateKey: today,
    goal,
    completed,
    remaining: Math.max(goal - completed, 0),
    progress: goal <= 0 ? 0 : Math.min(completed / goal, 1),
    isComplete: goal > 0 && completed >= goal,
  };

  const todayUtc = parseDateKey(today);
  const mondayOffset = (todayUtc.getUTCDay() + 6) % 7;
  const currentMonday = addDays(today, -mondayOffset);
  const labels = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const currentWeek = labels.map((label, index) => {
    const date = addDays(currentMonday, index);
    const dayAggregate = daily.get(date);
    return {
      label,
      localDateKey: date,
      count: dayAggregate?.total ?? 0,
      byMode: dayAggregate?.byMode ?? emptyModeCounts(),
      isToday: date === today,
      isFuture: date > today,
    };
  });

  const weeks = Math.max(1, params.heatMapWeeks ?? PRACTICE_HEATMAP_WEEK_COUNT);
  const firstMonday = addDays(currentMonday, -(weeks - 1) * 7);
  const heatMap = Array.from({ length: weeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(firstMonday, weekIndex * 7 + dayIndex);
      return (
        daily.get(date) ?? {
          localDateKey: date,
          total: 0,
          byMode: emptyModeCounts(),
          latestCompletedAtUtc: null,
          dominantMode: null,
          densityLevel: 0 as const,
        }
      );
    }),
  );

  const activeDates = Array.from(daily.keys()).sort();
  const constancyStart = addDays(today, -(PRACTICE_CONSTANCY_WINDOW_DAYS - 1));
  const activeInWindow = activeDates.filter(
    (date) => date >= constancyStart && date <= today,
  ).length;
  const deepPrime = breakdown.find((row) => row.mode === "deep_prime");

  return {
    score: calculateThreadStrengthScore(
      events,
      today,
      params.sensitivity,
      params.restDays,
    ),
    totalSessions: events.length,
    constancyPercent: Math.round(
      (activeInWindow / PRACTICE_CONSTANCY_WINDOW_DAYS) * 100,
    ),
    primeRecordDays: calculatePrimeRecord(activeDates),
    deepPrimePercent: deepPrime?.percent ?? 0,
    todayGoal,
    currentWeek,
    sessionBreakdown: breakdown,
    heatMap,
    dailyAggregates: daily,
  };
}
