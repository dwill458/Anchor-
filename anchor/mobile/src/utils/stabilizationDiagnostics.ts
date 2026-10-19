import * as Application from 'expo-application';
import Constants from 'expo-constants';

type Stage = 'focus.persistence' | 'focus.receipt' | 'focus.complete-state' |
  'canonical.queue' | 'canonical.hydration' | 'canonical.commit' |
  'legacy.auth.read' | 'legacy.auth.write' | 'legacy.private.read' | 'legacy.private.write';
let sequence = 0;

// Explicit synthetic package AND manifest AND build flag. Never emits owner data.
function enabled(): boolean {
  return process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS === '1' &&
    Application.applicationId === 'com.anchorintentions.expo58qa20261016' &&
    Constants.expoConfig?.extra?.sqlCipherLab === true;
}

function emit(stage: Stage, phase: string, id: number, startedAt: number): void {
  try {
    console.info('ANCHOR_STABILIZATION ' + JSON.stringify({ stage, phase, id,
      t: performance.now(), elapsedMs: performance.now() - startedAt }));
  } catch { /* Diagnostics cannot alter a durable receipt or its failure. */ }
}

export function markStabilizationStage(stage: Stage): void {
  if (enabled()) emit(stage, 'mark', ++sequence, performance.now());
}

export function traceStabilizationStage<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
  if (!enabled()) return work();
  const id = ++sequence;
  const startedAt = performance.now();
  emit(stage, 'begin', id, startedAt);
  try {
    return work().then(value => {
      emit(stage, 'resolved', id, startedAt);
      return value;
    }, error => {
      emit(stage, 'rejected', id, startedAt);
      throw error;
    });
  } catch (error) {
    emit(stage, 'rejected', id, startedAt);
    throw error;
  }
}
