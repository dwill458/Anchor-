import { act, renderHook } from '@testing-library/react-native';
import { useAppStartup } from '../useAppStartup';
import { SPLASH_FAIL_OPEN_TIMEOUT_MS } from '@/components/splash/splashAnimation.constants';

const readyOptions = {
  fontsReady: true,
  settingsHydrated: true,
  authRestorationSettled: true,
  essentialDataSettled: true,
  primeOnLaunchResolved: true,
};

describe('useAppStartup', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires every startup dependency before becoming ready', () => {
    const { result } = renderHook(() =>
      useAppStartup({ ...readyOptions, essentialDataSettled: false })
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.status).toBe('pending');
  });

  it('allows safe hydration failures to continue', () => {
    const { result } = renderHook(() =>
      useAppStartup({ ...readyOptions, safeFailure: true })
    );

    expect(result.current.isReady).toBe(true);
    expect(result.current.status).toBe('failed-but-safe-to-continue');
    expect(result.current.outcome).toBe('fail_open');
  });

  it('fails open after the defensive startup timeout', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useAppStartup({ ...readyOptions, fontsReady: false })
    );

    expect(result.current.isReady).toBe(false);

    act(() => {
      jest.advanceTimersByTime(SPLASH_FAIL_OPEN_TIMEOUT_MS + 1);
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.timedOut).toBe(true);
    expect(result.current.outcome).toBe('fail_open');
  });

  it('keeps fatal startup failures blocked', () => {
    const { result } = renderHook(() =>
      useAppStartup({ ...readyOptions, fatalFailure: true })
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.status).toBe('fatal');
  });
});
