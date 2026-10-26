import { act, renderHook } from '@testing-library/react-native';
import { useVisionBeginDock, visibleButtonFraction } from '../useVisionBeginDock';

type DockOptions = { blocked: boolean; newBoard: boolean; landed: boolean };
const returning: DockOptions = { blocked: false, newBoard: false, landed: true };
function measure(dock: ReturnType<typeof useVisionBeginDock>, buttonTop: number, buttonHeight = 50, viewportHeight = 600) {
  Object.defineProperty(dock.viewportRef, 'current', { configurable: true, value: {
    measureInWindow: (callback: (...rect: number[]) => void) => callback(0, 20, 300, viewportHeight),
  } });
  Object.defineProperty(dock.buttonRef, 'current', { configurable: true, value: {
    measureInWindow: (callback: (...rect: number[]) => void) => callback(0, buttonTop + 20, 300, buttonHeight),
  } });
  dock.measure();
}

describe('Vision Begin dock uses actual button visibility', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    [100, 50, 0, 600, 1],
    [700, 50, 0, 600, 0],
    [590, 50, 0, 600, .2],
    [100, 50, 125, 600, .5],
    [100, 0, 0, 600, 1],
  ])('measures intersection top=%s height=%s scroll=%s viewport=%s', (top, height, scrollY, viewport, fraction) => {
    expect(visibleButtonFraction(top, height, scrollY, viewport)).toBeCloseTo(fraction);
  });

  it('does not duplicate Begin on a short board with the actual button visible', () => {
    const { result } = renderHook(() => useVisionBeginDock(returning));
    act(() => { measure(result.current, 450); jest.advanceTimersByTime(6000); });
    expect(result.current.visible).toBe(false);
  });

  it('shows for a returning board only after arming and only when its measured button is offscreen', () => {
    const { result } = renderHook(() => useVisionBeginDock(returning));
    act(() => measure(result.current, 750));
    expect(result.current.visible).toBe(false);
    act(() => jest.advanceTimersByTime(1199));
    expect(result.current.visible).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(true);
  });

  it('hides while scrolling and reappears after rest only if Begin remains offscreen', () => {
    const { result } = renderHook(() => useVisionBeginDock(returning));
    act(() => { measure(result.current, 900); jest.advanceTimersByTime(1200); });
    expect(result.current.visible).toBe(true);
    act(() => result.current.onScroll(100));
    expect(result.current.visible).toBe(false);
    act(() => jest.advanceTimersByTime(649));
    expect(result.current.visible).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(true);
    act(() => { result.current.onScroll(400); jest.advanceTimersByTime(650); });
    expect(result.current.visible).toBe(false);
  });

  it('hides during editing or a modal interaction and restores visibility afterward', () => {
    const { result, rerender } = renderHook((options: DockOptions) => useVisionBeginDock(options), { initialProps: returning });
    act(() => { measure(result.current, 900); jest.advanceTimersByTime(1200); });
    expect(result.current.visible).toBe(true);
    rerender({ ...returning, blocked: true });
    expect(result.current.visible).toBe(false);
    rerender(returning);
    expect(result.current.visible).toBe(true);
  });

  it('waits until a new board lands and then arms after its arrival delay', () => {
    const options = { ...returning, newBoard: true, landed: false };
    const { result, rerender } = renderHook((props: DockOptions) => useVisionBeginDock(props), { initialProps: options });
    act(() => { measure(result.current, 900); jest.advanceTimersByTime(6000); });
    expect(result.current.visible).toBe(false);
    rerender({ ...options, landed: true });
    act(() => jest.advanceTimersByTime(1399));
    expect(result.current.visible).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(true);
  });

  it('uses hysteresis near the threshold to prevent repeated visibility flips', () => {
    const { result } = renderHook(() => useVisionBeginDock(returning));
    act(() => { measure(result.current, 750); jest.advanceTimersByTime(1200); });
    expect(result.current.visible).toBe(true);
    // Fifty-point button: 31 visible points remain below the visible reset threshold.
    act(() => measure(result.current, 569));
    expect(result.current.visible).toBe(true);
    act(() => measure(result.current, 565));
    expect(result.current.visible).toBe(false);
    act(() => measure(result.current, 569));
    expect(result.current.visible).toBe(false);
  });

  it('clears arming and scroll timers when the board unmounts', () => {
    const { result, unmount } = renderHook(() => useVisionBeginDock(returning));
    act(() => result.current.onScroll(10));
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
