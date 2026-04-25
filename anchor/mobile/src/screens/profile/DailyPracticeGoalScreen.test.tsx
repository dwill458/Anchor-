import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DailyPracticeGoalScreen } from './DailyPracticeGoalScreen';

const mockSetDailyPracticeGoal = jest.fn();
const mockSetDailyPracticeGoalPreset = jest.fn();
const mockGoBack = jest.fn();
const mockSettingsState = {
  dailyPracticeGoal: 3,
  dailyPracticeGoalPreset: 'three',
  setDailyPracticeGoal: mockSetDailyPracticeGoal,
  setDailyPracticeGoalPreset: mockSetDailyPracticeGoalPreset,
};

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector?: (state: typeof mockSettingsState) => unknown) =>
    selector ? selector(mockSettingsState) : mockSettingsState,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

describe('DailyPracticeGoalScreen', () => {
  beforeEach(() => {
    mockSettingsState.dailyPracticeGoal = 3;
    mockSettingsState.dailyPracticeGoalPreset = 'three';
    mockSetDailyPracticeGoal.mockReset();
    mockSetDailyPracticeGoalPreset.mockReset();
    mockGoBack.mockReset();
  });

  it('updates the goal when a preset is selected', () => {
    const screen = render(<DailyPracticeGoalScreen />);

    fireEvent.press(screen.getByText('Five times'));
    fireEvent.press(screen.getByText('Save Goal'));

    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(5);
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('five');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('updates the goal when the custom stepper is used', () => {
    const screen = render(<DailyPracticeGoalScreen />);

    fireEvent.press(screen.getByLabelText('Increase custom daily practice goal'));
    fireEvent.press(screen.getByText('Save Goal'));

    expect(mockSetDailyPracticeGoal).toHaveBeenCalledWith(4);
    expect(mockSetDailyPracticeGoalPreset).toHaveBeenCalledWith('custom');
  });
});
