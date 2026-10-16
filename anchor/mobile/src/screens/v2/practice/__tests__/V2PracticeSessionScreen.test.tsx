import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { V2PracticeSessionScreen } from '../V2PracticeSessionScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

jest.mock('@/services/PracticeCompletionService', () => ({
  PracticeCompletionService: {
    completePracticeSession: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({
    createSessionAudioPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      stop: jest.fn(),
      seekTo: jest.fn().mockResolvedValue(undefined),
      setVolume: jest.fn(),
      isLoaded: jest.fn().mockReturnValue(true),
      getCurrentTime: jest.fn().mockReturnValue(0),
    })),
    cleanupAllPlayers: jest.fn(),
  }),
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    notification: jest.fn(),
    impact: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    PRACTICE_STARTED: 'practice_started',
    PRACTICE_ABANDONED: 'practice_abandoned',
    PRACTICE_COMPLETED: 'practice_completed',
  },
  AnalyticsService: {
    track: jest.fn(),
  },
}));

describe('V2PracticeSessionScreen - Focus Flow Integration', () => {
const accountId = 'user-123';

function emitAppState(nextState: 'active' | 'background') {
  const listeners = (AppState.addEventListener as jest.Mock).mock.calls
    .filter(([eventName]) => eventName === 'change')
    .map(([, listener]) => listener as (state: string) => void);
  act(() => listeners.forEach((listener) => listener(nextState)));
}
  const mockAnchor = makeAnchor({
    id: 'a1',
    userId: accountId,
    intentionText: 'Release and ground',
    category: 'spirituality',
    threadStrength: 60,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    useAuthStore.setState({
      user: { id: accountId, email: 'test@example.com' } as any,
    });

    useAnchorStore.setState({
      anchors: [mockAnchor],
      currentAnchorId: 'a1',
    });

    useSettingsStore.setState({
      focusSessionDuration: 30,
      sessionAudioDefaults: {
        focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
        deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
        visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders V2FocusActiveScreen when mode is focus', () => {
    render(
      <V2PracticeSessionScreen
        anchorId="a1"
        mode="focus"
        durationSeconds={30}
        source="practice_hub"
        onBack={jest.fn()}
        onCompleted={jest.fn()}
        onFocusAgain={jest.fn()}
      />
    );

    expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    expect(screen.getByText('Release and ground')).toBeTruthy();
  });

  it.each(Array.from({ length: 10 }, (_, i) => i + 1))('10-second synthetic Focus completes (%i)', async () => {
    (PracticeCompletionService.completePracticeSession as jest.Mock).mockResolvedValue(undefined);
    const view = render(<V2PracticeSessionScreen anchorId="a1" mode="focus" durationSeconds={10}
      source="practice_hub" onBack={jest.fn()} onCompleted={jest.fn()} onFocusAgain={jest.fn()} />);
    emitAppState('active');
    await act(async () => { jest.advanceTimersByTime(800); });
    await act(async () => { jest.advanceTimersByTime(10000); });
    await act(async () => { jest.advanceTimersByTime(2300); });
    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('causally holds Focus completion behind a delayed durable receipt and recovers on settlement', async () => {
    let release!: () => void;
    (PracticeCompletionService.completePracticeSession as jest.Mock).mockImplementationOnce(
      () => new Promise<void>(resolve => { release = resolve; }));
    render(<V2PracticeSessionScreen anchorId="a1" mode="focus" durationSeconds={10}
      source="practice_hub" onBack={jest.fn()} onCompleted={jest.fn()} onFocusAgain={jest.fn()} />);
    emitAppState('active');
    await act(async () => { jest.advanceTimersByTime(800); });
    await act(async () => { jest.advanceTimersByTime(10000); });
    await act(async () => { jest.advanceTimersByTime(150000); });
    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('v2-focus-complete-screen')).toBeNull();
    expect(PracticeCompletionService.flush).not.toHaveBeenCalled();
    await act(async () => { release(); });
    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
  });

  it('completes focus session, writes to PracticeCompletionService, and displays complete screen', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();

    render(
        <V2PracticeSessionScreen
          anchorId="a1"
          mode="focus"
          durationSeconds={30}
        source="practice_hub"
        onBack={onBack}
        onCompleted={onCompleted}
        onFocusAgain={jest.fn()}
        />
    );
    emitAppState('active');

    // The outer Focus setup enters the session through its 800ms transition.
    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    // Complete the full 30s session duration
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    await act(async () => {
      jest.advanceTimersByTime(2300);
    });

    // Settle, fade, black hold, then mount the completion surface.

    // Verify PracticeCompletionService was called with correct data
    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId,
          mode: 'focus',
          plannedDurationSeconds: 30,
          actualDurationSeconds: 30,
          source: 'practice_screen',
          metadata: { v2_entry_source: 'practice_hub' },
        }),
        { mirrorLegacySession: true, flushImmediately: false }
    );
    expect(PracticeCompletionService.flush).toHaveBeenCalledWith(accountId);

    // Verify V2FocusCompleteScreen is rendered
    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
    expect(screen.getByText('Focus complete')).toBeTruthy();
    expect(screen.getByText('Reinforced today ✓')).toBeTruthy();

    // Continue returns to the Practice hub through the semantic completion callback.
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith({ mode: 'focus', durationSeconds: 30, saved: true });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('shows completion without waiting for a signed-in account sync to finish', async () => {
    let resolveFlush!: () => void;
    const pendingFlush = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });
    (PracticeCompletionService.flush as jest.Mock).mockReturnValueOnce(pendingFlush);

    let mockTime = 1000;
    const originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn(() => mockTime);

    try {
      render(
        <V2PracticeSessionScreen
          anchorId="a1"
          mode="focus"
          durationSeconds={10}
          source="practice_hub"
          onBack={jest.fn()}
          onCompleted={jest.fn()}
          onFocusAgain={jest.fn()}
        />
      );
      emitAppState('active');

      await act(async () => {
        jest.advanceTimersByTime(800);
      });
      await act(async () => {
        mockTime += 10500;
        jest.advanceTimersByTime(10000);
      });
      await act(async () => {
        mockTime += 2500;
        jest.advanceTimersByTime(2300);
      });

      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
    } finally {
      resolveFlush();
      global.performance.now = originalPerformanceNow;
    }
  });

  it('does not report reinforcement when durable session recording fails', async () => {
    const onCompleted = jest.fn();
    (PracticeCompletionService.completePracticeSession as jest.Mock).mockRejectedValueOnce(
      new Error('encrypted session queue unavailable')
    );
    render(
      <V2PracticeSessionScreen
        anchorId="a1"
        mode="focus"
        durationSeconds={30}
        source="practice_hub"
        onBack={jest.fn()}
        onCompleted={onCompleted}
        onFocusAgain={jest.fn()}
      />
    );
    emitAppState('active');
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await act(async () => {
      jest.advanceTimersByTime(2300);
    });

    expect(screen.getByText('This session could not be saved. Thread Strength was not updated.')).toBeTruthy();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onCompleted).toHaveBeenCalledWith({ mode: 'focus', durationSeconds: 30, saved: false });
  });

  it('exits focus session without marking as completed when End Session is pressed early', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();

    render(
      <V2PracticeSessionScreen
        anchorId="a1"
        mode="focus"
        durationSeconds={30}
        source="practice_hub"
        onBack={onBack}
        onCompleted={onCompleted}
        onFocusAgain={jest.fn()}
      />
    );
    emitAppState('active');

    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    const endButton = screen.getByTestId('focus-end-button');
    fireEvent.press(endButton);

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(PracticeCompletionService.completePracticeSession).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('v2-focus-complete-screen')).toBeNull();
  });

  it('exits Deep Focus without marking as completed when ended early', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });

    render(
      <V2PracticeSessionScreen
        anchorId="a1"
        mode="deep_prime"
        durationSeconds={120}
        source="practice_hub"
        onBack={onBack}
        onCompleted={onCompleted}
        onFocusAgain={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('v2-deep-focus-active-screen'));
    fireEvent.press(screen.getByLabelText('End session'));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(PracticeCompletionService.completePracticeSession).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deep Focus complete')).toBeNull();
  });

  it('routes to onCompleted when source is recommended_today and Done is pressed', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();

    render(
        <V2PracticeSessionScreen
          anchorId="a1"
          mode="focus"
          durationSeconds={10}
        source="recommended_today"
        onBack={onBack}
        onCompleted={onCompleted}
        onFocusAgain={jest.fn()}
        />
    );
    emitAppState('active');

      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

    await act(async () => {
        jest.advanceTimersByTime(2300);
    });

    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();

    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('allows focusing again from the completion screen', async () => {
    const onFocusAgain = jest.fn();
    render(
        <V2PracticeSessionScreen
          anchorId="a1"
          mode="focus"
          durationSeconds={10}
          source="practice_hub"
          onBack={jest.fn()}
          onCompleted={jest.fn()}
          onFocusAgain={onFocusAgain}
        />
    );
    emitAppState('active');

      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

    await act(async () => {
        jest.advanceTimersByTime(2300);
    });

    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();

    // Press Focus again
    fireEvent.press(screen.getByTestId('focus-complete-again-button'));

    expect(onFocusAgain).toHaveBeenCalledTimes(1);
  });

  it.each([120, 300, 600])('completes Deep Focus at %is through the canonical deep_prime record and Practice destination', async durationSeconds => {
    const monotonicClock = jest.spyOn(performance, 'now').mockReturnValue(0);
    const onCompleted = jest.fn();
    const onAgain = jest.fn();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    const view = render(<V2PracticeSessionScreen anchorId="a1" mode="deep_prime" durationSeconds={durationSeconds}
      source="practice_hub" onBack={jest.fn()} onCompleted={onCompleted} onFocusAgain={onAgain} />);
    expect(screen.getByTestId('v2-deep-focus-active-screen')).toBeTruthy();
    expect(screen.queryByTestId('v2-practice-session-timer')).toBeNull();
    monotonicClock.mockReturnValue(durationSeconds * 1000);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledTimes(1);
    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledWith(expect.objectContaining({
      accountId, mode: 'deep_prime', plannedDurationSeconds: durationSeconds, actualDurationSeconds: durationSeconds,
      guidanceVoice: 'female', backgroundAudio: 'ambient',
    }), { mirrorLegacySession: true, flushImmediately: false });
    expect(screen.getByText('Deep Focus complete')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Deep Focus again'));
    expect(onAgain).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onCompleted).toHaveBeenCalledWith({ mode: 'deep_prime', durationSeconds, saved: true });
    view.unmount();
    monotonicClock.mockRestore();
  });

  it('reports Deep Focus local persistence failure truthfully', async () => {
    const monotonicClock = jest.spyOn(performance, 'now').mockReturnValue(0);
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    (PracticeCompletionService.completePracticeSession as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const onCompleted = jest.fn();
    render(<V2PracticeSessionScreen anchorId="a1" mode="deep_prime" durationSeconds={120} source="practice_hub"
      onBack={jest.fn()} onCompleted={onCompleted} onFocusAgain={jest.fn()} />);
    monotonicClock.mockReturnValue(120000);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(screen.getByText('Deep Focus complete')).toBeTruthy();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(onCompleted).toHaveBeenCalledWith({ mode: 'deep_prime', durationSeconds: 120, saved: false });
    monotonicClock.mockRestore();
  });

  it('does not wait for network flush before showing Deep Focus completion', async () => {
    const monotonicClock = jest.spyOn(performance, 'now').mockReturnValue(0);
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    (PracticeCompletionService.flush as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    render(<V2PracticeSessionScreen anchorId="a1" mode="deep_prime" durationSeconds={120} source="practice_hub"
      onBack={jest.fn()} onCompleted={jest.fn()} onFocusAgain={jest.fn()} />);
    monotonicClock.mockReturnValue(120000);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(screen.getByText('Deep Focus complete')).toBeTruthy();
    expect(PracticeCompletionService.flush).toHaveBeenCalledWith(accountId);
    monotonicClock.mockRestore();
  });
});
