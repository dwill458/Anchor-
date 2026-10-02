import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService, { NOTIFICATION_IDS } from '@/services/NotificationService';
import { NOTIFICATION_STATE_STORAGE_KEY } from '@/services/NotificationState';
import {
  chartNotificationId,
  chartNotifyStorageKey,
  parseChartNotificationTarget,
  syncChartNotifications,
} from '../chartNotifications';

const mockAsync = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockAsync.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mockAsync.set(k, v);
    },
    removeItem: async (k: string) => {
      mockAsync.delete(k);
    },
    clear: async () => {
      mockAsync.clear();
    },
  },
}));

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

let mockSession: { practiceHistory: any[]; sessionLog: any[] } = { practiceHistory: [], sessionLog: [] };
jest.mock('@/stores/sessionStore', () => ({ useSessionStore: { getState: () => mockSession } }));

// Wednesday 2026-09-30 10:00 local.
const NOW = new Date(2026, 8, 30, 10, 0, 0);
const view = { destination: 'Launch the studio', oneMove: { title: 'Send the first invite' } };
const move = (id: string, completedAt: string | null) =>
  ({ id, title: id, completedAt, status: completedAt ? 'COMPLETED' : 'PENDING' }) as any;

const setFlags = async (flags: Record<string, unknown>) => {
  await AsyncStorage.setItem(
    NOTIFICATION_STATE_STORAGE_KEY,
    JSON.stringify({ notification_enabled: true, notificationPermissionStatus: 'granted', weeklyRecapEnabled: false, ...flags }),
  );
};
const scheduled = async () => (await NotificationService.getScheduledNotifications()).map((n) => n.identifier).sort();
const base = { anchorId: 'a1', courseId: 'c1', accountId: 'acct', view, now: NOW };
const lastMove = new Date(2026, 8, 29, 9, 0, 0).toISOString();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockMemory.clear();
  mockSession = { practiceHistory: [], sessionLog: [] };
  NotificationService.setMockEnabled(false);
  NotificationService.setMockEnabled(true);
});
afterAll(() => NotificationService.setMockEnabled(false));

describe('syncChartNotifications', () => {
  it('schedules a recap and an idle nudge (at most 2) with the chart deep link', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual(['chart-idle:a1', 'chart-recap:a1']);
    const all = await NotificationService.getScheduledNotifications();
    for (const item of all) expect((item.content.data as any).deepLink).toBe('anchor://v2/chart/a1');
    const recap = all.find((n) => n.identifier === 'chart-recap:a1')!;
    expect(recap.content.body).toContain('Send the first invite');
    expect(chartNotificationId('recap', 'a1')).toBe('chart-recap:a1');
  });

  it('skips the recap when the Weekly Summary push is on', async () => {
    await setFlags({ weeklyRecapEnabled: true });
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual(['chart-idle:a1']);
  });

  it('skips the recap when a WEEKLY_SUMMARY notification is scheduled', async () => {
    await setFlags({});
    await NotificationService.scheduleWeeklySummary();
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual(['chart-idle:a1', NOTIFICATION_IDS.WEEKLY_SUMMARY].sort());
  });

  it('schedules nothing when notifications are disabled or permission is not granted', async () => {
    await setFlags({ notification_enabled: false });
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual([]);
    await setFlags({ notificationPermissionStatus: 'denied' });
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual([]);
    await setFlags({ notificationPermissionStatus: 'undetermined' });
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual([]);
  });

  it('removes its pending pushes when notifications are turned off later', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toHaveLength(2);
    await setFlags({ notificationPermissionStatus: 'denied' });
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    expect(await scheduled()).toEqual([]);
  });

  it('keeps the same pushes on a repeat sync (no duplicates, idle not re-planned)', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    const first = await NotificationService.getScheduledNotifications();
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    const second = await NotificationService.getScheduledNotifications();
    expect(second.map((n) => n.identifier).sort()).toEqual(first.map((n) => n.identifier).sort());
    const idle = (list: typeof first) => list.find((n) => n.identifier === 'chart-idle:a1')!.trigger as any;
    expect(idle(second).date).toEqual(idle(first).date);
  });

  it('only one anchor owns the chart pushes: the previous owner is cancelled', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    await syncChartNotifications({ ...base, anchorId: 'a2', moves: [move('m2', lastMove)] });
    const ids = await scheduled();
    expect(ids.some((id) => id.endsWith(':a1'))).toBe(false);
    expect(ids).toContain('chart-recap:a2');
  });

  it('counts practices this week from the session store', async () => {
    await setFlags({});
    mockSession = {
      practiceHistory: [{ completedAt: new Date(2026, 8, 28, 8).toISOString() }, { completedAt: new Date(2026, 8, 29, 8).toISOString() }],
      sessionLog: [],
    };
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    const recap = (await NotificationService.getScheduledNotifications()).find((n) => n.identifier === 'chart-recap:a1')!;
    expect(recap.content.body).toMatch(/2/);
  });

  it('recap on a Monday reports this recap week, not last week (neutral line at 0)', async () => {
    await setFlags({});
    const monday = new Date(2026, 9, 5, 10, 0, 0); // Mon 2026-10-05
    const lastWeek = new Date(2026, 9, 1, 9, 0, 0).toISOString(); // Thu of the previous week
    mockSession = { practiceHistory: [{ completedAt: lastWeek }], sessionLog: [] };
    await syncChartNotifications({ ...base, now: monday, moves: [move('m1', lastWeek)] });
    const recap = (await NotificationService.getScheduledNotifications()).find((n) => n.identifier === 'chart-recap:a1')!;
    const { CHART_RHYTHM_COPY } = require('@/components/v2/chart/map/chartRhythm');
    expect(recap.content.body).toBe(
      CHART_RHYTHM_COPY.recapBody({ moves: 0, practices: 0, oneMove: 'Send the first invite' }),
    );
  });

  it('never requests permission and never throws', async () => {
    await setFlags({});
    const Notifications = require('expo-notifications');
    const requestSpy = Notifications.requestPermissionsAsync as jest.Mock | undefined;
    const before = requestSpy?.mock?.calls.length ?? 0;
    const spy = jest.spyOn(NotificationService, 'scheduleLocalNotification').mockRejectedValue(new Error('boom'));
    await expect(syncChartNotifications({ ...base, moves: [move('m1', lastMove)] })).resolves.toBeUndefined();
    spy.mockRestore();
    await expect(syncChartNotifications({ ...base, moves: null as any })).resolves.toBeUndefined();
    expect(requestSpy?.mock?.calls.length ?? 0).toBe(before);
  });

  it('stores memory under the encoded per-account key', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, accountId: 'a b', moves: [move('m1', lastMove)] });
    expect(chartNotifyStorageKey('a b')).toBe('anchor:v2:chart2:notify:a%20b');
    expect(chartNotifyStorageKey(null)).toBe('anchor:v2:chart2:notify:anonymous');
    const memory = JSON.parse(mockMemory.get('anchor:v2:chart2:notify:a%20b')!);
    expect(memory.idleNudgeScheduledFor).toBe(lastMove);
    expect(memory.scheduled).toHaveLength(2);
  });

  it('does not use guilt language in the copy', async () => {
    await setFlags({});
    await syncChartNotifications({ ...base, moves: [move('m1', lastMove)] });
    const text = (await NotificationService.getScheduledNotifications())
      .map((n) => `${n.content.title} ${n.content.body}`)
      .join(' ');
    expect(text).not.toMatch(/streak|missed|broke|lost|behind|failed/i);
  });
});

describe('parseChartNotificationTarget', () => {
  it('reads the anchor from the deep link or data', () => {
    expect(parseChartNotificationTarget({ deepLink: 'anchor://v2/chart/abc' })).toEqual({ anchorId: 'abc' });
    expect(parseChartNotificationTarget({ type: 'chart', anchorId: 'x' })).toEqual({ anchorId: 'x' });
  });
  it('ignores other notifications', () => {
    expect(parseChartNotificationTarget({ type: 'weekly_summary' })).toBeNull();
    expect(parseChartNotificationTarget({ deepLink: '/' })).toBeNull();
    expect(parseChartNotificationTarget(undefined)).toBeNull();
    expect(parseChartNotificationTarget({ type: 'chart' })).toBeNull();
  });
});
