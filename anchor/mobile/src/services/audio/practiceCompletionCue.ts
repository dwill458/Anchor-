import { playCreationSound } from '@/services/CreationSounds';
import { setAudioSessionMode } from './AudioSession';

/** Start the completion effect after switching out of session playback mode. */
export function playPracticeCompletionCue(soundEnabled: boolean): Promise<void> {
  if (!soundEnabled) return Promise.resolve();
  return setAudioSessionMode('effects')
    .then(() => { playCreationSound('practiceComplete'); })
    .catch(() => undefined);
}
