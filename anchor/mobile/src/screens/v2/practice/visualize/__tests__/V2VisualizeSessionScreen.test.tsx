import React from 'react';
import { Alert, Image } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2VisualizeSessionScreen } from '../V2VisualizeSessionScreen';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const mockEngine: any = {};
let mockEngineParams: any;
let mockReduceMotion = false;

jest.mock('@/screens/visualize/useVisualizeSessionEngine', () => ({
  useVisualizeSessionEngine: (params: any) => { mockEngineParams = params; return mockEngine; },
}));
jest.mock('@/screens/visualize/useVisualizeSessionAudio', () => ({
  useVisualizeSessionAudio: () => ({
    fadeOutAndStop: jest.fn(() => Promise.resolve()),
    finishCompletion: jest.fn(() => Promise.resolve()),
    hasVoiceGuidance: false,
  }),
}));
jest.mock('@/screens/visualize/useVisualizeImmersiveMode', () => ({ useVisualizeImmersiveMode: jest.fn() }));
jest.mock('@/services/SessionAudioManifest', () => ({ resolveSessionAudioPlan: jest.fn(() => ({})) }));
jest.mock('@/services/visualizeAudioManifest', () => ({ getVisualizeSessionAudioManifest: jest.fn(() => ({})) }));
jest.mock('@/services/SessionAudioAnalytics', () => ({ trackSessionStartedWithAudio: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'),
  useV2ReduceMotion: () => mockReduceMotion,
  v2Haptics: { selection: jest.fn(), completion: jest.fn() },
}));
jest.mock('@/services/PracticeCompletionService', () => ({
  PracticeCompletionService: { commitVisualizeCompletion: jest.fn(() => Promise.resolve({})) },
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { PRACTICE_SESSION_STARTED: 'started', PRACTICE_SESSION_COMPLETED: 'completed' },
  AnalyticsService: { track: jest.fn() },
}));

const anchor = makeAnchor({ id: 'anchor-1', userId: 'user-1', intentionText: 'Anchor has ten thousand users', category: 'desire' });
const tiles = [0, 1].map(index => ({
  id: `scene-${index}`, sceneId: `scene-${index}`, imageUrl: `https://cdn.example.com/${index}.jpg`, prompt: null, sortOrder: index, isHero: index === 0,
}));

function resetEngine(state = 'running') {
  Object.assign(mockEngine, {
    state, elapsedMs: 0, remainingSeconds: 180, completionPromise: null,
    start: jest.fn(), pause: jest.fn(), resume: jest.fn(), endEarly: jest.fn(), markCompleted: jest.fn(),
  });
}

function renderSession(overrides: Partial<React.ComponentProps<typeof V2VisualizeSessionScreen>> = {}) {
  const onExit = jest.fn();
  const onContinue = jest.fn();
  const utils = render(
    <V2VisualizeSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="My revenuecat dashboard shows 10 thousand active users for anchor." visionId="vision-1"
      durationSeconds={180} voice="female" ambient haptics source="recommended_today"
      onExit={onExit} onContinue={onContinue} {...overrides} />,
  );
  return { ...utils, onExit, onContinue };
}

async function reachTheEnd(rerender: (ui: React.ReactElement) => void, ui: React.ReactElement) {
  await act(async () => {
    await mockEngineParams.onComplete({ startedAt: '2026-09-21T10:00:00.000Z', completedAt: '2026-09-21T10:03:00.000Z' });
  });
  mockEngine.state = 'completing';
  mockEngine.remainingSeconds = 0;
  mockEngine.elapsedMs = 180_000;
  rerender(ui);
}

describe('V2VisualizeSessionScreen completion semantics', () => {
  let getSize: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockReduceMotion = false;
    resetEngine();
    // jest-expo's native ImageLoader mock predates the promise-based getSize.
    getSize = jest.spyOn(Image, 'getSize').mockImplementation(((_uri: string, ok?: (w: number, h: number) => void) => {
      ok?.(1080, 1920);
    }) as never);
  });
  afterEach(() => { getSize.mockRestore(); jest.useRealTimers(); });

  it('shows only the selected Vision images, full-bleed for portrait originals', () => {
    const { UNSAFE_getAllByType } = renderSession();
    const uris = UNSAFE_getAllByType(Image).map(node => (node.props.source as { uri?: string })?.uri).filter(Boolean);
    expect(new Set(uris)).toEqual(new Set(tiles.map(tile => tile.imageUrl)));
  });

  it('opening Visualize starts the session but records nothing', () => {
    const { getByTestId } = renderSession();
    expect(mockEngine.start).toHaveBeenCalledTimes(1);
    expect(getByTestId('v2-visualize-timer')).toBeTruthy();
    expect(PracticeCompletionService.commitVisualizeCompletion).not.toHaveBeenCalled();
  });

  it('leaving early asks first, ends the session, and never records completion', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByLabelText, onExit } = renderSession();
    fireEvent.press(getByLabelText('End Visualize'));
    expect(mockEngine.pause).toHaveBeenCalledWith('exit_prompt');
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { buttons.find(button => button.text === 'End session')?.onPress?.(); });
    expect(mockEngine.endEarly).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(PracticeCompletionService.commitVisualizeCompletion).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('"Keep going" resumes without recording anything', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByLabelText, onExit } = renderSession();
    fireEvent.press(getByLabelText('End Visualize'));
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    act(() => { buttons.find(button => button.text === 'Keep going')?.onPress?.(); });
    expect(mockEngine.resume).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('records exactly one valid Visualize completion when the full duration runs', async () => {
    const view = renderSession();
    const ui = (
      <V2VisualizeSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
        statement="My revenuecat dashboard shows 10 thousand active users for anchor." visionId="vision-1"
        durationSeconds={180} voice="female" ambient haptics source="recommended_today"
        onExit={view.onExit} onContinue={view.onContinue} />
    );
    await reachTheEnd(view.rerender, ui);
    // A second completion signal (re-render, double event) is ignored.
    await act(async () => {
      await mockEngineParams.onComplete({ startedAt: '2026-09-21T10:00:00.000Z', completedAt: '2026-09-21T10:03:00.000Z' });
    });
    expect(PracticeCompletionService.commitVisualizeCompletion).toHaveBeenCalledTimes(1);
    expect(PracticeCompletionService.commitVisualizeCompletion).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'user-1',
      durationSeconds: 180,
      sceneSnapshot: 'My revenuecat dashboard shows 10 thousand active users for anchor.',
      guidanceVoice: 'female',
      backgroundAudio: 'ambient',
      metadata: { v2_entry_source: 'recommended_today', vision_id: 'vision-1' },
    }));
  });

  it('resolves into the real Anchor, then offers Continue once', async () => {
    const view = renderSession();
    const ui = (
      <V2VisualizeSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
        statement="My revenuecat dashboard shows 10 thousand active users for anchor." visionId="vision-1"
        durationSeconds={180} voice="female" ambient haptics source="practice_hub"
        onExit={view.onExit} onContinue={view.onContinue} />
    );
    await reachTheEnd(view.rerender, ui);
    expect(view.getByTestId('v2-visualize-anchor')).toBeTruthy();
    // The closing line is laid out but hidden until the Anchor has fully arrived.
    expect(view.queryByText('Hold onto what you saw.')).toBeNull();
    const continueButton = view.getByLabelText('Continue');
    expect(continueButton.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await act(async () => { jest.advanceTimersByTime(10_500); });
    expect(view.getByText('Hold onto what you saw.')).toBeTruthy();
    expect(view.getByLabelText('Continue').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    fireEvent.press(view.getByLabelText('Continue'));
    fireEvent.press(view.getByLabelText('Continue'));
    expect(view.onContinue).toHaveBeenCalledTimes(1);
    expect(mockEngine.markCompleted).toHaveBeenCalledTimes(1);
    expect(view.onExit).not.toHaveBeenCalled();
  });

  it('keeps the ending under Reduce Motion, as a shorter opacity transition', async () => {
    mockReduceMotion = true;
    const view = renderSession();
    const ui = (
      <V2VisualizeSessionScreen anchor={anchor} accountId="user-1" tiles={tiles} statement="I am here." visionId="vision-1"
        durationSeconds={180} voice="none" ambient={false} haptics={false} source="practice_hub"
        onExit={view.onExit} onContinue={view.onContinue} />
    );
    await reachTheEnd(view.rerender, ui);
    expect(view.getByTestId('v2-visualize-anchor')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(4_700); });
    fireEvent.press(view.getByLabelText('Continue'));
    expect(view.onContinue).toHaveBeenCalledTimes(1);
  });

  it('never records without a signed-in account', async () => {
    const view = renderSession({ accountId: null });
    await act(async () => {
      await mockEngineParams.onComplete({ startedAt: '2026-09-21T10:00:00.000Z', completedAt: '2026-09-21T10:03:00.000Z' });
    });
    expect(PracticeCompletionService.commitVisualizeCompletion).not.toHaveBeenCalled();
    view.unmount();
  });
});
