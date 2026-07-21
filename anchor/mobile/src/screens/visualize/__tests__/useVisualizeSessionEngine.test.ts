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
  let now = 1_000_000;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockTrack.mockReset();
    now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    jest.useRealTimers();
  });

  const advanceClock = (milliseconds: number) => {
    now += milliseconds;
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
      }),
    );

    act(() => result.current.start());
    expect(result.current.phase.id).toBe('arrive');

    advanceClock(10_100);
    expect(result.current.phase.id).toBe('see');

    advanceClock(17_000);
    expect(result.current.phase.id).toBe('feel');
    expect(onComplete).not.toHaveBeenCalled();
    unmount();
  });

  it('freezes elapsed time while paused and resumes from the same point', () => {
    const { result, unmount } = renderHook(() =>
      useVisualizeSessionEngine({
        durationSeconds: 60,
        hapticsEnabled: false,
        onComplete: jest.fn(),
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
      }),
    );

    act(() => result.current.start());
    now += 60_000;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('completed');
    expect(result.current.remainingSeconds).toBe(0);

    now += 5_000;
    act(() => jest.advanceTimersByTime(5_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
  });
});
