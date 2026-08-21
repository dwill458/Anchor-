import { VISUALIZE_AUDIO_MANIFEST } from '@/services/visualizeAudioManifest';
import {
  getNextDueVisualizeCue,
  getVisualizeAmbientRestingVolume,
  getVisualizeFinalFadeRemainingMs,
  VISUALIZE_AMBIENT_LEVELS,
} from '../visualizeAudioState';

describe('visualizeAudioState', () => {
  const cues = VISUALIZE_AUDIO_MANIFEST[60].cues;

  it('deduplicates cues after pause/resume and foreground reconciliation', () => {
    const handled = new Set<string>();
    const first = getNextDueVisualizeCue(cues, 0, handled);
    expect(first?.id).toBe('viz-60-arrive-1');
    handled.add(first!.id);

    const second = getNextDueVisualizeCue(cues, 3_500, handled);
    expect(second?.id).toBe('viz-60-arrive-2');
    handled.add(second!.id);

    // Re-reading canonical elapsed time after foregrounding never returns a handled cue.
    expect(getNextDueVisualizeCue(cues, 3_500, handled)).toBeNull();
  });

  it('uses guided ducking and a higher ambient-only resting level', () => {
    expect(getVisualizeAmbientRestingVolume(true)).toBe(VISUALIZE_AMBIENT_LEVELS.guidedResting);
    expect(getVisualizeAmbientRestingVolume(false)).toBe(VISUALIZE_AMBIENT_LEVELS.ambientOnly);
    expect(VISUALIZE_AMBIENT_LEVELS.guidedDucked).toBeLessThan(VISUALIZE_AMBIENT_LEVELS.guidedResting);
  });

  it('starts the exact session-end fade and reaches zero at completion', () => {
    expect(getVisualizeFinalFadeRemainingMs(60, 2_000, 57_999)).toBeNull();
    expect(getVisualizeFinalFadeRemainingMs(60, 2_000, 58_000)).toBe(2_000);
    expect(getVisualizeFinalFadeRemainingMs(60, 2_000, 59_250)).toBe(750);
    expect(getVisualizeFinalFadeRemainingMs(60, 2_000, 60_000)).toBe(0);
  });
});
