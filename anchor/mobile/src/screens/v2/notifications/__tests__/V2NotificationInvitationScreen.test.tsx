import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const UNIQUE_SVG = '<svg viewBox="0 0 10 10"><path d="M2 3L7 8" data-mark="user-anchor-1"/></svg>';
const mockAnchor = makeAnchor({ id: 'anchor-1', category: 'career', baseSigilSvg: UNIQUE_SVG });

const mockNavigation = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(() => jest.fn()),
};
let mockRoute: any = { key: 'inv-1', name: 'V2NotificationInvitation', params: { anchorId: 'anchor-1', anchorTransition: false } };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('@/stores/anchorStore', () => {
  const state = { anchors: [] as any[] };
  const useAnchorStore: any = (selector?: (s: any) => any) => (selector ? selector(state) : state);
  useAnchorStore.getState = () => state;
  return { useAnchorStore, __state: state };
});
const mockReduced = { current: false };
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => mockReduced.current }));
const mockRecordOutcome = jest.fn((_o: string) => Promise.resolve());
jest.mock('@/hooks/useNotificationController', () => ({
  recordInvitationOutcomeInStorage: (o: string) => mockRecordOutcome(o),
  useNotificationController: () => { throw new Error('the invitation must not mount the controller'); },
}));
const mockLeave = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('@/navigation/v2/invitationHandoff', () => ({
  leaveInvitationFlowToHome: (...args: unknown[]) => mockLeave(...args),
}));
const mockEnroll = jest.fn();
jest.mock('@/hooks/v2/notifications/useReminderEnrollment', () => ({
  useReminderEnrollment: () => ({ status: 'idle', enroll: mockEnroll, openSystemSettings: jest.fn(), reset: jest.fn() }),
}));
const mockRequestPermissions = jest.fn();
jest.mock('@/services/NotificationService', () => ({
  __esModule: true,
  default: { requestPermissions: (...a: unknown[]) => mockRequestPermissions(...a), getPermissionStatus: jest.fn() },
}));
const mockTrack = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...a: unknown[]) => mockTrack(...a) },
  AnalyticsEvents: jest.requireActual('@/services/AnalyticsService').AnalyticsEvents,
}));

import { AnalyticsEvents } from '@/services/AnalyticsService';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import { INVITATION_COPY } from '../invitationCopy';
import { V2NotificationInvitationScreen, invitationFooterReadyMs, resetInvitationScreenForTests } from '../V2NotificationInvitationScreen';

const anchorState = (jest.requireMock('@/stores/anchorStore') as any).__state;

/** Lets the footer finish appearing (it takes no touches before that). */
const openFooter = () => act(() => { jest.advanceTimersByTime(invitationFooterReadyMs(true, false) + 1); });

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetInvitationScreenForTests();
  useReminderInvitationStore.getState().reset();
  anchorState.anchors = [mockAnchor];
  mockReduced.current = false;
  mockRoute = { key: 'inv-1', name: 'V2NotificationInvitation', params: { anchorId: 'anchor-1', anchorTransition: false } };
});

describe('V2NotificationInvitationScreen', () => {
  it('renders the locked copy', () => {
    render(<V2NotificationInvitationScreen />);
    expect(screen.getByText('Make time for what matters.')).toBeTruthy();
    expect(screen.getByText('A little time each day can help you stay connected to your goals and keep your momentum going.')).toBeTruthy();
    expect(screen.getByText('Return to your practice.')).toBeTruthy();
    expect(screen.getByText('Stay connected to your progress.')).toBeTruthy();
    expect(screen.getByText('Feel more focused and grounded.')).toBeTruthy();
    expect(screen.getByText('Build consistency, even on busy days.')).toBeTruthy();
    expect(screen.getByText('Keep your goals top of mind.')).toBeTruthy();
    expect(screen.getByText('A daily reminder is a gentle nudge, not a pressure.')).toBeTruthy();
    expect(screen.getByText('Choose my reminder time')).toBeTruthy();
    expect(screen.getByText('Maybe later')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
    expect(screen.getByText('ANCHOR')).toBeTruthy();
  });

  it("renders the user's own Anchor artwork, not a placeholder", () => {
    const view = render(<V2NotificationInvitationScreen />);
    expect(screen.getByTestId('notification-invitation-anchor')).toBeTruthy();
    const xmls = view.UNSAFE_queryAllByType('SvgXml' as any).map((node: any) => node.props.xml);
    expect(xmls.some((xml: string) => xml.includes('data-mark="user-anchor-1"'))).toBe(true);
    expect(screen.queryByText('Artwork unavailable')).toBeNull();
  });

  it('renders no stand-in art when the Anchor cannot be found', () => {
    anchorState.anchors = [];
    render(<V2NotificationInvitationScreen />);
    expect(screen.queryByTestId('notification-invitation-anchor')).toBeNull();
  });

  it('emits shown exactly once per route instance, with no private content', () => {
    const first = render(<V2NotificationInvitationScreen />);
    first.rerender(<V2NotificationInvitationScreen />);
    first.unmount();
    render(<V2NotificationInvitationScreen />);
    const shown = mockTrack.mock.calls.filter(([event]) => event === AnalyticsEvents.NOTIFICATION_INVITATION_SHOWN);
    expect(shown).toHaveLength(1);
    expect(JSON.stringify(shown[0][1])).not.toContain(mockAnchor.intentionText);
  });

  it('CTA tapped twice quickly navigates once, to the reminder time screen', () => {
    render(<V2NotificationInvitationScreen />);
    openFooter();
    const cta = screen.getByTestId('notification-invitation-cta');
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('V2ReminderTime', { anchorId: 'anchor-1' });
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvents.NOTIFICATION_INVITATION_ACCEPTED, expect.any(Object));
  });

  it('re-arms the CTA when the screen regains focus (back from the time screen)', () => {
    render(<V2NotificationInvitationScreen />);
    const focusListener = (mockNavigation.addListener.mock.calls as any[]).find(([name]) => name === 'focus')?.[1];
    openFooter();
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    act(() => focusListener());
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(2);
  });

  it('"Maybe later" persists dismissed, leaves for Home once, and never asks for permission', () => {
    render(<V2NotificationInvitationScreen />);
    openFooter();
    fireEvent.press(screen.getByTestId('notification-invitation-maybe-later'));
    fireEvent.press(screen.getByTestId('notification-invitation-maybe-later'));
    fireEvent.press(screen.getByTestId('notification-invitation-not-now'));
    expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
    expect(mockRecordOutcome).toHaveBeenCalledWith('dismissed');
    expect(mockLeave).toHaveBeenCalledTimes(1);
    const [, input, options] = mockLeave.mock.calls[0] as any[];
    expect(input.anchor.id).toBe('anchor-1');
    expect(typeof input.measure).toBe('function');
    expect(options).toEqual({ reduceMotion: false });
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvents.NOTIFICATION_INVITATION_DISMISSED, { action: 'maybe_later' });
    expect(mockEnroll).not.toHaveBeenCalled();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    // Leaving blocks the CTA too.
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('hands the staged session id to the way out', () => {
    useReminderInvitationStore.getState().stage({ anchorId: 'anchor-1', sessionId: 'session-7', fromRect: null });
    render(<V2NotificationInvitationScreen />);
    fireEvent.press(screen.getByTestId('notification-invitation-not-now'));
    expect((mockLeave.mock.calls[0] as any[])[1].sessionId).toBe('session-7');
  });

  it('hardware back during a leave cannot navigate twice', () => {
    const handlers: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, handler: () => boolean) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as any);
    render(<V2NotificationInvitationScreen />);
    const handler = handlers[handlers.length - 1];
    openFooter();
    expect(handler()).toBe(true);
    expect(handler()).toBe(true);
    fireEvent.press(screen.getByTestId('notification-invitation-maybe-later'));
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('takes the staged fromRect for its flight only when arriving with the Anchor', () => {
    useReminderInvitationStore.getState().stage({ anchorId: 'anchor-1', sessionId: 's', fromRect: { x: 1, y: 2, width: 3, height: 3 } });
    mockRoute = { ...mockRoute, params: { anchorId: 'anchor-1', anchorTransition: true } };
    render(<V2NotificationInvitationScreen />);
    fireEvent(screen.getByTestId('notification-invitation-anchor').parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 160, height: 160 } } });
    expect(useReminderInvitationStore.getState().staged?.fromRect).toBeNull();
  });

  it('under Reduce Motion never takes the flight (crossfade only)', () => {
    mockReduced.current = true;
    useReminderInvitationStore.getState().stage({ anchorId: 'anchor-1', sessionId: 's', fromRect: { x: 1, y: 2, width: 3, height: 3 } });
    mockRoute = { ...mockRoute, params: { anchorId: 'anchor-1', anchorTransition: true } };
    render(<V2NotificationInvitationScreen />);
    fireEvent(screen.getByTestId('notification-invitation-anchor').parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 160, height: 160 } } });
    expect(useReminderInvitationStore.getState().staged?.fromRect).not.toBeNull();
  });

  it('the footer takes no touches until it has appeared (timer fallback, no animation callback)', () => {
    render(<V2NotificationInvitationScreen />);
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    fireEvent.press(screen.getByTestId('notification-invitation-maybe-later'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(mockLeave).not.toHaveBeenCalled();
    openFooter();
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('after the CTA, Maybe later / Not now / back cannot also navigate', () => {
    const handlers: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, handler: () => boolean) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as any);
    render(<V2NotificationInvitationScreen />);
    openFooter();
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    fireEvent.press(screen.getByTestId('notification-invitation-maybe-later'));
    fireEvent.press(screen.getByTestId('notification-invitation-not-now'));
    handlers[handlers.length - 1]();
    expect(mockLeave).not.toHaveBeenCalled();
    expect(mockRecordOutcome).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('after Not now, the CTA cannot also navigate', () => {
    render(<V2NotificationInvitationScreen />);
    openFooter();
    fireEvent.press(screen.getByTestId('notification-invitation-not-now'));
    fireEvent.press(screen.getByTestId('notification-invitation-cta'));
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('Reduce Motion opens the footer within the reduced crossfade', () => {
    expect(invitationFooterReadyMs(true, true)).toBeLessThanOrEqual(150);
  });

  it('keeps copy constants in one place', () => {
    expect(INVITATION_COPY.headline).toBe('Make time for what matters.');
  });
});
