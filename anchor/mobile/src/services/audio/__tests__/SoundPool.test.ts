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
