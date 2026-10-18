import { act, renderHook } from '@testing-library/react-native';
import { PanResponder, type PanResponderCallbacks } from 'react-native';
import { useChooseController } from '../useChooseController';
import { safeHaptics } from '@/utils/haptics';

// Run the controller's animation callbacks on a deterministic clock, rather than
// the default Reanimated mock which completes every timing immediately.
jest.mock('react-native-reanimated', () => {
  const base = require('@/__tests__/mocks/reactNativeReanimated').default;
  return {
    ...base,
    useSharedValue: (value: number) => require('react').useRef({ value }).current,
    runOnJS: (fn: unknown) => fn,
    withTiming: (value: number, config: { duration: number }, callback?: (finished: boolean) => void) => ({ value, duration: config.duration, callback }),
    withSequence: (...steps: Array<{ duration: number; callback?: (finished: boolean) => void }>) => {
      let elapsed = 0;
      steps.forEach((step) => {
        elapsed += step.duration;
        if (step.callback) setTimeout(() => step.callback!(true), elapsed);
      });
      return 1;
    },
  };
});
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

it('stays silent on hold-start and early release', () => {
  let touch!: PanResponderCallbacks;
  jest.spyOn(PanResponder, 'create').mockImplementation((callbacks) => {
    touch = callbacks;
      return { getInteractionHandle: () => undefined, panHandlers: {} as never };
  });
  const onSealLanded = jest.fn();
  const onHoldComplete = jest.fn();
  const { result } = renderHook(() => useChooseController({ reduceMotion: false, onSealLanded, onHoldComplete, onSealAnimationDone: jest.fn() }));
  const event = { nativeEvent: { locationX: 195, locationY: 300 } } as never;
  act(() => { touch.onPanResponderGrant!(event, {} as never); });
  expect(onSealLanded).not.toHaveBeenCalled();
  expect(onHoldComplete).not.toHaveBeenCalled();
  act(() => { touch.onPanResponderRelease!(event, {} as never); });
  expect(onSealLanded).not.toHaveBeenCalled();
});

it.each([false, true])('lands sound at the flash, then rests before leaving (reduced=%s)', (reduceMotion) => {
  const onSealLanded = jest.fn();
  const onHoldComplete = jest.fn();
  const onSealAnimationDone = jest.fn();
  const heavyHapticAt = jest.fn(() => Date.now());
  jest.mocked(safeHaptics.impact).mockImplementation((style) => {
    if (style === 'heavy') heavyHapticAt();
    return Promise.resolve();
  });
  onSealLanded.mockImplementation(() => Date.now());
  const { result } = renderHook(() => useChooseController({ reduceMotion, onSealLanded, onHoldComplete, onSealAnimationDone }));
  expect(onSealLanded).not.toHaveBeenCalled();
  act(() => { void result.current.sealNow(); });
  expect(result.current.phase).toBe('sealing');
  expect(result.current.flash.value).toMatchObject({ value: 0.4 });
  expect(onSealLanded).toHaveBeenCalledTimes(1);
  expect(Math.abs(onSealLanded.mock.results[0].value - heavyHapticAt.mock.results[0].value)).toBeLessThanOrEqual(120);
  expect(onSealLanded.mock.invocationCallOrder[0]).toBeLessThan(onHoldComplete.mock.invocationCallOrder[0]);
  const sequenceMs = reduceMotion ? 400 : 1600;
  act(() => { jest.advanceTimersByTime(sequenceMs + 499); });
  expect(onSealAnimationDone).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(501); });
  expect(onSealAnimationDone).toHaveBeenCalledTimes(1);
  expect(safeHaptics.impact).toHaveBeenLastCalledWith('light');
  act(() => { void result.current.sealNow(); });
  expect(onSealLanded).toHaveBeenCalledTimes(1);
});
