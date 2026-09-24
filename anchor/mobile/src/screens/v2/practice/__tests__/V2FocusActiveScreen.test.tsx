import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { V2FocusActiveScreen } from '../focus/V2FocusActiveScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { safeHaptics } from '@/utils/haptics';
import { AnalyticsService } from '@/services/AnalyticsService';

const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockStop = jest.fn();
const mockCreateSessionAudioPlayer = jest.fn(() => ({
  play: mockPlay,
  pause: mockPause,
  stop: mockStop,
  seekTo: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn(),
  isLoaded: jest.fn().mockReturnValue(true),
  getCurrentTime: jest.fn().mockReturnValue(0),
}));

jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({
    createSessionAudioPlayer: mockCreateSessionAudioPlayer,
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
    PRACTICE_SESSION_STARTED: 'practice_session_started',
    PRACTICE_SESSION_PAUSED: 'practice_session_paused',
    PRACTICE_SESSION_RESUMED: 'practice_session_resumed',
    PRACTICE_SESSION_ENDED_EARLY: 'practice_session_ended_early',
    PRACTICE_SESSION_COMPLETED: 'practice_session_completed',
  },
  AnalyticsService: {
    track: jest.fn(),
  },
}));

describe('V2FocusActiveScreen', () => {
  const mockAnchor = makeAnchor({
    id: 'a1',
    intentionText: 'Breathe with clarity',
    category: 'career',
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the Focus orientation, intention text, and BEGIN button', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(screen.getByTestId('v2-focus-active-screen')).toBeTruthy();
    expect(screen.getByText('FOCUS')).toBeTruthy();
    expect(screen.getByText('Breathe with clarity')).toBeTruthy();
    expect(
      screen.getByText('Let the Anchor hold your attention.')
    ).toBeTruthy();
    expect(screen.getByTestId('focus-prepare-begin-button')).toBeTruthy();
  });

  it('transitions from Prepare to Focus when BEGIN is pressed', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('focus-prepare-begin-button'));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'practice_session_started',
      expect.objectContaining({ practice_mode: 'focus' })
    );
  });

  it('reveals controls on screen tap and allows pausing session', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    // Tap anywhere to reveal controls
    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));

    expect(screen.getByTestId('focus-remaining-time')).toBeTruthy();
    expect(screen.getByTestId('focus-pause-button')).toBeTruthy();
    expect(screen.getByTestId('focus-end-button')).toBeTruthy();
    expect(screen.getByTestId('focus-sound-active-toggle').props.accessibilityState.checked).toBe(true);

    // Tap pause
    fireEvent.press(screen.getByTestId('focus-pause-button'));

    expect(screen.getByTestId('focus-paused-overlay')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByTestId('focus-resume-button')).toBeTruthy();
  });

  it('exposes an accessibility action to reveal the hidden Focus controls', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    const session = screen.getByTestId('v2-focus-active-screen');
    expect(session.props.accessibilityRole).toBe('button');
    expect(session.props.accessibilityLabel).toBe('Show Focus controls');
    fireEvent(session, 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(screen.getByTestId('focus-pause-button')).toBeTruthy();
  });

  it('mutes configured audio and fades controls away after inactivity', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    fireEvent.press(screen.getByTestId('focus-sound-active-toggle'));
    expect(screen.getByTestId('focus-sound-active-toggle').props.accessibilityState.checked).toBe(false);
    expect(mockPause).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3700);
    });
    expect(screen.queryByTestId('focus-pause-button')).toBeNull();
  });

  it('resumes from pause when Resume button is pressed', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        initialPaused={true}
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(screen.getByTestId('focus-paused-overlay')).toBeTruthy();
    fireEvent.press(screen.getByTestId('focus-resume-button'));

    expect(screen.queryByTestId('focus-paused-overlay')).toBeNull();
  });

  it('ends with one End Session press and enters the shared completion path', () => {
    const onComplete = jest.fn();
    const onExit = jest.fn();
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        onExit={onExit}
        onComplete={onComplete}
      />
    );

    expect(screen.queryByTestId('focus-remaining-time')).toBeNull();
    expect(screen.queryByTestId('focus-end-button')).toBeNull();
    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    const endButton = screen.getByTestId('focus-end-button');
    fireEvent.press(endButton);
    fireEvent.press(endButton);

    act(() => {
      jest.advanceTimersByTime(1800);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      plannedDurationSeconds: 30,
      actualDurationSeconds: expect.any(Number),
    }));
    expect(onExit).not.toHaveBeenCalled();
    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'practice_session_ended_early',
      expect.objectContaining({ practice_mode: 'focus' })
    );
  });

  it.each([10, 30, 60])('completes a %s second session at its planned duration', (durationSeconds) => {
    const onComplete = jest.fn();

    let mockTime = 1000;
    const originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn(() => mockTime);

    try {
      render(
        <V2FocusActiveScreen
          anchor={mockAnchor}
          durationSeconds={durationSeconds}
          voice="female"
          ambient={true}
          initialStage="focus"
          onExit={jest.fn()}
          onComplete={onComplete}
        />
      );

      // Advance simulated monotonic time by 30 seconds
      mockTime += durationSeconds * 1000 + 500;

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Resolving sequence holds briefly before the completion view appears.
      act(() => {
        jest.advanceTimersByTime(1900);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          plannedDurationSeconds: durationSeconds,
          actualDurationSeconds: durationSeconds,
        })
      );
      expect(safeHaptics.notification).toHaveBeenCalled();
    } finally {
      global.performance.now = originalPerformanceNow;
    }
  });

  it('pauses session automatically when app moves to background', () => {
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        onExit={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    // Simulate AppState change to background
    act(() => {
      // @ts-ignore - simulate AppState listener
      const listeners = AppState.addEventListener.mock ? AppState.addEventListener.mock.calls : [];
      const changeListener = listeners.find((call: any[]) => call[0] === 'change')?.[1];
      if (changeListener) {
        changeListener('background');
      }
    });

    expect(screen.getByTestId('focus-paused-overlay')).toBeTruthy();
  });
});
