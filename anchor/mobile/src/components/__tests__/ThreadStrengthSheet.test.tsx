import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThreadStrengthSheet, getTagline, resolveAnchorStrengthPct } from '../ThreadStrengthSheet';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

let mockReduceMotion = false;

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.createAnimatedComponent = jest.fn((C: any) => C);
  return Reanimated;
});

const mockAnchor = {
  id: 'anchor-1',
  name: 'Test Anchor',
  intentionText: 'Anchor has ten thousand users',
  category: 'Focus',
  threadStrength: 43,
  baseSigilSvg: '<svg></svg>',
  sigilUri: null,
  enhancedImageUrl: null,
};

describe('ThreadStrengthSheet v2', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    useAnchorStore.setState({
      anchors: [mockAnchor as any],
    });
    useSessionStore.setState({
      primingHistory: [
        {
          id: 'p-1',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        } as any,
        {
          id: 'p-2',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        } as any,
        {
          id: 'p-3',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        } as any,
        {
          id: 'p-4',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: new Date().toISOString(),
        } as any,
      ],
      sessionLog: [],
    });
    useSettingsStore.setState({
      threadStrengthSensitivity: 'balanced',
    });
  });

  it('renders single score as XX /100 in the ring and no separate percentage pill in header', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('This Anchor · Thread Strength')).toBeTruthy();
    expect(screen.getByText('Anchor has ten thousand users')).toBeTruthy();
    expect(screen.getByText('43')).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
    expect(screen.getByText('STRENGTH')).toBeTruthy();
    // Verify there is no separate pill headerPct like "43%"
    expect(screen.queryByText('43%')).toBeNull();
  });

  it('promotes state headline and displays explainer copy below it', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('Thread is holding.')).toBeTruthy();
    expect(screen.getByText('Grows when you come back to this anchor consistently.')).toBeTruthy();
  });

  it('renders ordered stat rows with proportional labels and values', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('Total Sessions')).toBeTruthy();
    expect(screen.getByText('Longest Constancy')).toBeTruthy();
    expect(screen.getByText('Current Constancy')).toBeTruthy();
    expect(screen.getByText('Deep Primes')).toBeTruthy();
  });

  it('renders session breakdown with Silver styling for Deep Primes', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('Session Breakdown')).toBeTruthy();
    expect(screen.getAllByText(/Deep Primes/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Focus/)).toBeTruthy();
  });

  it('renders this week dot row and sensitivity footnote', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('This Week')).toBeTruthy();
    expect(screen.getByText('MON')).toBeTruthy();
    expect(screen.getByText('SUN')).toBeTruthy();
    expect(screen.getByText(/Balanced/)).toBeTruthy();
  });

  it('handles reduced motion mode without error', () => {
    mockReduceMotion = true;
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('43')).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
    expect(screen.getByText('Thread is holding.')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    render(<ThreadStrengthSheet visible={false} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.queryByText('This Anchor · Thread Strength')).toBeNull();
  });

  it('exports helper functions with stable signatures', () => {
    expect(getTagline(0, 0)).toBe('No sessions yet. Forge the first prime.');
    expect(getTagline(10, 1)).toBe('Thread is new. Return tomorrow to set it.');
    expect(getTagline(15, 5)).toBe('Thread is fraying. Prime today.');
    expect(getTagline(35, 5)).toBe('Slipping. Prime today.');
    expect(getTagline(55, 5)).toBe('Thread is holding.');
    expect(getTagline(85, 5)).toBe('Thread is holding strong.');
    expect(getTagline(95, 5)).toBe('Thread is fully tensioned.');

    const score = resolveAnchorStrengthPct({
      storedStrength: 80,
      totalSessions: 10,
      currentStreak: 5,
      thisWeekDays: [],
    });
    expect(score).toBe(80);
  });
});
