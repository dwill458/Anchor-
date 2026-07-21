import { useMemo } from 'react';

import { PRACTICE_CONSTANCY_WINDOW_DAYS } from '@/utils/practiceMetrics';
import { usePracticeMetrics } from '@/hooks/usePracticeMetrics';
import { useSettingsStore, type ThreadStrengthSensitivity } from '@/stores/settingsStore';

export interface DayData {
  date: string;
  focusCount: number;
  deepCount: number;
  visualizeCount: number;
  releaseCount: number;
  isToday: boolean;
  isFuture: boolean;
}

const SENSITIVITY_COPY: Record<
  ThreadStrengthSensitivity,
  { label: string; note: string }
> = {
  lenient: { label: 'Lenient', note: '2 grace days before decay begins.' },
  balanced: { label: 'Balanced', note: '1 grace day before decay begins.' },
  strict: { label: 'Strict', note: 'Any missed day begins decay.' },
};

export function useThreadHistory() {
  const snapshot = usePracticeMetrics();
  const sensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced',
  );

  return useMemo(() => {
    const todayKey = snapshot.todayGoal.localDateKey;
    const breakdown = Object.fromEntries(
      snapshot.sessionBreakdown.map((row) => [row.mode, row.count]),
    ) as Record<'deep_prime' | 'visualize' | 'focus' | 'release', number>;
    const copy = SENSITIVITY_COPY[sensitivity];

    return {
      weeks: snapshot.heatMap.map((week) =>
        week.map((day): DayData => ({
          date: day.localDateKey,
          focusCount: day.byMode.focus,
          deepCount: day.byMode.deep_prime,
          visualizeCount: day.byMode.visualize,
          releaseCount: day.byMode.release,
          isToday: day.localDateKey === todayKey,
          isFuture: day.localDateKey > todayKey,
        })),
      ),
      totalSessions: snapshot.totalSessions,
      currentStreak: snapshot.constancyPercent,
      longestStreak: snapshot.primeRecordDays,
      deepPrimePercent: snapshot.deepPrimePercent,
      focusCount: breakdown.focus,
      deepCount: breakdown.deep_prime,
      visualizeCount: breakdown.visualize,
      releaseCount: breakdown.release,
      threadStrength: snapshot.score,
      sensitivityLabel: copy.label,
      sensitivityNote: copy.note,
      constancyWindowDays: PRACTICE_CONSTANCY_WINDOW_DAYS,
      currentWeekDays: snapshot.currentWeek.map((day) => {
        const aggregate = snapshot.dailyAggregates.get(day.localDateKey);
        return {
          label: day.label.slice(0, 3),
          date: day.localDateKey,
          hasFocus: (aggregate?.byMode.focus ?? 0) > 0,
          hasDeep: (aggregate?.byMode.deep_prime ?? 0) > 0,
          hasVisualize: (aggregate?.byMode.visualize ?? 0) > 0,
          hasRelease: (aggregate?.byMode.release ?? 0) > 0,
          isToday: day.isToday,
          isFuture: day.isFuture,
        };
      }),
    };
  }, [sensitivity, snapshot]);
}

export type ThreadHistoryResult = ReturnType<typeof useThreadHistory>;
