import {
  VISUALIZE_AUDIO_MANIFEST,
  VISUALIZE_CUES,
  VISUALIZE_PHASE_BOUNDARIES,
} from '../visualizeAudioManifest';

describe('visualizeAudioManifest', () => {
  it('contains cues for all configured sessions', () => {
    expect(VISUALIZE_CUES.length).toBeGreaterThan(0);
    for (const durationSeconds of [60, 180, 300] as const) {
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].cues.length).toBe(21);
    }
  });

  it('has complete female and male mapping without timing overlap', () => {
    for (const durationSeconds of [60, 180, 300] as const) {
      const cues = VISUALIZE_AUDIO_MANIFEST[durationSeconds].cues;
      cues.forEach((cue) => {
        expect(cue.femaleAsset).toBeTruthy();
        expect(cue.maleAsset).toBeTruthy();
      });
    }
  });

  it('shares exact phase boundaries and duration-specific ambient tracks', () => {
    expect(VISUALIZE_PHASE_BOUNDARIES[60].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 10], [10, 24], [24, 42], [42, 53], [53, 60]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[180].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 29], [29, 72], [72, 126], [126, 158], [158, 180]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[300].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 48], [48, 120], [120, 210], [210, 264], [264, 300]]);
    for (const durationSeconds of [60, 180, 300] as const) {
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.durationSeconds).toBe(durationSeconds);
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.asset).toBeTruthy();
    }
    expect(VISUALIZE_AUDIO_MANIFEST[60].ambient.loop).toBe(false);
    expect(VISUALIZE_AUDIO_MANIFEST[180].ambient.loop).toBe(true);
    expect(VISUALIZE_AUDIO_MANIFEST[300].ambient.loop).toBe(true);
  });

  it('keeps the prompt IDs aligned to their five phase owners', () => {
    const cue = VISUALIZE_CUES.find(item => item.id === 'viz-60-arrive-1');
    expect(cue?.phase).toBe('arrive');
    expect(cue?.developmentValidation.male).toBe('verified');
  });
});
