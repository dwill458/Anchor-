import { NodeToneService } from '../NodeToneService';
import { SoundPool } from '../audio/SoundPool';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ soundEffectsEnabled: true }) },
}));
jest.mock('../audio/SoundPool', () => ({
  SoundPool: { register: jest.fn(), prewarm: jest.fn(), releaseIdle: jest.fn(), play: jest.fn() },
}));
jest.mock('../../assets/sounds/node-tones/0_wav.wav', () => 22050);
jest.mock('../../assets/sounds/node-tones/0.mp3', () => 48000);

it('retains the original WAV on iOS', async () => {
  await NodeToneService.prepare();
  expect(SoundPool.register).toHaveBeenCalledWith('node:0', 22050);
  expect(SoundPool.register).not.toHaveBeenCalledWith('node:0', 48000);
});
