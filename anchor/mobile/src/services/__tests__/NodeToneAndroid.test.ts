import { NodeToneService } from '../NodeToneService';
import { SoundPool } from '../audio/SoundPool';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ soundEffectsEnabled: true }) },
}));
jest.mock('../audio/SoundPool', () => ({
  SoundPool: { register: jest.fn(), prewarm: jest.fn(), releaseIdle: jest.fn(), play: jest.fn() },
}));
jest.mock('../../assets/sounds/node-tones/0.wav', () => 22050);
jest.mock('../../assets/sounds/node-tones/0.mp3', () => 48000, { virtual: true });

it('uses the compressed Android tone while preserving pitch keys and volume', async () => {
  await NodeToneService.prepare();
  expect(SoundPool.register).toHaveBeenCalledWith('node:0', 48000);
  expect(SoundPool.register).not.toHaveBeenCalledWith('node:0', 22050);
  NodeToneService.play(11);
  expect(SoundPool.play).toHaveBeenCalledWith('node:0', { volume: 0.32 });
});

