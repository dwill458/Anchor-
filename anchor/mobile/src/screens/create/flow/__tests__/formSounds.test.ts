import { playCreationSound } from '@/services/CreationSounds';
import { useSettingsStore } from '@/stores/settingsStore';
import { SoundPool } from '@/services/audio/SoundPool';

const mockStop = jest.fn();
jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: {
    play: jest.fn(() => {
      const settings = require('@/stores/settingsStore').useSettingsStore;
      return settings.getState().soundEffectsEnabled ? { stop: mockStop } : null;
    }),
    prewarm: jest.fn(),
  },
}));

describe('Form sound settings', () => {
  const original = useSettingsStore.getState().soundEffectsEnabled;
  afterEach(() => { useSettingsStore.setState({ soundEffectsEnabled: original }); jest.clearAllMocks(); });

  it('does not create either voice when sound effects are off', () => {
    useSettingsStore.setState({ soundEffectsEnabled: false });
    expect(playCreationSound('formTick')).toBeNull();
    expect(playCreationSound('formSettle')).toBeNull();
    expect(SoundPool.play).toHaveBeenCalledTimes(2);
  });

  it('uses the specified quiet defaults and releases each one-shot on stop', () => {
    useSettingsStore.setState({ soundEffectsEnabled: true });
    for (const [key, volume] of [['formTick', 0.30], ['formSettle', 0.35]] as const) {
      const handle = playCreationSound(key);
      const poolCall = jest.mocked(SoundPool.play).mock.calls.at(-1)!;
      expect(poolCall[0]).toBe(`creation:${key}`);
      expect(poolCall[1]).toEqual({ volume });
      handle!.stop(); handle!.stop();
      expect(mockStop).toHaveBeenCalledTimes(2);
      mockStop.mockClear();
    }
  });
});
