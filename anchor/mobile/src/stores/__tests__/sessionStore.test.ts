/**
 * sessionStore Tests
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useSessionStore } from '../sessionStore';

// Mock dependencies
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ token: null }),
  },
}));

jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: {
    getState: () => ({
      userFlags: {
        hasCompletedFirstCharge: false,
        hasCompletedFirstStabilize: false,
      },
      setUserFlag: jest.fn(),
      queueMilestone: jest.fn(),
    }),
  },
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({}),
  },
}));

// Helper to build a session entry (minus id)
const makeEntry = (
  overrides: Partial<{
    anchorId: string;
    type: 'activate' | 'reinforce' | 'stabilize';
    durationSeconds: number;
    mode: 'silent' | 'mantra' | 'ambient';
  }> = {}
) => ({
  anchorId: 'anchor-1',
  type: 'activate' as const,
  durationSeconds: 30,
  mode: 'silent' as const,
  completedAt: new Date().toISOString(),
  ...overrides,
});

const localDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Reset store to initial state before each test
beforeEach(() => {
  const { result } = renderHook(() => useSessionStore());
  act(() => {
    useSessionStore.setState({
      lastSession: null,
      todayPractice: { date: localDateString(new Date()), sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: 'test-week', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: 'test-week',
      primingHistory: [],
      journeyWeekStart: null,
      lastDecayDate: null,
    });
  });
});

describe('sessionStore', () => {
  describe('initial state', () => {
    it('has empty sessionLog', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.sessionLog).toEqual([]);
    });

    it('has null lastSession', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.lastSession).toBeNull();
    });

    it('starts with threadStrength 50', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.threadStrength).toBe(50);
    });

    it('starts with totalSessionsCount 0', () => {
      const { result } = renderHook(() => useSessionStore());
      expect(result.current.totalSessionsCount).toBe(0);
    });
  });

  describe('recordSession', () => {
    it('adds a session to the log', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry()));
      expect(result.current.sessionLog).toHaveLength(1);
    });

    it('sets lastSession to the recorded entry', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ anchorId: 'anchor-abc' })));
      expect(result.current.lastSession?.anchorId).toBe('anchor-abc');
    });

    it('increments todayPractice.sessionsCount', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ durationSeconds: 60 })));
      expect(result.current.todayPractice.sessionsCount).toBe(1);
      expect(result.current.todayPractice.totalSeconds).toBe(60);
    });

    it('increments totalSessionsCount for activate sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'activate' })));
      expect(result.current.totalSessionsCount).toBe(1);
    });

    it('increments totalSessionsCount for reinforce sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'reinforce' })));
      expect(result.current.totalSessionsCount).toBe(1);
    });

    it('does NOT increment totalSessionsCount for stabilize sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'stabilize' })));
      expect(result.current.totalSessionsCount).toBe(0);
    });

    it('increases threadStrength for activate session (gain 25)', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'activate' })));
      expect(result.current.threadStrength).toBe(75); // 50 + 25
    });

    it('increases threadStrength for reinforce session (gain 40)', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'reinforce' })));
      expect(result.current.threadStrength).toBe(90); // 50 + 40
    });

    it('caps threadStrength at 100', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({ threadStrength: 90 });
        result.current.recordSession(makeEntry({ type: 'reinforce' })); // +40 → capped at 100
      });
      expect(result.current.threadStrength).toBe(100);
    });

    it('does not change threadStrength for stabilize sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'stabilize' })));
      expect(result.current.threadStrength).toBe(50);
    });

    it('sets lastPrimedAt for activate sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'activate' })));
      expect(result.current.lastPrimedAt).toBe(localDateString(new Date()));
    });

    it('caps sessionLog at 50 entries', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.recordSession(makeEntry({ anchorId: `anchor-${i}` }));
        }
      });
      expect(result.current.sessionLog).toHaveLength(50);
    });

    it('generates a unique id for each session', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        result.current.recordSession(makeEntry());
        result.current.recordSession(makeEntry());
      });
      const ids = result.current.sessionLog.map((s) => s.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('records uncapped priming history metadata for activate sessions', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'activate' })));

      expect(result.current.primingHistory).toHaveLength(1);
      expect(result.current.primingHistory[0]).toEqual(
        expect.objectContaining({
          anchorId: 'anchor-1',
          type: 'activate',
          localDate: localDateString(new Date()),
        })
      );
    });

    it('sets journeyWeekStart from the first priming session', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.recordSession(makeEntry({ type: 'reinforce' })));

      expect(result.current.journeyWeekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('consumeGraceDay', () => {
    it('sets lastGraceDayUsedAt to a non-null ISO string', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.consumeGraceDay());
      expect(result.current.lastGraceDayUsedAt).not.toBeNull();
      expect(typeof result.current.lastGraceDayUsedAt).toBe('string');
    });
  });

  describe('resetIfNewDay', () => {
    it('does not reset todayPractice if the date matches today', () => {
      const today = localDateString(new Date());
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({
          todayPractice: { date: today, sessionsCount: 3, totalSeconds: 90 },
        });
        result.current.resetIfNewDay();
      });
      expect(result.current.todayPractice.sessionsCount).toBe(3);
    });

    it('resets todayPractice when the stored date is in the past', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({
          todayPractice: { date: '2020-01-01', sessionsCount: 5, totalSeconds: 150 },
        });
        result.current.resetIfNewDay();
      });
      expect(result.current.todayPractice.sessionsCount).toBe(0);
      expect(result.current.todayPractice.date).toBe(localDateString(new Date()));
    });
  });

  describe('applyDecay', () => {
    it('does nothing if never primed', () => {
      const { result } = renderHook(() => useSessionStore());
      act(() => result.current.applyDecay());
      expect(result.current.threadStrength).toBe(50);
    });

    it('does nothing if already applied decay today', () => {
      const today = localDateString(new Date());
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({ lastDecayDate: today, threadStrength: 30 });
        result.current.applyDecay();
      });
      expect(result.current.threadStrength).toBe(30); // unchanged
    });

    it('does nothing if last primed today', () => {
      const today = localDateString(new Date());
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({ lastPrimedAt: today, threadStrength: 80 });
        result.current.applyDecay();
      });
      expect(result.current.threadStrength).toBe(80);
    });

    it('applies 30-point decay for 1 missed day', () => {
      const yesterday = localDateString(new Date(Date.now() - 86400000));
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({
          lastPrimedAt: yesterday,
          threadStrength: 60,
          lastDecayDate: null,
        });
        result.current.applyDecay();
      });
      expect(result.current.threadStrength).toBe(30); // 60 - 30
    });

    it('does not drop below 10 on the first missed day', () => {
      const yesterday = localDateString(new Date(Date.now() - 86400000));
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({
          lastPrimedAt: yesterday,
          threadStrength: 15,
          lastDecayDate: null,
        });
        result.current.applyDecay();
      });
      expect(result.current.threadStrength).toBe(10); // floored at 10
    });

    it('marks lastDecayDate as today after applying', () => {
      const yesterday = localDateString(new Date(Date.now() - 86400000));
      const today = localDateString(new Date());
      const { result } = renderHook(() => useSessionStore());
      act(() => {
        useSessionStore.setState({ lastPrimedAt: yesterday, lastDecayDate: null });
        result.current.applyDecay();
      });
      expect(result.current.lastDecayDate).toBe(today);
    });
  });
});
