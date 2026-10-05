import {
  FULL_MIX_PHASE_ID,
  GUIDED_AUDIO_MANIFEST,
  SESSION_VOICE_CUE_SHEETS,
  VISUALIZE_VOICE_PLAYBACK_GAIN,
  isSessionAudioSelectionAvailable,
  lookupVoiceTracks,
  resolveSessionAudioPlan,
} from '../SessionAudioManifest';

describe('SessionAudioManifest', () => {
  it('has complete female coverage for every supported cue sheet', () => {
    for (const sheet of SESSION_VOICE_CUE_SHEETS) {
      const result = lookupVoiceTracks({
        voice: 'female',
        sessionType: sheet.sessionType,
        durationSeconds: sheet.durationSeconds,
        locale: sheet.locale,
      });
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.tracks.map((track) => track.phaseId).sort()).toEqual(
          sheet.cues.map((cue) => cue.phaseId).sort()
        );
      }
    }
  });

  it('has complete male coverage for every supported cue sheet', () => {
    for (const sheet of SESSION_VOICE_CUE_SHEETS) {
      const result = lookupVoiceTracks({
        voice: 'male',
        sessionType: sheet.sessionType,
        durationSeconds: sheet.durationSeconds,
        locale: sheet.locale,
      });
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.tracks.map((track) => track.phaseId).sort()).toEqual(
          sheet.cues.map((cue) => cue.phaseId).sort()
        );
        expect(result.tracks.every((track) => track.playbackGain > 0)).toBe(true);
        expect(result.tracks.every((track) => track.playbackGain <= 1)).toBe(true);
      }
    }

    expect(GUIDED_AUDIO_MANIFEST.filter((track) => track.voice === 'male')).toHaveLength(53);
    expect(
      isSessionAudioSelectionAvailable({
        sessionType: 'focus',
        durationSeconds: 30,
        defaults: { guidanceVoice: 'male', backgroundAudio: 'ambient' },
      })
    ).toBe(true);
  });

  it('falls an unsupported male configuration back to no voice without substituting female', () => {
    const plan = resolveSessionAudioPlan({
      sessionType: 'focus',
      durationSeconds: 45,
      configuration: {
        guidanceVoice: 'male',
        backgroundAudio: 'ambient',
        source: 'session_override',
      },
    });

    expect(plan.requestedConfiguration.guidanceVoice).toBe('male');
    expect(plan.configuration.guidanceVoice).toBe('none');
    expect(plan.voiceCues).toEqual([]);
    expect(plan.shouldPlayAmbient).toBe(true);
    expect(plan.fallbackReasons).toEqual(['voice_unavailable']);
  });

  it.each([
    ['none', 'off', false, false],
    ['none', 'ambient', false, true],
    ['female', 'off', true, false],
    // Finished mixes carry their own bed, so ambient is not layered on top.
    ['female', 'ambient', true, false],
    ['male', 'off', true, false],
    ['male', 'ambient', true, false],
  ] as const)(
    'resolves voice=%s and background=%s independently',
    (guidanceVoice, backgroundAudio, voice, ambient) => {
      const plan = resolveSessionAudioPlan({
        sessionType: 'focus',
        durationSeconds: 30,
        configuration: { guidanceVoice, backgroundAudio, source: 'default' },
      });
      expect(plan.shouldPlayVoice).toBe(voice);
      expect(plan.shouldPlayAmbient).toBe(ambient);
    }
  );

  it.each([60, 180, 300] as const)('resolves complete Visualize audio at %ss', (durationSeconds) => {
    const female = resolveSessionAudioPlan({
      sessionType: 'visualize',
      durationSeconds,
      configuration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
    });
    const male = resolveSessionAudioPlan({
      sessionType: 'visualize',
      durationSeconds,
      configuration: { guidanceVoice: 'male', backgroundAudio: 'off', source: 'session_override' },
    });

    expect(female.fallbackUsed).toBe(false);
    expect(female.shouldPlayVoice).toBe(true);
    expect(female.shouldPlayAmbient).toBe(true);
    expect(male.fallbackUsed).toBe(false);
    expect(male.shouldPlayVoice).toBe(true);
    expect(male.shouldPlayAmbient).toBe(false);
  });

  it('applies the reduced Visualize playback gain to both voices', () => {
    const visualizeTracks = GUIDED_AUDIO_MANIFEST.filter(
      track => track.sessionType === 'visualize',
    );

    expect(VISUALIZE_VOICE_PLAYBACK_GAIN).toBe(0.19);
    expect(visualizeTracks).toHaveLength(64);
    expect(visualizeTracks.every(track => track.playbackGain === 0.19)).toBe(true);
  });

  it.each([
    ['focus', 10], ['focus', 30], ['focus', 60],
    ['deep_prime', 120], ['deep_prime', 300], ['deep_prime', 600],
  ] as const)('serves one full-length mix per voice for %s %ss', (sessionType, durationSeconds) => {
    for (const voice of ['female', 'male'] as const) {
      const plan = resolveSessionAudioPlan({
        sessionType,
        durationSeconds,
        configuration: { guidanceVoice: voice, backgroundAudio: 'off', source: 'default' },
      });
      expect(plan.fallbackUsed).toBe(false);
      expect(plan.voiceCues).toHaveLength(1);
      expect(plan.voiceCues[0].triggerAtRemainingMs).toBe(durationSeconds * 1000);
      expect(plan.voiceCues[0].track.phaseId).toBe(FULL_MIX_PHASE_ID);
      expect(plan.voiceCues[0].track.playbackGain).toBe(1);
    }
  });
});
