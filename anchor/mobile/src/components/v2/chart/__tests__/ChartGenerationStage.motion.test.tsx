import React from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { ChartGenerationStage } from '../ChartGenerationStage';
import type { ChartMarker } from '../ChartLandscape';

jest.mock('../map/ChartMap', () => ({ ChartMap: () => null }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

const markers: ChartMarker[] = [{ id: 'first', number: 1, state: 'upcoming', accessibilityLabel: 'First waypoint' }];
const common = { width: 360, height: 667, reducedMotion: false, destinationImageUrl: 'https://example.test/vision.jpg', testID: 'chart-generation' };
const timings = (duration: number) => jest.mocked(withTiming).mock.calls.filter(call => (call[1] as {duration?: number})?.duration === duration);

describe('Chart generation motion', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('advances the current and done checklist states, pops once, and completes with the flag', () => {
    const done = jest.fn();
    const screen = render(<ChartGenerationStage {...common} markers={null} onRevealed={done} />);
    expect(screen.getByTestId('chart-checklist-reading').props.accessibilityLabel).toContain('current');
    expect(screen.getByTestId('chart-checklist-finding').props.accessibilityLabel).toContain('pending');
    act(() => jest.advanceTimersByTime(900));
    expect(screen.getByTestId('chart-check-reading')).toBeTruthy();
    expect(safeHaptics.impact).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Light);
    expect(timings(130)).toHaveLength(1);
    screen.rerender(<ChartGenerationStage {...common} markers={null} onRevealed={done} />);
    expect(timings(130)).toHaveLength(1);
    screen.rerender(<ChartGenerationStage {...common} markers={markers} onRevealed={done} />);
    expect(safeHaptics.impact).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Light);
    expect(timings(130)).toHaveLength(2);
    act(() => jest.advanceTimersByTime(1299));
    expect(screen.queryByTestId('chart-check-building')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('chart-check-building')).toBeTruthy();
    expect(timings(130)).toHaveLength(3);
    act(() => jest.advanceTimersByTime(300));
    expect(timings(300)).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(300));
    expect(done).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenNthCalledWith(3, Haptics.ImpactFeedbackStyle.Medium);
    screen.rerender(<ChartGenerationStage {...common} markers={markers} onRevealed={done} />);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(3);
    expect(timings(130)).toHaveLength(3);
  });

  it('develops each image URL once and never replays the same image on rerender', () => {
    const screen = render(<ChartGenerationStage {...common} markers={null} />);
    expect(timings(1400)).toHaveLength(1);
    screen.rerender(<ChartGenerationStage {...common} markers={null} category="career" />);
    expect(timings(1400)).toHaveLength(1);
    screen.rerender(<ChartGenerationStage {...common} destinationImageUrl="https://example.test/second.jpg" markers={null} />);
    expect(timings(1400)).toHaveLength(2);
    screen.rerender(<ChartGenerationStage {...common} markers={null} />);
    expect(timings(1400)).toHaveLength(2);
    expect(StyleSheet.flatten(screen.getByTestId('chart-stage-vision-cover').props.style).opacity).toBe(0);
  });

  it('breathes during long waits and stops the long-wait copy when the response arrives', () => {
    const screen = render(<ChartGenerationStage {...common} markers={null} />);
    act(() => jest.advanceTimersByTime(12000));
    expect(timings(1200)).toHaveLength(1);
    expect(screen.getByTestId('chart-generation-status').props.accessibilityLabel).toBe('Still finding the meaningful changes.');
    screen.rerender(<ChartGenerationStage {...common} markers={markers} />);
    expect(screen.getByTestId('chart-generation-status').props.accessibilityLabel).not.toContain('Still finding');
  });

  it('skips motion and haptics under reduced motion, preserving the existing finish callback', () => {
    const done = jest.fn();
    const screen = render(<ChartGenerationStage {...common} markers={null} reducedMotion onRevealed={done} />);
    act(() => jest.advanceTimersByTime(12000));
    screen.rerender(<ChartGenerationStage {...common} markers={markers} reducedMotion onRevealed={done} />);
    act(() => jest.advanceTimersByTime(420));
    expect(done).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(withTiming).not.toHaveBeenCalled();
  });
});
