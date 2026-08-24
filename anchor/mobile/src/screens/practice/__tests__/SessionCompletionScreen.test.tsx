import React from 'react';
import { Animated } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SessionCompletionScreen } from '../SessionCompletionScreen';

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
  AnalyticsEvents: {},
}));

describe('SessionCompletionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotion = false;
  });

  const baseProps = {
    anchor: {
      id: 'anchor-1',
      baseSigilSvg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
    } as any,
    eyebrow: 'FOCUS COMPLETE',
    headline: 'Focus complete.',
    accentColor: '#AD99D2',
    repeatLabel: 'Focus Again',
  };

  it('renders the session gain, not the anchor total, when Thread Strength increases', () => {
    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={8}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );

    expect(screen.getByText('FOCUS COMPLETE')).toBeTruthy();
    expect(screen.getByText('Focus complete.')).toBeTruthy();
    expect(screen.getByText('THREAD +8')).toBeTruthy();
    expect(screen.queryByText('THREAD 61')).toBeNull();
    expect(screen.getByText('STRENGTHENED')).toBeTruthy();
    expect(screen.getByText('PRACTICED')).toBeTruthy();
  });

  it('never shows a negative-looking delta and always includes a sign', () => {
    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={0}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );

    expect(screen.getByText('THREAD +0')).toBeTruthy();
  });

  it('formats sub-minute durations in seconds and minute-plus durations in minutes', () => {
    const { rerender } = render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={8}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );
    expect(screen.getByText('30 SEC')).toBeTruthy();

    rerender(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="deep_prime"
        durationSeconds={300}
        threadDelta={15}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );
    expect(screen.getByText('5 MIN')).toBeTruthy();
  });

  it('invokes onContinue and onRepeat from their respective CTAs', () => {
    const onContinue = jest.fn();
    const onRepeat = jest.fn();
    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={8}
        onContinue={onContinue}
        onRepeat={onRepeat}
      />,
    );

    fireEvent.press(screen.getByText('CONTINUE →'));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Focus Again'));
    expect(onRepeat).toHaveBeenCalledTimes(1);
  });

  it('renders optional secondary action and below-stats content slots', () => {
    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="visualize"
        durationSeconds={180}
        threadDelta={15}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
        secondaryAction={<></>}
        belowStatsContent={<></>}
      />,
    );
    expect(screen.getByText('THREAD +15')).toBeTruthy();
  });

  it('does not start the ambient ripple/shimmer loops when reduced motion is enabled', () => {
    mockReduceMotion = true;
    const loopSpy = jest.spyOn(Animated, 'loop');

    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={8}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );

    expect(loopSpy).not.toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it('starts the ambient ripple/shimmer loops when reduced motion is disabled', () => {
    mockReduceMotion = false;
    const loopSpy = jest.spyOn(Animated, 'loop');

    render(
      <SessionCompletionScreen
        {...baseProps}
        practiceMode="focus"
        durationSeconds={30}
        threadDelta={8}
        onContinue={jest.fn()}
        onRepeat={jest.fn()}
      />,
    );

    expect(loopSpy).toHaveBeenCalled();
    loopSpy.mockRestore();
  });
});
