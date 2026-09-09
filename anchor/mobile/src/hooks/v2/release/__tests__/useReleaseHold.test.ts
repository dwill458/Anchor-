import { act, renderHook } from '@testing-library/react-native';
import { useReleaseHold } from '../useReleaseHold';
import { RELEASE_HOLD_DURATION_MS } from '@/constants/v2/release';

describe('useReleaseHold', () => {
  let clock = 0;
  const now = () => clock;
  const haptics = { selection: jest.fn(), completion: jest.fn() };

  beforeEach(() => {
    clock = 0;
    jest.useFakeTimers();
    haptics.selection.mockClear();
    haptics.completion.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /** Advance both the injected clock and the interval scheduler together. */
  const advance = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock += step;
      act(() => {
        jest.advanceTimersByTime(step);
      });
    }
  };

  it('completes and fires the completion haptic after a full 1.8s hold', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useReleaseHold({ onComplete, onCancel, haptics, now }),
    );

    act(() => {
      result.current.beginHold();
    });
    expect(result.current.isHolding).toBe(true);

    advance(RELEASE_HOLD_DURATION_MS);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(haptics.completion).toHaveBeenCalledTimes(1);
    expect(haptics.selection).toHaveBeenCalled(); // crescendo before the top
    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(1);
  });

  it('cancels and resets cleanly when released before 1.8s, with no completion side effects', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useReleaseHold({ onComplete, onCancel, haptics, now }),
    );

    act(() => {
      result.current.beginHold();
    });
    advance(900); // ~half way
    expect(result.current.progress).toBeGreaterThan(0);

    act(() => {
      result.current.endHold();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(haptics.completion).not.toHaveBeenCalled();
    expect(result.current.isHolding).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.progress).toBe(0);

    // A further passage of time must not complete a cancelled hold.
    advance(2000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not restart once complete until reset() is called', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useReleaseHold({ onComplete, haptics, now }));

    act(() => {
      result.current.beginHold();
    });
    advance(RELEASE_HOLD_DURATION_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.beginHold();
    });
    advance(RELEASE_HOLD_DURATION_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reset();
    });
    expect(result.current.isComplete).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('announces the sustained state once when the hold begins advancing', () => {
    const onSustainStart = jest.fn();
    const { result } = renderHook(() =>
      useReleaseHold({ onComplete: jest.fn(), onSustainStart, haptics, now }),
    );

    act(() => {
      result.current.beginHold();
    });
    advance(200);
    advance(200);

    expect(onSustainStart).toHaveBeenCalledTimes(1);
  });
});
