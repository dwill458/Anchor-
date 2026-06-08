import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';

import {
  loadProfileSnapshot,
  loadSessionSnapshot,
  saveProfileSnapshot,
  saveSessionSnapshot,
} from '../UserLocalStateService';

const localDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('UserLocalStateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();
  });

  it('restores saved profile and session snapshots for the same user', async () => {
    const completedAt = new Date('2026-06-08T10:00:00.000Z').toISOString();

    useProfileStore.setState({
      ownerUserId: 'user-1',
      name: 'Deontrez Williams',
      axiom: 'Build in silence.',
      timezone: 'UTC-6 (CST)',
      mono: 'avatar_2',
      photo: 'file:///documents/profile-media/user-1.jpg',
      memberSince: '2026-05-01T00:00:00.000Z',
    });
    useSessionStore.setState({
      lastSession: {
        id: 'session-1',
        anchorId: 'anchor-1',
        type: 'reinforce',
        durationSeconds: 120,
        mode: 'ambient',
        completedAt,
      },
      todayPractice: {
        date: localDateString(new Date('2026-06-08T12:00:00.000Z')),
        sessionsCount: 1,
        totalSeconds: 120,
      },
      weeklyPractice: {
        weekKey: '2026-W24',
        sessionsCount: 1,
        totalSeconds: 120,
      },
      lastGraceDayUsedAt: null,
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          durationSeconds: 120,
          mode: 'ambient',
          completedAt,
        },
      ],
      threadStrength: 90,
      totalSessionsCount: 17,
      lastPrimedAt: '2026-06-08',
      weekHistory: [true, false, false, false, false, false, false],
      weekHistoryKey: '2026-W24',
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt,
          localDate: '2026-06-08',
          weekKey: '2026-W24',
          weekStart: '2026-06-08',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
      journeyWeekStart: '2026-06-08',
      lastDecayDate: '2026-06-08',
    } as any);

    await saveProfileSnapshot('user-1', {
      ownerUserId: 'user-1',
      name: 'Deontrez Williams',
      axiom: 'Build in silence.',
      timezone: 'UTC-6 (CST)',
      mono: 'avatar_2',
      photo: 'file:///documents/profile-media/user-1.jpg',
      memberSince: '2026-05-01T00:00:00.000Z',
    });
    await saveSessionSnapshot('user-1', {
      lastSession: {
        id: 'session-1',
        anchorId: 'anchor-1',
        type: 'reinforce',
        durationSeconds: 120,
        mode: 'ambient',
        completedAt,
      },
      todayPractice: {
        date: localDateString(new Date('2026-06-08T12:00:00.000Z')),
        sessionsCount: 1,
        totalSeconds: 120,
      },
      weeklyPractice: {
        weekKey: '2026-W24',
        sessionsCount: 1,
        totalSeconds: 120,
      },
      lastGraceDayUsedAt: null,
      sessionLog: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          durationSeconds: 120,
          mode: 'ambient',
          completedAt,
        },
      ],
      threadStrength: 90,
      totalSessionsCount: 17,
      lastPrimedAt: '2026-06-08',
      weekHistory: [true, false, false, false, false, false, false],
      weekHistoryKey: '2026-W24',
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt,
          localDate: '2026-06-08',
          weekKey: '2026-W24',
          weekStart: '2026-06-08',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
      journeyWeekStart: '2026-06-08',
      lastDecayDate: '2026-06-08',
    });

    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();

    const restoredProfile = await loadProfileSnapshot('user-1');
    const restoredSession = await loadSessionSnapshot('user-1');

    expect(restoredProfile).not.toBeNull();
    expect(restoredSession).not.toBeNull();
    useProfileStore.getState().updateProfile(restoredProfile!);
    useSessionStore.setState(restoredSession! as any);

    expect(useProfileStore.getState()).toEqual(
      expect.objectContaining({
        ownerUserId: 'user-1',
        name: 'Deontrez Williams',
        axiom: 'Build in silence.',
        mono: 'avatar_2',
        photo: 'file:///documents/profile-media/user-1.jpg',
      })
    );
    expect(useSessionStore.getState()).toEqual(
      expect.objectContaining({
        totalSessionsCount: 17,
        threadStrength: 90,
        lastPrimedAt: '2026-06-08',
      })
    );
    expect(useSessionStore.getState().sessionLog).toHaveLength(1);
  });

  it('keeps richer hydrated session data when a stored snapshot is older', async () => {
    useSessionStore.setState({
      totalSessionsCount: 1,
      threadStrength: 60,
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-01T10:00:00.000Z',
          localDate: '2026-06-01',
          weekKey: '2026-W23',
          weekStart: '2026-06-01',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
    } as any);
    await saveSessionSnapshot('user-1', {
      lastSession: null,
      todayPractice: { date: '2026-06-01', sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: '2026-W23', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 60,
      totalSessionsCount: 1,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: '2026-W23',
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-01T10:00:00.000Z',
          localDate: '2026-06-01',
          weekKey: '2026-W23',
          weekStart: '2026-06-01',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
      journeyWeekStart: null,
      lastDecayDate: null,
    });

    useSessionStore.setState({
      totalSessionsCount: 3,
      threadStrength: 75,
      primingHistory: [
        {
          id: 'session-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-01T10:00:00.000Z',
          localDate: '2026-06-01',
          weekKey: '2026-W23',
          weekStart: '2026-06-01',
          weekdayIndex: 0,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
        {
          id: 'session-2',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-02T10:00:00.000Z',
          localDate: '2026-06-02',
          weekKey: '2026-W23',
          weekStart: '2026-06-01',
          weekdayIndex: 1,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
        {
          id: 'session-3',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-06-03T10:00:00.000Z',
          localDate: '2026-06-03',
          weekKey: '2026-W23',
          weekStart: '2026-06-01',
          weekdayIndex: 2,
          hourOfDay: 10,
          timeOfDay: 'morning',
        },
      ],
    } as any);

    const snapshot = await loadSessionSnapshot('user-1');

    expect(snapshot).not.toBeNull();
    const shouldRestore =
      useSessionStore.getState().totalSessionsCount <= snapshot!.totalSessionsCount ||
      useSessionStore.getState().primingHistory.length < snapshot!.primingHistory.length;

    expect(shouldRestore).toBe(false);
    expect(useSessionStore.getState().totalSessionsCount).toBe(3);
    expect(useSessionStore.getState().threadStrength).toBe(75);
    expect(useSessionStore.getState().primingHistory).toHaveLength(3);
  });
});
