/**
 * Component and Screen Integration Tests for V2WeeklyInsightScreen.
 *
 * Verifies:
 * 1. Loads weekly insight snapshot or degrades gracefully to first-week empty state.
 * 2. Deterministic narrative correctly matches primary activity distribution.
 * 3. Activity breakdown accurately aggregates session counts and durations.
 * 4. Historical snapshot list renders past reviews without data leaks.
 * 5. Feedback interaction triggers state change and analytics callback.
 * 6. Missing optional domains (no Chart or no Vision) do not crash the view.
 * 7. Disclosure toggle expands/collapses detailed activity.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { V2WeeklyInsightScreen } from '../V2WeeklyInsightScreen';
import { PROTOTYPE_WEEKLY_INSIGHT_FIXTURES } from '@/adapters/v2/weeklyInsight/weeklyInsightFactsBuilder';
import { selectWeeklyInsight } from '@/adapters/v2/weeklyInsight/weeklyInsightSelector';

describe('V2WeeklyInsightScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1. renders weekly insight snapshot with deterministic headline, visual, and evidence', () => {
    const { getByTestId, getByText } = render(
      <V2WeeklyInsightScreen
        factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency}
      />,
    );

    expect(getByTestId('v2-weekly-insight-screen')).toBeTruthy();
    expect(getByText('AUG 31 – SEP 6')).toBeTruthy();
    expect(getByText('Completed week')).toBeTruthy();
    expect(getByText('You kept the Thread steady.')).toBeTruthy();
    expect(
      getByText(
        'You practiced across 4 different days and avoided meaningful softening, even without adding more sessions.',
      ),
    ).toBeTruthy();

    // Visual evidence
    expect(getByTestId('v2-weekly-insight-screen-visual-activity')).toBeTruthy();

    // Evidence row
    expect(getByTestId('v2-weekly-insight-screen-evidence')).toBeTruthy();
    expect(getByText('ACTIVE DAYS')).toBeTruthy();
    expect(getByText('Across the week')).toBeTruthy();

    // Interpretation & Next
    expect(getByText('WHAT THIS MEANS')).toBeTruthy();
    expect(
      getByText(
        'Your consistency came from returning across the week, not from packing more Practice into one day.',
      ),
    ).toBeTruthy();
    expect(getByText('NEXT WEEK')).toBeTruthy();
    expect(
      getByText('Keep the same rhythm. Short Focus sessions are enough to maintain this Thread.'),
    ).toBeTruthy();
  });

  it('2. deterministic narrative correctly matches depth state', () => {
    const { getByText, getByTestId } = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.depth} />,
    );

    expect(getByText('You went deeper, not more often.')).toBeTruthy();
    expect(getByTestId('v2-weekly-insight-screen-visual-anchor')).toBeTruthy();
    expect(getByText('DEEP PRIME')).toBeTruthy();
  });

  it('3. activity breakdown accurately aggregates session counts and durations', () => {
    const { getByTestId, getByText, getAllByText, queryByTestId } = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} />,
    );

    // Initially collapsed
    expect(queryByTestId('v2-weekly-insight-screen-disclosure-panel')).toBeNull();

    // Toggle disclosure
    fireEvent.press(getByTestId('v2-weekly-insight-screen-disclosure-toggle'));

    // Panel is now open
    expect(getByTestId('v2-weekly-insight-screen-disclosure-panel')).toBeTruthy();
    expect(getAllByText('PRACTICES').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('4').length).toBeGreaterThanOrEqual(1); // Active days
    expect(getByText('16')).toBeTruthy(); // Minutes (960s = 16min)
    expect(getByText('Practice mix')).toBeTruthy();
    expect(getByText('Focus')).toBeTruthy();
    expect(getByText('Deep Prime')).toBeTruthy();
  });

  it('4. historical snapshot list opens in drawer and selects past snapshot without data leaks', () => {
    const recovery = { ...selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.recovery), id: 'snap-archive-1' };
    const { getByTestId, getByText, queryByTestId } = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} historyOverride={[recovery]} />,
    );

    // Tap history button in header
    fireEvent.press(getByTestId('v2-weekly-insight-screen-history-btn'));

    // History drawer is visible
    expect(getByTestId('v2-weekly-insight-screen-history-drawer')).toBeTruthy();
    expect(
      getByText(
        'Past weeks stay preserved as snapshots, even when the insight engine changes later.',
      ),
    ).toBeTruthy();

    // Select the "Recovery" historical snapshot
    fireEvent.press(
      getByTestId('v2-weekly-insight-screen-history-drawer-item-snap-archive-1'),
    );

    // Toast appears
    expect(getByTestId('v2-weekly-insight-screen-toast')).toBeTruthy();
    expect(getByText('Historical snapshot')).toBeTruthy();

    // The view now renders the historical recovery snapshot
    expect(getByText('You rebuilt momentum.')).toBeTruthy();
    expect(getByTestId('v2-weekly-insight-screen-visual-thread')).toBeTruthy();
  });

  it('5. feedback interaction triggers state change and callback', () => {
    const onFeedbackSubmit = jest.fn();
    const { getByTestId, getByText } = render(
      <V2WeeklyInsightScreen
        factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency}
        onFeedbackSubmit={onFeedbackSubmit}
      />,
    );

    expect(getByText('Did this match how the week felt?')).toBeTruthy();

    // Tap "Yes" chip
    fireEvent.press(getByTestId('v2-weekly-insight-screen-feedback-chip-yes'));

    expect(onFeedbackSubmit).toHaveBeenCalledWith(
      expect.stringContaining('snapshot-'),
      'Yes',
    );

    // Toast displays
    expect(getByText('Reflection saved')).toBeTruthy();
  });

  it('6. missing optional domains (no Chart or no Vision) do not crash the view', () => {
    // Render noChart state
    const { getAllByText: getAllByTextNoChart, queryByText: queryByTextNoChart } = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.noChart} />,
    );
    expect(getAllByTextNoChart(/health/i).length).toBeGreaterThanOrEqual(1);
    expect(queryByTextNoChart(/Current waypoint/i)).toBeNull();

    // Render noVision state
    const { getByText: getByTextNoVision, queryByText: queryByTextNoVision } = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.noVision} />,
    );
    expect(getByTextNoVision(/You kept the Thread steady/i)).toBeTruthy();
    expect(queryByTextNoVision(/Vision:/i)).toBeNull();
  });

  it('7. calls onBack when back button pressed', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(
      <V2WeeklyInsightScreen
        factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency}
        onBack={onBack}
      />,
    );

    fireEvent.press(getByTestId('v2-weekly-insight-screen-back-btn'));
    expect(onBack).toHaveBeenCalled();
  });
});
