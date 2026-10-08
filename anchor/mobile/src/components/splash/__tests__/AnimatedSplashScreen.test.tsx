import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AnimatedSplashScreen } from '../AnimatedSplashScreen';
import { SPLASH_TIMINGS } from '../splashAnimation.constants';

const mockImpact = jest.fn();
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: (...args: unknown[]) => mockImpact(...args) },
}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  const Animated = {
    View: ReactNative.View,
    Image: ReactNative.Image,
    Text: ReactNative.Text,
    createAnimatedComponent: (component: unknown) => component,
  };

  return {
    __esModule: true,
    default: Animated,
    cancelAnimation: jest.fn(),
    Easing: {
      cubic: jest.fn(),
      out: jest.fn(() => undefined),
      inOut: jest.fn(() => undefined),
    },
    runOnJS: (callback: () => void) => callback,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedProps: (factory: () => unknown) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withDelay: (_delay: number, animation: unknown) => animation,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    // Completes at once so the sequence's end callback is observable.
    withTiming: (value: number, _config?: unknown, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return value;
    },
  };
});

type Props = React.ComponentProps<typeof AnimatedSplashScreen>;

const renderSplash = (overrides: Partial<Props> = {}) => {
  const props: Props = {
    variant: 'return',
    active: false,
    waiting: false,
    reduceMotionEnabled: false,
    onComplete: jest.fn(),
    onRootLayout: jest.fn(),
    onLogoReady: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<AnimatedSplashScreen {...props} />) };
};

describe('AnimatedSplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockImpact.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the native-matching star frame without starting early', () => {
    const { props, getByTestId } = renderSplash();

    expect(getByTestId('splash-star')).toBeTruthy();
    expect(props.onComplete).not.toHaveBeenCalled();

    fireEvent(getByTestId('animated-splash'), 'layout');
    fireEvent(getByTestId('splash-star'), 'load');

    expect(props.onRootLayout).toHaveBeenCalledTimes(1);
    expect(props.onLogoReady).toHaveBeenCalledTimes(1);
  });

  it('shows the wordmark only on first open', () => {
    expect(renderSplash({ variant: 'first' }).queryByTestId('splash-wordmark')).toBeTruthy();
    expect(renderSplash({ variant: 'return' }).queryByTestId('splash-wordmark')).toBeNull();
  });

  it('waits for a resolved variant before running', () => {
    const { props } = renderSplash({ variant: null, active: true });
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('completes the quick return without a haptic', () => {
    const { props } = renderSplash({ variant: 'return', active: true });
    act(() => {
      jest.runAllTimers();
    });
    expect(props.onComplete).toHaveBeenCalled();
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('closes the first-open ceremony with one light haptic', () => {
    const { props } = renderSplash({ variant: 'first', active: true });
    expect(mockImpact).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(SPLASH_TIMINGS.first.hapticAt);
    });
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(props.onComplete).toHaveBeenCalled();
  });

  it('skips the ceremony and its haptic under reduced motion', () => {
    const { props } = renderSplash({ variant: 'first', active: true, reduceMotionEnabled: true });
    act(() => {
      jest.runAllTimers();
    });
    expect(props.onComplete).toHaveBeenCalled();
    expect(mockImpact).not.toHaveBeenCalled();
  });
});
