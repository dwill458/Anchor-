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
    category: 'presence',
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
      activeAnchorId: 'a1',
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
        source="practice_hub"
        onBack={jest.fn()}
        onCompleted={jest.fn()}
      />
    );

    expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    expect(screen.getByText('“Release and ground”')).toBeTruthy();
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
        />
      );

      // Simulate 30s elapsed
      mockTime += 30500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Resolving delay (650ms)
      await act(async () => {
        jest.advanceTimersByTime(700);
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
      expect(screen.getByText('You returned.')).toBeTruthy();
      expect(screen.getByText('30 sec practiced')).toBeTruthy();

      // Press Done
      fireEvent.press(screen.getByTestId('focus-complete-done-button'));
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      global.performance.now = originalPerformanceNow;
    }
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
        />
      );

      mockTime += 10500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await act(async () => {
        jest.advanceTimersByTime(700);
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
        />
      );

      mockTime += 10500;

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await act(async () => {
        jest.advanceTimersByTime(700);
      });

      expect(screen.getByTestId('v2-focus-complete-screen')).toBeTruthy();

      // Press Focus again
      fireEvent.press(screen.getByTestId('focus-complete-again-button'));

      // Returns to active screen
      expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    } finally {
      global.performance.now = originalPerformanceNow;
    }
  });
});
