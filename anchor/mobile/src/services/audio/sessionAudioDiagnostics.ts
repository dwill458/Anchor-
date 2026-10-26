import type { AudioStatus } from 'expo-audio';
import type { AudioAssetReference } from '@/services/SessionAudioManifest';

type SessionAudioDiagnostic = {
  event: 'created' | 'status' | 'failure';
  playerId: string;
  asset?: AudioAssetReference;
  status?: AudioStatus;
  error?: string;
};
let listener: ((event: SessionAudioDiagnostic) => void) | null = null;

/** A development observer cannot change playback or persist session data. */
export function observeSessionAudio(next: ((event: SessionAudioDiagnostic) => void) | null) {
  if (__DEV__) listener = next;
}

export function reportSessionAudio(event: SessionAudioDiagnostic) {
  if (__DEV__ && listener) {
    try { listener(event); } catch { /* Diagnostics must not affect playback. */ }
  }
}
