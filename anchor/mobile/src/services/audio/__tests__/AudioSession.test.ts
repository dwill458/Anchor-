import { setAudioModeAsync } from 'expo-audio';
import { setAudioSessionMode } from '../AudioSession';

beforeEach(() => jest.clearAllMocks());

it('keeps effects audible in silent mode and keeps mixing with other audio', async () => {
  await setAudioSessionMode('effects');
  expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  }));
});

it('keeps session audio audible in silent mode and mixed with other audio', async () => {
  await setAudioSessionMode('session');
  expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  }));
});
