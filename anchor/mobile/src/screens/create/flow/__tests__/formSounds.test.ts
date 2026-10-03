import { createAudioPlayer } from 'expo-audio';
import { playCreationSound } from '@/services/CreationSounds';
import { useSettingsStore } from '@/stores/settingsStore';

describe('Form sound settings', () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  afterEach(() => { useSettingsStore.setState({ soundEffectsEnabled: original }); jest.clearAllMocks(); });

  it('does not create either voice when sound effects are off', () => {
    useSettingsStore.setState({ soundEffectsEnabled: false });
    expect(playCreationSound('formTick')).toBeNull();
    expect(playCreationSound('formSettle')).toBeNull();
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('uses the specified quiet defaults and releases each one-shot on stop', () => {
    useSettingsStore.setState({ soundEffectsEnabled: true });
    for (const [key, volume] of [['formTick', 0.30], ['formSettle', 0.35]] as const) {
      const handle = playCreationSound(key);
      const results = (createAudioPlayer as jest.Mock).mock.results;
      const player = results[results.length - 1].value;
      expect(player.volume).toBe(volume);
      expect(player.play).toHaveBeenCalledTimes(1);
      handle!.stop(); handle!.stop();
      expect(player.pause).toHaveBeenCalledTimes(1);
      expect(player.remove).toHaveBeenCalledTimes(1);
    }
  });
});
