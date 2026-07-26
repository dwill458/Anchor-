import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SwipeableTabContainer } from '../SwipeableTabContainer';

const sharedValues: Array<{ value: number }> = [];
let latestGesture: any;
const tabChildren = [
  <React.Fragment key="vault">Vault content</React.Fragment>,
  <React.Fragment key="practice">Practice content</React.Fragment>,
];

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    __sharedValues: sharedValues,
    default: { View },
    cancelAnimation: jest.fn(),
    Easing: {
      ease: undefined,
      out: jest.fn(() => undefined),
    },
    useSharedValue: (value: number) => {
      const ref = React.useRef(null) as { current: { value: number } | null };
      if (!ref.current) {
        ref.current = { value };
        sharedValues.push(ref.current);
      }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (
      value: number,
      _config?: unknown,
      callback?: (finished: boolean) => void
    ) => {
      callback?.(true);
      return value;
    },
    runOnJS: (callback: (...args: any[]) => any) => callback,
    useReducedMotion: () => false,
    interpolate: (value: number) => value,
    Extrapolation: { CLAMP: 'clamp' },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');

  const createPanGesture = () => {
    const gesture: any = {
      enabled: jest.fn(() => gesture),
      activeOffsetX: jest.fn(() => gesture),
      failOffsetY: jest.fn(() => gesture),
      onStart: jest.fn((callback: () => void) => {
        gesture.start = callback;
        return gesture;
      }),
      onUpdate: jest.fn((callback: (event: any) => void) => {
        gesture.update = callback;
        return gesture;
      }),
      onEnd: jest.fn((callback: (event: any) => void) => {
        gesture.end = callback;
        return gesture;
      }),
      onFinalize: jest.fn((callback: () => void) => {
        gesture.finalize = callback;
        return gesture;
      }),
    };
    latestGesture = gesture;
    return gesture;
  };

  return {
    Gesture: { Pan: createPanGesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

const renderTabs = (activeIndex: number, onIndexChange = jest.fn()) =>
  render(
    <SwipeableTabContainer
      activeIndex={activeIndex}
      onIndexChange={onIndexChange}
      tabCount={2}
    >
      {tabChildren}
    </SwipeableTabContainer>
  );

describe('SwipeableTabContainer', () => {
  beforeEach(() => {
    sharedValues.length = 0;
    latestGesture = undefined;
  });

  it('hands page ownership to the selected tab immediately', () => {
    const screen = renderTabs(0);

    expect(screen.getByTestId('tab-page-0').props.pointerEvents).toBe('auto');
    expect(screen.getByTestId('tab-page-1').props.pointerEvents).toBe('none');

    screen.rerender(
      <SwipeableTabContainer activeIndex={1} onIndexChange={jest.fn()} tabCount={2}>
        {tabChildren}
      </SwipeableTabContainer>
    );

    expect(screen.getByTestId('tab-page-0').props.pointerEvents).toBe('none');
    expect(screen.getByTestId('tab-page-1').props.pointerEvents).toBe('auto');
    expect(sharedValues[0]?.value).toBe(1);
  });

  it('ignores a stale pan after a tab-button selection changes activeIndex', () => {
    const onIndexChange = jest.fn();
    const screen = render(
      <SwipeableTabContainer activeIndex={1} onIndexChange={onIndexChange} tabCount={2}>
        {tabChildren}
      </SwipeableTabContainer>
    );
    const staleGesture = latestGesture;

    act(() => {
      staleGesture.start();
    });

    screen.rerender(
      <SwipeableTabContainer activeIndex={0} onIndexChange={onIndexChange} tabCount={2}>
        {tabChildren}
      </SwipeableTabContainer>
    );

    act(() => {
      staleGesture.update({ translationX: 240 });
      staleGesture.end({ velocityX: 0, translationX: 0 });
    });

    expect(sharedValues[0]?.value).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});
