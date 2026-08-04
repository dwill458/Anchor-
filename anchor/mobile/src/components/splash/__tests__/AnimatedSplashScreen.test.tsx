import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AnimatedSplashScreen } from '../AnimatedSplashScreen';

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const ReactNative = require('react-native');
  const Animated = {
    View: ReactNative.View,
    Image: ReactNative.Image,
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
    useSharedValue: (value: number) => ({ value }),
    withDelay: (_delay: number, animation: unknown) => animation,
    withTiming: (value: number) => value,
  };
});

describe('AnimatedSplashScreen', () => {
  it('renders the full-screen launch artwork without starting early', () => {
    const onComplete = jest.fn();
    const onRootLayout = jest.fn();
    const onLogoReady = jest.fn();
    const { getByTestId } = render(
      <AnimatedSplashScreen
        active={false}
        reduceMotionEnabled={false}
        onComplete={onComplete}
        onRootLayout={onRootLayout}
        onLogoReady={onLogoReady}
      />
    );

    expect(getByTestId('animated-splash')).toBeTruthy();
    expect(getByTestId('splash-artwork')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent(getByTestId('animated-splash'), 'layout');
    fireEvent(getByTestId('splash-artwork'), 'load');

    expect(onRootLayout).toHaveBeenCalledTimes(1);
    expect(onLogoReady).toHaveBeenCalledTimes(1);
  });
});
