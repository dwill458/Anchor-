import { act, renderHook } from '@testing-library/react-native';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { useDeepPrimeSessionAudio } from '../useDeepPrimeSessionAudio';

const mockCreateSessionAudioPlayer = jest.fn();
const mockTrackAmbientAudioLoadFailed = jest.fn();
const mockTrackGuidedAudioLoadFailed = jest.fn();
const createdPlayers: Array<{
  pause: jest.Mock;
  play: jest.Mock;
  setVolume: jest.Mock;
  stop: jest.Mock;
}> = [];

jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({ createSessionAudioPlayer: mockCreateSessionAudioPlayer }),
}));

jest.mock('@/services/SessionAudioAnalytics', () => ({
  trackAmbientAudioLoadFailed: (...args: unknown[]) => mockTrackAmbientAudioLoadFailed(...args),
  trackGuidedAudioLoadFailed: (...args: unknown[]) => mockTrackGuidedAudioLoadFailed(...args),
}));

const makePlayer = () => {
  const player = {
    pause: jest.fn(),
    play: jest.fn(),
    setVolume: jest.fn(),
    stop: jest.fn(),
  };
  createdPlayers.push(player);
  return player;
};

const plan = resolveSessionAudioPlan({
  sessionType: 'deep_prime',
  durationSeconds: 120,
  configuration: {
    guidanceVoice: 'female',
    backgroundAudio: 'ambient',
    source: 'default',
  },
});

describe('useDeepPrimeSessionAudio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    createdPlayers.length = 0;
    mockCreateSessionAudioPlayer.mockReset().mockImplementation(makePlayer);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('schedules cues from the screen timer and pauses without creating a second timer', () => {
    const { rerender } = renderHook(
      (props) => useDeepPrimeSessionAudio(props),
      {
        initialProps: { plan, remainingMs: 120_000, isActive: false, isComplete: false },
      }
    );

    rerender({ plan, remainingMs: 120_000, isActive: true, isComplete: false });
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(2);
    expect(createdPlayers[0].play).toHaveBeenCalled();
    expect(createdPlayers[1].play).toHaveBeenCalled();

    rerender({ plan, remainingMs: 91_000, isActive: true, isComplete: false });
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(2);
    rerender({ plan, remainingMs: 90_000, isActive: true, isComplete: false });
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(3);

    rerender({ plan, remainingMs: 89_000, isActive: false, isComplete: false });
    expect(createdPlayers[0].pause).toHaveBeenCalled();
    expect(createdPlayers[2].pause).toHaveBeenCalled();
  });

  it('continues the session when a player cannot be created', () => {
    mockCreateSessionAudioPlayer.mockImplementation((_asset, options) => {
      options?.onFailure?.();
      return null;
    });
    expect(() => {
      renderHook(() =>
        useDeepPrimeSessionAudio({
          plan,
          remainingMs: 120_000,
          isActive: true,
          isComplete: false,
        })
      );
    }).not.toThrow();
    expect(mockTrackAmbientAudioLoadFailed).toHaveBeenCalled();
    expect(mockTrackGuidedAudioLoadFailed).toHaveBeenCalled();
  });

  it.each([
    ['none', 'off', 0],
    ['none', 'ambient', 1],
    ['female', 'off', 1],
    ['female', 'ambient', 2],
    ['male', 'off', 1],
    ['male', 'ambient', 2],
  ] as const)('creates the independent voice=%s background=%s layers', (
    guidanceVoice,
    backgroundAudio,
    expectedPlayers
  ) => {
    const combinationPlan = resolveSessionAudioPlan({
      sessionType: 'deep_prime',
      durationSeconds: 120,
      configuration: { guidanceVoice, backgroundAudio, source: 'default' },
    });
    renderHook(() =>
      useDeepPrimeSessionAudio({
        plan: combinationPlan,
        remainingMs: 120_000,
        isActive: true,
        isComplete: false,
      })
    );
    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledTimes(expectedPlayers);
  });

  it('plays loudness-matched male Deep Prime guidance with a distinct track id', () => {
    const malePlan = resolveSessionAudioPlan({
      sessionType: 'deep_prime',
      durationSeconds: 120,
      configuration: {
        guidanceVoice: 'male',
        backgroundAudio: 'off',
        source: 'session_override',
      },
    });

    renderHook(() =>
      useDeepPrimeSessionAudio({
        plan: malePlan,
        remainingMs: 120_000,
        isActive: true,
        isComplete: false,
      })
    );

    expect(mockCreateSessionAudioPlayer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        trackId: 'deep-prime-2m-opening-male',
        volume: 0.46,
      })
    );
  });

  it('stops all session audio on completion', () => {
    const { rerender } = renderHook(
      (props) => useDeepPrimeSessionAudio(props),
      {
        initialProps: { plan, remainingMs: 120_000, isActive: true, isComplete: false },
      }
    );
    rerender({ plan, remainingMs: 0, isActive: false, isComplete: true });
    act(() => jest.advanceTimersByTime(700));
    expect(createdPlayers.some((player) => player.stop.mock.calls.length > 0)).toBe(true);
  });
});
