import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import IntentionInputScreen from '../IntentionInputScreen';
import { distillIntention } from '@/utils/sigil/distillation';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
}));

jest.mock('@/utils/sigil/distillation', () => ({
  distillIntention: jest.fn(),
}));

jest.useFakeTimers();

describe('IntentionInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders core guidance copy', () => {
    const { getByText } = render(<IntentionInputScreen />);

    expect(getByText('What are you anchoring right now?')).toBeTruthy();
    expect(getByText(/Write a short, clear intention/)).toBeTruthy();
    expect(getByText(/One sentence is enough/)).toBeTruthy();
    expect(getByText('You can refine or release this later.')).toBeTruthy();
    expect(getByText('Short. Present. Felt.')).toBeTruthy();
  });

  it('sets a deterministic placeholder from the pool', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const { getByPlaceholderText } = render(<IntentionInputScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText('e.g. Stay focused during training')).toBeTruthy();
    });

    randomSpy.mockRestore();
  });

  it('updates the input value when text changes', async () => {
    const { getByPlaceholderText, getByDisplayValue } = render(<IntentionInputScreen />);

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    fireEvent.changeText(input, 'Be calm');

    expect(getByDisplayValue('Be calm')).toBeTruthy();
  });

  it('does not accept input above the max character limit', async () => {
    const { getByPlaceholderText, queryByDisplayValue, getByDisplayValue } = render(
      <IntentionInputScreen />
    );

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    const maxValue = 'a'.repeat(100);
    const tooLong = 'a'.repeat(101);

    fireEvent.changeText(input, maxValue);
    expect(getByDisplayValue(maxValue)).toBeTruthy();

    fireEvent.changeText(input, tooLong);
    expect(queryByDisplayValue(tooLong)).toBeNull();
    expect(getByDisplayValue(maxValue)).toBeTruthy();
  });

  it('keeps Continue disabled before minimum characters', async () => {
    const { getByPlaceholderText, getByTestId } = render(<IntentionInputScreen />);

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    fireEvent.changeText(input, 'hi');

    const continueButton = getByTestId('continue-button');
    expect(continueButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables Continue after valid input and delay', async () => {
    const { getByPlaceholderText, getByTestId } = render(<IntentionInputScreen />);

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    fireEvent.changeText(input, 'Focus');

    expect(getByTestId('continue-button').props.accessibilityState?.disabled).toBe(true);

    jest.advanceTimersByTime(300);

    expect(getByTestId('continue-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('does not navigate before the 300ms validation delay', async () => {
    const { getByPlaceholderText, getByTestId } = render(<IntentionInputScreen />);

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    fireEvent.changeText(input, 'Steady');

    fireEvent.press(getByTestId('continue-button'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates with distilled letters after valid input', async () => {
    (distillIntention as jest.Mock).mockReturnValue({ finalLetters: ['S', 'T'] });

    const { getByPlaceholderText, getByTestId } = render(<IntentionInputScreen />);

    const input = await waitFor(() => getByPlaceholderText(/e\.g\./));
    fireEvent.changeText(input, 'Steady mind');

    jest.advanceTimersByTime(300);

    fireEvent.press(getByTestId('continue-button'));

    expect(distillIntention).toHaveBeenCalledWith('Steady mind');
    expect(mockNavigate).toHaveBeenCalledWith('DistillationAnimation', {
      intentionText: 'Steady mind',
      category: 'personal_growth',
      distilledLetters: ['S', 'T'],
    });
  });
});
