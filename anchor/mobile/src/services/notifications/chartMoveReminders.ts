/**
 * Move reminders: one local notification per planned Move, at the plan's local
 * date and time, because the person asked for it.
 *
 * - Separate from `syncChartNotifications`: these pushes do not count toward
 *   CHART_MAX_PUSHES_PER_WEEK and are not subject to the recap/idle
 *   one-owner rule. Every anchor keeps its own move reminders.
 * - Id `chart-move:{moveId}`. Deep link `anchor://v2/chart/{anchorId}`, the
 *   same shape the recap and idle pushes use.
 * - Reconcile is idempotent: it compares what should be scheduled with a small
 *   encrypted record of what is, cancels what no longer applies or changed,
 *   and schedules what is missing. Never schedules a past fire time.
 * - Never throws: failures log a warning.
 */
import NotificationService from '@/services/NotificationService';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { planFireDate, reminderBody } from '@/adapters/v2/chart/movePlan';
import type { MoveSummary } from '@/types/chart';
import { logger } from '@/utils/logger';

const CHART_DEEP_LINK_PREFIX = 'anchor://v2/chart/';

export type MoveReminderEntry = {
  id: string;
  anchorId: string;
  moveId: string;
  fireDate: string;
  body: string;
};

type MoveReminderRecord = { entries: MoveReminderEntry[] };

/** Whether this Chart can carry reminders, and which waypoint is current. */
export type MoveReminderView = {
  active: boolean;
  currentWaypointId: string | null;
} | null;

export type ReconcileMoveRemindersArgs = {
  accountId: string | null | undefined;
  anchorId: string;
  moves: MoveSummary[];
  view: MoveReminderView;
  now?: Date;
};

export const moveRemindersStorageKey = (accountId?: string | null): string =>
  `anchor:v2:chart2:moveReminders:${encodeURIComponent(accountId ?? 'anonymous')}`;

export const moveReminderId = (moveId: string): string => `chart-move:${moveId}`;

type DesiredReminder = MoveReminderEntry & { title: string; at: Date };

/** The reminders that should exist for these moves right now (R3), soonest first. */
export function qualifyingMoveReminders(
  anchorId: string,
  moves: MoveSummary[],
  view: MoveReminderView,
  now: Date
): DesiredReminder[] {
  if (!view?.active || !view.currentWaypointId) return [];
  const desired: DesiredReminder[] = [];
  for (const move of moves) {
    if (move.status !== 'ACTIVE' || move.waypointId !== view.currentWaypointId) continue;
    const plan = move.plan;
    if (!plan?.remind) continue;
    const at = planFireDate(plan);
    if (!at || at.getTime() <= now.getTime()) continue;
    desired.push({
      id: moveReminderId(move.id),
      anchorId,
      moveId: move.id,
      fireDate: at.toISOString(),
      body: reminderBody(plan.cue, move.title),
      title: CHART_COPY.reminder.title,
      at,
    });
  }
  return desired.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** True when a move reminder for this Chart fires within `windowMs` of `now` (idle nudge interplay, R7). */
export function hasMoveReminderWithin(
  moves: MoveSummary[],
  currentWaypointId: string | null,
  now: Date,
  windowMs = 48 * 60 * 60 * 1000
): boolean {
  return qualifyingMoveReminders('', moves, { active: true, currentWaypointId }, now).some(
    (reminder) => reminder.at.getTime() - now.getTime() <= windowMs
  );
}

async function loadRecord(key: string): Promise<MoveReminderRecord> {
  try {
    const raw = await encryptedPersistStorage.getItem(key);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as Partial<MoveReminderRecord>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is MoveReminderEntry =>
            !!entry &&
            typeof entry.id === 'string' &&
            typeof entry.anchorId === 'string' &&
            typeof entry.moveId === 'string' &&
            typeof entry.fireDate === 'string' &&
            typeof entry.body === 'string'
        )
      : [];
    return { entries };
  } catch (error) {
    logger.warn('[ChartMoveReminders] Failed to read the reminder record', error);
    return { entries: [] };
  }
}

async function saveRecord(key: string, record: MoveReminderRecord): Promise<void> {
  try {
    await encryptedPersistStorage.setItem(key, JSON.stringify(record));
  } catch (error) {
    logger.warn('[ChartMoveReminders] Failed to persist the reminder record', error);
  }
}

async function cancelQuietly(id: string): Promise<void> {
  try {
    await NotificationService.cancelNotification(id);
  } catch (error) {
    logger.warn('[ChartMoveReminders] Failed to cancel', id, error);
  }
}

// Reconciles for one account run one after another, so two quick Chart updates cannot interleave record writes.
const queues = new Map<string, Promise<void>>();
function serialize(key: string, work: () => Promise<void>): Promise<void> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(work, work).catch((error) => {
    logger.warn('[ChartMoveReminders] reconcile failed', error);
  });
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}

export function reconcileMoveReminders(args: ReconcileMoveRemindersArgs): Promise<void> {
  const key = moveRemindersStorageKey(args.accountId);
  return serialize(key, async () => {
    const now = args.now ?? new Date();
    const record = await loadRecord(key);
    const desired = qualifyingMoveReminders(args.anchorId, args.moves, args.view, now);
    const desiredById = new Map(desired.map((reminder) => [reminder.id, reminder]));

    // Entries that have already fired drop out of the record; nothing to cancel.
    const pending = record.entries.filter((entry) => new Date(entry.fireDate).getTime() > now.getTime());
    const others = pending.filter((entry) => entry.anchorId !== args.anchorId);
    const mine = pending.filter((entry) => entry.anchorId === args.anchorId);

    const kept: MoveReminderEntry[] = [];
    for (const entry of mine) {
      const wanted = desiredById.get(entry.id);
      if (wanted && wanted.fireDate === entry.fireDate && wanted.body === entry.body) {
        kept.push(entry);
        desiredById.delete(entry.id);
      } else {
        await cancelQuietly(entry.id);
      }
    }

    const scheduled: MoveReminderEntry[] = [];
    for (const reminder of desiredById.values()) {
      try {
        // Same id replaces any stray copy the record no longer knows about.
        await cancelQuietly(reminder.id);
        const result = await NotificationService.scheduleLocalNotification({
          id: reminder.id,
          title: reminder.title,
          body: reminder.body,
          fireDate: reminder.at,
          deepLink: `${CHART_DEEP_LINK_PREFIX}${reminder.anchorId}`,
        });
        if (result) {
          scheduled.push({
            id: reminder.id,
            anchorId: reminder.anchorId,
            moveId: reminder.moveId,
            fireDate: reminder.fireDate,
            body: reminder.body,
          });
        }
      } catch (error) {
        logger.warn('[ChartMoveReminders] Failed to schedule', reminder.id, error);
      }
    }

    const entries = [...others, ...kept, ...scheduled];
    // Most Chart updates change nothing here: skip the write so the record is only touched when it moves.
    if (JSON.stringify(entries) !== JSON.stringify(record.entries)) await saveRecord(key, { entries });
  });
}

/** Cancels every recorded move reminder for an account (sign-out, account switch). */
export function cancelAllMoveReminders(accountId: string | null | undefined): Promise<void> {
  const key = moveRemindersStorageKey(accountId);
  return serialize(key, async () => {
    const record = await loadRecord(key);
    await Promise.all(record.entries.map((entry) => cancelQuietly(entry.id)));
    await saveRecord(key, { entries: [] });
  });
}

/** Cancels one Chart's move reminders (archive, delete). */
export function cancelMoveRemindersForAnchor(accountId: string | null | undefined, anchorId: string): Promise<void> {
  return reconcileMoveReminders({ accountId, anchorId, moves: [], view: null });
}
