import { useEffect, useMemo, useState } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { buildThreadStrengthSnapshot } from '@/utils/practiceMetrics';

function millisecondsUntilNextLocalDay(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

export function usePracticeMetrics() {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const events = useSessionStore((state) => state.practiceHistory ?? []);
  const dailyGoal = useSettingsStore((state) => state.dailyPracticeGoal);
  const sensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity,
  );
  const restDays = useSettingsStore((state) => state.restDays);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const current = new Date();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, millisecondsUntilNextLocalDay(current));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return useMemo(
    () =>
      buildThreadStrengthSnapshot({
        events,
        accountId,
        dailyGoal,
        sensitivity,
        restDays,
        now,
      }),
    [accountId, dailyGoal, events, now, restDays, sensitivity],
  );
}
