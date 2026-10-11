import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { COMPLETION_SETTLE_MAX_MS, V2CinematicSessionScreen } from '../V2CinematicSessionScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { buildGuidedPlan } from '../guided/visualizeGuidedPlan';
import { v2Haptics } from '@/hooks/v2';

const mockEngine: any = {};
const mockEngineHook = jest.fn();
const mockUseCinematicAssets = jest.fn();
const mockCompletion = jest.fn((..._args: unknown[]) => Promise.resolve({}));
const mockSvgWidth = { current: 10 };
const mockSvgHeight = { current: 10 };
let mockPendingMarkLayout: (() => void) | null = null;
let mockAppState = 'active';
let mockAppStateListener: ((state: string) => void) | null = null;
let appStateDescriptor: PropertyDescriptor | undefined;
let appStateSpy: jest.SpyInstance;
const mockOnMarkLayout = jest.fn((props: any) => props.cinematic?.onMarkLayout?.({ x: 10, y: 10, width: 40, height: 60 }));
const mockUseBoardScene = jest.fn();
let mockCinematicStageProps: any;

jest.mock('../cinematicAssets', () => ({
  freezeCinematicTiles: (tiles: unknown[]) => tiles,
  useCinematicAssets: (...args: unknown[]) => mockUseCinematicAssets(...args),
}));
jest.mock('@/screens/visualize/useVisualizeSessionEngine', () => ({ getVisualizeMonotonicNow: () => 0 }));
jest.mock('../guided/useGuidedPlayback', () => ({ useGuidedPlayback: (...args: unknown[]) => mockEngineHook(...args) }));
jest.mock('@/services/visualizeGuidedTracks', () => ({ getGuidedTrackAsset: () => 1 }));
jest.mock('@/screens/visualize/useVisualizeImmersiveMode', () => ({ useVisualizeImmersiveMode: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'), useV2ReduceMotion: () => false, v2Haptics: { selection: jest.fn(), confirmation: jest.fn() },
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
  useVisionBoardScene: (...args: unknown[]) => { mockUseBoardScene(...args); return { roster: [], entering: {}, layout: { card: { x: 0, y: 0, width: 100, height: 100 },
    photos: [{ x: 0, y: 0, width: 40, height: 40, frame: 'landscape' }] }, shared: {}, initialRectFor: () => null }; },
}));
jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({
  VisionBoardScene: (props: any) => {
    const React = require('react'); const { View } = require('react-native');
    mockPendingMarkLayout = () => mockOnMarkLayout(props);
    return React.createElement(View, { testID: 'measure-mark' });
  },
}));
jest.mock('@/components/v2/vision/board/visionBoardLayouts', () => ({
  boardAttachmentFor: () => 'pin', boardSizeForWidth: (width: number) => ({ width, height: width / 1.56 }),
  detailBoardSizeForWidth: () => ({ width: 100, height: 100 }),
  selectBoardLayout: () => ({ card: { x: 0.5, y: 0.47, width: 0.24, aspectRatio: 1, rotation: 0, zIndex: 40 } }),
  toSceneRect: () => ({ x: 0, y: 0, width: 100, height: 100, rotation: 0 }),
}));
jest.mock('../cinematicSessionMotion', () => ({ cinematicSessionGeometry: () => ({}) }));
jest.mock('../CinematicSessionStage', () => ({
  CinematicSessionStage: (props: any) => {
    mockCinematicStageProps = props;
    const React = require('react'); const { View, Text } = require('react-native');
    return React.createElement(View, { testID: 'cinematic-stage' }, React.createElement(Text, null, String(props.elapsed.value)));
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
    state, positionMs: 0, remainingSeconds: 65, completionPromise: Promise.resolve(),
    start: jest.fn(), pause: jest.fn(), resume: jest.fn(), endEarly: jest.fn(() => Promise.resolve()), stopAudio: jest.fn(() => Promise.resolve()),
    markCompleted: jest.fn(),
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

function renderSessionWithHaptics() {
  const onExit = jest.fn(); const onContinue = jest.fn();
  mockUseCinematicAssets.mockReturnValue({ resources: null, ready: true, partial: false, unavailable: false,
    available: tiles, select: () => ({ tiles, images: [{}] }), retry: jest.fn(), timedOut: false, failedCount: 0 });
  const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
    statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics
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

  const rerenderSession = (view: ReturnType<typeof renderReadySession>, haptics = false) => view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
    statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={haptics}
    source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);

  it('opens a paused state from the session control and resumes from it', () => {
    const view = renderReadySession();
    measureMark();
    expect(view.queryByTestId('v2-visualize-paused')).toBeNull();
    fireEvent.press(view.getByLabelText('Pause Visualize'));
    expect(mockEngine.pause).toHaveBeenCalledWith('user');
    mockEngine.state = 'paused';
    rerenderSession(view);
    expect(view.getByTestId('v2-visualize-paused')).toBeTruthy();
    expect(view.getByLabelText('Resume Visualize')).toBeTruthy();
    expect(view.getByLabelText('End session')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Resume Visualize'));
    expect(mockEngine.resume).toHaveBeenCalledTimes(1);
    expect(view.onExit).not.toHaveBeenCalled();
  });

  it('never ends the session from one tap: the end control only pauses, ending needs the second choice', async () => {
    const view = renderReadySession();
    measureMark();
    fireEvent.press(view.getByLabelText('End Visualize'));
    expect(mockEngine.pause).toHaveBeenCalledWith('end_control');
    expect(mockEngine.endEarly).not.toHaveBeenCalled();
    expect(view.onExit).not.toHaveBeenCalled();
    mockEngine.state = 'paused';
    rerenderSession(view);
    await act(async () => { fireEvent.press(view.getByLabelText('End session')); });
    expect(mockEngine.endEarly).toHaveBeenCalledTimes(1);
    expect(view.onExit).toHaveBeenCalledTimes(1);
    expect(mockCompletion).not.toHaveBeenCalled();
    expect(view.onContinue).not.toHaveBeenCalled();
  });

  it('does not resume from the paused state while the app is backgrounded', () => {
    const view = renderReadySession();
    measureMark();
    mockEngine.state = 'paused';
    rerenderSession(view);
    changeAppState('background');
    fireEvent.press(view.getByLabelText('Resume Visualize'));
    expect(mockEngine.resume).not.toHaveBeenCalled();
  });

  it('shows a paused state for an interruption the audio caused, not only for taps', () => {
    const view = renderReadySession();
    measureMark();
    mockEngine.state = 'paused';
    rerenderSession(view);
    expect(view.getByTestId('v2-visualize-paused')).toBeTruthy();
  });

  it('fires the seal haptic once when the Anchor resolves, and never replays it after a late return', () => {
    const plan = buildGuidedPlan({ durationSeconds: 60, guide: 'lina', imageCount: 1 });
    const mockConfirm = v2Haptics.confirmation as jest.Mock;
    const view = renderSessionWithHaptics();
    measureMark();
    mockEngine.positionMs = plan.sealAtMs - 500; rerenderSession(view, true);
    expect(mockConfirm).not.toHaveBeenCalled();
    mockEngine.positionMs = plan.sealAtMs + 100; rerenderSession(view, true);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    mockEngine.positionMs = plan.sealAtMs + 2000; rerenderSession(view, true);
    mockEngine.positionMs = plan.sealAtMs + 3000; rerenderSession(view, true);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('skips the seal haptic when the session returns well after the moment has passed', () => {
    const plan = buildGuidedPlan({ durationSeconds: 60, guide: 'lina', imageCount: 1 });
    const mockConfirm = v2Haptics.confirmation as jest.Mock;
    const view = renderSessionWithHaptics();
    measureMark();
    mockEngine.positionMs = plan.sealAtMs + 20_000; rerenderSession(view, true);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('renders the caption for the phrase the audio position is in, and none through the Anchor chapter', () => {
    const plan = buildGuidedPlan({ durationSeconds: 60, guide: 'lina', imageCount: 1 });
    const view = renderReadySession();
    measureMark();
    const phrase = plan.captions.find(item => item.phraseId === 1)!;
    mockEngine.positionMs = phrase.startMs + 300; rerenderSession(view);
    expect(view.getByTestId('v2-visualize-caption').props.children).toBe('Don’t just see the picture. Step into it.');
    const anchorPhrase = plan.beatMap.phrases.find(item => item.chapter === 'ANCHOR')!;
    mockEngine.positionMs = anchorPhrase.startMs + 300; rerenderSession(view);
    expect(plan.captions.some(item => item.startMs <= mockEngine.positionMs && mockEngine.positionMs < item.endMs)).toBe(false);
  });

  it('drives the stage from the audio clock it hands the playback hook, not from a timer of its own', () => {
    renderReadySession();
    measureMark();
    const params = mockEngineHook.mock.calls[0][0];
    expect(params.positionSV).toBeDefined();
    expect(params.durationMs).toBe(64_800);
    expect(params.muted).toBe(true);
  });

  it('shows a plain recovery when the guided audio cannot load', () => {
    resetEngine('failed');
    const view = renderReadySession();
    measureMark();
    expect(view.getByText('Guided audio unavailable')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Back to Practice'));
    expect(view.onExit).toHaveBeenCalledTimes(1);
  });

  it('records one completion and enters Thread once after the final board hold', async () => {
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
    mockEngine.positionMs = 64_800;
    view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);
    await act(async () => { await Promise.resolve(); });
    expect(view.queryByLabelText('Done')).toBeNull();
    expect(mockEngine.markCompleted).toHaveBeenCalledTimes(1);
    expect(view.onContinue).toHaveBeenCalledTimes(1);
  });
  it('prepares the exact geometry without starting a hidden practice session', () => {
    resetEngine('preparing');
    mockUseCinematicAssets.mockReturnValue({ resources: null, ready: true, select: () => ({ tiles, images: [{}] }) });
    const onPrepared = jest.fn();
    const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="Saved Vision" durationSeconds={180} voice="none" ambient={false} haptics={false}
      source="practice_hub" prepareOnly onPrepared={onPrepared} onExit={jest.fn()} onContinue={jest.fn()} />);
    measureMark();
    expect(onPrepared).toHaveBeenCalledWith(expect.objectContaining({ anchor, statement: 'Saved Vision', markLocal: expect.any(Object) }));
    expect(mockEngine.start).not.toHaveBeenCalled();
    expect(mockCompletion).not.toHaveBeenCalled();
    expect(view.queryByTestId('cinematic-stage')).toBeNull();
  });

  it('freezes duration, audio and content even when live props change', async () => {
    const view = renderReadySession();
    measureMark();
    view.rerender(<V2CinematicSessionScreen anchor={{ ...anchor, intentionText: 'Changed later' }} accountId="other-account" tiles={[]}
      statement="Changed later" durationSeconds={600} voice="male" ambient haptics
      source="recommended_today" onExit={view.onExit} onContinue={view.onContinue} />);
    const last = mockEngineHook.mock.calls[mockEngineHook.mock.calls.length - 1][0];
    expect(last.durationMs).toBe(64_800);
    expect(last.muted).toBe(true);
    await act(async () => { await last.onComplete({ startedAt: '2026-09-30T10:00:00.000Z', completedAt: '2026-09-30T10:01:00.000Z' }); });
    expect(mockCompletion).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'user-1', anchor, durationSeconds: 60, guidanceVoice: 'none', backgroundAudio: 'off' }));
  });

  it('holds completion in background and enters Thread once on foreground', async () => {
    const view = renderReadySession(); measureMark();
    changeAppState('background');
    mockEngine.state = 'completing'; mockEngine.positionMs = 64800;
    view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="Saved Vision" durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);
    await act(async () => { await Promise.resolve(); });
    expect(view.onContinue).not.toHaveBeenCalled();
    changeAppState('active'); changeAppState('active');
    expect(view.onContinue).toHaveBeenCalledTimes(1);
  });

  describe('the final board can never hold the person indefinitely', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const enterCompleting = (view: ReturnType<typeof renderReadySession>) => {
      mockEngine.state = 'completing'; mockEngine.positionMs = 64800;
      view.rerender(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
        statement="My saved intention feels calm and clear." durationSeconds={60} voice="none" ambient={false} haptics={false}
        source="practice_hub" onExit={view.onExit} onContinue={view.onContinue} />);
    };

    it('continues when the completion write never settles', async () => {
      mockEngine.completionPromise = new Promise(() => undefined);
      const view = renderReadySession(); measureMark();
      enterCompleting(view);
      await act(async () => { await Promise.resolve(); });
      expect(view.onContinue).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(COMPLETION_SETTLE_MAX_MS + 50); });
      expect(mockEngine.markCompleted).toHaveBeenCalledTimes(1);
      expect(view.onContinue).toHaveBeenCalledTimes(1);
    });

    it('continues exactly once however many times the failsafe and the real settle race', async () => {
      const view = renderReadySession(); measureMark();
      enterCompleting(view);
      await act(async () => { await Promise.resolve(); });
      await act(async () => { jest.advanceTimersByTime(COMPLETION_SETTLE_MAX_MS * 3); });
      expect(view.onContinue).toHaveBeenCalledTimes(1);
      expect(mockEngine.markCompleted).toHaveBeenCalledTimes(1);
    });

    it('does not leave a failsafe timer behind when the session unmounts', async () => {
      mockEngine.completionPromise = new Promise(() => undefined);
      const view = renderReadySession(); measureMark();
      enterCompleting(view);
      view.unmount();
      await act(async () => { jest.advanceTimersByTime(COMPLETION_SETTLE_MAX_MS * 2); });
      expect(view.onContinue).not.toHaveBeenCalled();
    });
  });

  it('begins with the same prepared textures without another asset request or measurement', () => {
    resetEngine('preparing');
    mockUseCinematicAssets.mockReturnValue({ resources: null, ready: true, select: () => ({ tiles, images: [{}] }) });
    const onPrepared = jest.fn();
    const preparation = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="Saved Vision" durationSeconds={180} voice="none" ambient={false} haptics={false}
      source="practice_hub" prepareOnly onPrepared={onPrepared} onExit={jest.fn()} onContinue={jest.fn()} />);
    measureMark();
    const prepared = onPrepared.mock.calls[0][0];
    preparation.unmount(); mockUseCinematicAssets.mockClear();
    const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="Saved Vision" durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" prepared={prepared} onExit={jest.fn()} onContinue={jest.fn()} />);
    expect(mockUseCinematicAssets).not.toHaveBeenCalled();
    expect(view.getByTestId('cinematic-stage')).toBeTruthy();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
  });

  it('uses the full existing multi-photo composition while keeping note content out of Visualize', () => {
    mockUseBoardScene.mockClear();
    mockUseCinematicAssets.mockReturnValue({ resources: null, ready: true, partial: false, unavailable: false,
      available: tiles, select: () => ({ tiles, images: [{}] }), retry: jest.fn(), timedOut: false, failedCount: 0 });
    const note = { id: 'note-1', content: { text: 'A saved note' }, presentation: { styleId: 'paper' } } as any;
    const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles} notes={[note]}
      statement="Saved Vision" durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={jest.fn()} onContinue={jest.fn()} />);
    measureMark();

    expect(mockUseBoardScene).toHaveBeenCalledWith(tiles, expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }), 1, true);
    expect(view.getByTestId('cinematic-stage')).toBeTruthy();
    expect(mockCinematicStageProps).not.toHaveProperty('notes');
    view.unmount();
  });

});
