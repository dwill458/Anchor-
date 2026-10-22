import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook } from '@testing-library/react-native';

// withTiming resolves to its target so a shared value reads the animated end state.
const mockWithTiming = jest.fn((to: number, _config: unknown) => to);
const mockWithDelay = jest.fn((_delay: number, anim: unknown) => anim);
const mockReduced = { current: false };

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    // Stable per component instance, so a value written by a press survives re-renders.
    useSharedValue: (initial: number) => require('react').useState({ value: initial })[0],
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (to: number, config: unknown) => mockWithTiming(to, config),
    withDelay: (delay: number, anim: unknown) => mockWithDelay(delay, anim),
    Easing: {
      bezier: () => 'bezier',
      inOut: () => 'inOut',
      sin: 'sin',
    },
  };
});

jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: () => mockReduced.current,
}));

import { NOTIFICATION_MOTION, usePressScale } from '../notificationMotion';
import { Reveal } from '../Reveal';

const within = (value: number, min: number, max: number) => value >= min && value <= max;

describe('NOTIFICATION_MOTION', () => {
  it('keeps every duration inside its budget', () => {
    expect(within(NOTIFICATION_MOTION.screenMs, 450, 650)).toBe(true);
    expect(within(NOTIFICATION_MOTION.anchorFlightMs, 550, 750)).toBe(true);
    expect(within(NOTIFICATION_MOTION.textRevealMs, 300, 450)).toBe(true);
    expect(within(NOTIFICATION_MOTION.pressMs, 100, 140)).toBe(true);
    expect(within(NOTIFICATION_MOTION.successMs, 350, 500)).toBe(true);
    expect(NOTIFICATION_MOTION.reducedMs).toBeLessThanOrEqual(150);
    expect(NOTIFICATION_MOTION.staggerMs).toBe(75);
    expect(NOTIFICATION_MOTION.settleSpring).toEqual(
      expect.objectContaining({
        damping: expect.any(Number),
        stiffness: expect.any(Number),
        mass: expect.any(Number),
      })
    );
  });
});

describe('usePressScale', () => {
  beforeEach(() => {
    mockWithTiming.mockClear();
  });

  it('press-in scales to pressScale over pressMs', () => {
    const { result, rerender } = renderHook((reduce: boolean) => usePressScale(reduce), {
      initialProps: false,
    });
    expect(result.current.style).toEqual({ transform: [{ scale: 1 }] });
    act(() => result.current.onPressIn());
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      NOTIFICATION_MOTION.pressScale,
      expect.objectContaining({ duration: NOTIFICATION_MOTION.pressMs })
    );
    rerender(false);
    expect(result.current.style).toEqual({ transform: [{ scale: NOTIFICATION_MOTION.pressScale }] });
  });

  it('press-out returns to scale 1 over pressMs', () => {
    const { result, rerender } = renderHook((reduce: boolean) => usePressScale(reduce), {
      initialProps: false,
    });
    act(() => result.current.onPressIn());
    act(() => result.current.onPressOut());
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ duration: NOTIFICATION_MOTION.pressMs })
    );
    rerender(false);
    expect(result.current.style).toEqual({ transform: [{ scale: 1 }] });
  });

  it('under Reduce Motion the surface never scales', () => {
    const { result, rerender } = renderHook((reduce: boolean) => usePressScale(reduce), {
      initialProps: true,
    });
    act(() => result.current.onPressIn());
    act(() => result.current.onPressOut());
    expect(mockWithTiming).not.toHaveBeenCalled();
    rerender(true);
    expect(result.current.style).toEqual({ transform: [{ scale: 1 }] });
  });
});

describe('Reveal', () => {
  beforeEach(() => {
    mockWithTiming.mockClear();
    mockWithDelay.mockClear();
    mockReduced.current = false;
  });

  it('renders its children', () => {
    const { getByText } = render(
      React.createElement(Reveal, { index: 0 }, React.createElement(Text, null, 'hello'))
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('plays once per mount and does not replay on re-render or prop change', () => {
    const child = React.createElement(Text, null, 'hello');
    const { rerender } = render(React.createElement(Reveal, { index: 0 }, child));
    expect(mockWithTiming).toHaveBeenCalledTimes(1);

    rerender(React.createElement(Reveal, { index: 0 }, child));
    rerender(React.createElement(Reveal, { index: 3, reduceMotion: true }, child));
    expect(mockWithTiming).toHaveBeenCalledTimes(1);
  });

  it('staggers by index', () => {
    render(React.createElement(Reveal, { index: 2 }, React.createElement(Text, null, 'x')));
    expect(mockWithDelay).toHaveBeenCalledWith(2 * NOTIFICATION_MOTION.staggerMs, expect.anything());
  });

  it('uses an opacity-only reducedMs fade when Reduce Motion is on', () => {
    render(
      React.createElement(Reveal, { index: 2, reduceMotion: true }, React.createElement(Text, null, 'x'))
    );
    expect(mockWithDelay).not.toHaveBeenCalled();
    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithTiming.mock.calls[0][1]).toEqual(
      expect.objectContaining({ duration: NOTIFICATION_MOTION.reducedMs })
    );
  });
});
