import { setAudioModeAsync } from 'expo-audio';

export type AudioSessionMode = 'effects' | 'session';

// Flip to false in Phase 2 if effects should also play with the ringer switch on.
const SFX_RESPECT_SILENT_SWITCH = true;

let modeQueue = Promise.resolve();

/** Single owner for app audio mode. Calls are serialized because Expo applies a global mode. */
export function setAudioSessionMode(mode: AudioSessionMode): Promise<void> {
  const next = modeQueue.then(async () => {
    await setAudioModeAsync({
      playsInSilentMode: mode === 'session' || !SFX_RESPECT_SILENT_SWITCH,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
  });
  modeQueue = next.catch(() => undefined);
  return next;
}
