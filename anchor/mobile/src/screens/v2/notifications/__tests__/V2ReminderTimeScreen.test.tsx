import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const mockAnchor = makeAnchor({ id: 'anchor-1' });
const mockNavigation = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(() => jest.fn()),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'time-1', name: 'V2ReminderTime', params: { anchorId: 'anchor-1' } }),
}));
jest.mock('@/stores/anchorStore', () => {
  const state = { anchors: [] as any[] };
  const useAnchorStore: any = (selector?: (s: any) => any) => (selector ? selector(state) : state);
  return { useAnchorStore, __state: state };
});
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => false }));
const mockHaptic = jest.fn();
jest.mock('@/utils/haptics', () => ({ safeHaptics: { notification: (...a: unknown[]) => mockHaptic(...a), selection: jest.fn(), impact: jest.fn() } }));
const mockRecordOutcome = jest.fn((_o: string) => Promise.resolve());
jest.mock('@/hooks/useNotificationController', () => ({
  recordInvitationOutcomeInStorage: (o: string) => mockRecordOutcome(o),
}));
const mockLeave = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/navigation/v2/invitationHandoff', () => ({
  leaveInvitationFlowToHome: (...args: unknown[]) => mockLeave(...args),
}));
const mockEnrollment = {
  status: 'idle' as string,
  enroll: jest.fn((_t: string) => Promise.resolve()),
  openSystemSettings: jest.fn(),
  reset: jest.fn(),
};
jest.mock('@/hooks/v2/notifications/useReminderEnrollment', () => ({
  useReminderEnrollment: () => mockEnrollment,
}));
jest.mock('../invitationEligibility', () => ({
  loadNotificationStateSnapshot: () => Promise.resolve({ dailyPrimeTime: '21:15' }),
}));
jest.mock('@/utils/reminderTime', () => ({ deviceUses24Hour: () => false }));
jest.mock('@/components/v2/notifications/TimeWheel', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheel: ({ value, onChange, use24h }: any) => (
      <Pressable testID="mock-time-wheel" onPress={() => onChange('07:05')}>
        <Text>{`wheel:${value}:${use24h ? '24' : '12'}`}</Text>
      </Pressable>
    ),
  };
});
const mockTrack = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...a: unknown[]) => mockTrack(...a) },
  AnalyticsEvents: jest.requireActual('@/services/AnalyticsService').AnalyticsEvents,
}));

import { V2ReminderTimeScreen, REMINDER_REQUEST_EXIT_UNLOCK_MS, REMINDER_SUCCESS_AUTO_CONTINUE_MS } from '../V2ReminderTimeScreen';

const anchorState = (jest.requireMock('@/stores/anchorStore') as any).__state;

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  anchorState.anchors = [mockAnchor];
  mockEnrollment.status = 'idle';
});

describe('V2ReminderTimeScreen', () => {
  it('renders the locked copy, three progress segments and the wheel at the stored time', async () => {
    render(<V2ReminderTimeScreen />);
    await flush();
    expect(screen.getByText('YOUR DAILY MOMENT')).toBeTruthy();
    expect(screen.getByText('When would you like to reconnect with your Anchor?')).toBeTruthy();
    expect(screen.getByText('Choose a time that works for you. You can change this anytime.')).toBeTruthy();
    expect(screen.getByText("Every day, even if you've already practiced earlier. Your reminder will still arrive at this time.")).toBeTruthy();
    expect(screen.getByText('Next: Enable notifications')).toBeTruthy();
    expect(screen.getByTestId('reminder-time-progress')).toBeTruthy();
    expect(screen.getByText('wheel:21:15:12')).toBeTruthy();
  });

  it('requests nothing on viewing; the CTA enrolls the chosen time, once per double tap', async () => {
    render(<V2ReminderTimeScreen />);
    await flush();
    expect(mockEnrollment.enroll).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('mock-time-wheel'));
    fireEvent.press(screen.getByTestId('reminder-time-cta'));
    fireEvent.press(screen.getByTestId('reminder-time-cta'));
    expect(mockEnrollment.enroll).toHaveBeenCalledTimes(1);
    expect(mockEnrollment.enroll).toHaveBeenCalledWith('07:05');
  });

  it('back returns to the invitation, once', async () => {
    render(<V2ReminderTimeScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('reminder-time-back'));
    fireEvent.press(screen.getByTestId('reminder-time-back'));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockLeave).not.toHaveBeenCalled();
  });

  it('shows no success while requesting or after a failed enroll; failed offers a retry', async () => {
    mockEnrollment.status = 'requesting';
    const view = render(<V2ReminderTimeScreen />);
    await flush();
    expect(screen.queryByText('Your daily moment is set.')).toBeNull();
    mockEnrollment.status = 'failed';
    view.rerender(<V2ReminderTimeScreen />);
    expect(screen.queryByText('Your daily moment is set.')).toBeNull();
    expect(screen.getByTestId('reminder-time-failed')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(mockRecordOutcome).not.toHaveBeenCalled();
    expect(mockHaptic).not.toHaveBeenCalled();
  });

  it('a rejected enroll never shows success', async () => {
    mockEnrollment.enroll.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    render(<V2ReminderTimeScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('reminder-time-cta'));
    await flush();
    expect(screen.queryByText('Your daily moment is set.')).toBeNull();
  });

  it('denied (and blocked) explain, offer Open Settings and Not now, and never show success', async () => {
    mockEnrollment.status = 'denied';
    const view = render(<V2ReminderTimeScreen />);
    await flush();
    expect(screen.getByTestId('reminder-time-denied')).toBeTruthy();
    expect(screen.queryByText('Your daily moment is set.')).toBeNull();
    fireEvent.press(screen.getByTestId('reminder-time-open-settings'));
    expect(mockEnrollment.openSystemSettings).toHaveBeenCalledTimes(1);
    mockEnrollment.status = 'blocked';
    view.rerender(<V2ReminderTimeScreen />);
    expect(screen.getByText('Open Settings')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reminder-time-denied-not-now'));
    expect(mockRecordOutcome).toHaveBeenCalledWith('dismissed');
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('success appears only on hook success: haptic, records accepted once, auto-continues Home once', async () => {
    jest.useFakeTimers();
    try {
      mockEnrollment.status = 'success';
      const view = render(<V2ReminderTimeScreen />);
      await flush();
      expect(screen.getByText('Your daily moment is set.')).toBeTruthy();
      expect(mockHaptic).toHaveBeenCalledTimes(1);
      expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
      expect(mockRecordOutcome).toHaveBeenCalledWith('accepted');
      view.rerender(<V2ReminderTimeScreen />);
      expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
      expect(mockLeave).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(REMINDER_SUCCESS_AUTO_CONTINUE_MS); });
      expect(mockLeave).toHaveBeenCalledTimes(1);
      // A tap after the auto-continue started does nothing more.
      fireEvent.press(screen.getByTestId('reminder-time-success'));
      expect(mockLeave).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('tapping the success state continues Home immediately', async () => {
    mockEnrollment.status = 'success';
    render(<V2ReminderTimeScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('reminder-time-success'));
    expect(mockLeave).toHaveBeenCalledTimes(1);
    const [, input] = mockLeave.mock.calls[0] as any[];
    expect(input.anchor.id).toBe('anchor-1');
  });

  it('hardware back during enroll is swallowed and navigates nowhere', async () => {
    const handlers: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, handler: () => boolean) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as any);
    mockEnrollment.status = 'requesting';
    render(<V2ReminderTimeScreen />);
    await flush();
    const handler = handlers[handlers.length - 1];
    expect(handler()).toBe(true);
    expect(handler()).toBe(true);
    fireEvent.press(screen.getByTestId('reminder-time-not-now'));
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(mockLeave).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('"Not now" persists dismissed and leaves Home once, without enrolling', async () => {
    render(<V2ReminderTimeScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('reminder-time-not-now'));
    fireEvent.press(screen.getByTestId('reminder-time-not-now'));
    expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
    expect(mockRecordOutcome).toHaveBeenCalledWith('dismissed');
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(mockEnrollment.enroll).not.toHaveBeenCalled();
  });
  it('a request that never settles stops holding the exits after the unlock window, recording nothing', async () => {
    jest.useFakeTimers();
    try {
      mockEnrollment.status = 'requesting';
      const view = render(<V2ReminderTimeScreen />);
      await flush();
      fireEvent.press(screen.getByTestId('reminder-time-not-now'));
      expect(mockLeave).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(REMINDER_REQUEST_EXIT_UNLOCK_MS + 1); });
      view.rerender(<V2ReminderTimeScreen />);
      fireEvent.press(screen.getByTestId('reminder-time-not-now'));
      expect(mockLeave).toHaveBeenCalledTimes(1);
      expect(mockEnrollment.reset).toHaveBeenCalled();
      expect(mockRecordOutcome).not.toHaveBeenCalled();
      // A late success after leaving is never marked accepted.
      mockEnrollment.status = 'success';
      view.rerender(<V2ReminderTimeScreen />);
      expect(mockRecordOutcome).not.toHaveBeenCalled();
      expect(mockLeave).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('back is also released for a hung request', async () => {
    jest.useFakeTimers();
    try {
      mockEnrollment.status = 'requesting';
      render(<V2ReminderTimeScreen />);
      await flush();
      fireEvent.press(screen.getByTestId('reminder-time-back'));
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(REMINDER_REQUEST_EXIT_UNLOCK_MS + 1); });
      fireEvent.press(screen.getByTestId('reminder-time-back'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('the success auto-continue survives a re-render with a new Anchor object', async () => {
    jest.useFakeTimers();
    try {
      mockEnrollment.status = 'success';
      const view = render(<V2ReminderTimeScreen />);
      await flush();
      anchorState.anchors = [{ ...mockAnchor }];
      view.rerender(<V2ReminderTimeScreen />);
      act(() => { jest.advanceTimersByTime(REMINDER_SUCCESS_AUTO_CONTINUE_MS); });
      expect(mockLeave).toHaveBeenCalledTimes(1);
      act(() => { jest.advanceTimersByTime(REMINDER_SUCCESS_AUTO_CONTINUE_MS * 2); });
      expect(mockLeave).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
