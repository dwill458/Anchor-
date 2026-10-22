jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, unknown> = { anchorId: 'anchor-1' };
let mockFocusCallbacks: Array<() => void> = [];
jest.mock('@react-navigation/native', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, canGoBack: () => true }),
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (callback: () => void) => {
      ReactActual.useEffect(() => {
        mockFocusCallbacks.push(callback);
        callback();
      }, [callback]);
    },
  };
});
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => true }));
const mockCommitChart = jest.fn();
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({
  trackChart: jest.fn(),
  useAnchorChart: () => ({ data: { anchor: { intentionText: 'Restore my Buick Regal', category: 'career' }, chart: { id: 'course-1' } }, commitChart: mockCommitChart }),
}));
jest.mock('../chartScreenSupport', () => ({
  useChartContext: () => ({ identity: { intention: 'Restore my Buick Regal', category: 'career', art: null }, anchorArt: null, vision: null }),
}));
const mockApi = { approve: jest.fn(), dismiss: jest.fn(), turn: jest.fn(), getConversation: jest.fn(), uploadPhoto: jest.fn(), getProfile: jest.fn(async () => ({ style: 'DRIVEN', memories: [] })) };
jest.mock('@/services/v2/askChartApi', () => ({ askChartApi: new Proxy({}, { get: (_t, name: string) => (mockApi as Record<string, unknown>)[name] }) }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, get: jest.fn(), post: jest.fn() }, ApiClientError: class extends Error {} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/hooks/v2/vision/speechRecognition', () => ({ speechModule: null, useSpeechEvent: () => undefined }));

const mockAsk = {
  state: { status: 'ready', conversationId: 'c', mode: 'ONGOING', messages: [] as unknown[], draft: null, turn: 'idle', stage: null, error: null, openingFailed: false },
  send: jest.fn(() => true), retry: jest.fn(), cancel: jest.fn(), reload: jest.fn(), markAction: jest.fn(), syncActions: jest.fn(),
  suggestions: [], requestPhoto: null, planInput: null, busy: false,
};
const mockUseAskChart = jest.fn((_options: unknown) => mockAsk);
jest.mock('@/hooks/v2/chart/useAskChart', () => ({ useAskChart: (options: unknown) => mockUseAskChart(options) }));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartRequestError } from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { V2ChartAskScreen } from '../V2ChartAskScreen';

const assistant = (id: string, action: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id, key: id, role: 'ASSISTANT', text: 'Here is what I would add.', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action, actionUnavailable: false, skill: null, status: 'sent', animate: false, ...extra,
});
const moves = (status = 'PENDING') => ({
  type: 'ADD_MOVES', status, summary: 'Split the paint stripping into three', waypointId: 'w2', waypointTitle: 'Prepare the exterior',
  moves: [{ title: 'Gather materials', rationale: 'Have everything before you start' }, { title: 'Strip one half', rationale: null }],
  reason: null, detail: null, routeProposalId: null, routeTitles: null, baseCourseVersion: 3,
});
const revise = (status = 'PENDING') => ({
  type: 'REVISE_ROUTE', status, summary: 'Fewer waypoints', waypointId: null, waypointTitle: null, moves: [], reason: 'TOO_MANY_STEPS', detail: null,
  routeProposalId: 'prop-1', routeTitles: ['Strip', 'Paint', 'Wheels'], baseCourseVersion: 3,
});
const withMessages = (...messages: unknown[]) => { mockAsk.state = { ...mockAsk.state, messages }; };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { anchorId: 'anchor-1' };
  mockFocusCallbacks = [];
  mockAsk.state = { ...mockAsk.state, status: 'ready', messages: [] };
  mockApi.approve.mockResolvedValue({ chart: { id: 'course-1', version: 4 }, added: 2 });
  mockApi.dismiss.mockResolvedValue({ dismissed: true });
});

describe('V2ChartAskScreen', () => {
  it('opens the conversation for the Anchor, greets by default and goes back', () => {
    const screen = render(<V2ChartAskScreen />);
    expect(screen.getByTestId('v2-chart-ask')).toBeTruthy();
    expect(screen.getByText('Restore my Buick Regal')).toBeTruthy();
    expect(mockUseAskChart).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'anchor-1', greet: true }));
    expect(mockAsk.send).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('ask-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(trackChart).toHaveBeenCalledWith('ask_chart_opened', expect.objectContaining({ seeded: false }));
  });

  it('sends the composer text and clears it only once it is accepted', () => {
    const screen = render(<V2ChartAskScreen />);
    fireEvent.changeText(screen.getByTestId('ask-input'), 'How do I start?');
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(mockAsk.send).toHaveBeenCalledWith('How do I start?', { attachments: [], previewUris: [] });
    expect(screen.getByTestId('ask-input').props.value).toBe('');
  });

  it('keeps the text when the send was refused', () => {
    mockAsk.send.mockReturnValueOnce(false as never);
    const screen = render(<V2ChartAskScreen />);
    fireEvent.changeText(screen.getByTestId('ask-input'), 'draft');
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(screen.getByTestId('ask-input').props.value).toBe('draft');
  });

  it('a seeded conversation skips the greeting and sends its first message exactly once, into an empty conversation', () => {
    mockParams = { anchorId: 'anchor-1', prompt: { text: 'Break this move down', skill: 'BREAK_DOWN', targetMoveId: 'move-1' } };
    const screen = render(<V2ChartAskScreen />);
    expect(mockUseAskChart).toHaveBeenCalledWith(expect.objectContaining({ greet: false }));
    expect(mockAsk.send).toHaveBeenCalledTimes(1);
    expect(mockAsk.send).toHaveBeenCalledWith('Break this move down', { skill: 'BREAK_DOWN', targetMoveId: 'move-1' });
    screen.rerender(<V2ChartAskScreen />);
    expect(mockAsk.send).toHaveBeenCalledTimes(1);
  });

  it('does not seed into a conversation that already has messages', () => {
    mockParams = { anchorId: 'anchor-1', prompt: { text: 'Break this move down', skill: 'BREAK_DOWN' } };
    withMessages({ id: 'old' });
    render(<V2ChartAskScreen />);
    expect(mockAsk.send).not.toHaveBeenCalled();
  });

  it('re-reads proposal statuses when the screen is focused again, but not on the first focus', () => {
    render(<V2ChartAskScreen />);
    expect(mockAsk.syncActions).not.toHaveBeenCalled();
    act(() => mockFocusCallbacks[mockFocusCallbacks.length - 1]());
    expect(mockAsk.syncActions).toHaveBeenCalledTimes(1);
  });
});

describe('V2ChartAskScreen — proposals', () => {
  it('shows suggested moves as a card, with the reason for each, and changes nothing until approved', () => {
    withMessages(assistant('msg-1', moves()));
    const screen = render(<V2ChartAskScreen />);
    expect(screen.getByTestId('ask-proposal')).toBeTruthy();
    expect(screen.getByText('Split the paint stripping into three')).toBeTruthy();
    expect(screen.getByText('For “Prepare the exterior”')).toBeTruthy();
    expect(screen.getByText('Gather materials')).toBeTruthy();
    expect(screen.getByText('Have everything before you start')).toBeTruthy();
    expect(mockApi.approve).not.toHaveBeenCalled();
    expect(mockCommitChart).not.toHaveBeenCalled();
  });

  it('approving saves on the server, publishes the saved Chart, marks it applied, and only then opens Route Updated', async () => {
    withMessages(assistant('msg-1', moves()));
    const screen = render(<V2ChartAskScreen />);
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockApi.approve).toHaveBeenCalledWith('course-1', 'msg-1');
    expect(mockCommitChart).toHaveBeenCalledWith({ id: 'course-1', version: 4 });
    expect(mockAsk.markAction).toHaveBeenCalledWith('msg-1', 'APPLIED');
    expect(mockNavigate).toHaveBeenCalledWith('V2ChartRouteUpdated', { anchorId: 'anchor-1', change: { kind: 'MOVES_ADDED', count: 2, waypointTitle: 'Prepare the exterior' }, source: 'ask' });
    // Saved first, confirmed second.
    expect(mockApi.approve.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  it('shows no success and opens nothing when the save fails, and the person can try again', async () => {
    mockApi.approve.mockRejectedValueOnce(new ChartRequestError('unavailable', 'X'));
    withMessages(assistant('msg-1', moves()));
    const screen = render(<V2ChartAskScreen />);
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    expect(await screen.findByTestId('ask-proposal-error')).toBeTruthy();
    expect(screen.getByText(/nothing changed/i)).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockAsk.markAction).not.toHaveBeenCalled();
    expect(mockCommitChart).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  });

  it('says so, and offers no approval, when the waypoint is already behind the person', async () => {
    mockApi.approve.mockRejectedValueOnce(new ChartRequestError('conflict', 'PROPOSAL_STALE'));
    withMessages(assistant('msg-1', moves()));
    const screen = render(<V2ChartAskScreen />);
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    expect(await screen.findByText(/already behind you/)).toBeTruthy();
    expect(screen.queryByTestId('ask-proposal-approve')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('“Not now” dismisses on the server and marks it dismissed, without opening anything', async () => {
    withMessages(assistant('msg-1', moves()));
    const screen = render(<V2ChartAskScreen />);
    fireEvent.press(screen.getByTestId('ask-proposal-dismiss'));
    await waitFor(() => expect(mockAsk.markAction).toHaveBeenCalledWith('msg-1', 'DISMISSED'));
    expect(mockApi.dismiss).toHaveBeenCalledWith('course-1', 'msg-1');
    expect(mockApi.approve).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an applied proposal as a quiet line and a dismissed one as such, with no buttons', () => {
    withMessages(assistant('a', moves('APPLIED')), assistant('b', revise('APPLIED')), assistant('c', moves('DISMISSED')));
    const screen = render(<V2ChartAskScreen />);
    expect(screen.getAllByTestId('ask-proposal-applied')).toHaveLength(2);
    expect(screen.getByText('Added to your Chart')).toBeTruthy();
    expect(screen.getByText('Route updated')).toBeTruthy();
    expect(screen.getByTestId('ask-proposal-dismissed')).toBeTruthy();
    expect(screen.queryByTestId('ask-proposal-approve')).toBeNull();
  });

  it('a route revision opens the existing route review on that proposal; nothing is applied here', () => {
    withMessages(assistant('msg-9', revise()));
    const screen = render(<V2ChartAskScreen />);
    expect(screen.getByText('SUGGESTED ROUTE CHANGE')).toBeTruthy();
    expect(screen.getByText('Wheels')).toBeTruthy();
    expect(screen.getByText('You’ll review every step before anything changes.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-proposal-approve'));
    expect(mockNavigate).toHaveBeenCalledWith('V2ChartAdjust', { anchorId: 'anchor-1', proposalId: 'prop-1', askMessageId: 'msg-9' });
    expect(mockApi.approve).not.toHaveBeenCalled();
  });

  it('says honestly when a promised change could not be prepared', () => {
    withMessages(assistant('msg-1', null, { actionUnavailable: true }));
    const screen = render(<V2ChartAskScreen />);
    expect(screen.getByTestId('ask-action-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('ask-proposal')).toBeNull();
  });
});
