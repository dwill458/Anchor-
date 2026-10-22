import { createAudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '../SoundPool';

it('does not create or prewarm an effect player when effects are disabled', () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  useSettingsStore.setState({ soundEffectsEnabled: false });
  jest.mocked(createAudioPlayer).mockClear();

  SoundPool.prewarm(['chart-open']);
  expect(SoundPool.play('chart-open')).toBeNull();
  expect(createAudioPlayer).not.toHaveBeenCalled();

  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('stops an active pooled effect when effects are switched off', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  const player = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:active-effect', 1);
  SoundPool.play('test:active-effect');
  await Promise.resolve();

  useSettingsStore.setState({ soundEffectsEnabled: false });
  expect(player.pause).toHaveBeenCalledTimes(1);
  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('loops a pooled bed and fades its handle before stopping', async () => {
  jest.useFakeTimers();
  const original = useSettingsStore.getState().soundEffectsEnabled;
  const player = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    loop: false,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:form-bed', 1);

  const handle = SoundPool.play('test:form-bed', { volume: 0.12, loop: true });
  await Promise.resolve();
  expect(player.loop).toBe(true);
  expect(player.play).toHaveBeenCalledTimes(1);

  handle?.stop(300);
  jest.advanceTimersByTime(160);
  expect(player.volume).toBeGreaterThan(0);
  expect(player.volume).toBeLessThan(0.12);
  jest.advanceTimersByTime(160);
  expect(player.volume).toBe(0);
  expect(player.pause).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('waits for an unloaded player and plays when its status listener reports loaded', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  let loaded = false;
  const statusListeners: Array<(status: { isLoaded: boolean; didJustFinish?: boolean }) => void> = [];
  const player = {
    addListener: jest.fn((_event: string, listener: (status: { isLoaded: boolean; didJustFinish?: boolean }) => void) => {
      statusListeners.push(listener);
      return { remove: jest.fn() };
    }),
    get isLoaded() { return loaded; },
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:wait-for-load', 1);

  SoundPool.play('test:wait-for-load');
  await Promise.resolve();
  expect(player.play).not.toHaveBeenCalled();

  loaded = true;
  statusListeners[0]({ isLoaded: true });
  await Promise.resolve();
  await Promise.resolve();

  expect(player.play).toHaveBeenCalledTimes(1);
  expect(player.setPlaybackRate).not.toHaveBeenCalled();
  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('plays even when seeking to the start rejects', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  const player = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.reject(new Error('seek unavailable'))),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:seek-rejects', 1);

  SoundPool.play('test:seek-rejects');
  await Promise.resolve();
  await Promise.resolve();

  expect(player.play).toHaveBeenCalledTimes(1);
  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('still plays when setting a non-default rate throws', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  const player = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(() => { throw new Error('rate unavailable'); }),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:rate-rejects', 1);

  SoundPool.play('test:rate-rejects', { rate: 1.25 });
  await Promise.resolve();
  await Promise.resolve();

  expect(player.setPlaybackRate).toHaveBeenCalledWith(1.25);
  expect(player.play).toHaveBeenCalledTimes(1);
  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('does not treat isLoaded alone as loaded when playbackState is buffering, but resolves on ready', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  let loaded = false;
  const statusListeners: Array<(status: { isLoaded?: boolean; playbackState?: string; didJustFinish?: boolean }) => void> = [];
  const player = {
    addListener: jest.fn((_event: string, listener: (status: { isLoaded?: boolean; playbackState?: string; didJustFinish?: boolean }) => void) => {
      statusListeners.push(listener);
      return { remove: jest.fn() };
    }),
    get isLoaded() { return loaded; },
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:untruthful-loaded', 1);

  SoundPool.play('test:untruthful-loaded');
  await Promise.resolve();
  expect(player.play).not.toHaveBeenCalled();

  // Status with isLoaded: true but playbackState: 'buffering' must NOT trigger playback
  statusListeners[0]({ isLoaded: true, playbackState: 'buffering' });
  await Promise.resolve();
  await Promise.resolve();
  expect(player.play).not.toHaveBeenCalled();

  // Truthful status with playbackState: 'ready' must trigger playback
  statusListeners[0]({ playbackState: 'ready' });
  await Promise.resolve();
  await Promise.resolve();
  expect(player.play).toHaveBeenCalledTimes(1);

  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('treats didJustFinish as loaded', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  let loaded = false;
  const statusListeners: Array<(status: { isLoaded?: boolean; playbackState?: string; didJustFinish?: boolean }) => void> = [];
  const player = {
    addListener: jest.fn((_event: string, listener: (status: { isLoaded?: boolean; playbackState?: string; didJustFinish?: boolean }) => void) => {
      statusListeners.push(listener);
      return { remove: jest.fn() };
    }),
    get isLoaded() { return loaded; },
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };
  useSettingsStore.setState({ soundEffectsEnabled: true });
  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:ended-reusable', 1);

  SoundPool.play('test:ended-reusable');
  await Promise.resolve();
  expect(player.play).not.toHaveBeenCalled();

  statusListeners[0]({ didJustFinish: true });
  await Promise.resolve();
  await Promise.resolve();
  expect(player.play).toHaveBeenCalledTimes(1);

  useSettingsStore.setState({ soundEffectsEnabled: original });
});

it('caps live players at the configured MAX_LIVE_PLAYERS limit', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  useSettingsStore.setState({ soundEffectsEnabled: true });
  SoundPool.reset();

  const makePlayer = () => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  });

  jest.mocked(createAudioPlayer).mockImplementation(makePlayer as never);

  for (let i = 0; i < 30; i++) {
    SoundPool.register(`test:cap-${i}`, i);
    SoundPool.prewarm([`test:cap-${i}`]);
  }

  const { MAX_LIVE_PLAYERS, countLivePlayers } = require('../SoundPool');
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(MAX_LIVE_PLAYERS).toBe(24);
  expect(countLivePlayers()).toBe(MAX_LIVE_PLAYERS);

  useSettingsStore.setState({ soundEffectsEnabled: original });
  SoundPool.reset();
});

it('releaseIdle disposes idle players for specified keys', () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  useSettingsStore.setState({ soundEffectsEnabled: true });
  SoundPool.reset();

  const player = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    release: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };

  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:release-target', 1);
  SoundPool.prewarm(['test:release-target']);

  const { countLivePlayers } = require('../SoundPool');
  expect(countLivePlayers()).toBe(1);

  SoundPool.releaseIdle(['test:release-target']);
  expect(player.remove).toHaveBeenCalled();
  expect(player.release).toHaveBeenCalled();
  expect(countLivePlayers()).toBe(0);

  useSettingsStore.setState({ soundEffectsEnabled: original });
  SoundPool.reset();
});

it('discards and releases an entry if playbackState transitions to idle after playback starts', async () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  useSettingsStore.setState({ soundEffectsEnabled: true });
  SoundPool.reset();

  const statusListeners: Array<(status: { playbackState?: string; didJustFinish?: boolean }) => void> = [];
  const player = {
    addListener: jest.fn((_event: string, listener: (status: { playbackState?: string; didJustFinish?: boolean }) => void) => {
      statusListeners.push(listener);
      return { remove: jest.fn() };
    }),
    isLoaded: true,
    pause: jest.fn(),
    play: jest.fn(),
    release: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    volume: 1,
    shouldCorrectPitch: false,
  };

  jest.mocked(createAudioPlayer).mockReturnValue(player as never);
  SoundPool.register('test:idle-error', 1);
  SoundPool.play('test:idle-error');
  await Promise.resolve();
  await Promise.resolve();

  expect(player.play).toHaveBeenCalledTimes(1);
  statusListeners[0]({ playbackState: 'idle' });

  const { countLivePlayers } = require('../SoundPool');
  expect(player.remove).toHaveBeenCalledTimes(1);
  expect(player.release).toHaveBeenCalledTimes(1);
  expect(countLivePlayers()).toBe(0);

  useSettingsStore.setState({ soundEffectsEnabled: original });
  SoundPool.reset();
});

it('on load-timeout discards timed-out entry, releases non-current idle keys, and retries once', async () => {
  jest.useFakeTimers();
  const originalDebug = process.env.EXPO_PUBLIC_SFX_DEBUG;
  process.env.EXPO_PUBLIC_SFX_DEBUG = '1';
  const original = useSettingsStore.getState().soundEffectsEnabled;
  useSettingsStore.setState({ soundEffectsEnabled: true });
  SoundPool.reset();

  const createdPlayers: Array<{
    addListener: jest.Mock;
    isLoaded: boolean;
    pause: jest.Mock;
    play: jest.Mock;
    release: jest.Mock;
    remove: jest.Mock;
    seekTo: jest.Mock;
    setPlaybackRate: jest.Mock;
    volume: number;
    shouldCorrectPitch: boolean;
  }> = [];

  jest.mocked(createAudioPlayer).mockImplementation(() => {
    const isFirst = createdPlayers.length === 0;
    const p = {
      addListener: jest.fn((_e: string, listener: (s: { playbackState: string }) => void) => {
        // Second player loads immediately as ready
        if (!isFirst) {
          setTimeout(() => listener({ playbackState: 'ready' }), 10);
        }
        return { remove: jest.fn() };
      }),
      isLoaded: !isFirst,
      pause: jest.fn(),
      play: jest.fn(),
      release: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      setPlaybackRate: jest.fn(),
      volume: 1,
      shouldCorrectPitch: false,
    };
    createdPlayers.push(p);
    return p as never;
  });

  SoundPool.register('test:timeout-retry', 1);
  SoundPool.play('test:timeout-retry');

  // Advance time past the 1500ms timeout
  await jest.advanceTimersByTimeAsync(1600);

  // First player should have timed out and been discarded via remove() and release()
  expect(createdPlayers[0].remove).toHaveBeenCalled();
  expect(createdPlayers[0].release).toHaveBeenCalled();
  // Second player should have been created on retry
  expect(createdPlayers.length).toBe(2);
  expect(createdPlayers[1].play).toHaveBeenCalledTimes(1);

  const { getSfxLog } = require('../sfxLog');
  const logLines = getSfxLog();
  const retryLog = logLines.find((line: string) => line.includes('retry=1'));
  expect(retryLog).toBeDefined();

  if (originalDebug === undefined) delete process.env.EXPO_PUBLIC_SFX_DEBUG;
  else process.env.EXPO_PUBLIC_SFX_DEBUG = originalDebug;
  useSettingsStore.setState({ soundEffectsEnabled: original });
  jest.useRealTimers();
  SoundPool.reset();
});
