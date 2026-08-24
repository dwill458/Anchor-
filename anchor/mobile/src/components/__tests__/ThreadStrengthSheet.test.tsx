import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThreadStrengthSheet, getTagline, resolveAnchorStrengthPct } from '../ThreadStrengthSheet';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AnalyticsService } from '@/services/AnalyticsService';

let mockReduceMotion = false;

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.createAnimatedComponent = jest.fn((C: any) => C);
  return Reanimated;
});

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: jest.fn(),
  },
}));

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
    jest.clearAllMocks();
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

  it('renders this week dot row and sensitivity row', () => {
    render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.getByText('This Week')).toBeTruthy();
    expect(screen.getByText('MON')).toBeTruthy();
    expect(screen.getByText('SUN')).toBeTruthy();
    expect(screen.getByText('SENSITIVITY: BALANCED')).toBeTruthy();
    expect(screen.getByText('One grace day before gradual decay.')).toBeTruthy();
  });

  describe('Education Accordion (How Thread Strength Works)', () => {
    it('is collapsed by default with heading and supporting copy visible, while detailed principles are hidden', () => {
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      expect(screen.getByText('HOW THREAD STRENGTH WORKS')).toBeTruthy();
      expect(screen.getByText('Built through return, depth, and consistency.')).toBeTruthy();

      expect(screen.queryByText('RETURN OVER TIME')).toBeNull();
      expect(screen.queryByText('REPEAT PRACTICE')).toBeNull();
      expect(screen.queryByText('PRACTICE DEPTH')).toBeNull();
      expect(screen.queryByText('TIME AWAY')).toBeNull();
    });

    it('expands on tap to reveal the four principles and logs analytics', () => {
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      const toggle = screen.getByTestId('thread-strength-education-toggle');
      fireEvent.press(toggle);

      expect(screen.getByText('RETURN OVER TIME')).toBeTruthy();
      expect(
        screen.getByText(
          'Your first practice with this Anchor each day has the strongest effect. Returning across different days builds Thread Strength most effectively.'
        )
      ).toBeTruthy();

      expect(screen.getByText('REPEAT PRACTICE')).toBeTruthy();
      expect(
        screen.getByText(
          'Practicing the same Anchor again can still reinforce it, but additional practices in the same day contribute less Thread Strength.'
        )
      ).toBeTruthy();

      expect(screen.getByText('PRACTICE DEPTH')).toBeTruthy();
      expect(
        screen.getByText(
          'Different practices reinforce your Anchor differently. Deeper practices can have a stronger effect than shorter Focus sessions.'
        )
      ).toBeTruthy();

      expect(screen.getByText('TIME AWAY')).toBeTruthy();
      expect(
        screen.getByText(
          'Thread Strength gradually eases when you stop returning. Rest days are protected, and your Sensitivity setting controls how soon strength begins to loosen.'
        )
      ).toBeTruthy();

      expect(AnalyticsService.track).toHaveBeenCalledWith('thread_strength_education_opened', {
        anchor_id: 'anchor-1',
      });
    });

    it('collapses on second tap and logs closed analytics', () => {
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      const toggle = screen.getByTestId('thread-strength-education-toggle');
      fireEvent.press(toggle);
      expect(screen.getByText('RETURN OVER TIME')).toBeTruthy();

      fireEvent.press(toggle);
      expect(screen.queryByText('RETURN OVER TIME')).toBeNull();

      expect(AnalyticsService.track).toHaveBeenCalledWith('thread_strength_education_closed', {
        anchor_id: 'anchor-1',
      });
    });

    it('handles reduced motion mode and expands accordion without error', () => {
      mockReduceMotion = true;
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      const toggle = screen.getByTestId('thread-strength-education-toggle');
      fireEvent.press(toggle);

      expect(screen.getByText('RETURN OVER TIME')).toBeTruthy();
      expect(screen.getByText('REPEAT PRACTICE')).toBeTruthy();
    });
  });

  describe('Sensitivity copy validation', () => {
    it('renders correct copy for Balanced sensitivity and not the obsolete copy', () => {
      useSettingsStore.setState({ threadStrengthSensitivity: 'balanced' });
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      expect(screen.getByText('SENSITIVITY: BALANCED')).toBeTruthy();
      expect(screen.getByText('One grace day before gradual decay.')).toBeTruthy();
      expect(screen.queryByText('Any missed day begins decay.')).toBeNull();
    });

    it('renders correct two-day grace explanation for Lenient sensitivity', () => {
      useSettingsStore.setState({ threadStrengthSensitivity: 'lenient' });
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      expect(screen.getByText('SENSITIVITY: LENIENT')).toBeTruthy();
      expect(screen.getByText('Two grace days before gradual decay.')).toBeTruthy();
    });

    it('renders immediate-decay explanation for Strict sensitivity', () => {
      useSettingsStore.setState({ threadStrengthSensitivity: 'strict' });
      render(<ThreadStrengthSheet visible={true} onClose={jest.fn()} anchorId="anchor-1" />);

      expect(screen.getByText('SENSITIVITY: STRICT')).toBeTruthy();
      expect(screen.getByText('Decay begins after the first missed practice day.')).toBeTruthy();
    });

    it('calls onOpenSensitivity when sensitivity row is pressed', () => {
      const onOpenSensitivity = jest.fn();
      render(
        <ThreadStrengthSheet
          visible={true}
          onClose={jest.fn()}
          anchorId="anchor-1"
          onOpenSensitivity={onOpenSensitivity}
        />
      );

      const sensitivityRow = screen.getByTestId('thread-strength-sensitivity-row');
      fireEvent.press(sensitivityRow);

      expect(onOpenSensitivity).toHaveBeenCalledTimes(1);
    });
  });

  it('does not render when visible is false', () => {
    render(<ThreadStrengthSheet visible={false} onClose={jest.fn()} anchorId="anchor-1" />);

    expect(screen.queryByText('This Anchor · Thread Strength')).toBeNull();
  });

  it('exports helper functions with stable signatures', () => {
    expect(getTagline(0, 0)).toBe('No sessions yet. Forge the first prime.');
    expect(getTagline(10, 1)).toBe('Thread is beginning.');
    expect(getTagline(15, 5)).toBe('Thread is beginning.');
    expect(getTagline(35, 5)).toBe('Thread is lightly held.');
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
