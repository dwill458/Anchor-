import { act, renderHook } from '@testing-library/react-native';
import { REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS, useRequiredLocalHydrationGuard } from '../useRequiredLocalHydrationGuard';

describe('useRequiredLocalHydrationGuard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps startup recoverable when required stores finish before the timeout', () => {
    const { result, rerender, unmount } = renderHook(
      ({ anchorsHydrated, firstRunHydrated }) =>
        useRequiredLocalHydrationGuard({ anchorsHydrated, firstRunHydrated }),
      { initialProps: { anchorsHydrated: false, firstRunHydrated: false } },
    );

    act(() => jest.advanceTimersByTime(REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS - 1000));
    expect(result.current).toBe(false);

    rerender({ anchorsHydrated: true, firstRunHydrated: true });
    act(() => jest.advanceTimersByTime(REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS));

    expect(result.current).toBe(false);
    unmount();
  });

  it('does not extend the remaining store deadline when the other store hydrates one second early', () => {
    const { result, rerender, unmount } = renderHook(
      ({ anchorsHydrated, firstRunHydrated }) =>
        useRequiredLocalHydrationGuard({ anchorsHydrated, firstRunHydrated }),
      { initialProps: { anchorsHydrated: false, firstRunHydrated: false } },
    );

    act(() => jest.advanceTimersByTime(REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS - 1000));
    rerender({ anchorsHydrated: false, firstRunHydrated: true });
    expect(result.current).toBe(false);

    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    rerender({ anchorsHydrated: true, firstRunHydrated: true });
    expect(result.current).toBe(false);
    unmount();
  });

  it.each(['anchorsHydrated', 'firstRunHydrated'] as const)(
    'fails closed at the timeout when %s stays unresolved',
    (unresolvedStore) => {
      const hydration: { anchorsHydrated: boolean; firstRunHydrated: boolean } = {
        anchorsHydrated: true,
        firstRunHydrated: true,
      };
      hydration[unresolvedStore] = false;
      const { result, unmount } = renderHook(() => useRequiredLocalHydrationGuard(hydration));

      act(() => jest.advanceTimersByTime(REQUIRED_LOCAL_HYDRATION_TIMEOUT_MS - 1000));
      expect(result.current).toBe(false);

      act(() => jest.advanceTimersByTime(1000));
      expect(result.current).toBe(true);
      unmount();
    },
  );

  it('cancels outstanding required-store timers on unmount', () => {
    const { unmount } = renderHook(() =>
      useRequiredLocalHydrationGuard({ anchorsHydrated: false, firstRunHydrated: false }),
    );

    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
