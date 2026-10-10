import { AppState, type AppStateStatus } from 'react-native';
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
  type PendingSmartNotification,
  readPendingSmartNotification,
  writePendingSmartNotification,
} from '@/services/notifications/pendingNotificationStore';
import {
  getPendingNotificationStateSync,
  type SyncedNotificationState,
  syncNotificationStateToServer,
} from '@/services/NotificationSyncService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { PracticeSessionRecord } from '@/types/practice';
import { logger } from '@/utils/logger';
import { buildThreadStrengthSnapshot, selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';

type NotificationStateWithSyncMetadata = SyncedNotificationState;

const SMART_NOTIFICATION_PRIORITY: NotificationCategory[] = [
  'thread_strength',
  'unfinished_anchor',
  'weekly_recap',
];

const DAILY_PRIME_HORIZON_DAYS = 7;

let coordinatorQueue: Promise<unknown> = Promise.resolve();

const runExclusively = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = coordinatorQueue.then(task, task);
  coordinatorQueue = result.catch(() => undefined);
  return result;
};

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

class NotificationCoordinatorClass {
  private isInitialized = false;
  private appStateSubscription: { remove: () => void } | null = null;
  private authSubscription: (() => void) | null = null;
  private currentUserId: string | null = null;
  private lastPersonalReminderConfig: {
    isEnabled: boolean;
    time: string;
    title: string;
    body: string;
  } | null = null;

  /**
   * Initializes the root notification coordinator once per application lifecycle.
   */
  public initialize(): () => void {
    if (this.isInitialized) {
      return () => this.destroy();
    }

    this.isInitialized = true;
    this.currentUserId = useAuthStore.getState().user?.id ?? null;

    // Listen for app foregrounding to reconcile on resume
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void this.reconcile();
        }
      }
    );

    // Track user session changes to prevent leaking notification preferences across accounts
    this.authSubscription = useAuthStore.subscribe((state) => {
      const nextUserId = state.user?.id ?? null;
      if (nextUserId !== this.currentUserId) {
        this.currentUserId = nextUserId;
        this.lastPersonalReminderConfig = null;
        void this.reconcile({ force: true, forcePersonalReminder: true, verifyNative: true });
      }
    });

    // Run initial reconciliation on mount verifying native scheduled truth
    void this.reconcile({ verifyNative: true });

    logger.info('[NotificationCoordinator] Initialized successfully');
    return () => this.destroy();
  }

  public destroy(): void {
    if (!this.isInitialized) return;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.authSubscription?.();
    this.authSubscription = null;
    this.lastPersonalReminderConfig = null;
    this.isInitialized = false;
    logger.info('[NotificationCoordinator] Destroyed listeners');
  }

  private async loadState(): Promise<NotificationStateWithSyncMetadata> {
    const stored = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    return normalizeNotificationState(
      stored ? JSON.parse(stored) : initializeNotificationState()
    );
  }

  private async saveState(state: NotificationStateWithSyncMetadata): Promise<void> {
    await AsyncStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(state));
  }

  private async syncStateToServer(
    state: NotificationStateWithSyncMetadata
  ): Promise<NotificationStateWithSyncMetadata | null> {
    if (!useAuthStore.getState().isAuthenticated) {
      return null;
    }

    const pendingState = await getPendingNotificationStateSync();
    const nextState = pendingState ? { ...pendingState, ...state } : state;
    return syncNotificationStateToServer(nextState);
  }

  private syncWithStores(
    state: NotificationStateWithSyncMetadata
  ): NotificationStateWithSyncMetadata {
    const now = new Date();
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();
    const settingsState = useSettingsStore.getState();
    const accountId = useAuthStore.getState().user?.id ?? null;
    const dailyPracticeGoal = settingsState.dailyPracticeGoal ?? 3;
    const hasCanonicalLedger =
      Array.isArray(sessionState.practiceHistory) && Boolean(accountId);
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
              return (
                !Number.isNaN(completedAt.getTime()) &&
                now.getTime() - completedAt.getTime() < 7 * 86_400_000
              );
            }).length
      ),
      primed_today:
        state.primed_today ||
        currentPrimes > 0 ||
        canonicalEvents.some((entry) => entry.localDateKey === localDateString(now)),
      last_prime_at: latestPrime,
      has_reached_goal_today:
        state.has_reached_goal_today || currentPrimes >= dailyPracticeGoal,
      threadStrength: hasCanonicalLedger
        ? metrics.score
        : (sessionState.threadStrength ?? 0),
      unfinishedAnchorReminders,
    };
  }

  private normalizeLifecycleState(
    input: NotificationStateWithSyncMetadata
  ): NotificationStateWithSyncMetadata {
    const now = new Date();
    const state = this.syncWithStores({ ...input });
    const lastPrimeDate = state.last_prime_at ? new Date(state.last_prime_at) : null;
    const daysSince = daysBetween(state.last_prime_at, now);

    if (lastPrimeDate && !isSameDay(now, lastPrimeDate)) {
      state.primed_today = false;
      state.has_reached_goal_today = false;
      state.current_primes = 0;
    }

    if (daysSince > 1) {
      state.missed_yesterday = true;
      state.miss_streak = daysSince - 1;
    } else if (daysSince === 1 && !state.primed_today) {
      state.missed_yesterday = true;
      state.miss_streak = 1;
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
  }

  private buildRuleContext(): NotificationRuleContext {
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();
    const settingsState = useSettingsStore.getState();
    const accountId = useAuthStore.getState().user?.id ?? null;
    const now = new Date();
    const hasCanonicalLedger =
      Array.isArray(sessionState.practiceHistory) && Boolean(accountId);
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
      totalSessionsCount: hasCanonicalLedger
        ? metrics.totalSessions
        : sessionState.totalSessionsCount,
      threadStrength: hasCanonicalLedger
        ? metrics.score
        : (sessionState.threadStrength ?? 0),
      anchors: anchorState.anchors,
    };
  }

  private async cancelSmartNotifications(
    context?: NotificationRuleContext
  ): Promise<void> {
    await Promise.all(
      SMART_NOTIFICATION_PRIORITY.map((category) =>
        NotificationService.cancelSmartNotification(category)
      )
    );

    await Promise.all(
      (context?.anchors ?? []).map((anchor) =>
        NotificationService.cancelSmartNotification(
          'unfinished_anchor',
          anchor.localId ?? anchor.id
        )
      )
    );

    await writePendingSmartNotification(null);
  }

  /**
   * Reconciles the personal daily reminder natively.
   * Ensures exactly one active schedule exists at the selected time.
   * Idempotent: if the reminder already matches the desired configuration, leaves it untouched.
   */
  private async reconcilePersonalDailyReminder(
    state: NotificationStateWithSyncMetadata,
    options?: { forcePersonalReminder?: boolean; verifyNative?: boolean }
  ): Promise<void> {
    const isEnabled = Boolean(
      state.notification_enabled &&
      state.notificationPermissionStatus === 'granted' &&
      state.personalDailyReminderOptedIn &&
      state.dailyPrimeEnabled &&
      state.dailyPrimeTime
    );

    const title = 'Your moment of focus';
    const body = 'Take a moment to reconnect with what matters. Your Anchor is ready.';

    if (!isEnabled) {
      if (this.lastPersonalReminderConfig?.isEnabled !== false || options?.forcePersonalReminder) {
        await NotificationService.cancelPersonalDailyReminder();
        this.lastPersonalReminderConfig = { isEnabled: false, time: '', title: '', body: '' };
      }
      return;
    }

    const isConfigUnchanged =
      this.lastPersonalReminderConfig?.isEnabled === true &&
      this.lastPersonalReminderConfig?.time === state.dailyPrimeTime &&
      this.lastPersonalReminderConfig?.title === title &&
      this.lastPersonalReminderConfig?.body === body;

    if (!options?.forcePersonalReminder && !options?.verifyNative && isConfigUnchanged) {
      // Unchanged reminder configuration: leave untouched
      return;
    }

    const scheduledId = await NotificationService.schedulePersonalDailyReminder(state.dailyPrimeTime, {
      title,
      body,
      force: options?.forcePersonalReminder,
    });

    if (scheduledId) {
      this.lastPersonalReminderConfig = {
        isEnabled: true,
        time: state.dailyPrimeTime,
        title,
        body,
      };
    } else {
      // Scheduling failed: do not report false success
      this.lastPersonalReminderConfig = null;
    }
  }

  /**
   * Directly verifies and reconciles with native scheduled notification state.
   */
  public async verifyAndReconcileNativeSchedule(): Promise<NotificationStateWithSyncMetadata> {
    return this.reconcile({ verifyNative: true });
  }

  /**
   * Reconciles notification schedules and synchronization state.
   */
  public async reconcile(options: {
    force?: boolean;
    forcePersonalReminder?: boolean;
    verifyNative?: boolean;
  } = {}): Promise<NotificationStateWithSyncMetadata> {
    return runExclusively(async () => {
      let state = await this.loadState();
      state = this.normalizeLifecycleState(state);
      state.last_app_open_at = new Date().toISOString();
      state.app_opened_in_last_5_days = true;

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

      // Reconcile Personal Daily Reminder independently (idempotent, untouched if unchanged)
      await this.reconcilePersonalDailyReminder(stateWithPermission, options);

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
        await this.saveState(stateWithPermission);
        return stateWithPermission;
      }

      await NotificationService.cancelNotification('micro-prime');
      await NotificationService.cancelWeeklySummary();

      const context = this.buildRuleContext();
      await this.cancelSmartNotifications(context);

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

      let finalState = stateWithPermission;
      if (result?.fireDate) {
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

        if (notificationId) {
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

          finalState = {
            ...stateWithPermission,
            lastTemplateIdByCategory: {
              ...(stateWithPermission.lastTemplateIdByCategory ?? {}),
              [result.category]: template.id,
            },
          };
        }
      }

      await this.saveState(finalState);
      const syncedState = await this.syncStateToServer(finalState);
      if (syncedState) {
        await this.saveState(syncedState);
        return syncedState;
      }
      return finalState;
    });
  }

  /**
   * Called by PracticeCompletionService when a practice session completes.
   * Updates state without cancelling the user's personal daily reminder.
   */
  public async recordPracticeCompleted(
    record: PracticeSessionRecord
  ): Promise<void> {
    try {
      await runExclusively(async () => {
        let state = await this.loadState();
        state = this.normalizeLifecycleState(state);

        state.primed_today = true;
        state.last_prime_at = record.completedAt ?? new Date().toISOString();
        state.missed_yesterday = false;
        state.miss_streak = 0;

        state = this.syncWithStores(state);
        state.has_reached_goal_today = state.current_primes >= state.goal_primes;

        await this.saveState(state);
      });

      // Reconcile smart notifications with force: true to suppress same-day nudges.
      // Personal daily reminder is preserved!
      await this.reconcile({ force: true });
    } catch (error) {
      logger.error('[NotificationCoordinator] recordPracticeCompleted error:', error);
    }
  }
}

export const NotificationCoordinator = new NotificationCoordinatorClass();
