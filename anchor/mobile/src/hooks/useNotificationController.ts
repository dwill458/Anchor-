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
  NotificationMilestone,
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
  'milestone',
  'thread_strength',
  'unfinished_anchor',
  'weekly_recap',
  'daily_prime',
];

/**
 * How many days of daily prime reminders are queued ahead of time.
 *
 * Local notifications are only (re)scheduled while the app runs, so a single
 * one-shot reminder means a user who stops opening Anchor stops being reminded
 * after the very first notification. Queueing a horizon keeps the reminder
 * arriving without the app running. Occurrences beyond today only ever fire on
 * days the app was not opened — which are, by definition, days without a
 * completed session — so the "skip the day you already primed" rule still holds.
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

  if (pending.category === 'milestone' && pending.milestone) {
    next.sentMilestones = Array.from(
      new Set([...(state.sentMilestones ?? []), pending.milestone])
    );
  }

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
 * Queue the daily prime reminder for the days after the first occurrence.
 * Occurrence 0 is scheduled by the caller as the winning rule result.
 */
const scheduleDailyPrimeHorizon = async ({
  firstFireDate,
  tone,
  template,
  rendered,
}: {
  firstFireDate: Date;
  tone: NotificationTone;
  template: NotificationTemplate;
  rendered: { title: string; body: string };
}): Promise<void> => {
  for (let dayOffset = 1; dayOffset < DAILY_PRIME_HORIZON_DAYS; dayOffset += 1) {
    const fireDate = new Date(firstFireDate.getTime() + dayOffset * MS_PER_DAY);
    await NotificationService.scheduleSmartNotification({
      category: 'daily_prime',
      templateId: template.id,
      tone,
      title: rendered.title,
      body: rendered.body,
      fireDate,
      occurrence: dayOffset,
    });
  }
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
      restDays: settingsState.restDays,
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
        category === 'daily_prime'
          ? NotificationService.cancelSmartNotificationSeries(category, DAILY_PRIME_HORIZON_DAYS)
          : NotificationService.cancelSmartNotification(category)
      )
    );

    await Promise.all(
      (context?.anchors ?? []).map((anchor) =>
        NotificationService.cancelSmartNotification('unfinished_anchor', anchor.localId ?? anchor.id)
      )
    );

    await writePendingSmartNotification(null);
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

    const result = evaluateNotificationRules(stateWithPermission, context)
      .find((candidate) => candidate.eligible && candidate.fireDate);

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
      milestone: result.milestone,
    });

    if (!notificationId) {
      return stateWithPermission;
    }

    if (result.category === 'daily_prime') {
      await scheduleDailyPrimeHorizon({
        firstFireDate: result.fireDate,
        tone: stateWithPermission.notificationTone,
        template,
        rendered,
      });
    }

    await writePendingSmartNotification({
      identifier: notificationId,
      category: result.category,
      fireDate: result.fireDate.toISOString(),
      anchorId: result.anchorId,
      milestone: result.milestone as NotificationMilestone | undefined,
    });

    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_SCHEDULED, {
      category: result.category,
      templateId: template.id,
      tone: stateWithPermission.notificationTone,
      anchorId: result.anchorId,
      sentAt: result.fireDate.toISOString(),
    });

    return markSmartNotificationScheduled(stateWithPermission, result, template.id);
  }, [buildRuleContext, cancelSmartNotifications, markSmartNotificationScheduled]);

  const initOnAppOpen = useCallback(async () => {
    try {
      await runExclusively(async () => {
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

      if (
        !state.sovereign_rank &&
        isSovereign(state.total_primes_all_time, state.alchemist_milestones_count)
      ) {
        state.sovereign_rank = true;
      }

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
        await NotificationService.cancelNotification('micro-prime');
        await NotificationService.cancelWeeklySummary();
        await cancelSmartNotifications(buildRuleContext());
        if (isAuthenticated) {
          await clearPushTokensFromServer();
        }
      } else {
        // Request OS permission BEFORE scheduling. scheduleSmartNotifications()
        // reads the resulting permission status, so on a first-time enable the
        // prompt has to come first or every rule is rejected as undetermined.
        // Android 13+ never shows the POST_NOTIFICATIONS prompt unless the app
        // asks, and local reminders need it just as much as remote push does —
        // so the ask is not gated on being signed in.
        const registration = isAuthenticated
          ? await NotificationService.getRemotePushRegistration()
          : { permissionGranted: await NotificationService.requestPermissions() };

        if (registration.permissionGranted) {
          state.notificationPermissionStatus = 'granted';
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_GRANTED);
          if (isAuthenticated && 'expoPushToken' in registration) {
            await syncPushTokensToServer({
              expoPushToken: registration.expoPushToken,
              fcmToken: registration.fcmToken,
              apnsToken: registration.apnsToken,
            });
          }
        } else {
          state.notificationPermissionStatus = 'denied';
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED);
          if (isAuthenticated) {
            await clearPushTokensFromServer();
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
    | 'threadStrengthAlertsEnabled'
    | 'threadStrengthThreshold'
    | 'unfinishedAnchorRemindersEnabled'
    | 'weeklyRecapEnabled'
    | 'milestoneNotificationsEnabled'
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

        state = await scheduleSmartNotifications(state, { force: true });
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
