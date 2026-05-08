import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '@/services/NotificationService';
import {
  type NotificationState,
  daysBetween,
  getMonday12AMLocal,
  initializeNotificationState,
  isSameDay,
  isSameWeek,
  NOTIFICATION_STATE_STORAGE_KEY,
} from '@/services/NotificationState';
import { isSovereign } from '@/services/NotificationPriority';
import { NOTIFICATION_COPY } from '@/constants/NotificationCopy';
import {
  countDailyGoalCompletions,
  localDateString,
} from '@/services/DailyGoalNudgeService';
import {
  clearPushTokensFromServer,
  syncNotificationStateToServer,
  syncPushTokensToServer,
} from '@/services/NotificationSyncService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const useNotificationController = () => {
  const [notifState, setNotifState] = useState<NotificationState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);

  const loadState = useCallback(async (): Promise<NotificationState> => {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : initializeNotificationState();
  }, []);

  const saveState = useCallback(async (state: NotificationState) => {
    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(state));
    setNotifState(state);
  }, []);

  const syncStateToServer = useCallback(async (state: NotificationState) => {
    if (!useAuthStore.getState().isAuthenticated) {
      return;
    }

    await syncNotificationStateToServer(state);
  }, []);

  const syncWithStores = useCallback((state: NotificationState): NotificationState => {
    const now = new Date();
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();

    const currentPrimes = countDailyGoalCompletions(sessionState.sessionLog, now);
    const latestPrime = sessionState.primingHistory[0]?.completedAt ?? state.last_prime_at;

    return {
      ...state,
      goal_primes: dailyPracticeGoal,
      current_primes: Math.max(state.current_primes, currentPrimes),
      total_primes_this_week: Math.max(
        state.total_primes_this_week,
        sessionState.primingHistory.filter(
          (entry) => entry.weekStart === state.week_started_at
        ).length
      ),
      total_primes_all_time: Math.max(
        state.total_primes_all_time,
        anchorState.totalPrimes,
        sessionState.totalSessionsCount
      ),
      primed_today:
        state.primed_today ||
        currentPrimes > 0 ||
        sessionState.lastPrimedAt === localDateString(now),
      last_prime_at: latestPrime,
      has_reached_goal_today:
        state.has_reached_goal_today || currentPrimes >= dailyPracticeGoal,
    };
  }, [dailyPracticeGoal]);

  const reconcile = useCallback((input: NotificationState): NotificationState => {
    const now = new Date();
    const state = syncWithStores({ ...input });
    const lastPrimeDate = state.last_prime_at
      ? new Date(state.last_prime_at)
      : null;
    const daysSince = daysBetween(state.last_prime_at, now);

    if (lastPrimeDate && !isSameDay(now, lastPrimeDate)) {
      state.primed_today = false;
      state.has_reached_goal_today = false;
      state.current_primes = 0;
    }

    if (daysSince > 1) {
      state.missed_yesterday = true;
      state.miss_streak = daysSince - 1; // deterministic, not additive
    } else if (daysSince === 1 && !state.primed_today) {
      state.missed_yesterday = true;
      state.miss_streak = 1; // always 1, not += 1
    } else {
      state.missed_yesterday = false;
      state.miss_streak = 0;
    }

    state.app_opened_in_last_5_days = daysBetween(state.last_app_open_at, now) <= 5;

    if (!isSameWeek(now, state.week_started_at)) {
      state.total_primes_this_week = 0;
      state.week_started_at = getMonday12AMLocal();
    }

    return state;
  }, [syncWithStores]);

  const scheduleMicroPrime = useCallback(async (state: NotificationState) => {
    await NotificationService.cancelNotification('micro-prime');

    if (!state.notification_enabled || state.primed_today) {
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(state.active_hours_end, 0, 0, 0);

    const copy = state.sovereign_rank
      ? NOTIFICATION_COPY.microPrime.sovereign
      : NOTIFICATION_COPY.microPrime.standard;

    await NotificationService.scheduleLocalNotification({
      id: 'micro-prime',
      title: copy.title,
      body: copy.body,
      fireDate: tomorrow,
      deepLink: '/sanctuary',
    });

    const settings = useSettingsStore.getState();
    if (settings.weeklySummaryEnabled && state.notification_enabled) {
      await NotificationService.scheduleWeeklySummary(state.active_hours_end);
    } else {
      await NotificationService.cancelWeeklySummary();
    }
  }, []);

  const initOnAppOpen = useCallback(async () => {
    try {
      let state = await loadState();
      state = reconcile(state);
      state.last_app_open_at = new Date().toISOString();
      state.app_opened_in_last_5_days = true;

      if (
        !state.sovereign_rank &&
        isSovereign(state.total_primes_all_time, state.alchemist_milestones_count)
      ) {
        state.sovereign_rank = true;
      }

      await saveState(state);
      await scheduleMicroPrime(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] initOnAppOpen error:', err);
    } finally {
      setIsInitialized(true);
    }
  }, [loadState, reconcile, saveState, scheduleMicroPrime, syncStateToServer]);

  useEffect(() => {
    void initOnAppOpen();
  }, [initOnAppOpen]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    let cancelled = false;

    const syncGoalWithSettings = async () => {
      try {
        const reconciledState = reconcile(await loadState());
        if (cancelled) {
          return;
        }

        await saveState(reconciledState);
        await syncStateToServer(reconciledState);
      } catch (err) {
        console.error('[NotificationController] syncGoalWithSettings error:', err);
      }
    };

    void syncGoalWithSettings();

    return () => {
      cancelled = true;
    };
  }, [dailyPracticeGoal, isInitialized, loadState, reconcile, saveState, syncStateToServer]);

  const handlePrimeComplete = useCallback(async () => {
    try {
      let state = reconcile(await loadState());

      // Do NOT increment prime counts here — session save already handles this
      state.primed_today = true;
      state.last_prime_at = new Date().toISOString();
      state.missed_yesterday = false;
      state.miss_streak = 0;

      state = syncWithStores(state);

      // Derive goal status from current store-backed prime counts
      state.has_reached_goal_today = state.current_primes >= state.goal_primes;

      if (
        !state.sovereign_rank &&
        isSovereign(state.total_primes_all_time, state.alchemist_milestones_count)
      ) {
        state.sovereign_rank = true;
      }

      await saveState(state);
      await scheduleMicroPrime(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] handlePrimeComplete error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleMicroPrime, syncStateToServer, syncWithStores]);

  const handleBurnFlowEntered = useCallback(async () => {
    try {
      const state = reconcile(await loadState());
      state.has_entered_burn_flow = true;
      await saveState(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] handleBurnFlowEntered error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  const handleSigilVaulted = useCallback(async () => {
    try {
      const state = reconcile(await loadState());
      state.sigil_in_vault = true;
      state.alchemist_milestones_count += 1;
      state.current_primes = 0;
      state.has_reached_goal_today = false;
      state.has_entered_burn_flow = false;
      state.sigil_in_vault = false;

      if (
        !state.sovereign_rank &&
        isSovereign(state.total_primes_all_time, state.alchemist_milestones_count)
      ) {
        state.sovereign_rank = true;
      }

      await saveState(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] handleSigilVaulted error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  const updateActiveHours = useCallback(async (start: number, end: number) => {
    try {
      const state = reconcile(await loadState());
      state.active_hours_start = start;
      state.active_hours_end = end;
      await saveState(state);
      await scheduleMicroPrime(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] updateActiveHours error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleMicroPrime, syncStateToServer]);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    try {
      const state = reconcile(await loadState());
      state.notification_enabled = enabled;
      await saveState(state);

      if (!enabled) {
        await NotificationService.cancelNotification('micro-prime');
        await NotificationService.cancelWeeklySummary();
        await clearPushTokensFromServer();
      } else {
        await scheduleMicroPrime(state);
        const registration = await NotificationService.getRemotePushRegistration();
        if (registration.permissionGranted) {
          await syncPushTokensToServer({
            expoPushToken: registration.expoPushToken,
            fcmToken: registration.fcmToken,
            apnsToken: registration.apnsToken,
          });
        } else {
          await clearPushTokensFromServer();
        }
      }
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] toggleNotifications error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleMicroPrime, syncStateToServer]);

  const setActiveSession = useCallback(async (active: boolean) => {
    try {
      const state = reconcile(await loadState());
      if (state.active_session === active) {
        return;
      }
      state.active_session = active;
      await saveState(state);
      if (!active) {
        await scheduleMicroPrime(state);
      }
    } catch (err) {
      console.error('[NotificationController] setActiveSession error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleMicroPrime]);

  const toggleWeaver = useCallback(async (enabled: boolean) => {
    try {
      const state = reconcile(await loadState());
      state.weaver_enabled = enabled;
      await saveState(state);
      await syncStateToServer(state);
    } catch (err) {
      console.error('[NotificationController] toggleWeaver error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  return {
    notifState,
    isInitialized,
    handlePrimeComplete,
    handleBurnFlowEntered,
    handleSigilVaulted,
    updateActiveHours,
    toggleNotifications,
    setActiveSession,
    toggleWeaver,
  };
};
