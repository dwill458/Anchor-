import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useDeepFocusSession } from '../useDeepFocusSession';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsEvents: {}, AnalyticsService: { track: jest.fn() } }));

describe('Deep Focus active-time lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  });
  afterEach(() => { jest.useRealTimers(); });
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  it.each([120, 300, 600] as const)('completes %is once with no ending hold', duration => {
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() => useDeepFocusSession({ duration, showTime: false, onSample: jest.fn(), onComplete }));
    advance(duration * 1000 - 250);
    expect(onComplete).not.toHaveBeenCalled();
    advance(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ plannedDurationSeconds: duration, actualDurationSeconds: duration }));
    expect(result.current.state).toBe('complete');
    advance(10000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
  });
  it('excludes background time and requires explicit resume', () => {
    let listener: (state: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => { listener = fn; return { remove: jest.fn() }; });
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() => useDeepFocusSession({ duration: 120, showTime: false, onSample: jest.fn(), onComplete }));
    advance(40000);
    act(() => listener('background'));
    advance(600000);
    act(() => listener('active'));
    expect(result.current.state).toBe('paused');
    expect(result.current.readElapsed()).toBe(40);
    act(() => result.current.resume());
    advance(80000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
  });
  it('ends early without completing when end is called', () => {
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() => useDeepFocusSession({ duration: 600, showTime: false, onSample: jest.fn(), onComplete }));
    advance(21500);
    act(() => result.current.pause());
    advance(60000);
    act(() => { result.current.end(); result.current.end(); });
    advance(1250);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.state).toBe('ended_early');
    unmount();
  });
  it('does not rerender the immersive screen on logical clock ticks and cancels on unmount', () => {
    const onComplete = jest.fn();
    const onSample = jest.fn();
    let renders = 0;
    const hook = renderHook(() => { renders++; return useDeepFocusSession({ duration: 600, showTime: false, onSample, onComplete }); });
    const initial = renders;
    advance(14000);
    expect(renders).toBe(initial);
    hook.unmount();
    const samples = onSample.mock.calls.length;
    advance(600000);
    expect(onSample).toHaveBeenCalledTimes(samples);
    expect(onComplete).not.toHaveBeenCalled();
    const second = renderHook(() => useDeepFocusSession({ duration: 120, showTime: false, onSample, onComplete }));
    expect(second.result.current.readElapsed()).toBe(0);
    second.unmount();
  });

  it('defers a background entry until an explicit foreground resume', () => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    const onSample = jest.fn();
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() => useDeepFocusSession({ duration: 120, showTime: false, onSample, onComplete }));
    advance(600000);
    expect(onSample).not.toHaveBeenCalled();
    expect(result.current.state).toBe('paused');
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    act(() => result.current.resume());
    advance(120000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not complete when ended early and remains in ended_early state', () => {
    const onComplete = jest.fn();
    const { result, unmount } = renderHook(() => useDeepFocusSession({ duration: 120, showTime: false, onSample: jest.fn(), onComplete }));
    advance(20000);
    act(() => result.current.end());
    advance(500);
    act(() => result.current.pause('app_background'));
    advance(600000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.state).toBe('ended_early');
    act(() => result.current.resume());
    advance(750);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.state).toBe('ended_early');
    unmount();
  });
});
