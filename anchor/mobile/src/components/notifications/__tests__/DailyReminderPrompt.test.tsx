import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DailyReminderPrompt } from '../DailyReminderPrompt';

const mockMarkReminderPromptShown = jest.fn(() => Promise.resolve());
const mockCompleteReminderPrompt = jest.fn(() => Promise.resolve());
const mockSetDailyPrimeReminder = jest.fn(
  (): Promise<'granted' | 'denied'> => Promise.resolve('granted')
);

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    markReminderPromptShown: mockMarkReminderPromptShown,
    completeReminderPrompt: mockCompleteReminderPrompt,
    setDailyPrimeReminder: mockSetDailyPrimeReminder,
  }),
}));

const mockTrack = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: new Proxy({}, { get: (_t, prop) => String(prop) }),
  AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));

describe('DailyReminderPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetDailyPrimeReminder.mockResolvedValue('granted');
  });

  it('records that the prompt was shown when it becomes visible', async () => {
    render(<DailyReminderPrompt visible variant="first_anchor" onDismiss={jest.fn()} />);
    await waitFor(() => expect(mockMarkReminderPromptShown).toHaveBeenCalledWith('first_anchor'));
  });

  it('schedules the first-anchor reminder with the 8 AM smart default', async () => {
    const onDismiss = jest.fn();
    const { getByText, queryByText } = render(
      <DailyReminderPrompt visible variant="first_anchor" onDismiss={onDismiss} />
    );

    expect(getByText('Keep This Anchor Alive')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Set 8:00 AM Reminder'));
    });

    expect(mockSetDailyPrimeReminder).toHaveBeenCalledWith('08:00', 'first_anchor');
    await waitFor(() => expect(getByText('Reminder set')).toBeTruthy());
    expect(queryByText('Keep This Anchor Alive')).toBeNull();

    await act(async () => {
      fireEvent.press(getByText('Done'));
    });
    expect(mockCompleteReminderPrompt).toHaveBeenCalledWith('first_anchor');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('lets a first-anchor user choose another time before scheduling', async () => {
    const { getByText } = render(
      <DailyReminderPrompt visible variant="first_anchor" onDismiss={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Choose a different time'));
    });
    expect(getByText('Morning')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Afternoon'));
    });

    expect(mockSetDailyPrimeReminder).toHaveBeenCalledWith('15:00', 'first_anchor');
  });

  it('dismisses without scheduling when the user taps Not Now', async () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <DailyReminderPrompt visible variant="first_anchor" onDismiss={onDismiss} />
    );

    await act(async () => {
      fireEvent.press(getByText('Not Now'));
    });

    expect(mockSetDailyPrimeReminder).not.toHaveBeenCalled();
    expect(mockCompleteReminderPrompt).toHaveBeenCalledWith('first_anchor');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('schedules straight away with a morning default in the fallback variant', async () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <DailyReminderPrompt visible variant="fallback" onDismiss={onDismiss} />
    );

    expect(getByText('Make This a Rhythm')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Remind Me Tomorrow'));
    });

    expect(mockSetDailyPrimeReminder).toHaveBeenCalledWith('08:00', 'fallback');
    await waitFor(() => expect(getByText('Reminder set')).toBeTruthy());
  });

  it('closes on denied permission without showing success', async () => {
    mockSetDailyPrimeReminder.mockResolvedValue('denied');
    const onDismiss = jest.fn();
    const { getByText, queryByText } = render(
      <DailyReminderPrompt visible variant="fallback" onDismiss={onDismiss} />
    );

    await act(async () => {
      fireEvent.press(getByText('Remind Me Tomorrow'));
    });

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(queryByText('Reminder set')).toBeNull();
    expect(mockCompleteReminderPrompt).toHaveBeenCalledWith('fallback');
  });
});
