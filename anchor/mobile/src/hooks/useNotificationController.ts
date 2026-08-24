import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
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
import {
  countDailyGoalCompletions,
  localDateString,
} from '@/services/DailyGoalNudgeService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import {
  evaluateDailyPrime,
  evaluateNotificationRules,
  evaluateThreadStrength,
  evaluateUnfinishedAnchor,
  evaluateWeeklyRecap,
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
import { buildThreadStrengthSnapshot, selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';

type NotificationStateWithSyncMetadata = SyncedNotificationState;

const SMART_NOTIFICATION_PRIORITY: NotificationCategory[] = [
  'thread_strength',
  'unfinished_anchor',
  'weekly_recap',
  'daily_prime',
];

// This hook is deliberately mounted in the app shell as well as several
// feature screens. A scheduling pass is a cancel-and-replace transaction, so
// overlapping passes can otherwise cancel a notification another instance has
// just queued. Keep the complete transaction process-wide and sequential.
let schedulerQueue: Promise<unknown> = Promise.resolve();

const runSchedulingExclusively = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = schedulerQueue.then(task, task);
  schedulerQueue = result.catch(() => undefined);
  return result;
};

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
    const settingsState = useSettingsStore.getState();
    const accountId = useAuthStore.getState().user?.id ?? null;
    const hasCanonicalLedger = Array.isArray(sessionState.practiceHistory) && Boolean(accountId);
    const canonicalEvents = hasCanonicalLedger
      ? selectCanonicalPracticeEvents(sessionState.practiceHistory, accountId, now)
      : [];
    const metrics = buildThreadStrengthSnapshot({
      events: sessionState.practiceHistory,
      accountId,
      dailyGoal: dailyPracticeGoal,
      sensitivity: settingsState.threadStrengthSensitivity,
      sensitivityHistory: settingsState.sensitivityHistory,
      restDays: settingsState.restDays,
      restDaysHistory: settingsState.restDaysHistory,
      baseline: sessionState.v2Baselines?.['practice_wide'] ?? null,
      now,
    });
    const currentPrimes = hasCanonicalLedger
      ? metrics.todayGoal.completed
      : countDailyGoalCompletions(sessionState.sessionLog, now);
    const latestPrime = hasCanonicalLedger
      ? canonicalEvents[canonicalEvents.length - 1]?.completedAt ?? state.last_prime_at
      : sessionState.lastSession?.completedAt ?? state.last_prime_at;
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
        hasCanonicalLedger
          ? metrics.currentWeek.reduce((sum, day) => sum + day.count, 0)
          : sessionState.sessionLog.filter((entry) => {
              const completedAt = new Date(entry.completedAt);
              return !Number.isNaN(completedAt.getTime()) && now.getTime() - completedAt.getTime() < 7 * 86_400_000;
            }).length
      ),
      total_primes_all_time: Math.max(
        state.total_primes_all_time,
        anchorState.totalPrimes,
        hasCanonicalLedger ? metrics.totalSessions : sessionState.totalSessionsCount
      ),
      primed_today:
        state.primed_today ||
        currentPrimes > 0 ||
        canonicalEvents.some((entry) => entry.localDateKey === localDateString(now)),
      last_prime_at: latestPrime,
      has_reached_goal_today:
        state.has_reached_goal_today || currentPrimes >= dailyPracticeGoal,
      threadStrength: hasCanonicalLedger ? metrics.score : sessionState.threadStrength,
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
    const settingsState = useSettingsStore.getState();
    const accountId = useAuthStore.getState().user?.id ?? null;
    const now = new Date();
    const hasCanonicalLedger = Array.isArray(sessionState.practiceHistory) && Boolean(accountId);
    const metrics = buildThreadStrengthSnapshot({
      events: sessionState.practiceHistory,
      accountId,
      dailyGoal: settingsState.dailyPracticeGoal,
      sensitivity: settingsState.threadStrengthSensitivity,
      sensitivityHistory: settingsState.sensitivityHistory,
      restDays: settingsState.restDays,
      restDaysHistory: settingsState.restDaysHistory,
      baseline: sessionState.v2Baselines?.['practice_wide'] ?? null,
      now,
    });

    return {
      now,
      sessionLog: sessionState.sessionLog,
      practiceHistory: sessionState.practiceHistory,
      accountId,
      totalSessionsCount: hasCanonicalLedger ? metrics.totalSessions : sessionState.totalSessionsCount,
      threadStrength: hasCanonicalLedger ? metrics.score : sessionState.threadStrength,
      anchors: anchorState.anchors,
    };
  }, []);

  const cancelSmartNotifications = useCallback(async (context?: NotificationRuleContext) => {
    await Promise.all(
      SMART_NOTIFICATION_PRIORITY.map((category) =>
        NotificationService.cancelSmartNotification(category)
      )
    );

    await Promise.all(
      (context?.anchors ?? []).map((anchor) =>
        NotificationService.cancelSmartNotification('unfinished_anchor', anchor.localId ?? anchor.id)
      )
    );
  }, []);

  const markSmartNotificationScheduled = useCallback((
    state: NotificationStateWithSyncMetadata,
    result: NotificationRuleResult,
    templateId: string
  ): NotificationStateWithSyncMetadata => {
    const next: NotificationStateWithSyncMetadata = {
      ...state,
      lastTemplateIdByCategory: {
        ...(state.lastTemplateIdByCategory ?? {}),
        [result.category]: templateId,
      },
    };

    // Note: lastNotificationSentAt is only updated when a notification is actually delivered,
    // NOT when scheduled in advance, preventing false rate-limit self-cancellation.

    return next;
  }, []);

  const scheduleSmartNotifications = useCallback(async (
    state: NotificationStateWithSyncMetadata
  ): Promise<NotificationStateWithSyncMetadata> => runSchedulingExclusively(async () => {
    await NotificationService.cancelNotification('micro-prime');
    await NotificationService.cancelWeeklySummary();

    const permissionStatus = await NotificationService.getPermissionStatus();
    const stateWithPermission = {
      ...state,
      notificationPermissionStatus: permissionStatus,
    };

    const context = buildRuleContext();

    if (
      !stateWithPermission.notification_enabled ||
      permissionStatus !== 'granted'
    ) {
      await cancelSmartNotifications(context);
      return stateWithPermission;
    }

    let nextState = { ...stateWithPermission };

    // 1. Primary Daily Prime Reminder (Recurring)
    if (stateWithPermission.dailyPrimeEnabled) {
      const dailyPrimeResult = evaluateDailyPrime(stateWithPermission, context);
      if (dailyPrimeResult.eligible && dailyPrimeResult.fireDate) {
        const template = selectNotificationTemplate({
          category: 'daily_prime',
          tone: stateWithPermission.notificationTone,
          lastTemplateIdByCategory: stateWithPermission.lastTemplateIdByCategory,
        });
        const rendered = renderNotificationTemplate({
          template,
          variables: dailyPrimeResult.variables,
        });

        const notificationId = await NotificationService.scheduleSmartNotification({
          category: 'daily_prime',
          templateId: template.id,
          tone: stateWithPermission.notificationTone,
          title: rendered.title,
          body: rendered.body,
          fireDate: dailyPrimeResult.fireDate,
          repeatsDaily: true,
        });

        if (notificationId) {
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SCHEDULED, {
            category: 'daily_prime',
            templateId: template.id,
            tone: stateWithPermission.notificationTone,
            sentAt: dailyPrimeResult.fireDate.toISOString(),
          });
          nextState = markSmartNotificationScheduled(nextState, dailyPrimeResult, template.id);
        }
      } else {
        await NotificationService.cancelSmartNotification('daily_prime');
      }
    } else {
      await NotificationService.cancelSmartNotification('daily_prime');
    }

    // 2. Situational Smart Nudges (Thread Strength, Unfinished Anchor, Weekly Recap)
    const situationalRules: NotificationRuleResult[] = [
      evaluateThreadStrength(stateWithPermission, context),
      evaluateUnfinishedAnchor(stateWithPermission, context),
      evaluateWeeklyRecap(stateWithPermission, context),
    ];
    const situationalCandidate = situationalRules.find(
      (candidate) => candidate.eligible && candidate.fireDate
    );

    if (situationalCandidate?.fireDate) {
      // Cancel other situational categories so only the active one is queued
      await Promise.all(
        (['thread_strength', 'unfinished_anchor', 'weekly_recap'] as NotificationCategory[])
          .filter((cat) => cat !== situationalCandidate.category)
          .map((cat) => NotificationService.cancelSmartNotification(cat))
      );

      const template = selectNotificationTemplate({
        category: situationalCandidate.category,
        tone: stateWithPermission.notificationTone,
        lastTemplateIdByCategory: stateWithPermission.lastTemplateIdByCategory,
      });
      const rendered = renderNotificationTemplate({
        template,
        variables: situationalCandidate.variables,
      });

      const notificationId = await NotificationService.scheduleSmartNotification({
        category: situationalCandidate.category,
        templateId: template.id,
        tone: stateWithPermission.notificationTone,
        title: rendered.title,
        body: rendered.body,
        fireDate: situationalCandidate.fireDate,
        anchorId: situationalCandidate.anchorId,
      });

      if (notificationId) {
        AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SCHEDULED, {
          category: situationalCandidate.category,
          templateId: template.id,
          tone: stateWithPermission.notificationTone,
          anchorId: situationalCandidate.anchorId,
          sentAt: situationalCandidate.fireDate.toISOString(),
        });
        nextState = markSmartNotificationScheduled(nextState, situationalCandidate, template.id);
      }
    } else {
      await Promise.all(
        (['thread_strength', 'unfinished_anchor', 'weekly_recap'] as NotificationCategory[]).map(
          (cat) => NotificationService.cancelSmartNotification(cat)
        )
      );
    }

    return nextState;
  }), [buildRuleContext, cancelSmartNotifications, markSmartNotificationScheduled]);

  const initOnAppOpen = useCallback(async () => {
    try {
      let state = await loadState();
      state = reconcile(state);
      state.last_app_open_at = new Date().toISOString();
      state.app_opened_in_last_5_days = true;

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
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void initOnAppOpen();
      }
    });
    return () => {
      subscription.remove();
    };
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
      state.current_primes = 0;
      state.has_reached_goal_today = false;
      state.has_entered_burn_flow = false;
      state.sigil_in_vault = false;

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
        // Request OS permission BEFORE scheduling. getRemotePushRegistration()
        // triggers the permission prompt; scheduleSmartNotifications() reads the
        // resulting permission status, so on a first-time enable scheduling must
        // run after the prompt or every rule is rejected as undetermined.
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
        state = await scheduleSmartNotifications(state);
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
    | 'notificationTone'
  >>) => {
    try {
      let state = reconcile(await loadState());

      if (updates.dailyPrimeEnabled === false && state.dailyPrimeEnabled) {
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_DISABLED, {
          source: 'settings',
        });
      } else if (updates.dailyPrimeEnabled === true && !state.dailyPrimeEnabled) {
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_SCHEDULED, {
          source: 'settings',
          time: updates.dailyPrimeTime ?? state.dailyPrimeTime,
        });
      }
      if (
        typeof updates.dailyPrimeTime === 'string' &&
        updates.dailyPrimeTime !== state.dailyPrimeTime
      ) {
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_TIME_CHANGED, {
          source: 'settings',
          time: updates.dailyPrimeTime,
        });
      }

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
    // The daily-reminder prompt card (shown on the Anchor completion screen and,
    // as a fallback, after the first prime) now owns the permission ask. We only
    // reconcile + reschedule here so state stays fresh after a save.
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
  }, [loadState, reconcile, saveState, scheduleSmartNotifications, syncStateToServer]);

  /**
   * Resolve reminder eligibility at the first-Anchor moment instead of relying
   * on the hook's initial asynchronous hydration. This prevents a fast
   * onboarding path from silently skipping the prompt while `notifState` is
   * still null. If permission was already granted, we still offer the card so
   * the new account can choose its reminder time; a denied permission remains
   * respected.
   */
  const canOfferFirstAnchorReminder = useCallback(async (): Promise<boolean> => {
    try {
      const state = reconcile(await loadState());
      const notificationPermissionStatus = await NotificationService.getPermissionStatus();
      const refreshedState = {
        ...state,
        notificationPermissionStatus,
      };

      await saveState(refreshedState);

      return (
        notificationPermissionStatus !== 'denied' &&
        !refreshedState.firstAnchorReminderPromptCompleted
      );
    } catch (err) {
      logger.warn('[NotificationController] Failed to resolve first-anchor reminder eligibility', err);
      return false;
    }
  }, [loadState, reconcile, saveState]);

  /**
   * Record that the daily-reminder prompt card was shown for a given moment.
   * Tracks the first time the prompt is surfaced without nagging on re-entry.
   */
  const markReminderPromptShown = useCallback(async (
    source: 'first_anchor' | 'fallback'
  ) => {
    try {
      const state = reconcile(await loadState());
      AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PROMPT_CARD_VIEWED, { source });
      if (!state.notificationPromptShownAt) {
        state.notificationPromptShownAt = new Date().toISOString();
        await saveState(state);
        const syncedState = await syncStateToServer(state);
        if (syncedState) {
          await saveState(syncedState);
        }
      }
    } catch (err) {
      logger.error('[NotificationController] markReminderPromptShown error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  /**
   * Mark a reminder prompt moment as resolved so we never nag the user there
   * again — regardless of whether they scheduled, denied, or skipped.
   */
  const completeReminderPrompt = useCallback(async (
    source: 'first_anchor' | 'fallback'
  ) => {
    try {
      const state = reconcile(await loadState());
      if (source === 'first_anchor') {
        state.firstAnchorReminderPromptCompleted = true;
      } else {
        state.fallbackReminderPromptCompleted = true;
      }
      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }
    } catch (err) {
      logger.error('[NotificationController] completeReminderPrompt error:', err);
    }
  }, [loadState, reconcile, saveState, syncStateToServer]);

  /**
   * Triggered only after the user has expressed clear intent (tapped
   * "Set Daily Reminder" and chosen a time). Fires the native OS permission
   * prompt, and on grant enables + schedules the daily prime reminder.
   * Returns the resulting permission status.
   */
  const setDailyPrimeReminder = useCallback(async (
    time: string,
    source: 'first_anchor' | 'fallback'
  ): Promise<'granted' | 'denied'> => {
    try {
      let state = reconcile(await loadState());

      AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_PROMPT_SHOWN, { source });
      const granted = await NotificationService.requestPermissions();

      state.notificationPermissionStatus = granted ? 'granted' : 'denied';
      state.notification_enabled = granted;
      if (!state.notificationPromptShownAt) {
        state.notificationPromptShownAt = new Date().toISOString();
      }

      if (granted) {
        state.dailyPrimeEnabled = true;
        state.dailyPrimeTime = time;
        AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED, { source });

        if (useAuthStore.getState().isAuthenticated) {
          const registration = await NotificationService.getRemotePushRegistration();
          if (registration.permissionGranted) {
            await syncPushTokensToServer({
              expoPushToken: registration.expoPushToken,
              fcmToken: registration.fcmToken,
              apnsToken: registration.apnsToken,
            });
          }
        }

        state = await scheduleSmartNotifications(state);
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_SCHEDULED, {
          source,
          time,
        });
      } else {
        AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED, { source });
        await cancelSmartNotifications(buildRuleContext());
      }

      await saveState(state);
      const syncedState = await syncStateToServer(state);
      if (syncedState) {
        await saveState(syncedState);
      }

      return granted ? 'granted' : 'denied';
    } catch (err) {
      logger.error('[NotificationController] setDailyPrimeReminder error:', err);
      return 'denied';
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
    canOfferFirstAnchorReminder,
    markReminderPromptShown,
    completeReminderPrompt,
    setDailyPrimeReminder,
  };
};

export async function recordNotificationDelivered(
  category: NotificationCategory,
  anchorId?: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    const state = normalizeNotificationState(
      stored ? JSON.parse(stored) : initializeNotificationState()
    );
    const now = new Date().toISOString();
    state.lastNotificationSentAt = {
      ...(state.lastNotificationSentAt ?? {}),
      [category]: now,
    };
    if (category === 'unfinished_anchor' && anchorId) {
      state.unfinishedAnchorReminders = {
        ...(state.unfinishedAnchorReminders ?? {}),
        [anchorId]: {
          startedAt: state.unfinishedAnchorReminders?.[anchorId]?.startedAt ?? now,
          sentAt: now,
        },
      };
    }
    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.warn('[NotificationController] Failed to record notification delivery', error);
  }
}
