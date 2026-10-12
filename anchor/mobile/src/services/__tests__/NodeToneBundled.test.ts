import { NodeToneService } from '../NodeToneService';
import { SoundPool } from '../audio/SoundPool';
import { useSettingsStore } from '@/stores/settingsStore';

jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: null }));
jest.mock('../audio/SoundPool', () => ({
  SoundPool: { register: jest.fn(), prewarm: jest.fn(), releaseIdle: jest.fn(), play: jest.fn() },
}));

it('plays every recorded grid cell from bundled assets even without a writable cache', async () => {
  useSettingsStore.setState({ soundEffectsEnabled: true });
  const cells = [20, 8, 13, 14, 6, 3, 18, 19];
  await NodeToneService.prepare(cells);
  expect(SoundPool.register).toHaveBeenCalledTimes(10);
  cells.forEach((cell) => NodeToneService.play(cell));

  expect(SoundPool.play).toHaveBeenCalledTimes(cells.length);
  expect(jest.mocked(SoundPool.play).mock.calls.map(([key]) => key)).toEqual([
    'node:21', 'node:16', 'node:4', 'node:7', 'node:12', 'node:4', 'node:16', 'node:19',
  ]);
});
