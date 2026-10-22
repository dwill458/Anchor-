import { createAudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '../SoundPool';

it('fades a looping bed from silence and cancels the fade when effects are disabled', async () => {
  jest.useFakeTimers();
  const original = useSettingsStore.getState().soundEffectsEnabled;
  const player = { addListener: jest.fn(() => ({ remove: jest.fn() })), isLoaded: true, pause: jest.fn(), play: jest.fn(), remove: jest.fn(),
    seekTo: jest.fn(async () => undefined), setPlaybackRate: jest.fn(), volume: 1, loop: false, shouldCorrectPitch: false };
  try {
    SoundPool.reset(); useSettingsStore.setState({ soundEffectsEnabled: true });
    jest.mocked(createAudioPlayer).mockReturnValue(player as never); SoundPool.register('test:ceremony-fade', 1);
    SoundPool.play('test:ceremony-fade', { volume: .18, loop: true, fadeInMs: 2500 }); await Promise.resolve();
    expect(player.volume).toBe(0); expect(player.loop).toBe(true); expect(player.play).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1250); expect(player.volume).toBeGreaterThan(.08); expect(player.volume).toBeLessThan(.1);
    useSettingsStore.setState({ soundEffectsEnabled: false }); const stoppedVolume = player.volume;
    jest.advanceTimersByTime(2500); expect(player.volume).toBe(stoppedVolume); expect(player.pause).toHaveBeenCalledTimes(1);
  } finally { SoundPool.reset(); useSettingsStore.setState({ soundEffectsEnabled: original }); jest.useRealTimers(); }
});
