import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThreadStrength } from '../ThreadStrength';
import {
  generateWavePath,
  getWaveLength,
  getWaveY,
  DEFAULT_COLORED_WAVE,
  COLORED_STRAND_2,
  COLORED_STRAND_3,
  COLORED_STRAND_4,
  GRAY_STRAND_1,
  GRAY_STRAND_2,
  GRAY_STRAND_3,
  GRAY_STRAND_4,
  GRAY_STRAND_5,
} from '../wavePath';

describe('wavePath generator', () => {
  it('returns an empty string when width or height is <= 0', () => {
    expect(generateWavePath(0, 48)).toBe('');
    expect(generateWavePath(100, 0)).toBe('');
    expect(generateWavePath(-50, 48)).toBe('');
  });

  it('generates valid SVG cubic Bézier path commands', () => {
    const path = generateWavePath(320, 48, DEFAULT_COLORED_WAVE);
    expect(path.startsWith('M 0')).toBe(true);
    expect(path).toContain('C ');
  });

  it('calculates getWaveY within expected amplitude bounds', () => {
    const width = 360;
    const height = 48;
    const amplitude = 8;
    const midY = height / 2; // 24

    for (let x = 0; x <= width; x += 30) {
      const y = getWaveY(x, width, height, { amplitude });
      expect(y).toBeGreaterThanOrEqual(midY - amplitude - 0.01);
      expect(y).toBeLessThanOrEqual(midY + amplitude + 0.01);
    }
  });

  it('calculates accurate wave path lengths with getWaveLength', () => {
    const width = 350;
    const height = 48;
    const length1 = getWaveLength(width, height, DEFAULT_COLORED_WAVE);
    const length2 = getWaveLength(width, height, COLORED_STRAND_2);

    expect(length1).toBeGreaterThan(width);
    expect(length2).toBeGreaterThan(width);
    expect(getWaveLength(0, height)).toBe(0);
    expect(getWaveLength(width, 0)).toBe(0);
  });
});

describe('ThreadStrength component', () => {
  it('renders with required props and displays delta pill', () => {
    const { getByText, getByTestId } = render(
      <ThreadStrength
        percent={72}
        color="#D94F8A"
        weeklyDelta={6}
        testID="thread-strength"
      />
    );

    expect(getByTestId('thread-strength')).toBeTruthy();
    expect(getByText('▲ +6% this week')).toBeTruthy();
  });

  it('renders negative delta correctly', () => {
    const { getByText } = render(
      <ThreadStrength
        percent={50}
        color="#2FA879"
        weeklyDelta={-4}
      />
    );

    expect(getByText('▼ -4% this week')).toBeTruthy();
  });

  it('renders status word when provided', () => {
    const { getByText } = render(
      <ThreadStrength
        percent={88}
        color="#2FA879"
        weeklyDelta={12}
        status="EMBEDDED"
      />
    );

    expect(getByText('CONSISTENCY')).toBeTruthy();
    expect(getByText('EMBEDDED')).toBeTruthy();
  });

  it('handles track layout and renders multi-strand paths', () => {
    const { getByTestId } = render(
      <ThreadStrength
        percent={64}
        color="#B6A32A"
        weeklyDelta={8}
        testID="thread-strength"
      />
    );

    const track = getByTestId('thread-strength-track');
    expect(track).toBeTruthy();

    fireEvent(track, 'layout', {
      nativeEvent: { layout: { width: 350, height: 48, x: 0, y: 0 } },
    });
  });

  it('clamps percent between 0 and 100', () => {
    const { getByTestId, rerender } = render(
      <ThreadStrength
        percent={120}
        color="#D94F8A"
        weeklyDelta={6}
        testID="thread-strength"
      />
    );

    expect(getByTestId('thread-strength')).toBeTruthy();

    rerender(
      <ThreadStrength
        percent={-15}
        color="#D94F8A"
        weeklyDelta={6}
        testID="thread-strength"
      />
    );

    expect(getByTestId('thread-strength')).toBeTruthy();
  });

  it('supports explicit reduceMotion override', () => {
    const { getByTestId } = render(
      <ThreadStrength
        percent={75}
        color="#A64F68"
        weeklyDelta={5}
        reduceMotion={true}
        testID="thread-strength-reduced"
      />
    );

    expect(getByTestId('thread-strength-reduced')).toBeTruthy();
  });

  it('handles edge case of 0% strength without crashing', () => {
    const { getByTestId } = render(
      <ThreadStrength
        percent={0}
        color="#A64F68"
        testID="thread-strength-zero"
      />
    );

    const track = getByTestId('thread-strength-zero-track');
    fireEvent(track, 'layout', {
      nativeEvent: { layout: { width: 350, height: 48, x: 0, y: 0 } },
    });

    expect(getByTestId('thread-strength-zero')).toBeTruthy();
  });

  it('handles edge case of 100% strength without crashing', () => {
    const { getByTestId } = render(
      <ThreadStrength
        percent={100}
        color="#66856A"
        testID="thread-strength-full"
      />
    );

    const track = getByTestId('thread-strength-full-track');
    fireEvent(track, 'layout', {
      nativeEvent: { layout: { width: 350, height: 48, x: 0, y: 0 } },
    });

    expect(getByTestId('thread-strength-full')).toBeTruthy();
  });
});
