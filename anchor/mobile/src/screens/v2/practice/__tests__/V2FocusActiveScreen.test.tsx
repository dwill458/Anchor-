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
const mockSetVolume = jest.fn();
let mockPlaybackOverride: number | null = null;
const mockCreateSessionAudioPlayer = jest.fn((_asset: unknown, _options: { onFinish?: () => void; onFailure?: () => void }) => {
  let playingSince: number | null = null;
  let position = 0;
  return {
  play: () => { mockPlay(); if (playingSince == null) playingSince = performance.now(); },
  pause: () => { mockPause(); if (playingSince != null) position += (performance.now() - playingSince) / 1000; playingSince = null; },
  stop: () => { mockStop(); playingSince = null; },
  seekTo: jest.fn().mockResolvedValue(undefined),
  setVolume: mockSetVolume,
  isLoaded: jest.fn().mockReturnValue(true),
  getCurrentTime: () => mockPlaybackOverride ?? position + (playingSince == null ? 0 : (performance.now() - playingSince) / 1000),
}; });

jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({
    createSessionAudioPlayer: mockCreateSessionAudioPlayer,
    cleanupAllPlayers: jest.fn(),
  }),
}));
jest.mock('@/services/audio/practiceCompletionCue', () => ({ playPracticeCompletionCue: jest.fn() }));

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
    mockPlaybackOverride = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not consume a short Focus session while the mix buffers and keeps its intended silent tail', () => {
    mockPlaybackOverride = 0;
    const onComplete = jest.fn();
    render(<V2FocusActiveScreen anchor={mockAnchor} durationSeconds={10} voice="female" ambient initialStage="focus"
      onExit={jest.fn()} onComplete={onComplete} />);
    act(() => jest.advanceTimersByTime(22_000));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('Well done.')).toBeNull();
    mockPlaybackOverride = 9.5;
    act(() => jest.advanceTimersByTime(250));
    const finished = mockCreateSessionAudioPlayer.mock.calls[0][1].onFinish;
    if (!finished) throw new Error('Focus full mix did not register completion');
    act(() => finished());
    act(() => jest.advanceTimersByTime(499));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2_601));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ actualDurationSeconds: 10 }));
  });

  it('holds a failed guidance stream until retry succeeds', () => {
    mockPlaybackOverride = 0;
    const onComplete = jest.fn();
    render(<V2FocusActiveScreen anchor={mockAnchor} durationSeconds={10} voice="female" ambient
      initialStage="focus" onExit={jest.fn()} onComplete={onComplete} />);
    act(() => jest.advanceTimersByTime(250));
    const failure = mockCreateSessionAudioPlayer.mock.calls[0][1].onFailure;
    if (!failure) throw new Error('Missing guidance failure handler');
    act(() => failure());
    act(() => jest.advanceTimersByTime(30_000));
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Retry guidance'), { stopPropagation: jest.fn() });
    act(() => jest.advanceTimersByTime(250));
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Retry guidance')).toBeNull();
    mockPlaybackOverride = 10;
    act(() => jest.advanceTimersByTime(2_750));
    expect(onComplete).toHaveBeenCalledTimes(1);
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

    // The finished mix (voice + bed in one file) starts on the first clock tick.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    fireEvent.press(screen.getByTestId('focus-sound-active-toggle'));
    expect(screen.getByTestId('focus-sound-active-toggle').props.accessibilityState.checked).toBe(false);
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockSetVolume).toHaveBeenCalledWith(0);

    act(() => {
      jest.advanceTimersByTime(3700);
    });
    expect(screen.queryByTestId('focus-pause-button')).toBeNull();
  });

  it('advances modular voice cues while muted and unmutes the current closing cue', () => {
    render(<V2FocusActiveScreen anchor={mockAnchor} durationSeconds={30} voice="soothing" ambient
      initialStage="focus" onExit={jest.fn()} onComplete={jest.fn()} />);
    act(() => jest.advanceTimersByTime(1_000));
    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    fireEvent.press(screen.getByTestId('focus-sound-active-toggle'));
    act(() => jest.advanceTimersByTime(22_250));
    const cueCount = mockCreateSessionAudioPlayer.mock.calls.length;
    expect(mockCreateSessionAudioPlayer.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({ volume: 0 }));
    fireEvent.press(screen.getByTestId('v2-focus-active-screen'));
    fireEvent.press(screen.getByTestId('focus-sound-active-toggle'));
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(cueCount);
    expect(mockSetVolume).toHaveBeenLastCalledWith(0.305);
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

  it('ends early when End Session is pressed and exits without completing', () => {
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

    expect(onComplete).not.toHaveBeenCalled();
    expect(jest.requireMock('@/services/audio/practiceCompletionCue').playPracticeCompletionCue).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'practice_session_ended_early',
      expect.objectContaining({ practice_mode: 'focus' })
    );
  });

  it('ends early from paused overlay when End Focus is pressed and exits without completing', () => {
    const onComplete = jest.fn();
    const onExit = jest.fn();
    render(
      <V2FocusActiveScreen
        anchor={mockAnchor}
        durationSeconds={30}
        voice="female"
        ambient={true}
        initialStage="focus"
        initialPaused={true}
        onExit={onExit}
        onComplete={onComplete}
      />
    );

    const endButton = screen.getByTestId('focus-paused-end-button');
    fireEvent.press(endButton);

    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'practice_session_ended_early',
      expect.objectContaining({ practice_mode: 'focus' })
    );
  });

  it.each([10, 30, 60])('completes a %s second session at its planned duration', async (durationSeconds) => {
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

      // Completion follows the native mix position, even if wall time differs.
      mockPlaybackOverride = durationSeconds;
      mockTime += durationSeconds * 1000 + 500;

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Resolving sequence holds briefly before the completion view appears.
      act(() => {
        jest.advanceTimersByTime(2300);
      });
      await act(async () => { await jest.advanceTimersByTimeAsync(3000); });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          plannedDurationSeconds: durationSeconds,
          actualDurationSeconds: durationSeconds,
        })
      );
      expect(safeHaptics.notification).toHaveBeenCalled();
      expect(jest.requireMock('@/services/audio/practiceCompletionCue').playPracticeCompletionCue).toHaveBeenCalledTimes(1);
      expect(jest.requireMock('@/services/audio/practiceCompletionCue').playPracticeCompletionCue).toHaveBeenCalledWith(true);
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
      // Every mounted 'change' subscriber (the screen and the Anchor aura) hears the transition.
      listeners.filter((call: any[]) => call[0] === 'change').forEach((call: any[]) => call[1]('background'));
    });

    expect(screen.getByTestId('focus-paused-overlay')).toBeTruthy();
  });

  it('does not play the completion cue or haptic when unmounted inside their windows', () => {
    let mockTime = 1000;
    const originalPerformanceNow = global.performance.now;
    global.performance.now = jest.fn(() => mockTime);

    try {
      const view = render(
        <V2FocusActiveScreen
          anchor={mockAnchor}
          durationSeconds={10}
          voice="female"
          ambient={true}
          initialStage="focus"
          onExit={jest.fn()}
          onComplete={jest.fn()}
        />
      );

      // The next clock tick sees the full duration and begins the ending.
      mockTime += 10500;
      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Unmount before the 240ms haptic and the 300ms cue have fired.
      act(() => {
        jest.advanceTimersByTime(100);
      });
      view.unmount();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(safeHaptics.notification).not.toHaveBeenCalled();
      expect(jest.requireMock('@/services/audio/practiceCompletionCue').playPracticeCompletionCue).not.toHaveBeenCalled();
    } finally {
      global.performance.now = originalPerformanceNow;
    }
  });
});
