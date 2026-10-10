/** Shared lightweight Reanimated mock for the TimeWheel / ReminderTimeSheet tests. */
export const createReanimatedMock = () => {
  const { View, ScrollView } = require('react-native');
  const lerp = (x: number, input: number[], output: number[]) => {
    if (x <= input[0]) return output[0];
    for (let i = 1; i < input.length; i += 1) {
      if (x <= input[i]) {
        const t = (x - input[i - 1]) / (input[i] - input[i - 1]);
        return output[i - 1] + t * (output[i] - output[i - 1]);
      }
    }
    return output[output.length - 1];
  };
  return {
    __esModule: true,
    default: { View, ScrollView, createAnimatedComponent: (c: unknown) => c },
    // Stable identity across renders, like the real hook.
    useSharedValue: (initial: unknown) => require('react').useRef({ value: initial }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    // Lets tests drive the scroll handler's onScroll worklet through a normal scroll event.
    useAnimatedScrollHandler: (handlers: { onScroll?: (e: unknown) => void }) => (e: { nativeEvent: unknown }) =>
      handlers.onScroll?.(e.nativeEvent),
    interpolate: lerp,
    Extrapolation: { CLAMP: 'clamp' },
    runOnJS: (fn: (...a: unknown[]) => unknown) => fn,
    withTiming: (to: unknown, _cfg?: unknown, cb?: (finished: boolean) => void) => {
      cb?.(true);
      return to;
    },
    withSpring: (to: unknown) => to,
    cancelAnimation: () => undefined,
    Easing: { bezier: () => 'bezier', out: () => 'out', cubic: 'cubic', inOut: () => 'inOut', sin: 'sin' },
  };
};
