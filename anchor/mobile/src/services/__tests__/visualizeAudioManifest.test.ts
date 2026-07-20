import {
  VISUALIZE_AUDIO_MANIFEST,
  VISUALIZE_CUES,
  VISUALIZE_PHASE_BOUNDARIES,
} from '../visualizeAudioManifest';

const EXPECTED_TIMESTAMPS = {
  60: [1, 5, 11, 15, 21, 28, 32, 39, 45, 50, 55],
  180: [2, 8, 17, 22, 25, 31, 37, 48, 55, 61, 68, 81, 88, 94, 100, 110, 120, 131, 139, 147, 153, 160, 167, 172, 176],
  300: [3, 11, 21, 28, 34, 38, 42, 50, 58, 70, 78, 87, 98, 109, 117, 125, 134, 142, 154, 161, 168, 176, 186, 197, 208, 218, 227, 237, 247, 256, 266, 274, 281, 287, 292],
} as const;

describe('visualizeAudioManifest', () => {
  it('contains every unique canonical cue at the exact timestamp', () => {
    expect(VISUALIZE_CUES).toHaveLength(71);
    expect(new Set(VISUALIZE_CUES.map(cue => cue.id)).size).toBe(71);
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
      .toEqual([[0, 10], [10, 27], [27, 44], [44, 54], [54, 60]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[180].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 29], [29, 79], [79, 129], [129, 158], [158, 180]]);
    expect(VISUALIZE_PHASE_BOUNDARIES[300].map(phase => [phase.startSeconds, phase.endSeconds]))
      .toEqual([[0, 48], [48, 132], [132, 216], [216, 264], [264, 300]]);
    for (const durationSeconds of [60, 180, 300] as const) {
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.durationSeconds).toBe(durationSeconds);
      expect(VISUALIZE_AUDIO_MANIFEST[durationSeconds].ambient.asset).toBeTruthy();
    }
  });

  it('documents the verified same-script substitution instead of hiding the mismatch', () => {
    const cue = VISUALIZE_CUES.find(item => item.id === 'VIZ_1M_ARRIVE_01');
    expect(cue?.developmentValidation.female).toBe('verified_same_script_substitution');
    expect(cue?.developmentValidation.male).toBe('verified');
  });
});
