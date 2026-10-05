import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false, useCreationReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay) };
});

import { V2WeeklyInsightScreen } from '../V2WeeklyInsightScreen';
import { PROTOTYPE_WEEKLY_INSIGHT_FIXTURES } from '@/adapters/v2/weeklyInsight/weeklyInsightFactsBuilder';
import { selectWeeklyInsight } from '@/adapters/v2/weeklyInsight/weeklyInsightSelector';

const withDelay = Reanimated.withDelay as jest.Mock;
const ID = 'v2-weekly-insight-screen';

describe('V2WeeklyInsightScreen motion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    withDelay.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stages its sections in once and keeps every section on screen', () => {
    const { getByTestId } = render(<V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} />);
    expect(withDelay).toHaveBeenCalled();
    for (const section of ['visual-activity', 'evidence', 'interpretation', 'next-direction', 'feedback', 'disclosure']) {
      expect(getByTestId(`${ID}-${section}`)).toBeTruthy();
    }
    const longest = Math.max(...withDelay.mock.calls.map(([delay]) => delay as number));
    expect(longest).toBeLessThanOrEqual(6 * 60);
  });

  it('does not replay the arrival when the disclosure opens or the screen re-renders', () => {
    const view = render(<V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} />);
    const afterMount = withDelay.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);
    fireEvent.press(view.getByTestId(`${ID}-disclosure-toggle`));
    expect(view.getByTestId(`${ID}-disclosure-panel`)).toBeTruthy();
    view.rerender(<V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} />);
    expect(withDelay.mock.calls.length).toBe(afterMount);
  });

  it('swaps to a historical snapshot in place, without staging the sections in again', () => {
    const recovery = { ...selectWeeklyInsight(PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.recovery), id: 'snap-archive-1' };
    const view = render(
      <V2WeeklyInsightScreen factsOverride={PROTOTYPE_WEEKLY_INSIGHT_FIXTURES.consistency} historyOverride={[recovery]} />,
    );
    const afterMount = withDelay.mock.calls.length;
    fireEvent.press(view.getByTestId(`${ID}-history-btn`));
    fireEvent.press(view.getByTestId(`${ID}-history-drawer-item-snap-archive-1`));
    expect(view.getByText('You rebuilt momentum.')).toBeTruthy();
    expect(view.getByText('Historical snapshot')).toBeTruthy();
    expect(withDelay.mock.calls.length).toBe(afterMount);
  });
});
