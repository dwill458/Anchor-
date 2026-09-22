import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

  it('completes focus session, writes to PracticeCompletionService, and displays complete screen', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();

    let mockTime = 1000;
    const originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn(() => mockTime);

    try {
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

      // Begin session from prepare state
      fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Simulate 30s elapsed
      mockTime += 30500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Settle, fade, black hold, then mount the completion surface.
      await act(async () => {
        jest.advanceTimersByTime(1900);
      });

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
        { flushImmediately: false }
      );
      expect(PracticeCompletionService.flush).toHaveBeenCalledWith(accountId);

      // Verify V2FocusCompleteScreen is rendered
      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
      expect(screen.getByText('Focus complete')).toBeTruthy();
      expect(screen.getByText('You reinforced this Anchor.')).toBeTruthy();

      // Continue returns to the Practice hub through the semantic completion callback.
      fireEvent.press(screen.getByTestId('focus-complete-done-button'));
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    } finally {
      global.performance.now = originalPerformanceNow;
    }
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

      fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      mockTime += 10500;
      await act(async () => {
        jest.advanceTimersByTime(1000);
        jest.advanceTimersByTime(1900);
      });

      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
    } finally {
      resolveFlush();
      global.performance.now = originalPerformanceNow;
    }
  });

  it('records one completion when End Session is tapped rapidly', async () => {
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

    fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    const endButton = screen.getByTestId('focus-end-button');
    fireEvent.press(endButton);
    fireEvent.press(endButton);
    await act(async () => {
      jest.advanceTimersByTime(1900);
    });

    expect(PracticeCompletionService.completePracticeSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();
  });

  it('routes to onCompleted when source is recommended_today and Done is pressed', async () => {
    const onCompleted = jest.fn();
    const onBack = jest.fn();

    let mockTime = 1000;
    const originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn(() => mockTime);

    try {
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

      fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      mockTime += 10500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await act(async () => {
        jest.advanceTimersByTime(1900);
      });

      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();

      fireEvent.press(screen.getByTestId('focus-complete-done-button'));
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    } finally {
      global.performance.now = originalPerformanceNow;
    }
  });

  it('allows focusing again from the completion screen', async () => {
    const onFocusAgain = jest.fn();
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
          onFocusAgain={onFocusAgain}
        />
      );

      fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      mockTime += 10500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await act(async () => {
        jest.advanceTimersByTime(1900);
      });

      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();

      // Press Focus again
      fireEvent.press(screen.getByTestId('focus-complete-again-button'));

      expect(onFocusAgain).toHaveBeenCalledTimes(1);
    } finally {
      global.performance.now = originalPerformanceNow;
    }
  });
});
