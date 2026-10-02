/**
 * Chart local notifications: a weekly recap and a single idle nudge, at most
 * two pushes a week, all through the existing NotificationService.
 *
 * - Never requests permission: it only reads the stored status.
 * - Only one anchor owns the chart pushes at a time (the most recently
 *   synced); the previous owner's pending pushes are cancelled.
 * - The recap is skipped when the existing Weekly Summary push is on.
 * - NotificationService.scheduleLocalNotification can only carry `deepLink` in
 *   the payload, so the anchor is encoded in `anchor://v2/chart/{anchorId}`;
 *   `parseChartNotificationTarget` reads it back (App.tsx tap handler).
 * - Never throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHART_MAX_PUSHES_PER_WEEK,
  type ChartNotificationKind,
  type ChartNotificationPlan,
} from '@/components/v2/chart/map/chartMapContracts';
import {
  countInRecapWeek,
  lastCompletedMoveAt,
  movesInRecapWeek,
  nextRecapSlot,
  planChartNotifications,
} from '@/components/v2/chart/map/chartRhythm';
import NotificationService, { NOTIFICATION_IDS } from '@/services/NotificationService';
import {
  NOTIFICATION_STATE_STORAGE_KEY,
  normalizeNotificationState,
} from '@/services/NotificationState';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { useSessionStore } from '@/stores/sessionStore';
import type { MoveSummary } from '@/types/chart';
import { logger } from '@/utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Memory entries older than this are dropped (they no longer count toward any week). */
const MEMORY_RETENTION_MS = 14 * DAY_MS;
const CHART_DEEP_LINK_PREFIX = 'anchor://v2/chart/';

export type ChartNotifyEntry = { kind: ChartNotificationKind; fireDate: string; anchorId: string };
export type ChartNotifyMemory = {
  idleNudgeScheduledFor: string | null;
  scheduled: ChartNotifyEntry[];
};

export type SyncChartNotificationsArgs = {
  anchorId: string;
  courseId: string;
  accountId?: string | null;
  view: { destination: string; oneMove: { title: string } | null };
  moves: MoveSummary[];
  now?: Date;
};

export const chartNotifyStorageKey = (accountId?: string | null): string =>
  `anchor:v2:chart2:notify:${encodeURIComponent(accountId ?? 'anonymous')}`;

export const chartNotificationId = (kind: ChartNotificationKind, anchorId: string): string =>
  `chart-${kind}:${anchorId}`;

/** Reads the chart target out of a tapped notification's `data`, or null when it is not a chart push. */
export function parseChartNotificationTarget(data: unknown): { anchorId: string } | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const deepLink = typeof record.deepLink === 'string' ? record.deepLink : '';
  const fromLink = deepLink.startsWith(CHART_DEEP_LINK_PREFIX)
    ? decodeURIComponent(deepLink.slice(CHART_DEEP_LINK_PREFIX.length).split(/[?#/]/)[0] ?? '')
    : '';
  const isChart = record.type === 'chart' || fromLink.length > 0;
  if (!isChart) return null;
  const fromData = typeof record.anchorId === 'string' ? record.anchorId : '';
  const anchorId = fromData || fromLink;
  return anchorId ? { anchorId } : null;
}

function emptyMemory(): ChartNotifyMemory {
  return { idleNudgeScheduledFor: null, scheduled: [] };
}

async function loadMemory(key: string): Promise<ChartNotifyMemory> {
  try {
    const raw = await encryptedPersistStorage.getItem(key);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<ChartNotifyMemory>;
    const scheduled = Array.isArray(parsed.scheduled)
      ? parsed.scheduled.filter(
          (entry): entry is ChartNotifyEntry =>
            !!entry &&
            (entry.kind === 'recap' || entry.kind === 'idle') &&
            typeof entry.fireDate === 'string' &&
            typeof entry.anchorId === 'string',
        )
      : [];
    return {
      idleNudgeScheduledFor: typeof parsed.idleNudgeScheduledFor === 'string' ? parsed.idleNudgeScheduledFor : null,
      scheduled,
    };
  } catch {
    return emptyMemory();
  }
}

async function saveMemory(key: string, memory: ChartNotifyMemory): Promise<void> {
  try {
    await encryptedPersistStorage.setItem(key, JSON.stringify(memory));
  } catch (error) {
    logger.warn('[ChartNotifications] Failed to persist notify memory', error);
  }
}

/** Practices in the recap's own week (Monday 00:00 local up to the recap fire date). */
function practicesInRecapWeek(recapFireDate: Date): number {
  try {
    const state = useSessionStore.getState();
    const history = countInRecapWeek(
      (state.practiceHistory ?? []).map((record) => record.completedAt),
      recapFireDate,
    );
    const log = countInRecapWeek((state.sessionLog ?? []).map((entry) => entry.completedAt), recapFireDate);
    return Math.max(history, log);
  } catch {
    return 0;
  }
}

async function readNotificationFlags(): Promise<{
  enabled: boolean;
  granted: boolean;
  weeklyRecapOn: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    const state = normalizeNotificationState(raw ? JSON.parse(raw) : null);
    return {
      enabled: state.notification_enabled === true,
      granted: state.notificationPermissionStatus === 'granted',
      weeklyRecapOn: state.weeklyRecapEnabled === true,
    };
  } catch {
    return { enabled: false, granted: false, weeklyRecapOn: false };
  }
}

/**
 * True when the existing Weekly Summary push is on: either the smart
 * `weeklyRecapEnabled` preference, or a WEEKLY_SUMMARY notification is scheduled.
 * (`settingsStore.weeklySummaryEnabled` only gates the in-app summary card.)
 */
async function weeklySummaryPushIsOn(weeklyRecapOn: boolean): Promise<boolean> {
  if (weeklyRecapOn) return true;
  try {
    const scheduled = await NotificationService.getScheduledNotifications();
    return scheduled.some((item) => item.identifier === NOTIFICATION_IDS.WEEKLY_SUMMARY);
  } catch {
    return false;
  }
}

async function cancelQuietly(id: string): Promise<void> {
  try {
    await NotificationService.cancelNotification(id);
  } catch (error) {
    logger.warn('[ChartNotifications] Failed to cancel', id, error);
  }
}

export async function syncChartNotifications(args: SyncChartNotificationsArgs): Promise<void> {
  try {
    const now = args.now ?? new Date();
    const nowMs = now.getTime();
    const key = chartNotifyStorageKey(args.accountId);
    const memory = await loadMemory(key);

    const fresh = memory.scheduled.filter((entry) => {
      const t = new Date(entry.fireDate).getTime();
      return !Number.isNaN(t) && nowMs - t < MEMORY_RETENTION_MS;
    });
    const isPending = (entry: ChartNotifyEntry) => new Date(entry.fireDate).getTime() > nowMs;
    const fired = fresh.filter((entry) => !isPending(entry));
    const minePending = fresh.filter((entry) => isPending(entry) && entry.anchorId === args.anchorId);
    const othersPending = fresh.filter((entry) => isPending(entry) && entry.anchorId !== args.anchorId);

    // One owner at a time: the previous owner's pending pushes go.
    await Promise.all(othersPending.map((entry) => cancelQuietly(chartNotificationId(entry.kind, entry.anchorId))));

    const flags = await readNotificationFlags();
    if (!flags.enabled || !flags.granted) {
      await Promise.all(minePending.map((entry) => cancelQuietly(chartNotificationId(entry.kind, entry.anchorId))));
      await saveMemory(key, { idleNudgeScheduledFor: memory.idleNudgeScheduledFor, scheduled: fired });
      return;
    }

    const lastMoveAt = lastCompletedMoveAt(args.moves);
    const keptIdle =
      lastMoveAt !== null && memory.idleNudgeScheduledFor === lastMoveAt
        ? minePending.find((entry) => entry.kind === 'idle') ?? null
        : null;

    // Counts describe the week the recap will land in, not a rolling window ending now.
    const recapFireDate = nextRecapSlot(now);
    const plans: ChartNotificationPlan[] = planChartNotifications({
      anchorId: args.anchorId,
      now,
      lastMoveAt,
      idleNudgeScheduledFor: memory.idleNudgeScheduledFor,
      movesThisWeek: movesInRecapWeek(args.moves, recapFireDate),
      practicesThisWeek: practicesInRecapWeek(recapFireDate),
      oneMoveTitle: args.view.oneMove?.title ?? null,
      destination: args.view.destination,
      weeklySummaryEnabled: await weeklySummaryPushIsOn(flags.weeklyRecapOn),
      notificationsEnabled: flags.enabled,
      permissionGranted: flags.granted,
      alreadyScheduled: [...fired, ...(keptIdle ? [keptIdle] : [])].map(({ kind, fireDate }) => ({ kind, fireDate })),
    }).slice(0, CHART_MAX_PUSHES_PER_WEEK);

    // Replace this anchor's pending pushes (except an idle nudge that is still valid).
    await Promise.all(
      minePending
        .filter((entry) => entry !== keptIdle)
        .map((entry) => cancelQuietly(chartNotificationId(entry.kind, entry.anchorId))),
    );

    const scheduledNow: ChartNotifyEntry[] = [];
    for (const plan of plans) {
      const result = await NotificationService.scheduleLocalNotification({
        id: plan.id,
        title: plan.title,
        body: plan.body,
        fireDate: plan.fireDate,
        deepLink: plan.deepLink,
      });
      if (result) scheduledNow.push({ kind: plan.kind, fireDate: plan.fireDate.toISOString(), anchorId: args.anchorId });
    }

    const idleScheduled = scheduledNow.some((entry) => entry.kind === 'idle');
    await saveMemory(key, {
      idleNudgeScheduledFor: idleScheduled ? lastMoveAt : memory.idleNudgeScheduledFor,
      scheduled: [...fired, ...(keptIdle ? [keptIdle] : []), ...scheduledNow],
    });
  } catch (error) {
    logger.warn('[ChartNotifications] sync failed', error);
  }
}
