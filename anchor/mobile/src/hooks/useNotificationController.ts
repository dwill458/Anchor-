import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '@/services/NotificationService';
import {
  type NotificationState,
  daysBetween,
  getMonday12AMLocal,
  initializeNotificationState,
  isSameDay,
  isSameWeek,
  normalizeNotificationState,
  NOTIFICATION_STATE_STORAGE_KEY,
} from '@/services/NotificationState';
import { isSovereign } from '@/services/NotificationPriority';
import {
  countDailyGoalCompletions,
  localDateString,
} from '@/services/DailyGoalNudgeService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import {
  evaluateNotificationRules,
  type NotificationRuleContext,
  type NotificationRuleResult,
} from '@/services/notifications/notificationRules';
import {
  renderNotificationTemplate,
  selectNotificationTemplate,
} from '@/services/notifications/notificationSelector';
import type {
  NotificationCategory,
  NotificationTone,
} from '@/services/notifications/notificationTypes';
import {
  clearPushTokensFromServer,
  getPendingNotificationStateSync,
  type SyncedNotificationState,
  syncNotificationStateToServer,
  syncPushTokensToServer,
} from '@/services/NotificationSyncService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

type NotificationStateWithSyncMetadata = SyncedNotificationState;

const SMART_NOTIFICATION_PRIORITY: NotificationCategory[] = [
  'milestone',
  'thread_strength',
  'unfinished_anchor',
  'weekly_recap',
  'daily_prime',
];

export const useNotificationController = () => {
  const [notifState, setNotifState] = useState<NotificationStateWithSyncMetadata | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);

  const loadState = useCallback(async (): Promise<NotificationStateWithSyncMetadata> => {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    return normalizeNotificationState(stored ? JSON.parse(stored) : initializeNotificationState());
  }, []);

  const saveState = useCallback(async (state: NotificationStateWithSyncMetadata) => {
    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(state));
    setNotifState(state);
  }, []);

  const syncStateToServer = useCallback(async (
    state: NotificationStateWithSyncMetadata
  ): Promise<NotificationStateWithSyncMetadata | null> => {
    if (!useAuthStore.getState().isAuthenticated) {
      return null;
    }

    const pendingState = await getPendingNotificationStateSync();
    const nextState = pendingState ? { ...pendingState, ...state } : state;
    return syncNotificationStateToServer(nextState);
  }, []);

  const syncWithStores = useCallback((
    state: NotificationStateWithSyncMetadata
  ): NotificationStateWithSyncMetadata => {
    const now = new Date();
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();

    const currentPrimes = countDailyGoalCompletions(sessionState.sessionLog, now);
    const latestPrime = sessionState.primingHistory[0]?.completedAt ?? state.last_prime_at;
    const unfinishedAnchorReminders = { ...(state.unfinishedAnchorReminders ?? {}) };
    anchorState.anchors.forEach((anchor) => {
      if (anchor.isCharged || anchor.isReleased || anchor.archivedAt) {
        return;
      }
      const anchorId = anchor.localId ?? anchor.id;
      if (!unfinishedAnchorReminders[anchorId]) {
        const createdAt =
          anchor.createdAt instanceof Date
            ? anchor.createdAt
            : new Date(anchor.createdAt);
        unfinishedAnchorReminders[anchorId] = {
          startedAt: Number.isNaN(createdAt.getTime())
            ? now.toISOString()
            : createdAt.toISOString(),
        };
      }
    });

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
      threadStrength: sessionState.threadStrength,
      unfinishedAnchorReminders,
    };
  }, [dailyPracticeGoal]);

  const reconcile = useCallback((
    input: NotificationStateWithSyncMetadata
  ): NotificationStateWithSyncMetadata => {
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

  const buildRuleContext = useCallback((): NotificationRuleContext => {
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();

    return {
      now: new Date(),
      sessionLog: sessionState.sessionLog,
      totalSessionsCount: sessionState.totalSessionsCount,
      threadStrength: sessionState.threadStrength,
      anchors: anchorState.anchors,
    };
  }, []);

  const cancelSmartNotifications = useCallback(async (
    context?: NotificationRuleContext,
    keepIdentifier?: string | null
  ) => {
    const cancelUnless = (category: NotificationCategory, anchorId?: string) => {
      if (keepIdentifier && NotificationService.getSmartNotificationId(category, anchorId) === keepIdentifier) {
        return Promise.resolve();
      }
      return NotificationService.cancelSmartNotification(category, anchorId);
    };

    await Promise.all(
      SMART_NOTIFICATION_PRIORITY.map((category) => cancelUnless(category))
    );

    await Promise.all(
      (context?.anchors ?? []).map((anchor) =>
        cancelUnless('unfinished_anchor', anchor.localId ?? anchor.id)
      )
    );
  }, []);

  const markSmartNotificationScheduled = useCallback((
    state: NotificationStateWithSyncMetadata,
    result: NotificationRuleResult,
    templateId: string
  ): NotificationStateWithSyncMetadata => {
    // NOTE: "sent" de-duplication state (lastNotificationSentAt, sentMilestones,
    // unfinishedAnchorReminders[].sentAt) is intentionally NOT recorded here.
    // Smart notifications are rescheduled on every reconcile (app open, settings
    // change, prime complete, …), and that flow cancels all pending smart
    // notifications first. Recording "sent" at schedule time made the rate-limit
    // rules cancel a pending notification and then refuse to reschedule it, so it
    // never fired. Delivery is now recorded when the OS actually delivers the
    // notification — see recordNotificationDelivery wired in App.tsx.
    return {
      ...state,
      lastTemplateIdByCategory: {
        ...(state.lastTemplateIdByCategory ?? {}),
        [result.category]: templateId,
      },
    };
  }, []);

  const scheduleSmartNotifications = useCallback(async (
    state: NotificationStateWithSyncMetadata
  ): Promise<NotificationStateWithSyncMetadata> => {
    await NotificationService.cancelNotification('micro-prime');
    await NotificationService.cancelWeeklySummary();

    const context = buildRuleContext();

    const permissionStatus = await NotificationService.getPermissionStatus();
    const stateWithPermission = {
      ...state,
      notificationPermissionStatus: permissionStatus,
    };

    const result = evaluateNotificationRules(stateWithPermission, context)
      .find((candidate) => candidate.eligible && candidate.fireDate);

    // `daily_prime` fires at a user-configurable time, so it must always be
    // rescheduled to honor settings changes. The relative categories fire a few
    // minutes out; if one is already pending, keep it so repeated reconciles
    // don't keep pushing its fire time back (which previously meant it never
    // fired). We cancel every other smart notification, then leave the winner in
    // place.
    const winnerId = result?.fireDate
      ? NotificationService.getSmartNotificationId(result.category, result.anchorId)
      : null;
    const keepExisting = Boolean(
      result?.fireDate &&
      result.category !== 'daily_prime' &&
      (await NotificationService.isSmartNotificationPending(result.category, result.anchorId))
    );

    await cancelSmartNotifications(context, keepExisting ? winnerId : null);

    if (!result?.fireDate || keepExisting) {
      return stateWithPermission;
    }

    const template = selectNotificationTemplate({
      category: result.category,
      tone: stateWithPermission.notificationTone,
      lastTemplateIdByCategory: stateWithPermission.lastTemplateIdByCategory,
    });
    const rendered = renderNotificationTemplate({
      template,
      variables: result.variables,
    });

    const notificationId = await NotificationService.scheduleSmartNotification({
      category: result.category,
      templateId: template.id,
      tone: stateWithPermission.notificationTone,
      title: rendered.title,
      body: rendered.body,
      fireDate: result.fireDate,
      anchorId: result.anchorId,
      milestone: result.milestone,
    });

    if (notificationId) {
      AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SCHEDULED, {
        category: result.category,
        templateId: template.id,
        tone: stateWithPermission.notificationTone,
        anchorId: result.anchorId,
        sentAt: result.fireDate.toISOString(),
      });
      return markSmartNotificationScheduled(stateWithPermission, result, template.id);
    }

    return stateWithPermission;
  }, [buildRuleContext, cancelSmartNotifications, markSmartNotificationScheduled]);

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

      state = await scheduleSmartNotifications(state);
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] initOnAppOpen error:', err);
    } finally {
      setIsInitialized(true);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

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

        const scheduledState = await scheduleSmartNotifications(reconciledState);
        await saveState(scheduledState);
        const syncedState = await syncStateToServer(scheduledState);
        if (syncedState && !cancelled) {
          await saveState(syncedState);
        }
      } catch (err) {
        logger.error('[NotificationController] syncGoalWithSettings error:', err);
      }
    };

    void syncGoalWithSettings();

    return () => {
      cancelled = true;
    };
  }, [dailyPracticeGoal, isInitialized, loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

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

      state = await scheduleSmartNotifications(state);
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] handlePrimeComplete error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer, syncWithStores]);

  const handleBurnFlowEntered = useCallback(async () => {
    try {
      const state = reconcile(await loadState());
      state.has_entered_burn_flow = true;
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] handleBurnFlowEntered error:', err);
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
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] handleSigilVaulted error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  const updateActiveHours = useCallback(async (start: number, end: number) => {
    try {
      let state = reconcile(await loadState());
      state.active_hours_start = start;
      state.active_hours_end = end;
      state.dailyPrimeTime = `${String(end).padStart(2, '0')}:00`;
      state = await scheduleSmartNotifications(state);
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] updateActiveHours error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    try {
      let state = reconcile(await loadState());
      state.notification_enabled = enabled;
      useSettingsStore.setState({ weeklySummaryEnabled: enabled });

      const isAuthenticated = useAuthStore.getState().isAuthenticated;

      if (!enabled) {
        await NotificationService.cancelNotification('micro-prime');
        await NotificationService.cancelWeeklySummary();
        await cancelSmartNotifications(buildRuleContext());
        if (isAuthenticated) {
          await clearPushTokensFromServer();
        }
      } else {
        state = await scheduleSmartNotifications(state);
        if (isAuthenticated) {
          const registration = await NotificationService.getRemotePushRegistration();
          if (registration.permissionGranted) {
            state.notificationPermissionStatus = 'granted';
            AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED);
            await syncPushTokensToServer({
              expoPushToken: registration.expoPushToken,
              fcmToken: registration.fcmToken,
              apnsToken: registration.apnsToken,
            });
          } else {
            state.notificationPermissionStatus = 'denied';
            AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED);
            await clearPushTokensFromServer();
          }
        }
      }
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] toggleNotifications error:', err);
    }
  }, [buildRuleContext, cancelSmartNotifications, loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

  const setActiveSession = useCallback(async (active: boolean) => {
    try {
      let state = reconcile(await loadState());
      if (state.active_session === active) {
        return;
      }
      state.active_session = active;
      if (!active) {
        state = await scheduleSmartNotifications(state);
      }
      await saveState(state);
    } catch (err) {
      logger.error('[NotificationController] setActiveSession error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications]);

  const toggleWeaver = useCallback(async (enabled: boolean) => {
    try {
      const state = reconcile(await loadState());
      state.weaver_enabled = enabled;
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] toggleWeaver error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  const updateNotificationPreferences = useCallback(async (updates: Partial<Pick<
    NotificationState,
    | 'dailyPrimeEnabled'
    | 'dailyPrimeTime'
    | 'threadStrengthAlertsEnabled'
    | 'threadStrengthThreshold'
    | 'unfinishedAnchorRemindersEnabled'
    | 'weeklyRecapEnabled'
    | 'milestoneNotificationsEnabled'
    | 'notificationTone'
  >>) => {
    try {
      let state = reconcile(await loadState());
      state = {
        ...state,
        ...updates,
        dailyPrimeTime: updates.dailyPrimeTime ?? state.dailyPrimeTime,
        threadStrengthThreshold:
          updates.threadStrengthThreshold != null
            ? Math.min(100, Math.max(0, Math.round(updates.threadStrengthThreshold)))
            : state.threadStrengthThreshold,
        notificationTone: (updates.notificationTone ?? state.notificationTone) as NotificationTone,
      };

      state = await scheduleSmartNotifications(state);
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] updateNotificationPreferences error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

  const promptForNotificationPermission = useCallback(async () => {
    try {
      let state = reconcile(await loadState());
      AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_PROMPT_SHOWN);
      const granted = await NotificationService.requestPermissions();

      state.notificationPermissionStatus = granted ? 'granted' : 'denied';
      state.notification_enabled = granted;

      AnalyticsService.track(
        granted
          ? AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED
          : AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED
      );

      if (granted) {
        state = await scheduleSmartNotifications(state);
      } else {
        await cancelSmartNotifications(buildRuleContext());
      }

      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] promptForNotificationPermission error:', err);
    }
  }, [
    buildRuleContext,
    cancelSmartNotifications,
    loadState,
    reconcile,
    saveState,
    scheduleSmartNotifications,
    syncStateToServer,
  ]);

  const showNotificationSoftAsk = useCallback(async () => {
    try {
      const state = reconcile(await loadState());
      if (
        state.softAskShownAt ||
        state.notificationPermissionStatus !== 'undetermined'
      ) {
        return;
      }

      const shownAt = new Date().toISOString();
      await saveState({ ...state, softAskShownAt: shownAt });

      Alert.alert(
        'Keep your anchor active?',
        'Anchor can remind you to prime once a day, at the time you choose.',
        [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => {
              void (async () => {
                const dismissedState = reconcile(await loadState());
                dismissedState.softAskDismissedAt = new Date().toISOString();
                await saveState(dismissedState);
                await syncStateToServer(dismissedState);
              })();
            },
          },
          {
            text: 'Enable reminders',
            onPress: () => {
              void promptForNotificationPermission();
            },
          },
        ]
      );
    } catch (err) {
      logger.error('[NotificationController] showNotificationSoftAsk error:', err);
    }
  }, [loadState, promptForNotificationPermission, reconcile, saveState, syncStateToServer]);

  const handleAnchorSaved = useCallback(async () => {
    await showNotificationSoftAsk();
    try {
      let state = reconcile(await loadState());
      state = await scheduleSmartNotifications(state);
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] handleAnchorSaved error:', err);
    }
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, showNotificationSoftAsk, syncStateToServer]);

  return {
    notifState,
    isInitialized,
    handlePrimeComplete,
    handleBurnFlowEntered,
    handleSigilVaulted,
    updateActiveHours,
    updateNotificationPreferences,
    toggleNotifications,
    setActiveSession,
    toggleWeaver,
    showNotificationSoftAsk,
    handleAnchorSaved,
  };
};
