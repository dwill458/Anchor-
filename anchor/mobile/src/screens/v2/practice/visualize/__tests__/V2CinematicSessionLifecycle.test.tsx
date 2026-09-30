import React from 'react';
import { Alert, AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2CinematicSessionScreen } from '../V2CinematicSessionScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const mockEngine: any = {};
const mockEngineHook = jest.fn();
const mockUseCinematicAssets = jest.fn();
const mockCompletion = jest.fn((..._args: unknown[]) => Promise.resolve({}));
const mockFinishCompletion = jest.fn(() => Promise.resolve());
const mockFadeOut = jest.fn(() => Promise.resolve());
const mockSvgWidth = { current: 10 };
const mockSvgHeight = { current: 10 };
let mockPendingMarkLayout: (() => void) | null = null;
let mockAppState = 'active';
let mockAppStateListener: ((state: string) => void) | null = null;
let appStateDescriptor: PropertyDescriptor | undefined;
let appStateSpy: jest.SpyInstance;
const mockOnMarkLayout = jest.fn((props: any) => props.cinematic?.onMarkLayout?.({ x: 10, y: 10, width: 40, height: 60 }));

jest.mock('../cinematicAssets', () => ({
  freezeCinematicTiles: (tiles: unknown[]) => tiles,
  useCinematicAssets: (...args: unknown[]) => mockUseCinematicAssets(...args),
}));
jest.mock('@/screens/visualize/useVisualizeSessionEngine', () => ({
  useVisualizeSessionEngine: (...args: unknown[]) => mockEngineHook(...args),
}));
jest.mock('@/screens/visualize/useVisualizeSessionAudio', () => ({
  useVisualizeSessionAudio: () => ({ fadeOutAndStop: mockFadeOut, finishCompletion: mockFinishCompletion }),
}));
jest.mock('@/screens/visualize/useVisualizeImmersiveMode', () => ({ useVisualizeImmersiveMode: jest.fn() }));
jest.mock('@/services/SessionAudioManifest', () => ({ resolveSessionAudioPlan: jest.fn(() => ({})) }));
jest.mock('@/services/visualizeAudioManifest', () => ({ getVisualizeSessionAudioManifest: jest.fn(() => ({ cues: [] })) }));
jest.mock('@/services/SessionAudioAnalytics', () => ({ trackSessionStartedWithAudio: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'), useV2ReduceMotion: () => false, v2Haptics: { selection: jest.fn() },
}));
jest.mock('@/services/PracticeCompletionService', () => ({
  PracticeCompletionService: { commitVisualizeCompletion: (...args: unknown[]) => mockCompletion(...args) },
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { PRACTICE_SESSION_STARTED: 'started', PRACTICE_SESSION_COMPLETED: 'completed' },
  AnalyticsService: { track: jest.fn() },
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: { SVG: { MakeFromString: () => ({ width: () => mockSvgWidth.current, height: () => mockSvgHeight.current }) } },
  useImage: () => ({}),
}));
jest.mock('@/components/v2/anchors/anchorPresentation', () => ({
  anchorArtworkSvg: () => '<svg viewBox="0 0 100 100"><path d="M0 0"/></svg>',
}));
jest.mock('@/components/v2/vision/board/useVisionBoardScene', () => ({
  useVisionBoardScene: () => ({ roster: [], entering: {}, layout: { card: { x: 0, y: 0, width: 100, height: 100 },
    photos: [{ x: 0, y: 0, width: 40, height: 40, frame: 'landscape' }] }, shared: {}, initialRectFor: () => null }),
}));
jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({
  VisionBoardScene: (props: any) => {
    const React = require('react'); const { View } = require('react-native');
    mockPendingMarkLayout = () => mockOnMarkLayout(props);
    return React.createElement(View, { testID: 'measure-mark' });
  },
}));
jest.mock('@/components/v2/vision/board/visionBoardLayouts', () => ({
  boardAttachmentFor: () => 'pin', boardSizeForWidth: () => ({ width: 100, height: 100 }),
  toSceneRect: () => ({ x: 0, y: 0, width: 100, height: 100, rotation: 0 }),
}));
jest.mock('../cinematicSessionMotion', () => ({ cinematicSessionGeometry: () => ({}) }));
jest.mock('../CinematicSessionStage', () => ({
  CinematicSessionStage: ({ elapsed }: any) => {
    const React = require('react'); const { View, Text } = require('react-native');
    return React.createElement(View, { testID: 'cinematic-stage' }, React.createElement(Text, null, String(elapsed.value)));
  },
}));
jest.mock('../prototype/cinematicGeometry', () => ({
  photoWindow: () => ({ x: 0, y: 0, width: 20, height: 20 }), rotatedChild: () => ({ x: 0, y: 0, width: 20, height: 20 }),
}));

const anchor = makeAnchor({ id: 'anchor-1', userId: 'user-1', intentionText: 'A real intention' });
const tiles = [{ id: 'image-1', sceneId: 'image-1', imageUrl: 'https://cdn.example.com/image.jpg',
  prompt: null, sortOrder: 0, isHero: true }];

function resetEngine(state = 'running') {
  Object.assign(mockEngine, {
    state, elapsedMs: 0, remainingSeconds: 60, completionPromise: Promise.resolve(),
    start: jest.fn(), pause: jest.fn(), resume: jest.fn(), endEarly: jest.fn(), markCompleted: jest.fn(),
  });
  mockEngineHook.mockImplementation(() => mockEngine);
}

function renderReadySession() {
  const onExit = jest.fn(); const onContinue = jest.fn();
  mockUseCinematicAssets.mockReturnValue({ resources: null, ready: true, partial: false, unavailable: false,
    available: tiles, select: () => ({ tiles, images: [{}] }), retry: jest.fn(), timedOut: false, failedCount: 0 });
  const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
    statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={false}
    source="practice_hub" onExit={onExit} onContinue={onContinue} />);
  return { ...view, onExit, onContinue };
}

function measureMark() {
  act(() => { mockPendingMarkLayout?.(); });
}

function changeAppState(state: string) {
  mockAppState = state;
  act(() => { mockAppStateListener?.(state); });
}

describe('V2 cinematic session readiness and lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnMarkLayout.mockClear();
    mockPendingMarkLayout = null;
    mockSvgWidth.current = 10;
    mockSvgHeight.current = 10;
    mockAppState = 'active';
    mockAppStateListener = null;
    appStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => mockAppState });
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: 'change', listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: jest.fn() } as never;
    }) as never);
    resetEngine();
    mockUseCinematicAssets.mockReturnValue({ resources: null, ready: false, partial: false, unavailable: false,
      available: [], select: jest.fn(), retry: jest.fn(), timedOut: false, failedCount: 0 });
  });

  afterEach(() => {
    appStateSpy.mockRestore();
    if (appStateDescriptor) Object.defineProperty(AppState, 'currentState', appStateDescriptor);
    else delete (AppState as any).currentState;
  });

  it('waits for measured Anchor geometry and decoded board assets before starting the engine', async () => {
    const view = renderReadySession();
    expect(mockEngine.start).not.toHaveBeenCalled();
    expect(view.getByTestId('measure-mark')).toBeTruthy();
    measureMark();
    expect(mockOnMarkLayout).toHaveBeenCalled();
    expect(view.queryByTestId('cinematic-stage')).toBeTruthy();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('cinematic-stage')).toBeTruthy();
  });

  it('accepts the saved viewBox-only Anchor SVG when Skia reports no intrinsic dimensions', () => {
    mockSvgWidth.current = 0;
    mockSvgHeight.current = 0;
    const view = renderReadySession();
    expect(view.queryByText('The actual Anchor artwork is unavailable.')).toBeNull();
    measureMark();
    expect(view.getByTestId('cinematic-stage')).toBeTruthy();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
  });

  it('does not start when assets and mark finish in background; starts after the app becomes active', () => {
    mockAppState = 'background';
    const view = renderReadySession();
    measureMark();
    expect(view.getByTestId('cinematic-stage')).toBeTruthy();
    expect(mockEngine.start).not.toHaveBeenCalled();
    changeAppState('active');
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
  });

  it('keeps delayed readiness from starting behind an open exit confirmation', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = renderReadySession();
    mockEngine.state = 'idle';
    fireEvent.press(view.getByLabelText('End Visualize'));
    measureMark();
    expect(mockEngine.start).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    act(() => { buttons.find(button => button.text === 'Keep going')?.onPress?.(); });
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    expect(mockEngine.resume).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('does not resume from Keep going or dismiss while the app is backgrounded', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = renderReadySession();
    measureMark();
    fireEvent.press(view.getByLabelText('End Visualize'));
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const options = alert.mock.calls[0][3] as { onDismiss?: () => void };
    changeAppState('background');
    const callsBeforeDismiss = mockEngine.resume.mock.calls.length;
    act(() => { buttons.find(button => button.text === 'Keep going')?.onPress?.(); options.onDismiss?.(); });
    expect(mockEngine.resume).toHaveBeenCalledTimes(callsBeforeDismiss);
    alert.mockRestore();
  });

  it('pauses and resumes the visual session clock through the engine controls', () => {
    const view = renderReadySession();
    measureMark();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText('Pause Visualize'));
    expect(mockEngine.pause).toHaveBeenCalledWith('user');
    mockEngine.state = 'paused';
    view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);
    fireEvent.press(view.getByLabelText('Resume Visualize'));
    expect(mockEngine.resume).toHaveBeenCalledTimes(1);
  });

  it('cancels an exit prompt safely, then exits only after the destructive choice', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = renderReadySession();
    measureMark();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText('End Visualize'));
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    act(() => { buttons.find(button => button.text === 'Keep going')?.onPress?.(); });
    expect(mockEngine.resume).toHaveBeenCalledTimes(1);
    expect(view.onExit).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('End Visualize'));
    const nextButtons = alert.mock.calls[1][2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { nextButtons.find(button => button.text === 'End session')?.onPress?.(); });
    expect(mockEngine.endEarly).toHaveBeenCalledTimes(1);
    expect(mockFadeOut).toHaveBeenCalledTimes(1);
    expect(view.onExit).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('records one completion and offers Done once after the engine reaches completion', async () => {
    const view = renderReadySession();
    measureMark();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    const complete = mockEngineHook.mock.calls[0][0].onComplete;
    await act(async () => {
      await complete({ startedAt: '2026-09-29T10:00:00.000Z', completedAt: '2026-09-29T10:01:00.000Z' });
      await complete({ startedAt: '2026-09-29T10:00:00.000Z', completedAt: '2026-09-29T10:01:00.000Z' });
    });
    expect(mockCompletion).toHaveBeenCalledTimes(1);
    mockEngine.state = 'completing';
    mockEngine.remainingSeconds = 0;
    mockEngine.elapsedMs = 60_000;
    view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.press(view.getByLabelText('Done'));
    fireEvent.press(view.getByLabelText('Done'));
    expect(mockEngine.markCompleted).toHaveBeenCalledTimes(1);
    expect(view.onContinue).toHaveBeenCalledTimes(1);
  });
});
