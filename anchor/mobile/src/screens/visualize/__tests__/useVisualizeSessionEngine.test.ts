import { act, renderHook } from '@testing-library/react-native';

import { useVisualizeSessionEngine } from '../useVisualizeSessionEngine';

const mockTrack = jest.fn();

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    PRACTICE_SESSION_PAUSED: 'practice_session_paused',
    PRACTICE_SESSION_RESUMED: 'practice_session_resumed',
    PRACTICE_SESSION_ENDED_EARLY: 'practice_session_ended_early',
    PRACTICE_PHASE_REACHED: 'practice_phase_reached',
  },
  AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));

describe('useVisualizeSessionEngine', () => {
  let monotonicNow = 0;
  let wallClockNow = 1_000_000;

  beforeEach(() => {
    jest.useFakeTimers();
    mockTrack.mockReset();
    monotonicNow = 0;
    wallClockNow = 1_000_000;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const advanceClock = (milliseconds: number) => {
    monotonicNow += milliseconds;
    wallClockNow += milliseconds;
    act(() => {
      jest.advanceTimersByTime(Math.max(100, milliseconds));
    });
  };

  it('moves through phase boundaries without changing the canonical audio schedule', () => {
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() =>
      useVisualizeSessionEngine({
        durationSeconds: 60,
        hapticsEnabled: false,
        onComplete,
        clock: () => monotonicNow,
        wallClock: () => wallClockNow,
      }),
    );

    act(() => result.current.start());
    expect(result.current.phase.id).toBe('see');

    advanceClock(12_100);
    expect(result.current.phase.id).toBe('feel');

    advanceClock(11_000);
    expect(result.current.phase.id).toBe('choose');
    expect(onComplete).not.toHaveBeenCalled();
    unmount();
  });

  it('freezes elapsed time while paused and resumes from the same point', () => {
    const { result, unmount } = renderHook(() =>
      useVisualizeSessionEngine({
        durationSeconds: 60,
        hapticsEnabled: false,
        onComplete: jest.fn(),
        clock: () => monotonicNow,
        wallClock: () => wallClockNow,
      }),
    );

    act(() => result.current.start());
    advanceClock(5_000);
    const beforePause = result.current.elapsedMs;

    act(() => result.current.pause('test'));
    advanceClock(8_000);
    expect(result.current.elapsedMs).toBe(beforePause);

    act(() => result.current.resume());
    advanceClock(1_000);
    expect(result.current.elapsedMs).toBeCloseTo(beforePause + 1_000, -2);
    expect(mockTrack).toHaveBeenCalledWith(
      'practice_session_paused',
      expect.objectContaining({ practice_mode: 'visualize', source: 'test' }),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'practice_session_resumed',
      expect.objectContaining({ practice_mode: 'visualize' }),
    );
    unmount();
  });

  it('commits completion once at the exact session boundary', async () => {
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useVisualizeSessionEngine({
        durationSeconds: 60,
        hapticsEnabled: false,
        onComplete,
        clock: () => monotonicNow,
        wallClock: () => wallClockNow,
      }),
    );

    act(() => result.current.start());
    monotonicNow += 60_000;
    wallClockNow += 60_000;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('completing');
    expect(result.current.remainingSeconds).toBe(0);

    await act(async () => {
      await result.current.completionPromise;
      result.current.markCompleted();
    });
    expect(result.current.state).toBe('completed');

    monotonicNow += 5_000;
    act(() => jest.advanceTimersByTime(5_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
  });

  describe('the clock, not any callback, ends the session', () => {
    const mount = (durationSeconds: 60 | 180 | 300, onComplete: () => Promise<void> | void) => renderHook(() =>
      useVisualizeSessionEngine({
        durationSeconds, hapticsEnabled: true, onComplete,
        clock: () => monotonicNow, wallClock: () => wallClockNow,
      }));

    it.each([60, 180, 300] as const)('a %i second session always reaches completing, then completed', async seconds => {
      const { result, unmount } = mount(seconds, jest.fn().mockResolvedValue(undefined));
      act(() => result.current.start());
      for (let elapsed = 0; elapsed < seconds; elapsed += 5) advanceClock(5_000);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('completing');
      act(() => result.current.markCompleted());
      expect(result.current.state).toBe('completed');
      unmount();
    });

    it('enters completing even when the completion callback never settles', async () => {
      const { result, unmount } = mount(60, () => new Promise<void>(() => undefined));
      act(() => result.current.start());
      advanceClock(60_000);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('completing');
      expect(result.current.remainingSeconds).toBe(0);
      unmount();
    });

    it('enters completing even when the completion callback throws', async () => {
      const onComplete = jest.fn(() => { throw new Error('storage unavailable'); });
      const { result, unmount } = mount(60, onComplete);
      act(() => result.current.start());
      advanceClock(60_000);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('completing');
      expect(onComplete).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('finishes from elapsed time even if the interval was starved and several seconds passed in one tick', async () => {
      const { result, unmount } = mount(60, jest.fn().mockResolvedValue(undefined));
      act(() => result.current.start());
      advanceClock(10_000);
      monotonicNow += 120_000; wallClockNow += 120_000; // the JS thread was blocked well past the end
      await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
      expect(result.current.state).toBe('completing');
      expect(result.current.elapsedMs).toBe(60_000);
      unmount();
    });

    it('does not complete while paused, and completes once resumed and the time has run out', async () => {
      const onComplete = jest.fn().mockResolvedValue(undefined);
      const { result, unmount } = mount(60, onComplete);
      act(() => result.current.start());
      advanceClock(30_000);
      act(() => result.current.pause('app_background'));
      advanceClock(600_000); // backgrounded for ten minutes
      expect(result.current.state).toBe('paused');
      expect(onComplete).not.toHaveBeenCalled();
      act(() => result.current.resume());
      advanceClock(30_000);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.state).toBe('completing');
      expect(onComplete).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('cleans up its timers on unmount and never completes afterwards', () => {
      const onComplete = jest.fn();
      const { result, unmount } = mount(60, onComplete);
      act(() => result.current.start());
      advanceClock(10_000);
      unmount();
      expect(jest.getTimerCount()).toBe(0);
      monotonicNow += 120_000;
      act(() => jest.advanceTimersByTime(120_000));
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
