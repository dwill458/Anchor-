import { act, renderHook } from '@testing-library/react-native';

import {
  resolveSessionAudioPlan,
  VISUALIZE_VOICE_PLAYBACK_GAIN,
} from '@/services/SessionAudioManifest';
import { VISUALIZE_AUDIO_MANIFEST } from '@/services/visualizeAudioManifest';
import { useVisualizeSessionAudio } from '../useVisualizeSessionAudio';

const mockCreateSessionAudioPlayer = jest.fn();
const mockTrackAmbientAudioLoadFailed = jest.fn();
const mockTrackGuidedAudioLoadFailed = jest.fn();
const createdPlayers: Array<{
  getCurrentTime: jest.Mock;
  isLoaded: jest.Mock;
  pause: jest.Mock;
  play: jest.Mock;
  seekTo: jest.Mock;
  setVolume: jest.Mock;
  stop: jest.Mock;
  options: Record<string, any>;
}> = [];

jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({ createSessionAudioPlayer: mockCreateSessionAudioPlayer }),
}));

jest.mock('@/services/SessionAudioAnalytics', () => ({
  trackAmbientAudioLoadFailed: (...args: unknown[]) => mockTrackAmbientAudioLoadFailed(...args),
  trackGuidedAudioLoadFailed: (...args: unknown[]) => mockTrackGuidedAudioLoadFailed(...args),
}));

const makePlayer = (_asset: unknown, options: Record<string, any> = {}) => {
  const player = {
    getCurrentTime: jest.fn(() => 0),
    isLoaded: jest.fn(() => true),
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setVolume: jest.fn(),
    stop: jest.fn(),
    options,
  };
  createdPlayers.push(player);
  return player;
};

const manifest = VISUALIZE_AUDIO_MANIFEST[60];
const onInterruption = jest.fn();
const makePlan = (guidanceVoice: 'female' | 'male' | 'none', backgroundAudio: 'ambient' | 'off') =>
  resolveSessionAudioPlan({
    sessionType: 'visualize',
    durationSeconds: 60,
    configuration: { guidanceVoice, backgroundAudio, source: 'session_override' },
  });

describe('useVisualizeSessionAudio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    createdPlayers.length = 0;
    mockCreateSessionAudioPlayer.mockReset().mockImplementation(makePlayer);
    mockTrackAmbientAudioLoadFailed.mockReset();
    mockTrackGuidedAudioLoadFailed.mockReset();
    onInterruption.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it.each([
    ['none', 'off', 0],
    ['none', 'ambient', 1],
    ['female', 'off', 1],
    ['female', 'ambient', 2],
    ['male', 'off', 1],
    ['male', 'ambient', 2],
  ] as const)('preloads only the selected voice=%s background=%s layers', (voice, background, expected) => {
    renderHook(() => useVisualizeSessionAudio({
      plan: makePlan(voice, background),
      manifest,
      elapsedMs: 0,
      isActive: false,
      isComplete: false,
      onInterruption,
    }));
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(expected);
  });

  it.each(['female', 'male'] as const)('starts %s guidance at the reduced voice gain', voice => {
    renderHook(() => useVisualizeSessionAudio({
      plan: makePlan(voice, 'off'),
      manifest,
      elapsedMs: 0,
      isActive: false,
      isComplete: false,
      onInterruption,
    }));

    expect(createdPlayers).toHaveLength(1);
    expect(createdPlayers[0].options.volume).toBe(VISUALIZE_VOICE_PLAYBACK_GAIN);
  });

  it('uses canonical elapsed time, preserves active cue state, and does not replay handled cues', () => {
    const plan = makePlan('female', 'ambient');
    const { rerender } = renderHook(
      props => useVisualizeSessionAudio(props),
      { initialProps: { plan, manifest, elapsedMs: 0, isActive: false, isComplete: false, onInterruption } },
    );
    expect(createdPlayers).toHaveLength(2); // ambient + first cue preloaded

    rerender({ plan, manifest, elapsedMs: 0, isActive: true, isComplete: false, onInterruption });
    expect(createdPlayers[0].play).toHaveBeenCalledTimes(1);
    rerender({ plan, manifest, elapsedMs: 1_000, isActive: true, isComplete: false, onInterruption });
    expect(createdPlayers[1].play).toHaveBeenCalledTimes(1);
    expect(createdPlayers).toHaveLength(3); // next cue progressively preloaded

    rerender({ plan, manifest, elapsedMs: 1_500, isActive: false, isComplete: false, onInterruption });
    expect(createdPlayers[0].pause).toHaveBeenCalled();
    expect(createdPlayers[1].pause).toHaveBeenCalled();
    rerender({ plan, manifest, elapsedMs: 1_500, isActive: true, isComplete: false, onInterruption });
    expect(createdPlayers[0].seekTo).toHaveBeenCalledWith(1.5);
    expect(createdPlayers[1].play).toHaveBeenCalledTimes(2); // resume, not replay from zero

    act(() => createdPlayers[1].options.onFinish());
    rerender({ plan, manifest, elapsedMs: 5_000, isActive: true, isComplete: false, onInterruption });
    expect(createdPlayers[2].play).toHaveBeenCalledTimes(1);
    expect(createdPlayers[1].play).toHaveBeenCalledTimes(2);
  });

  it('cleans up on completion and confirmed early exit', async () => {
    const plan = makePlan('female', 'ambient');
    const { result, rerender } = renderHook(
      props => useVisualizeSessionAudio(props),
      { initialProps: { plan, manifest, elapsedMs: 1_000, isActive: true, isComplete: false, onInterruption } },
    );
    rerender({ plan, manifest, elapsedMs: 60_000, isActive: false, isComplete: true, onInterruption });
    expect(createdPlayers.some(player => player.stop.mock.calls.length > 0)).toBe(true);

    const second = renderHook(() => useVisualizeSessionAudio({
      plan,
      manifest,
      elapsedMs: 2_000,
      isActive: true,
      isComplete: false,
      onInterruption,
    }));
    let cleanup!: Promise<void>;
    act(() => {
      cleanup = second.result.current.fadeOutAndStop();
      jest.advanceTimersByTime(400);
    });
    await act(async () => cleanup);
    expect(createdPlayers.some(player => player.stop.mock.calls.length > 0)).toBe(true);
  });

  it('keeps ambient ducked when pausing and resuming during an active cue', () => {
    const plan = makePlan('female', 'ambient');
    const { rerender } = renderHook(
      props => useVisualizeSessionAudio(props),
      { initialProps: { plan, manifest, elapsedMs: 1_000, isActive: true, isComplete: false, onInterruption } },
    );
    const ambient = createdPlayers[0];

    act(() => jest.advanceTimersByTime(200));
    expect(ambient.setVolume).toHaveBeenLastCalledWith(0.21);

    rerender({ plan, manifest, elapsedMs: 1_500, isActive: false, isComplete: false, onInterruption });
    rerender({ plan, manifest, elapsedMs: 1_500, isActive: true, isComplete: false, onInterruption });

    expect(ambient.setVolume).toHaveBeenLastCalledWith(0.21);
  });

  it('coalesces repeated early-exit stops and opens a new session with fresh players', async () => {
    const plan = makePlan('female', 'ambient');
    const firstSession = renderHook(() => useVisualizeSessionAudio({
      plan,
      manifest,
      elapsedMs: 2_000,
      isActive: true,
      isComplete: false,
      onInterruption,
    }));
    const firstSessionPlayers = [...createdPlayers];
    let firstStop!: Promise<void>;
    let secondStop!: Promise<void>;

    act(() => {
      firstStop = firstSession.result.current.fadeOutAndStop();
      secondStop = firstSession.result.current.fadeOutAndStop();
    });
    expect(secondStop).toBe(firstStop);
    act(() => jest.advanceTimersByTime(400));
    await act(async () => Promise.all([firstStop, secondStop]));
    expect(firstSessionPlayers[0].stop).toHaveBeenCalledTimes(1);
    firstSession.unmount();

    const playerCountBeforeReopen = createdPlayers.length;
    renderHook(() => useVisualizeSessionAudio({
      plan,
      manifest,
      elapsedMs: 0,
      isActive: true,
      isComplete: false,
      onInterruption,
    }));
    const reopenedPlayers = createdPlayers.slice(playerCountBeforeReopen);

    expect(reopenedPlayers).toHaveLength(2);
    expect(reopenedPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(firstSessionPlayers[0].play).toHaveBeenCalledTimes(1);
  });

  it('settles an early-exit stop if unmount interrupts its fade', async () => {
    const plan = makePlan('none', 'ambient');
    const session = renderHook(() => useVisualizeSessionAudio({
      plan,
      manifest,
      elapsedMs: 2_000,
      isActive: true,
      isComplete: false,
      onInterruption,
    }));
    let stop!: Promise<void>;

    act(() => {
      stop = session.result.current.fadeOutAndStop();
      session.unmount();
    });

    await expect(stop).resolves.toBeUndefined();
    expect(createdPlayers[0].stop).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when a clip cannot be created', () => {
    const plan = makePlan('female', 'ambient');
    mockCreateSessionAudioPlayer.mockImplementation((_asset, options) => {
      options?.onFailure?.();
      return null;
    });
    expect(() => renderHook(() => useVisualizeSessionAudio({
      plan,
      manifest,
      elapsedMs: 1_000,
      isActive: true,
      isComplete: false,
      onInterruption,
    }))).not.toThrow();
    expect(mockTrackAmbientAudioLoadFailed).toHaveBeenCalled();
    expect(mockTrackGuidedAudioLoadFailed).toHaveBeenCalled();
  });
});
