import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DailyPracticeGoalScreen } from './DailyPracticeGoalScreen';

const mockSetDailyPracticeGoal = jest.fn();
const mockSettingsState = {
  dailyPracticeGoal: 3,
  setDailyPracticeGoal: mockSetDailyPracticeGoal,
};

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => mockSettingsState,
}));

describe('DailyPracticeGoalScreen', () => {
  beforeEach(() => {
    mockSettingsState.dailyPracticeGoal = 3;
    mockSetDailyPracticeGoal.mockReset();
  });

  it('updates the goal when a preset is selected', () => {
    const screen = render(<DailyPracticeGoalScreen />);

    fireEvent.press(screen.getByLabelText('Select 5 Focus Bursts / day'));

    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(5);
  });

  it('updates the goal when the custom stepper is used', () => {
    const screen = render(<DailyPracticeGoalScreen />);

    fireEvent.press(screen.getByLabelText('Increase custom daily focus goal'));

    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(4);
  });
});
