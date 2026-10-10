import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '@/services/NotificationService';
import {
  type NotificationState,
  type ReminderInvitationOutcome,
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
  NotificationTemplate,
  NotificationTone,
} from '@/services/notifications/notificationTypes';
import {
  type PendingSmartNotification,
  readPendingSmartNotification,
  writePendingSmartNotification,
} from '@/services/notifications/pendingNotificationStore';
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
];

/**
 * Legacy horizon constant preserved for migration cleanup only.
 * Personal daily reminders now use the native repeating DAILY trigger.
 */
const DAILY_PRIME_HORIZON_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fold a reminder that has already fired into the "sent" ledger. Delivery — not
 * scheduling — is what the frequency rules throttle on.
 */
const recordDeliveredNotification = (
  state: NotificationStateWithSyncMetadata,
  pending: PendingSmartNotification
): NotificationStateWithSyncMetadata => {
  const deliveredAt = pending.fireDate;
  const next: NotificationStateWithSyncMetadata = {
    ...state,
    lastNotificationSentAt: {
      ...(state.lastNotificationSentAt ?? {}),
      [pending.category]: deliveredAt,
    },
  };

  if (pending.category === 'unfinished_anchor' && pending.anchorId) {
    next.unfinishedAnchorReminders = {
      ...(state.unfinishedAnchorReminders ?? {}),
      [pending.anchorId]: {
        startedAt:
          state.unfinishedAnchorReminders?.[pending.anchorId]?.startedAt ?? deliveredAt,
        sentAt: deliveredAt,
      },
    };
  }

  return next;
};


/**
 * `useNotificationController` is mounted by several screens at once, so the
 * load → schedule → save cycle is serialized to stop concurrent instances from
 * cancelling each other's work.
 */
let schedulerQueue: Promise<unknown> = Promise.resolve();

const runExclusively = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = schedulerQueue.then(task, task);
  schedulerQueue = result.catch(() => undefined);
  return result;
};

/*
 * Non-hook writers for the reminder invitation's two pure state writes. Mounting the controller hook
 * starts its app-open reconcile/scheduling effects, which a navigator route or the invitation screen
 * must not do just by appearing. These share the hook's storage, normalization, server sync and the
 * same `runExclusively` queue, so they never race a mounted controller.
 */
const loadStoredNotificationState = async (): Promise<NotificationStateWithSyncMetadata> => {
  const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
  return normalizeNotificationState(stored ? JSON.parse(stored) : initializeNotificationState());
};

const persistAndSyncStoredNotificationState = async (next: NotificationStateWithSyncMetadata) => {
  await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(next));
  if (!useAuthStore.getState().isAuthenticated) return;
  const pendingState = await getPendingNotificationStateSync();
  const synced = await syncNotificationStateToServer(pendingState ? { ...pendingState, ...next } : next);
  if (synced) {
    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(synced));
  }
};

/** Same contract as the hook's `markFirstPracticeCompleted`: idempotent state write, never consent. */
export const markFirstPracticeCompletedInStorage = async (): Promise<void> => {
  try {
    await runExclusively(async () => {
      const state = await loadStoredNotificationState();
      if (state.firstPracticeCompletedAt) return;
      await persistAndSyncStoredNotificationState({
        ...state,
        firstPracticeCompletedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    logger.error('[NotificationController] markFirstPracticeCompletedInStorage error:', err);
  }
};

/** Same contract as the hook's `recordInvitationOutcome`: never sets `personalDailyReminderOptedIn`. */
export const recordInvitationOutcomeInStorage = async (outcome: ReminderInvitationOutcome): Promise<void> => {
  try {
    await runExclusively(async () => {
      const state = await loadStoredNotificationState();
      await persistAndSyncStoredNotificationState({
        ...state,
        reminderInvitationShownAt: state.reminderInvitationShownAt ?? new Date().toISOString(),
        reminderInvitationOutcome: outcome,
      });
    });
  } catch (err) {
    logger.error('[NotificationController] recordInvitationOutcomeInStorage error:', err);
  }
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
      events: sessionState.practiceHistory ?? [],
      accountId,
      dailyGoal: dailyPracticeGoal,
      sensitivity: settingsState.threadStrengthSensitivity,
      restDays: settingsState.restDays,
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
      primed_today:
        state.primed_today ||
        currentPrimes > 0 ||
        canonicalEvents.some((entry) => entry.localDateKey === localDateString(now)),
      last_prime_at: latestPrime,
      has_reached_goal_today:
        state.has_reached_goal_today || currentPrimes >= dailyPracticeGoal,
      threadStrength: hasCanonicalLedger ? metrics.score : (sessionState.threadStrength ?? 0),
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
      events: sessionState.practiceHistory ?? [],
      accountId,
      dailyGoal: settingsState.dailyPracticeGoal,
      sensitivity: settingsState.threadStrengthSensitivity,
      restDays: settingsState.restDays,
      now,
    });

    return {
      now,
      sessionLog: sessionState.sessionLog,
      practiceHistory: sessionState.practiceHistory,
      accountId,
      totalSessionsCount: hasCanonicalLedger ? metrics.totalSessions : sessionState.totalSessionsCount,
      threadStrength: hasCanonicalLedger ? metrics.score : (sessionState.threadStrength ?? 0),
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

    // Migration cleanup: clear legacy 7-day daily_prime horizon series if present
    await NotificationService.cancelSmartNotificationSeries('daily_prime', DAILY_PRIME_HORIZON_DAYS);

    await writePendingSmartNotification(null);
  }, []);

  const reconcilePersonalDailyReminder = useCallback(async (
    state: NotificationStateWithSyncMetadata
  ): Promise<void> => {
    const isEnabled = Boolean(
      state.notification_enabled &&
      state.notificationPermissionStatus === 'granted' &&
      state.personalDailyReminderOptedIn &&
      state.dailyPrimeEnabled &&
      state.dailyPrimeTime
    );

    if (!isEnabled) {
      await NotificationService.cancelPersonalDailyReminder();
      return;
    }

    await NotificationService.schedulePersonalDailyReminder(state.dailyPrimeTime, {
      title: 'Your moment of focus',
      body: 'Take a moment to reconnect with what matters. Your Anchor is ready.',
    });
  }, []);

  const markSmartNotificationScheduled = useCallback((
    state: NotificationStateWithSyncMetadata,
    result: NotificationRuleResult,
    templateId: string
  ): NotificationStateWithSyncMetadata => ({
    ...state,
    lastTemplateIdByCategory: {
      ...(state.lastTemplateIdByCategory ?? {}),
      [result.category]: templateId,
    },
  }), []);

  /**
   * Cancel everything and queue the highest-priority eligible reminder.
   *
   * A reminder that is already queued and has not fired yet is left alone
   * unless `force` is set. This hook is mounted by several screens, and each
   * mount re-runs the scheduler: cancelling first and re-evaluating afterwards
   * meant the freshly scheduled reminder was thrown away and — because the
   * frequency rules then saw it as "just sent" — nothing was queued in its
   * place, so the device ended up with no notifications at all.
   */
  const scheduleSmartNotifications = useCallback(async (
    state: NotificationStateWithSyncMetadata,
    options: { force?: boolean } = {}
  ): Promise<NotificationStateWithSyncMetadata> => {
    const now = new Date();
    const pending = await readPendingSmartNotification();
    const pendingFireTime = pending ? new Date(pending.fireDate).getTime() : null;
    const hasFired = pendingFireTime != null && pendingFireTime <= now.getTime();

    let workingState = state;
    if (pending && hasFired) {
      workingState = recordDeliveredNotification(state, pending);
      await writePendingSmartNotification(null);
    }

    const permissionStatus = await NotificationService.getPermissionStatus();
    const stateWithPermission = {
      ...workingState,
      notificationPermissionStatus: permissionStatus,
    };

    // Reconcile user-scheduled repeating personal daily reminder independently
    await reconcilePersonalDailyReminder(stateWithPermission);

    const hasActivePersonalReminder = Boolean(
      stateWithPermission.notification_enabled &&
      stateWithPermission.notificationPermissionStatus === 'granted' &&
      stateWithPermission.personalDailyReminderOptedIn &&
      stateWithPermission.dailyPrimeEnabled &&
      stateWithPermission.dailyPrimeTime
    );

    const stillQueued = Boolean(pending && !hasFired);
    if (
      stillQueued &&
      !options.force &&
      permissionStatus === 'granted' &&
      stateWithPermission.notification_enabled
    ) {
      return stateWithPermission;
    }

    await NotificationService.cancelNotification('micro-prime');
    await NotificationService.cancelWeeklySummary();

    const context = buildRuleContext();
    await cancelSmartNotifications(context);

    // If personal daily reminder is active for today, suppress competing discretionary engagement notifications (like thread_strength and unfinished_anchor)
    const ruleResults = evaluateNotificationRules(stateWithPermission, context);
    const result = ruleResults.find((candidate) => {
      if (!candidate.eligible || !candidate.fireDate) return false;
      if (
        hasActivePersonalReminder &&
        (candidate.category === 'thread_strength' ||
          candidate.category === 'unfinished_anchor' ||
          candidate.category === 'daily_prime')
      ) {
        return false;
      }
      if (candidate.category === 'daily_prime') {
        return false;
      }
      return true;
    });

    if (!result?.fireDate) {
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
    });

    if (!notificationId) {
      return stateWithPermission;
    }

    await writePendingSmartNotification({
      identifier: notificationId,
      category: result.category,
      fireDate: result.fireDate.toISOString(),
      anchorId: result.anchorId,
    });

    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SCHEDULED, {
      category: result.category,
      templateId: template.id,
      tone: stateWithPermission.notificationTone,
      anchorId: result.anchorId,
      sentAt: result.fireDate.toISOString(),
    });

    return markSmartNotificationScheduled(stateWithPermission, result, template.id);
  }, [
    buildRuleContext,
    cancelSmartNotifications,
    markSmartNotificationScheduled,
    reconcilePersonalDailyReminder,
  ]);

  const initOnAppOpen = useCallback(async () => {
    try {
      await runExclusively(async () => {
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
      });
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
        await runExclusively(async () => {
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
        });
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

      state = await scheduleSmartNotifications(state, { force: true });
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
      state = await scheduleSmartNotifications(state, { force: true });
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
        await NotificationService.cancelPersonalDailyReminder();
        await NotificationService.cancelNotification('micro-prime');
        await NotificationService.cancelWeeklySummary();
        await cancelSmartNotifications(buildRuleContext());
        if (isAuthenticated) {
          try {
            await clearPushTokensFromServer();
          } catch (syncErr) {
            logger.warn('[NotificationController] Failed to clear push tokens on disable:', syncErr);
          }
        }
      } else {
        const granted = await NotificationService.requestPermissions();
        state.notificationPermissionStatus = granted ? 'granted' : 'denied';

        if (granted) {
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED);
          if (isAuthenticated) {
            try {
              const registration = await NotificationService.getRemotePushRegistration();
              if (registration.expoPushToken) {
                await syncPushTokensToServer({
                  expoPushToken: registration.expoPushToken,
                  fcmToken: registration.fcmToken,
                  apnsToken: registration.apnsToken,
                });
              }
            } catch (tokenErr) {
              logger.warn('[NotificationController] Failed to sync push tokens (local reminders still active):', tokenErr);
            }
          }
        } else {
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED);
          await NotificationService.cancelPersonalDailyReminder();
          await cancelSmartNotifications(buildRuleContext());
          if (isAuthenticated) {
            try {
              await clearPushTokensFromServer();
            } catch (syncErr) {
              logger.warn('[NotificationController] Failed to clear push tokens on deny:', syncErr);
            }
          }
        }

        state = await scheduleSmartNotifications(state, { force: true });
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
    | 'personalDailyReminderOptedIn'
    | 'threadStrengthAlertsEnabled'
    | 'threadStrengthThreshold'
    | 'unfinishedAnchorRemindersEnabled'
    | 'weeklyRecapEnabled'
    | 'notificationTone'
    | 'visionRemindersEnabled'
    | 'chartRemindersEnabled'
    | 'momentumCheckinsEnabled'
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

      const personalDailyReminderOptedIn =
        typeof updates.personalDailyReminderOptedIn === 'boolean'
          ? updates.personalDailyReminderOptedIn
          : updates.dailyPrimeEnabled === true
          ? true
          : updates.dailyPrimeEnabled === false
          ? false
          : state.personalDailyReminderOptedIn;

      state = {
        ...state,
        ...updates,
        personalDailyReminderOptedIn,
        dailyPrimeTime: updates.dailyPrimeTime ?? state.dailyPrimeTime,
        threadStrengthThreshold:
          updates.threadStrengthThreshold != null
            ? Math.min(100, Math.max(0, Math.round(updates.threadStrengthThreshold)))
            : state.threadStrengthThreshold,
        notificationTone: (updates.notificationTone ?? state.notificationTone) as NotificationTone,
      };

      state = await scheduleSmartNotifications(state, { force: true });
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
        state = await scheduleSmartNotifications(state, { force: true });
      } else {
        await NotificationService.cancelPersonalDailyReminder();
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
        refreshedState.notification_enabled &&
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
        state.personalDailyReminderOptedIn = true;
        state.dailyPrimeEnabled = true;
        state.dailyPrimeTime = time;
        AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED, { source });

        if (useAuthStore.getState().isAuthenticated) {
          try {
            const registration = await NotificationService.getRemotePushRegistration();
            if (registration.expoPushToken) {
              await syncPushTokensToServer({
                expoPushToken: registration.expoPushToken,
                fcmToken: registration.fcmToken,
                apnsToken: registration.apnsToken,
              });
            }
          } catch (tokenErr) {
            logger.warn('[NotificationController] Push token sync failed during setDailyPrimeReminder:', tokenErr);
          }
        }

        state = await scheduleSmartNotifications(state, { force: true });
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_SCHEDULED, {
          source,
          time,
        });
      } else {
        AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED, { source });
        await NotificationService.cancelPersonalDailyReminder();
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

  /**
   * Enrollment-only writer for the personal daily reminder. Turns on the master
   * switch and the personal reminder, then schedules ONLY that reminder through
   * reconcilePersonalDailyReminder. It never touches weeklySummaryEnabled, push
   * tokens, or smart-category scheduling, because categories are independent.
   * Writes nothing and returns false unless OS permission is already granted.
   */
  const enableDailyReminderOnly = useCallback(async (time: string): Promise<boolean> => {
    try {
      return await runExclusively(async () => {
        const permission = await NotificationService.getPermissionStatus();
        if (permission !== 'granted') {
          return false;
        }

        const state: NotificationStateWithSyncMetadata = {
          ...reconcile(await loadState()),
          notification_enabled: true,
          notificationPermissionStatus: 'granted',
          personalDailyReminderOptedIn: true,
          dailyPrimeEnabled: true,
          dailyPrimeTime: time,
        };
        await reconcilePersonalDailyReminder(state);
        await saveState(state);
        AnalyticsService.track(AnalyticsEvents.DAILY_PRIME_REMINDER_SCHEDULED, {
          source: 'enrollment',
          time,
        });

        try {
          const syncedState = await syncStateToServer(state);
          if (syncedState) {
            await saveState(syncedState);
          }
        } catch (syncErr) {
          logger.warn('[NotificationController] enableDailyReminderOnly sync failed:', syncErr);
        }
        return true;
      });
    } catch (err) {
      logger.error('[NotificationController] enableDailyReminderOnly error:', err);
      return false;
    }
  }, [loadState, reconcile, reconcilePersonalDailyReminder, saveState, syncStateToServer]);

  /**
   * Record that the user finished their first practice. Idempotent (only sets
   * when null) and a pure state write: no scheduling, no reconcile, and never
   * consent. The reminder invitation reads this to decide whether to appear.
   */
  const markFirstPracticeCompleted = useCallback(async () => {
    try {
      await runExclusively(async () => {
        const state = await loadState();
        if (state.firstPracticeCompletedAt) {
          return;
        }
        const next = { ...state, firstPracticeCompletedAt: new Date().toISOString() };
        await saveState(next);
        const syncedState = await syncStateToServer(next);
        if (syncedState) {
          await saveState(syncedState);
        }
      });
    } catch (err) {
      logger.error('[NotificationController] markFirstPracticeCompleted error:', err);
    }
  }, [loadState, saveState, syncStateToServer]);

  /**
   * Record how the reminder invitation ended. Pure state write: it stamps the
   * first time the invitation was shown and the outcome, and never sets
   * `personalDailyReminderOptedIn` - consent is only recorded by the explicit
   * preference/permission path.
   */
  const recordInvitationOutcome = useCallback(async (outcome: ReminderInvitationOutcome) => {
    try {
      await runExclusively(async () => {
        const state = await loadState();
        const next = {
          ...state,
          reminderInvitationShownAt: state.reminderInvitationShownAt ?? new Date().toISOString(),
          reminderInvitationOutcome: outcome,
        };
        await saveState(next);
        const syncedState = await syncStateToServer(next);
        if (syncedState) {
          await saveState(syncedState);
        }
      });
    } catch (err) {
      logger.error('[NotificationController] recordInvitationOutcome error:', err);
    }
  }, [loadState, saveState, syncStateToServer]);

  return {
    notifState,
    isInitialized,
    markFirstPracticeCompleted,
    recordInvitationOutcome,
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
    enableDailyReminderOnly,
  };
};
