import NotificationService from '@/services/NotificationService';
import type { MoveSummary } from '@/types/chart';
import { planChartNotifications } from '@/components/v2/chart/map/chartRhythm';
import {
  cancelAllMoveReminders,
  hasMoveReminderWithin,
  moveReminderId,
  moveRemindersStorageKey,
  reconcileMoveReminders,
} from '../chartMoveReminders';

const mockMemory = new Map<string, string>();
jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: async (k: string) => mockMemory.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mockMemory.set(k, v);
    },
    removeItem: async (k: string) => {
      mockMemory.delete(k);
    },
  },
}));

// Monday 16 November 2026, 10:00 local.
const NOW = new Date(2026, 10, 16, 10, 0);
const VIEW = { active: true, currentWaypointId: 'wp' };

const move = (id: string, overrides: Partial<MoveSummary> = {}): MoveSummary => ({
  id,
  courseId: 'course',
  waypointId: 'wp',
  title: 'Open the curtains',
  rationale: null,
  source: 'USER',
  status: 'ACTIVE',
  position: 100,
  isCurrent: true,
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  plan: { cue: 'After I wake up', date: '2026-11-17', time: '15:00', remind: true },
  ...overrides,
});

let schedule: jest.SpyInstance;
let cancel: jest.SpyInstance;

beforeEach(() => {
  mockMemory.clear();
  schedule = jest.spyOn(NotificationService, 'scheduleLocalNotification').mockImplementation(async (options) => options.id);
  cancel = jest.spyOn(NotificationService, 'cancelNotification').mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

const scheduledIds = () => schedule.mock.calls.map(([options]) => options.id);
const record = (account = 'acct') => JSON.parse(mockMemory.get(moveRemindersStorageKey(account)) ?? '{"entries":[]}').entries;

it('schedules exactly one reminder per qualifying move, at local time, with the Chart deep link', async () => {
  const moves = [
    move('a'),
    move('b', { plan: { cue: null, date: '2026-11-18', time: '08:00', remind: true }, title: 'Drink the water' }),
    move('no-remind', { plan: { cue: 'After lunch', date: '2026-11-17', time: '12:30', remind: false } }),
    move('no-time', { plan: { cue: 'After lunch', date: '2026-11-17', time: null, remind: true } }),
    move('suggested', { status: 'SUGGESTED' }),
    move('other-waypoint', { waypointId: 'later' }),
  ];
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves, view: VIEW, now: NOW });
  expect(scheduledIds().sort()).toEqual([moveReminderId('a'), moveReminderId('b')]);
  const first = schedule.mock.calls.find(([options]) => options.id === 'chart-move:a')![0];
  expect(first).toMatchObject({ title: 'Your move', body: 'After I wake up: open the curtains', deepLink: 'anchor://v2/chart/anchor-1' });
  expect([first.fireDate.getDate(), first.fireDate.getHours(), first.fireDate.getMinutes()]).toEqual([17, 15, 0]);
  expect(schedule.mock.calls.find(([options]) => options.id === 'chart-move:b')![0].body).toBe('Drink the water');

  // Idempotent: a second pass with the same data schedules nothing new.
  schedule.mockClear();
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves, view: VIEW, now: NOW });
  expect(schedule).not.toHaveBeenCalled();
  expect(record()).toHaveLength(2);
});

it.each([
  ['completing', (m: MoveSummary) => ({ ...m, status: 'COMPLETED' as const })],
  ['dismissing', (m: MoveSummary) => ({ ...m, status: 'DISMISSED' as const })],
  ['reaching the waypoint', (m: MoveSummary) => m],
  ['clearing the plan', (m: MoveSummary) => ({ ...m, plan: null })],
])('%s cancels the reminder', async (label, change) => {
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: VIEW, now: NOW });
  cancel.mockClear();
  const view = label === 'reaching the waypoint' ? { active: true, currentWaypointId: 'next' } : VIEW;
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [change(move('a'))], view, now: NOW });
  expect(cancel).toHaveBeenCalledWith('chart-move:a');
  expect(record()).toEqual([]);
});

it('a changed time reschedules', async () => {
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: VIEW, now: NOW });
  schedule.mockClear();
  cancel.mockClear();
  const moved = move('a', { plan: { cue: 'After I wake up', date: '2026-11-17', time: '16:30', remind: true } });
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [moved], view: VIEW, now: NOW });
  expect(cancel).toHaveBeenCalledWith('chart-move:a');
  expect(scheduledIds()).toEqual(['chart-move:a']);
  expect(schedule.mock.calls[0][0].fireDate.getHours()).toBe(16);
});

it('never schedules a past fire time', async () => {
  const past = move('a', { plan: { cue: null, date: '2026-11-16', time: '09:30', remind: true } });
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [past], view: VIEW, now: NOW });
  expect(schedule).not.toHaveBeenCalled();
});

it('an inactive or finished Chart schedules nothing', async () => {
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: { active: false, currentWaypointId: 'wp' }, now: NOW });
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: null, now: NOW });
  expect(schedule).not.toHaveBeenCalled();
});

it("another anchor's reminders survive when this anchor reconciles", async () => {
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: VIEW, now: NOW });
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-2', moves: [move('b')], view: VIEW, now: NOW });
  cancel.mockClear();
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-2', moves: [], view: null, now: NOW });
  expect(cancel).toHaveBeenCalledWith('chart-move:b');
  expect(cancel).not.toHaveBeenCalledWith('chart-move:a');
  expect(record().map((entry: { id: string }) => entry.id)).toEqual(['chart-move:a']);
});

it('sign-out cancels every recorded reminder for that account only', async () => {
  await reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: VIEW, now: NOW });
  await reconcileMoveReminders({ accountId: 'other', anchorId: 'anchor-9', moves: [move('z')], view: VIEW, now: NOW });
  cancel.mockClear();
  await cancelAllMoveReminders('acct');
  expect(cancel.mock.calls.map(([id]) => id)).toEqual(['chart-move:a']);
  expect(record('acct')).toEqual([]);
  expect(record('other')).toHaveLength(1);
});

it('storage and scheduling failures never throw', async () => {
  schedule.mockRejectedValue(new Error('boom'));
  await expect(reconcileMoveReminders({ accountId: 'acct', anchorId: 'anchor-1', moves: [move('a')], view: VIEW, now: NOW })).resolves.toBeUndefined();
});

describe('idle nudge interplay', () => {
  const base = {
    anchorId: 'anchor-1',
    now: NOW,
    lastMoveAt: new Date(2026, 10, 12, 9).toISOString(),
    idleNudgeScheduledFor: null,
    movesThisWeek: 0,
    practicesThisWeek: 0,
    oneMoveTitle: 'Open the curtains',
    destination: 'Mornings that are mine',
    weeklySummaryEnabled: true,
    notificationsEnabled: true,
    permissionGranted: true,
    alreadyScheduled: [],
  };
  it('skips the idle nudge when a move reminder fires within 48 hours', () => {
    expect(hasMoveReminderWithin([move('a')], 'wp', NOW)).toBe(true);
    expect(planChartNotifications({ ...base, moveReminderSoon: true }).some((plan) => plan.kind === 'idle')).toBe(false);
  });
  it('keeps it otherwise, and existing callers default to false', () => {
    const far = move('a', { plan: { cue: null, date: '2026-11-25', time: '09:00', remind: true } });
    expect(hasMoveReminderWithin([far], 'wp', NOW)).toBe(false);
    expect(planChartNotifications(base).some((plan) => plan.kind === 'idle')).toBe(true);
  });
});
