import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, BackHandler } from 'react-native';
import AnchorCreationFlowScreen from '../AnchorCreationFlowScreen';
import type { FlowFrameSource } from '../FlowCanvas';
import { useEvolveSessionStore } from '@/stores/v2/evolveSessionStore';
import { useAnchorStore } from '@/stores/anchorStore';

let mockGetFrame: () => FlowFrameSource;
let mockNow = 100;
let mockEvolve: { fromAnchorId: string } | undefined;
let mockSaved: (result: unknown) => void;
let mockChoose: { onHoldComplete: (page: number) => void; onSealAnimationDone: () => void };
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();
const mockSaveAnchor = jest.fn();
const mockProceed = jest.fn();
const mockGenerate = jest.fn();
const mockHandOffToHome = jest.fn();
const mockPrepareHomeArrival = jest.fn();

jest.mock('@/config/v2FeatureFlag', () => ({ isAnchorV2Enabled: () => true }));
jest.mock('@/stores/v2/firstRunStore', () => ({ useFirstRunStore: { getState: () => ({ setStep: jest.fn() }) } }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, popToTop: mockPopToTop }),
  useRoute: () => ({
    params: {
      intentionText: 'Finish my novel this year', category: 'custom', source: 'typed',
      ...(mockEvolve ? { evolve: mockEvolve } : {}),
    },
  }),
}));
jest.mock('../FlowCanvas', () => ({ FlowCanvas: (props: { getFrame: () => FlowFrameSource }) => { mockGetFrame = props.getFrame; return null; } }));
jest.mock('../flowFonts', () => ({ useFlowFonts: () => ({ measure: require('./recordingPainter').fakeMeasure }) }));
jest.mock('../components/StyleScene', () => ({ StyleScene: ({ step }: { step: { commit: () => void } }) => {
  const { Pressable, Text } = require('react-native');
  return <Pressable onPress={step.commit}><Text>Commit Alloy</Text></Pressable>;
} }));
jest.mock('../useStyleStep', () => ({ useStyleStep: ({ onCommit }: { onCommit: (id: string) => boolean }) => ({ commit: () => onCommit('alloy'), reset: jest.fn() }) }));
jest.mock('../useChooseController', () => ({
  useChooseController: (options: typeof mockChoose) => { mockChoose = options; return { phase: 'choosing', holdActive: false, reset: jest.fn() }; },
}));
jest.mock('../components/ChooseScene', () => ({ ChooseScene: () => null }));
jest.mock('../components/FpsProbe', () => ({ FpsProbe: () => null }));
jest.mock('@/hooks/useHighRefreshRate', () => ({ useHighRefreshRate: jest.fn() }));
jest.mock('@/hooks/useAudio', () => ({ useAudio: jest.fn() }));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useCreationReduceMotion: () => true }));
jest.mock('@/hooks/useTrialStatus', () => ({ useTrialStatus: () => ({ hasActiveEntitlement: true, entitlementReady: true }) }));
jest.mock('@/hooks/useSaveAnchor', () => ({
  useSaveAnchor: (_input: unknown, routing: { onSaved: (result: unknown) => void }) => {
    mockSaved = routing.onSaved;
    return { saveAnchor: mockSaveAnchor, reminderCardVisible: false, handleReminderDismiss: jest.fn() };
  },
}));
jest.mock('@/components/notifications', () => ({ DailyReminderPrompt: () => null }));
jest.mock('@/navigation/v2/creationHandoff', () => ({
  handOffToHome: (...args: unknown[]) => mockHandOffToHome(...args),
  prepareHomeArrival: (...args: unknown[]) => mockPrepareHomeArrival(...args),
}));
jest.mock('@/services/AnchorGenerationService', () => ({ AnchorGenerationService: { generate: (...args: unknown[]) => mockGenerate(...args) } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: () => ({ stop: jest.fn() }) }));
jest.mock('@/services/NodeToneService', () => ({ NodeToneService: { prepare: jest.fn(), play: jest.fn(), release: jest.fn() } }));
jest.mock('@/services/FrictionAnalytics', () => ({ FrictionAnalytics: { stepViewed: jest.fn(), stepCompleted: jest.fn(), flowRetry: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ anchorCount: 1, isAuthenticated: true, user: { id: 'u1' } }),
    { getState: () => ({ pendingFirstAnchorDraft: null, setPendingFirstAnchorDraft: jest.fn() }) },
  ),
}));

function advanceFrames(seconds: number) {
  act(() => {
    for (let i = 0; i < Math.ceil(seconds / 0.05); i += 1) {
      mockNow += 50;
      jest.advanceTimersByTime(50);
      mockGetFrame();
    }
  });
}

/** Style committed, the Form generated: the screen is at Choose, ready to seal Form 1. */
async function reachChoose() {
  let resolve!: (value: unknown) => void;
  mockGenerate.mockImplementation(() => new Promise((done) => { resolve = done; }));
  render(<AnchorCreationFlowScreen />);
  advanceFrames(16);
  fireEvent.press(screen.getByText('Commit Alloy'));
  advanceFrames(6);
  await act(async () => { resolve({ variations: ['data:image/png;base64,YQ=='] }); });
  advanceFrames(2);
}

const flush = () => act(async () => { await Promise.resolve(); });

describe('AnchorCreationFlowScreen: Evolve hand-off', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(100_000);
    jest.clearAllMocks(); mockNow = 100; mockEvolve = undefined;
    useEvolveSessionStore.getState().clear();
    useAnchorStore.setState({ anchors: [] });
    mockSaveAnchor.mockResolvedValue({ status: 'saved', anchorId: 'new-1', isGuestFirstAnchor: false, isFirstAnchor: false, proceed: mockProceed });
    AppState.currentState = 'active';
    jest.spyOn(performance, 'now').mockImplementation(() => mockNow);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as never);
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }) as never);
  });
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.restoreAllMocks(); jest.useRealTimers(); });

  it('a sealed evolve returns to the Release it came from, with the new Anchor attached', () => {
    mockEvolve = { fromAnchorId: 'old-1' };
    useEvolveSessionStore.getState().begin({ fromAnchorId: 'old-1', fromIntention: 'Publish my novel' });
    useAnchorStore.setState({ anchors: [{ id: 'new-1', intentionText: 'Finish my novel this year' } as never] });
    render(<AnchorCreationFlowScreen />);
    act(() => mockSaved({ anchorId: 'new-1', input: { intentionText: 'Finish my novel this year', baseSigilSvg: '<svg />', category: 'custom' } }));

    expect(useEvolveSessionStore.getState().successor).toEqual({ anchorId: 'new-1', intentionText: 'Finish my novel this year' });
    expect(useEvolveSessionStore.getState().pending).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith({
      name: 'V2Release',
      params: { anchorId: 'old-1', reason: 'evolve', successor: { anchorId: 'new-1', intentionText: 'Finish my novel this year' } },
      merge: true,
    });
    // Not Home: nothing flies, nothing is staged.
    expect(mockHandOffToHome).not.toHaveBeenCalled();
    expect(mockPrepareHomeArrival).not.toHaveBeenCalled();
  });

  it('without the marker the hand-off to Home is exactly as before', () => {
    render(<AnchorCreationFlowScreen />);
    act(() => mockSaved({ anchorId: 'new-1', input: { intentionText: 'x', baseSigilSvg: '<svg />', category: 'custom' } }));
    expect(mockHandOffToHome).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useEvolveSessionStore.getState().successor).toBeNull();
  });

  it('seals through the whole flow without ever staging a Home arrival in evolve mode', async () => {
    mockEvolve = { fromAnchorId: 'old-1' };
    await reachChoose();
    act(() => mockChoose.onHoldComplete(0));
    await flush();
    expect(mockSaveAnchor).toHaveBeenCalledTimes(1);
    // The save resolved; Home would have been staged here for an ordinary seal.
    expect(mockPrepareHomeArrival).not.toHaveBeenCalled();
    act(() => mockChoose.onSealAnimationDone());
    await flush();
    expect(mockProceed).toHaveBeenCalledTimes(1);
    expect(mockPrepareHomeArrival).not.toHaveBeenCalled();
    expect(mockHandOffToHome).not.toHaveBeenCalled();
  });

  it('an ordinary seal still stages the Home arrival when the save resolves', async () => {
    await reachChoose();
    act(() => mockChoose.onHoldComplete(0));
    await flush();
    expect(mockPrepareHomeArrival).toHaveBeenCalledTimes(1);
    expect(mockPrepareHomeArrival).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'new-1' }));
  });

  it('backing out of creation attaches nothing and navigates nowhere but back', async () => {
    mockEvolve = { fromAnchorId: 'old-1' };
    useEvolveSessionStore.getState().begin({ fromAnchorId: 'old-1', fromIntention: 'Publish my novel' });
    render(<AnchorCreationFlowScreen />);
    advanceFrames(2);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(useEvolveSessionStore.getState().successor).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockHandOffToHome).not.toHaveBeenCalled();
  });
});
