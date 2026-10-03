import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useGuidedPlayback } from '../guided/useGuidedPlayback';

jest.mock('react-native-reanimated', () => ({
  cancelAnimation: jest.fn(),
  withTiming: (value: number) => value,
  Easing: { linear: 'linear' },
  ReduceMotion: { Never: 'never' },
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { PRACTICE_SESSION_PAUSED: 'paused', PRACTICE_SESSION_RESUMED: 'resumed', PRACTICE_SESSION_ENDED_EARLY: 'ended' },
  AnalyticsService: { track: jest.fn() },
}));

type FakeStatus = { playing: boolean; isBuffering: boolean; didJustFinish: boolean };
const mockFake: { positionSeconds: number; options: null | { onStatus?: (status: FakeStatus) => void; onFinish?: () => void; onFailure?: () => void; volume?: number }; player: Record<string, jest.Mock | (() => boolean)>; fail: boolean } = {
  positionSeconds: 0,
  options: null,
  player: { getCurrentTime: jest.fn((): number => mockFake.positionSeconds), play: jest.fn(), pause: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), isLoaded: () => true, seekTo: jest.fn() },
  fail: false,
};
jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({
    createSessionAudioPlayer: (_asset: unknown, options: typeof mockFake.options) => {
      mockFake.options = options;
      return mockFake.fail ? null : mockFake.player;
    },
  }),
}));

let appStateListener: ((state: string) => void) | null = null;
let wall = 1_000_000;
const setup = (overrides: Partial<Parameters<typeof useGuidedPlayback>[0]> = {}) => {
  const positionSV = { value: 0 };
  const onComplete = jest.fn(() => Promise.resolve());
  const hook = renderHook(() => useGuidedPlayback({ asset: 1, muted: false, durationMs: 64_800, positionSV: positionSV as never,
    onComplete, wallClock: () => wall, ...overrides }));
  return { ...hook, positionSV, onComplete };
};
const tick = (ms = 60) => { act(() => { jest.advanceTimersByTime(ms); }); };
const afterSettle = () => { wall += 700; };
const fake_play = () => { act(() => { mockFake.options?.onStatus?.({ playing: true, isBuffering: false, didJustFinish: false }); }); };
const fake_pos = (seconds: number) => { mockFake.positionSeconds = seconds; };

describe('guided playback: the audio position is the clock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFake.positionSeconds = 0; mockFake.options = null; mockFake.fail = false; wall = 1_000_000;
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: 'change', listener: (state: string) => void) => {
      appStateListener = listener; return { remove: jest.fn() } as never;
    }) as never);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('plays at full volume, or silently when sound is off, because the track is the clock either way', () => {
    setup({ muted: true });
    expect(mockFake.options?.volume).toBe(0);
    const audible = setup({ muted: false });
    expect(mockFake.options?.volume).toBe(1);
    audible.unmount();
  });

  it('mirrors the real playback position into the shared value and the position state', () => {
    const { result, positionSV } = setup();
    act(() => { result.current.start(); });
    expect(mockFake.player.play).toHaveBeenCalledTimes(1);
    mockFake.positionSeconds = 12.4; tick();
    expect(positionSV.value).toBe(12_400);
    expect(result.current.positionMs).toBeCloseTo(12_400, -1);
    expect(result.current.remainingSeconds).toBe(Math.ceil((64_800 - 12_400) / 1000));
  });

  it('freezes on pause and, on resume, shows the state at the real position without replaying what was missed', () => {
    const { result, positionSV } = setup();
    act(() => { result.current.start(); });
    mockFake.positionSeconds = 20; tick();
    act(() => { result.current.pause('user'); });
    expect(result.current.state).toBe('paused');
    expect(mockFake.player.pause).toHaveBeenCalled();
    const frozen = positionSV.value;
    tick(2000);
    expect(positionSV.value).toBe(frozen);
    // The position moved while nobody was looking (a seek, a resumed route); the first frame back is the real one.
    mockFake.positionSeconds = 41.3;
    act(() => { result.current.resume(); });
    expect(result.current.state).toBe('running');
    expect(positionSV.value).toBe(41_300);
    expect(result.current.positionMs).toBe(41_300);
  });

  it('snaps rather than gliding across a large jump in position', () => {
    const { result, positionSV } = setup();
    act(() => { result.current.start(); });
    mockFake.positionSeconds = 5; tick();
    mockFake.positionSeconds = 30; tick();
    expect(positionSV.value).toBe(30_000);
  });

  it('pauses when the app leaves the foreground and resyncs to the audio position on return', () => {
    const { result, positionSV } = setup();
    act(() => { result.current.start(); });
    mockFake.positionSeconds = 33; tick();
    act(() => { appStateListener?.('background'); });
    expect(result.current.state).toBe('paused');
    mockFake.positionSeconds = 61;
    act(() => { appStateListener?.('active'); });
    expect(positionSV.value).toBe(61_000);
    expect(result.current.state).toBe('paused');
  });

  it('treats playback that stops unasked (a call, a route change) as a pause on the frame the audio is at', () => {
    const { result } = setup();
    act(() => { result.current.start(); });
    afterSettle();
    act(() => { mockFake.options?.onStatus?.({ playing: true, isBuffering: false, didJustFinish: false }); });
    mockFake.positionSeconds = 17.5; tick();
    act(() => { mockFake.options?.onStatus?.({ playing: false, isBuffering: false, didJustFinish: false }); });
    expect(result.current.state).toBe('paused');
    expect(result.current.positionMs).toBe(17_500);
  });

  it('does not mistake buffering, or a stale status right after starting, for an interruption', () => {
    const { result } = setup();
    act(() => { result.current.start(); });
    act(() => { mockFake.options?.onStatus?.({ playing: true, isBuffering: false, didJustFinish: false }); });
    act(() => { mockFake.options?.onStatus?.({ playing: false, isBuffering: false, didJustFinish: false }); });
    expect(result.current.state).toBe('running');
    afterSettle();
    act(() => { mockFake.options?.onStatus?.({ playing: false, isBuffering: true, didJustFinish: false }); });
    expect(result.current.state).toBe('running');
  });

  it('keeps the narration paused under the Paused state when the platform restarts it on its own', () => {
    const { result } = setup();
    act(() => { result.current.start(); });
    afterSettle();
    fake_play();
    fake_pos(22); tick();
    act(() => { appStateListener?.('background'); });
    expect(result.current.state).toBe('paused');
    (mockFake.player.pause as jest.Mock).mockClear();
    // The platform resumes the player when the app returns, and reports it playing again.
    act(() => { appStateListener?.('active'); });
    expect(mockFake.player.pause as jest.Mock).toHaveBeenCalledTimes(1);
    (mockFake.player.pause as jest.Mock).mockClear();
    act(() => { mockFake.options?.onStatus?.({ playing: true, isBuffering: false, didJustFinish: false }); });
    expect(mockFake.player.pause as jest.Mock).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('paused');
    expect(result.current.positionMs).toBe(22_000);
  });

  it('completes from the track actually finishing, exactly once, with real wall-clock timing', async () => {
    const { result, onComplete } = setup();
    act(() => { result.current.start(); });
    wall += 65_000;
    mockFake.positionSeconds = 64.8;
    act(() => { mockFake.options?.onFinish?.(); });
    act(() => { mockFake.options?.onStatus?.({ playing: false, isBuffering: false, didJustFinish: true }); });
    tick();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.state).toBe('completing');
    expect(onComplete).toHaveBeenCalledTimes(1);
    const timing = (onComplete.mock.calls[0] as unknown as [{ startedAt: string; completedAt: string }])[0];
    expect(new Date(timing.completedAt).getTime() - new Date(timing.startedAt).getTime()).toBe(65_000);
    act(() => { result.current.markCompleted(); });
    expect(result.current.state).toBe('completed');
  });

  it('never completes before the audio reaches its end', () => {
    const { result, onComplete } = setup();
    act(() => { result.current.start(); });
    mockFake.positionSeconds = 40; tick(500);
    expect(result.current.state).toBe('running');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('ends early without pretending the session finished', async () => {
    const { result, onComplete } = setup();
    act(() => { result.current.start(); });
    mockFake.positionSeconds = 22; tick();
    let ended: Promise<void> = Promise.resolve();
    act(() => { ended = result.current.endEarly(); });
    await act(async () => { await jest.advanceTimersByTimeAsync(400); await ended; });
    expect(result.current.state).toBe('ended_early');
    expect(mockFake.player.stop).toHaveBeenCalled();
    act(() => { mockFake.options?.onFinish?.(); });
    tick(500);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.state).toBe('ended_early');
  });

  it('reports a failed state when the player cannot be created or fails to load', () => {
    mockFake.fail = true;
    const unavailable = setup();
    expect(unavailable.result.current.state).toBe('failed');
    mockFake.fail = false;
    const loaded = setup();
    act(() => { mockFake.options?.onFailure?.(); });
    expect(loaded.result.current.state).toBe('failed');
  });
});
