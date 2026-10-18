import React from 'react';
import { render } from '@testing-library/react-native';
import { ThreadAuraCanvas } from './ThreadAuraCanvas';

const mockSetActive = jest.fn();
const mockTiming = jest.fn();
jest.mock('react-native-reanimated', () => ({
  ...require('@/__tests__/mocks/reactNativeReanimated').default,
  useSharedValue: (initial: number) => require('react').useRef({ value: initial }).current,
  useFrameCallback: () => require('react').useMemo(() => ({ setActive: mockSetActive }), []),
  withTiming: (target: number, config: unknown) => { mockTiming(target, config); return target; },
}));

const props = { svg: '<svg/>', threadStrength: 50, categoryColor: '#66856A', size: 200, artworkSize: 144,
  variant: 'home' as const, active: true, animate: true, particlesEnabled: true, reducedMotion: false };

beforeEach(() => {
  mockSetActive.mockClear(); mockTiming.mockClear();
});

it('retains the previous confirmed score while covered, eases on return, retreats without a reward, and stops on unmount', () => {
  const screen = render(<ThreadAuraCanvas {...props} />);
  expect(mockSetActive).toHaveBeenCalledWith(true);
  mockTiming.mockClear();
  screen.rerender(<ThreadAuraCanvas {...props} threadStrength={68} active={false} animate={false} />);
  expect(mockSetActive).toHaveBeenLastCalledWith(false);
  expect(mockTiming).not.toHaveBeenCalled();
  screen.rerender(<ThreadAuraCanvas {...props} threadStrength={68} />);
  expect(mockTiming).toHaveBeenCalledWith(0.68, expect.objectContaining({ duration: 1500 }));
  expect(mockTiming).toHaveBeenCalledWith(1, { duration: 350 });
  mockTiming.mockClear();
  screen.rerender(<ThreadAuraCanvas {...props} threadStrength={40} />);
  expect(mockTiming).toHaveBeenCalledWith(0.4, expect.objectContaining({ duration: 2200 }));
  expect(mockTiming).not.toHaveBeenCalledWith(1, { duration: 350 });
  screen.unmount(); expect(mockSetActive).toHaveBeenLastCalledWith(false);
});
