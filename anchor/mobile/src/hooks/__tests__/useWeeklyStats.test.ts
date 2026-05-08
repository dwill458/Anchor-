import { renderHook } from '@testing-library/react-hooks';
import { useWeeklyStats } from '../useWeeklyStats';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { createMockAnchor } from '@/__tests__/utils/testUtils';

function createPrimingEntry(
  id: string,
  {
    anchorId,
    type,
    completedAt,
    localDate,
    weekStart,
    weekdayIndex,
    hourOfDay,
    timeOfDay,
  }: {
    anchorId: string;
    type: 'activate' | 'reinforce';
    completedAt: string;
    localDate: string;
    weekStart: string;
    weekdayIndex: number;
    hourOfDay: number;
    timeOfDay: 'late_night' | 'morning' | 'afternoon' | 'evening';
  }
) {
  return {
    id,
    anchorId,
    type,
    completedAt,
    localDate,
    weekKey: 'test-week',
    weekStart,
    weekdayIndex,
    hourOfDay,
    timeOfDay,
  };
}

describe('useWeeklyStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAnchorStore.getState().clearAnchors();
    useSessionStore.setState({
      lastSession: null,
      todayPractice: { date: '2026-04-19', sessionsCount: 0, totalSeconds: 0 },
      weeklyPractice: { weekKey: '2026-W16', sessionsCount: 0, totalSeconds: 0 },
      lastGraceDayUsedAt: null,
      sessionLog: [],
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: [false, false, false, false, false, false, false],
      weekHistoryKey: '2026-W16',
      primingHistory: [],
      journeyWeekStart: null,
      lastDecayDate: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('derives user-relative week numbers and lifetime day/time insights from priming history', () => {
    jest.setSystemTime(new Date(2026, 3, 19, 20, 0, 0));

    useAnchorStore.getState().setAnchors([
      createMockAnchor({
        id: 'anchor-1',
        intentionText: 'Close the right deals',
        createdAt: new Date('2026-03-30T09:00:00.000Z'),
        updatedAt: new Date('2026-03-30T09:00:00.000Z'),
      }),
      createMockAnchor({
        id: 'anchor-2',
        intentionText: 'Train with calm precision',
        createdAt: new Date('2026-04-06T09:00:00.000Z'),
        updatedAt: new Date('2026-04-06T09:00:00.000Z'),
      }),
    ]);

    useSessionStore.setState({
      threadStrength: 83,
      totalSessionsCount: 5,
      lastPrimedAt: '2026-04-17',
      journeyWeekStart: '2026-03-30',
      primingHistory: [
        createPrimingEntry('prime-5', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-17T18:30:00.000Z',
          localDate: '2026-04-17',
          weekStart: '2026-04-13',
          weekdayIndex: 4,
          hourOfDay: 18,
          timeOfDay: 'evening',
        }),
        createPrimingEntry('prime-4', {
          anchorId: 'anchor-2',
          type: 'reinforce',
          completedAt: '2026-04-15T13:00:00.000Z',
          localDate: '2026-04-15',
          weekStart: '2026-04-13',
          weekdayIndex: 2,
          hourOfDay: 13,
          timeOfDay: 'afternoon',
        }),
        createPrimingEntry('prime-3', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-15T18:00:00.000Z',
          localDate: '2026-04-15',
          weekStart: '2026-04-13',
          weekdayIndex: 2,
          hourOfDay: 18,
          timeOfDay: 'evening',
        }),
        createPrimingEntry('prime-2', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-04-08T18:45:00.000Z',
          localDate: '2026-04-08',
          weekStart: '2026-04-06',
          weekdayIndex: 2,
          hourOfDay: 18,
          timeOfDay: 'evening',
        }),
        createPrimingEntry('prime-1', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-04-01T08:15:00.000Z',
          localDate: '2026-04-01',
          weekStart: '2026-03-30',
          weekdayIndex: 2,
          hourOfDay: 8,
          timeOfDay: 'morning',
        }),
        createPrimingEntry('prime-6', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-04-19T09:10:00.000Z',
          localDate: '2026-04-19',
          weekStart: '2026-04-13',
          weekdayIndex: 6,
          hourOfDay: 9,
          timeOfDay: 'morning',
        }),
        createPrimingEntry('prime-7', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-04-19T17:40:00.000Z',
          localDate: '2026-04-19',
          weekStart: '2026-04-13',
          weekdayIndex: 6,
          hourOfDay: 17,
          timeOfDay: 'evening',
        }),
      ],
    });

    const { result } = renderHook(() => useWeeklyStats());

    expect(result.current.weekNumber).toBe(3);
    expect(result.current.weekStart).toBe('2026-04-12');
    expect(result.current.weekEnd).toBe('2026-04-18');
    expect(result.current.totalPrimes).toBe(3);
    expect(result.current.daysShownUp).toBe(2);
    expect(result.current.threadDelta).toBe(90);
    expect(result.current.peakPrimingWindow).toEqual({
      day: 'Wednesday',
      timeOfDay: 'evenings',
    });
    expect(result.current.dominantAnchor?.id).toBe('anchor-1');
    expect(result.current.dominantAnchor?.weeklyPrimeCount).toBe(2);
    expect(result.current.dominantAnchor?.threadStrength).toBe(83);
  });

  it('defaults new users to week 1 with empty insight fallbacks', () => {
    jest.setSystemTime(new Date(2026, 3, 13, 9, 0, 0));

    const { result } = renderHook(() => useWeeklyStats());

    expect(result.current.weekNumber).toBe(1);
    expect(result.current.weekStart).toBe('2026-04-12');
    expect(result.current.weekEnd).toBe('2026-04-18');
    expect(result.current.totalPrimes).toBe(0);
    expect(result.current.peakPrimingWindow).toEqual({
      day: 'Monday',
      timeOfDay: 'mornings',
    });
  });

  it('falls back to the sole active anchor when there are no weekly primes', () => {
    jest.setSystemTime(new Date(2026, 3, 13, 9, 0, 0));

    useAnchorStore.getState().setAnchors([
      createMockAnchor({
        id: 'anchor-only',
        intentionText: 'Stay centered under pressure',
        createdAt: new Date('2026-04-10T09:00:00.000Z'),
        updatedAt: new Date('2026-04-10T09:00:00.000Z'),
      }),
    ]);

    useSessionStore.setState({
      threadStrength: 67,
      primingHistory: [],
    });

    const { result } = renderHook(() => useWeeklyStats());

    expect(result.current.dominantAnchor).toEqual({
      id: 'anchor-only',
      intention: 'Stay centered under pressure',
      threadStrength: 67,
      weeklyPrimeCount: 0,
      forgedAt: new Date('2026-04-10T09:00:00.000Z').toISOString(),
    });
  });
});
