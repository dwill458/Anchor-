import { withSpring, withTiming } from 'react-native-reanimated';

/** Keep native completion callbacks asynchronous in transition lifecycle tests. */
export function deferAnimationCallbacks() {
  const animate = (target: unknown, config?: { duration?: number }, done?: (finished: boolean) => void) => {
    if (done) setTimeout(() => done(true), Math.max(1, config?.duration ?? 500));
    return target;
  };
  (withTiming as jest.Mock).mockImplementation(animate);
  (withSpring as jest.Mock).mockImplementation(animate);
}
