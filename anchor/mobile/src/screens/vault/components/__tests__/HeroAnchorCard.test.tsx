import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { HeroAnchorCard } from '../HeroAnchorCard';
import type { Anchor } from '@/types';

jest.mock('../SelectedChipGlowRing', () => ({
  SelectedChipGlowRing: () => null,
}));

const mockAnchor: Anchor = {
  id: 'test-anchor-1',
  userId: 'user-1',
  name: 'Courage',
  intentionText: 'I face challenges with calm confidence',
  category: 'health',
  baseSigilSvg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>',
  reinforcedSigilSvg: null,
  enhancedImageUrl: null,
  isCharged: true,
  threadStrength: 75,
  streak: 5,
  chargeCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('HeroAnchorCard', () => {
  it('renders anchor intention, category, and stage elements', () => {
    const onPress = jest.fn();
    render(
      <HeroAnchorCard
        anchor={mockAnchor}
        onPress={onPress}
        reduceMotionEnabled={false}
      />
    );

    expect(screen.getByText('I face challenges with calm confidence')).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
    expect(screen.getByText('THREAD STRENGTH')).toBeTruthy();
    expect(screen.getByTestId('hero-stage')).toBeTruthy();
  });

  it('handles press-in and press-out interactions', () => {
    const onPress = jest.fn();
    render(
      <HeroAnchorCard
        anchor={mockAnchor}
        onPress={onPress}
        reduceMotionEnabled={false}
      />
    );

    const button = screen.getByRole('button');
    fireEvent(button, 'pressIn');
    fireEvent(button, 'pressOut');
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders gracefully when reduceMotionEnabled is true', () => {
    render(
      <HeroAnchorCard
        anchor={mockAnchor}
        onPress={jest.fn()}
        reduceMotionEnabled={true}
      />
    );

    expect(screen.getByTestId('hero-stage')).toBeTruthy();
    expect(screen.getByText('I face challenges with calm confidence')).toBeTruthy();
  });

  it('renders gracefully when performanceTier is low', () => {
    render(
      <HeroAnchorCard
        anchor={mockAnchor}
        onPress={jest.fn()}
        reduceMotionEnabled={false}
        performanceTier="low"
      />
    );

    expect(screen.getByTestId('hero-stage')).toBeTruthy();
    expect(screen.getByText('I face challenges with calm confidence')).toBeTruthy();
  });
});
