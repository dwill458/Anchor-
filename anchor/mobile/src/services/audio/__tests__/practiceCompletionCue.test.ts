import { playCreationSound } from '@/services/CreationSounds';
import { setAudioSessionMode } from '../AudioSession';
import { playPracticeCompletionCue } from '../practiceCompletionCue';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('../AudioSession', () => ({ setAudioSessionMode: jest.fn(() => Promise.resolve()) }));

beforeEach(() => jest.clearAllMocks());

it('plays one practice completion cue after restoring effects mode', async () => {
  await playPracticeCompletionCue(true);
  expect(setAudioSessionMode).toHaveBeenCalledTimes(1);
  expect(setAudioSessionMode).toHaveBeenCalledWith('effects');
  expect(playCreationSound).toHaveBeenCalledTimes(1);
  expect(playCreationSound).toHaveBeenCalledWith('practiceComplete');
});

it('does not play a cue when session sound is off', async () => {
  await playPracticeCompletionCue(false);
  expect(setAudioSessionMode).not.toHaveBeenCalled();
  expect(playCreationSound).not.toHaveBeenCalled();
});
