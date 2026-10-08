import { setAudioModeAsync } from 'expo-audio';
import { sfxLog } from './sfxLog';

export type AudioSessionMode = 'effects' | 'session';

// Flip to false in Phase 2 if effects should also play with the ringer switch on.
const SFX_RESPECT_SILENT_SWITCH = true;

let modeQueue = Promise.resolve();

/** Single owner for app audio mode. Calls are serialized because Expo applies a global mode. */
export function setAudioSessionMode(mode: AudioSessionMode): Promise<void> {
  const next = modeQueue.then(async () => {
    sfxLog(`audioMode mode=${mode} result=started`);
    try {
      await setAudioModeAsync({
        playsInSilentMode: mode === 'session' || !SFX_RESPECT_SILENT_SWITCH,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      sfxLog(`audioMode mode=${mode} result=resolved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sfxLog(`audioMode mode=${mode} result=rejected error=${message}`);
      throw error;
    }
  });
  modeQueue = next.catch(() => undefined);
  return next;
}
