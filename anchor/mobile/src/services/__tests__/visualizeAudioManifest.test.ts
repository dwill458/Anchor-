import {
  VISUALIZE_AUDIO_MANIFEST,
  VISUALIZE_CUES,
  VISUALIZE_PHASE_BOUNDARIES,
} from '../visualizeAudioManifest';

const EXPECTED_TIMESTAMPS = {
  60: [1.5, 13.5, 24.5, 36, 52],
  180: [2, 19, 38, 54, 69, 84, 99, 117, 135, 155, 171],
  300: [3, 20, 38, 60, 77, 94, 110, 127, 144, 160, 181, 204, 230, 255, 273, 290],
} as const;

describe('visualizeAudioManifest', () => {
  it('contains every unique canonical cue at the exact timestamp', () => {
    expect(VISUALIZE_CUES).toHaveLength(32);
    expect(new Set(VISUALIZE_CUES.map(cue => cue.id)).size).toBe(32);
    for (const durationSeconds of [60, 180, 300] as const) {
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].cues.map(cue => cue.startSeconds))
        .toEqual(EXPECTED_TIMESTAMPS[durationSeconds]);
    }
  });

  it('has complete female and male mapping without timing overlap', () => {
    for (const durationSeconds of [60, 180, 300] as const) {
      const cues = VISUALIZE_AUDIO_MANIFEST[durationSeconds].cues;
      cues.forEach((cue, index) => {
        const nextStart = cues[index + 1]?.startSeconds ?? durationSeconds;
        expect(cue.femaleAsset).toBeTruthy();
        expect(cue.maleAsset).toBeTruthy();
        expect(cue.expectedClipDurationSeconds.female).toBeGreaterThan(0);
        expect(cue.expectedClipDurationSeconds.male).toBeGreaterThan(0);
        expect(cue.startSeconds + cue.expectedClipDurationSeconds.female).toBeLessThanOrEqual(nextStart + 0.04);
        expect(cue.startSeconds + cue.expectedClipDurationSeconds.male).toBeLessThanOrEqual(nextStart + 0.04);
      });
    }
  });

  it('shares exact phase boundaries and duration-specific ambient tracks', () => {
    expect(VISUALIZE_PHASE_BOUNDARIES[60].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 12], [12, 23], [23, 34], [34, 50], [50, 60]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[180].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 35], [35, 65], [65, 95], [95, 150], [150, 180]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[300].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 55], [55, 105], [105, 155], [155, 250], [250, 300]]);
    for (const durationSeconds of [60, 180, 300] as const) {
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.durationSeconds).toBe(durationSeconds);
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.asset).toBeTruthy();
    }
    expect(VISUALIZE_AUDIO_MANIFEST[60].ambient.loop).toBe(false);
    expect(VISUALIZE_AUDIO_MANIFEST[180].ambient.loop).toBe(true);
    expect(VISUALIZE_AUDIO_MANIFEST[300].ambient.loop).toBe(true);
  });

  it('keeps the new prompt IDs aligned to their five phase owners', () => {
    const cue = VISUALIZE_CUES.find(item => item.id === 'visualize-60-see-1');
    expect(cue?.phase).toBe('see');
    expect(cue?.developmentValidation.male).toBe('verified');
  });
});
