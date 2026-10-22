import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: jest.fn(() => Promise.reject({ status: 404 })), post: jest.fn() },
  ApiClientError: class ApiClientError extends Error {},
}));

jest.mock('expo-video', () => ({
  VideoView: (props: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={props.testID ?? 'expo-video-view'} />;
  },
  useVideoPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) })),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => false }));

import { V2PracticeScreen } from '../V2PracticeScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type { V2RecommendationContext } from '@/adapters/v2/practice';
import { invalidateV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ANCHOR_TRANSITION_TIMING, ProgressiveFocusTransitionProvider } from '@/navigation/v2/ProgressiveFocusTransition';

// Every mocked native view shares one measureInWindow; answer it with a plausible on-screen rect.
const nativeMethodsModule = require('@react-native/jest-preset/jest/MockNativeMethods');
const mockNativeMethods = (nativeMethodsModule.default ?? nativeMethodsModule) as { measureInWindow: jest.Mock };

const focusToday: V2RecommendationContext = {
  anchorId: 'a',
  completionSignal: null,
  vision: { exists: false, seenToday: false },
  thread: { delta7d: null, delta7dStatus: 'UNAVAILABLE', status: 'UNAVAILABLE' },
  recommendation: { action: 'Focus', reason: 'server_authoritative' },
};
const fullAccess = { focus: true, deep_prime: true, visualize: true, release: true };

function renderPractice(onBeginPractice = jest.fn()) {
  const anchor = makeAnchor({ id: 'a', threadStrength: 20 });
  useAnchorStore.setState({ anchors: [anchor] });
  render(
    <ProgressiveFocusTransitionProvider>
      <V2PracticeScreen anchor={anchor} recommendation={focusToday} capabilities={fullAccess} onBeginPractice={onBeginPractice} />
    </ProgressiveFocusTransitionProvider>,
  );
  return onBeginPractice;
}

const lock = () => screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true });

function mountCopy() {
  fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
}

/** Jest never runs Reanimated frames, so a flight ends through its watchdog. */
function landFlight() {
  act(() => { jest.advanceTimersByTime(3000); });
}

describe('Practice: the Anchor travels hub -> setup -> session', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    invalidateV2RecommendationContext();
    resetV2VisionReadCache();
    useSessionStore.setState({ practiceHistory: [], sessionLog: [], todayPractice: { date: '', sessionsCount: 0, totalSeconds: 0 } });
    mockNativeMethods.measureInWindow.mockImplementation((callback: (...rect: number[]) => void) => callback(24, 140, 60, 60));
  });

  afterEach(() => {
    mockNativeMethods.measureInWindow.mockReset();
    jest.useRealTimers();
  });

  it('opens setup beneath the travelling ACTIVE ANCHOR mark, not before', () => {
    renderPractice();
    fireEvent.press(screen.getByTestId('v2-recommended-today'));
    // The mark leaves first; setup mounts under it a beat later.
    expect(screen.queryByTestId('v2-practice-prepare-focus')).toBeNull();
    expect(lock()).toBeTruthy();
    mountCopy();
    act(() => { jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.practice.navigateAtMs); });
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();
    landFlight();
    expect(lock()).toBeNull();
  });

  it('starts exactly one session from repeated Begin taps and mounts it beneath the travelling Anchor', () => {
    const onBeginPractice = renderPractice();
    fireEvent.press(screen.getByTestId('v2-recommended-today'));
    mountCopy();
    landFlight();
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Begin Focus'));
    fireEvent.press(screen.getByLabelText('Begin Focus'));
    expect(onBeginPractice).not.toHaveBeenCalled();
    mountCopy();
    act(() => { jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.session.navigateAtMs); });

    expect(onBeginPractice).toHaveBeenCalledTimes(1);
    expect(onBeginPractice).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'a', mode: 'focus' }));
    expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    expect(screen.queryByTestId('v2-practice-prepare-focus')).toBeNull();
    landFlight();
    expect(lock()).toBeNull();
    expect(onBeginPractice).toHaveBeenCalledTimes(1);
  });

  it('still begins the practice when the setup Anchor cannot be measured', () => {
    const onBeginPractice = renderPractice();
    fireEvent.press(screen.getByTestId('v2-recommended-today'));
    mountCopy();
    landFlight();
    mockNativeMethods.measureInWindow.mockImplementation(() => undefined);
    fireEvent.press(screen.getByLabelText('Begin Focus'));
    act(() => { jest.advanceTimersByTime(300); });
    expect(onBeginPractice).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    expect(lock()).toBeNull();
  });
});
