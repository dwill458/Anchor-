import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, BackHandler, type AppStateStatus } from 'react-native';
import AnchorCreationFlowScreen from '../AnchorCreationFlowScreen';
import type { FlowFrameSource } from '../FlowCanvas';

let mockGetFrame: () => FlowFrameSource;
let mockNow = 100;
let mockAppState: (state: AppStateStatus) => void;
let mockBack: () => boolean;
const mockGoBack = jest.fn();
const mockGenerate = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn();
const mockImpact = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { intentionText: 'Stay calm under pressure', category: 'custom', source: 'typed' } }),
}));
jest.mock('../FlowCanvas', () => ({ FlowCanvas: (props: { getFrame: () => FlowFrameSource }) => { mockGetFrame = props.getFrame; return null; } }));
jest.mock('../flowFonts', () => ({ useFlowFonts: () => ({ measure: require('./recordingPainter').fakeMeasure }) }));
jest.mock('../components/StyleScene', () => ({ StyleScene: ({ step }: { step: { commit: () => void } }) => {
  const { Pressable, Text } = require('react-native');
  return <Pressable onPress={step.commit}><Text>Commit Alloy</Text></Pressable>;
} }));
jest.mock('../useStyleStep', () => ({ useStyleStep: ({ onCommit }: { onCommit: (id: string) => boolean }) => ({ commit: () => onCommit('alloy'), reset: jest.fn() }) }));
jest.mock('../useChooseController', () => ({ useChooseController: () => ({ phase: 'choosing', holdActive: false }) }));
jest.mock('../components/ChooseScene', () => ({ ChooseScene: () => null }));
jest.mock('../components/FpsProbe', () => ({ FpsProbe: () => null }));
jest.mock('@/hooks/useHighRefreshRate', () => ({ useHighRefreshRate: jest.fn() }));
jest.mock('@/hooks/useAudio', () => ({ useAudio: jest.fn() }));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useCreationReduceMotion: () => true }));
jest.mock('@/hooks/useTrialStatus', () => ({ useTrialStatus: () => ({ hasActiveEntitlement: true, entitlementReady: true }) }));
jest.mock('@/hooks/useSaveAnchor', () => ({ useSaveAnchor: () => ({ saveAnchor: jest.fn() }) }));
jest.mock('@/components/notifications', () => ({ DailyReminderPrompt: () => null }));
jest.mock('@/navigation/v2/creationHandoff', () => ({ handOffToHome: jest.fn(), prepareHomeArrival: jest.fn() }));
jest.mock('@/services/AnchorGenerationService', () => ({ AnchorGenerationService: { generate: (...args: unknown[]) => mockGenerate(...args) } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlay(...args) }));
jest.mock('@/services/NodeToneService', () => ({ NodeToneService: { prepare: jest.fn(), play: jest.fn() } }));
jest.mock('@/services/FrictionAnalytics', () => ({ FrictionAnalytics: { stepViewed: jest.fn(), stepCompleted: jest.fn(), flowRetry: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: (...args: unknown[]) => mockImpact(...args) } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ anchorCount: 0, isAuthenticated: false, user: null }) }));

function advanceFrames(seconds: number) {
  act(() => {
    for (let i = 0; i < Math.ceil(seconds / 0.05); i += 1) {
      mockNow += 50;
      jest.advanceTimersByTime(50);
      mockGetFrame();
    }
  });
}

function commit() {
  render(<AnchorCreationFlowScreen />);
  advanceFrames(16);
  fireEvent.press(screen.getByText('Commit Alloy'));
}

describe('Form wait wiring', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(100_000);
    jest.clearAllMocks(); mockNow = 100;
    mockGenerate.mockImplementation(() => new Promise(() => {}));
    mockPlay.mockImplementation(() => ({ stop: mockStop }));
    AppState.currentState = 'active';
    jest.spyOn(performance, 'now').mockImplementation(() => mockNow);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      mockAppState = handler; return { remove: jest.fn() };
    });
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      mockBack = handler as () => boolean; return { remove: jest.fn() };
    });
  });
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.restoreAllMocks(); jest.useRealTimers(); });

  it('locks header and hardware back through 12 seconds, then aborts and exits', () => {
    commit();
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    act(() => { expect(mockBack()).toBe(true); jest.advanceTimersByTime(11_999); });
    expect(mockGoBack).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState.disabled).toBe(false);
    act(() => { mockBack(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].signal.aborted).toBe(true);
  });

  it('renders Retry at 45 seconds without a canvas or unrelated render, and resets on retry', () => {
    commit();
    act(() => jest.advanceTimersByTime(44_999));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState.disabled).toBe(true);
  });

  it('unlocks immediately on failure, stops craft events, and preserves Back to Style', async () => {
    mockGenerate.mockRejectedValue({ kind: 'generic' });
    commit();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState.disabled).toBe(false);
    mockPlay.mockClear(); mockImpact.mockClear();
    advanceFrames(8);
    expect(mockPlay).not.toHaveBeenCalled(); expect(mockImpact).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Back to style' }));
    expect(screen.getByText('Commit Alloy')).toBeTruthy();
  });

  it('runs craft cues with Reduce Motion, stops sound in background, and settles once', async () => {
    let resolve!: (value: unknown) => void;
    mockGenerate.mockImplementation(() => new Promise((done) => { resolve = done; }));
    commit();
    mockPlay.mockClear(); mockImpact.mockClear();
    advanceFrames(6);
    expect(mockImpact).toHaveBeenCalledWith('light'); expect(mockImpact).toHaveBeenCalledWith('medium');
    expect(mockPlay).toHaveBeenCalledWith('formTick', 0.30);
    act(() => mockAppState('background'));
    expect(mockStop).toHaveBeenCalled();
    mockPlay.mockClear(); mockImpact.mockClear();
    advanceFrames(4);
    expect(mockPlay).not.toHaveBeenCalled(); expect(mockImpact).not.toHaveBeenCalled();
    act(() => mockAppState('active'));
    await act(async () => { resolve({ variations: ['data:image/png;base64,YQ=='] }); });
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState.disabled).toBe(false);
    advanceFrames(2);
    expect(mockPlay.mock.calls.filter(([key]) => key === 'formSettle')).toEqual([['formSettle', 0.35]]);
    expect(mockImpact).toHaveBeenCalledWith('medium');
    mockPlay.mockClear(); advanceFrames(4);
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
