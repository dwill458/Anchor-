import { NodeToneService } from '../NodeToneService';
import { SoundPool } from '../audio/SoundPool';
import { useSettingsStore } from '@/stores/settingsStore';

jest.mock('../audio/SoundPool', () => ({
  SoundPool: {
    register: jest.fn(),
    prewarm: jest.fn(),
    releaseIdle: jest.fn(),
    play: jest.fn(),
  },
}));

describe('NodeToneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ soundEffectsEnabled: true });
  });

  it('prepares scale tones and prewarms them in SoundPool', async () => {
    await NodeToneService.prepare([1, 2, 3]);

    expect(SoundPool.register).toHaveBeenCalled();
    expect(SoundPool.prewarm).toHaveBeenCalled();
    const prewarmedKeys = jest.mocked(SoundPool.prewarm).mock.calls[0][0];
    expect(prewarmedKeys.length).toBeGreaterThan(0);
    expect(prewarmedKeys.every((k: string) => k.startsWith('node:'))).toBe(true);
  });

  it('plays mapped tones using SoundPool', async () => {
    await NodeToneService.prepare([1]);

    NodeToneService.play(1);
    expect(SoundPool.play).toHaveBeenCalledWith(
      expect.stringMatching(/^node:/),
      expect.objectContaining({ volume: 0.32 })
    );
  });

  it('asynchronously builds and plays tone without dropping if unprepared at call time', async () => {
    // Cell 7 hasn't been prepared beforehand in an empty state
    NodeToneService.play(7);

    // Allow promise tick to run
    await Promise.resolve();
    await Promise.resolve();

    expect(SoundPool.play).toHaveBeenCalledWith(
      expect.stringMatching(/^node:/),
      expect.objectContaining({ volume: 0.32 })
    );
  });

  it('releases idle node tone players on release', async () => {
    await NodeToneService.prepare([1, 2]);
    NodeToneService.release();

    expect(SoundPool.releaseIdle).toHaveBeenCalled();
    const releasedKeys = jest.mocked(SoundPool.releaseIdle).mock.calls[0][0];
    expect(releasedKeys?.length).toBeGreaterThan(0);
    expect(releasedKeys?.every((k: string) => k.startsWith('node:'))).toBe(true);
  });

  it('does nothing when soundEffectsEnabled is false', async () => {
    useSettingsStore.setState({ soundEffectsEnabled: false });

    await NodeToneService.prepare([1]);
    NodeToneService.play(1);

    expect(SoundPool.prewarm).not.toHaveBeenCalled();
    expect(SoundPool.play).not.toHaveBeenCalled();
  });
});
