import type { AudioSource } from 'expo-audio';

import type { GuidanceVoice } from '@/types/sessionAudio';
import { VISUALIZE_CLIP_DURATIONS } from './visualizeAudioDurations.generated';

export const VISUALIZE_DURATIONS_SECONDS = [60, 180, 300] as const;
export type VisualizeDurationSeconds = (typeof VISUALIZE_DURATIONS_SECONDS)[number];

export const VISUALIZE_PHASE_IDS = ['arrive', 'see', 'feel', 'seal', 'return'] as const;
export type VisualizePhaseId = (typeof VISUALIZE_PHASE_IDS)[number];

export interface VisualizePhaseBoundary {
  id: VisualizePhaseId;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

export interface VisualizeDuckingEnvelope {
  attackMs: number;
  releaseMs: number;
}

export type VisualizeAssetValidationStatus =
  | 'verified'
  | 'verified_same_script_substitution';

export interface VisualizeCueDefinition {
  id: string;
  durationSeconds: VisualizeDurationSeconds;
  phase: VisualizePhaseId;
  startSeconds: number;
  text: string;
  femaleAsset: AudioSource;
  maleAsset: AudioSource;
  expectedClipDurationSeconds: Readonly<Record<Exclude<GuidanceVoice, 'none'>, number>>;
  duckingEnvelope: VisualizeDuckingEnvelope;
  developmentValidation: Readonly<Record<Exclude<GuidanceVoice, 'none'>, VisualizeAssetValidationStatus>>;
}

export interface VisualizeAmbientDefinition {
  durationSeconds: VisualizeDurationSeconds;
  asset: AudioSource;
  expectedDurationSeconds: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface VisualizeSessionAudioManifest {
  durationSeconds: VisualizeDurationSeconds;
  phases: readonly VisualizePhaseBoundary[];
  cues: readonly VisualizeCueDefinition[];
  ambient: VisualizeAmbientDefinition;
}

const voiceAssets = (
  femaleAsset: AudioSource,
  maleAsset: AudioSource,
): Pick<VisualizeCueDefinition, 'femaleAsset' | 'maleAsset'> => ({ femaleAsset, maleAsset });

// Static requires are intentional: Metro cannot resolve dynamically constructed asset paths.
const VOICE_ASSETS: Record<string, ReturnType<typeof voiceAssets>> = {
  VIZ_1M_ARRIVE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_arrive_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_arrive_01_male.mp3')),
  VIZ_1M_ARRIVE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_arrive_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_arrive_02_male.mp3')),
  VIZ_1M_SEE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_see_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_see_01_male.mp3')),
  VIZ_1M_SEE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_see_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_see_02_male.mp3')),
  VIZ_1M_SEE_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_see_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_see_03_male.mp3')),
  VIZ_1M_FEEL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_feel_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_feel_01_male.mp3')),
  VIZ_1M_FEEL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_feel_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_feel_02_male.mp3')),
  VIZ_1M_FEEL_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_feel_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_feel_03_male.mp3')),
  VIZ_1M_SEAL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_seal_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_seal_01_male.mp3')),
  VIZ_1M_SEAL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_seal_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_seal_02_male.mp3')),
  VIZ_1M_RETURN_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_1m_return_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_1m_return_01_male.mp3')),
  VIZ_3M_ARRIVE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_arrive_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_arrive_01_male.mp3')),
  VIZ_3M_ARRIVE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_arrive_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_arrive_02_male.mp3')),
  VIZ_3M_ARRIVE_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_arrive_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_arrive_03_male.mp3')),
  VIZ_3M_ARRIVE_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_arrive_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_arrive_04_male.mp3')),
  VIZ_3M_ARRIVE_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_arrive_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_arrive_05_male.mp3')),
  VIZ_3M_SEE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_01_male.mp3')),
  VIZ_3M_SEE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_02_male.mp3')),
  VIZ_3M_SEE_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_03_male.mp3')),
  VIZ_3M_SEE_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_04_male.mp3')),
  VIZ_3M_SEE_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_05_male.mp3')),
  VIZ_3M_SEE_06: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_see_06_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_see_06_male.mp3')),
  VIZ_3M_FEEL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_01_male.mp3')),
  VIZ_3M_FEEL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_02_male.mp3')),
  VIZ_3M_FEEL_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_03_male.mp3')),
  VIZ_3M_FEEL_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_04_male.mp3')),
  VIZ_3M_FEEL_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_05_male.mp3')),
  VIZ_3M_FEEL_06: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_feel_06_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_feel_06_male.mp3')),
  VIZ_3M_SEAL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_seal_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_seal_01_male.mp3')),
  VIZ_3M_SEAL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_seal_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_seal_02_male.mp3')),
  VIZ_3M_SEAL_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_seal_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_seal_03_male.mp3')),
  VIZ_3M_SEAL_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_seal_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_seal_04_male.mp3')),
  VIZ_3M_RETURN_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_return_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_return_01_male.mp3')),
  VIZ_3M_RETURN_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_return_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_return_02_male.mp3')),
  VIZ_3M_RETURN_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_return_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_return_03_male.mp3')),
  VIZ_3M_RETURN_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_3m_return_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_3m_return_04_male.mp3')),
  VIZ_5M_ARRIVE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_01_male.mp3')),
  VIZ_5M_ARRIVE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_02_male.mp3')),
  VIZ_5M_ARRIVE_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_03_male.mp3')),
  VIZ_5M_ARRIVE_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_04_male.mp3')),
  VIZ_5M_ARRIVE_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_05_male.mp3')),
  VIZ_5M_ARRIVE_06: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_06_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_06_male.mp3')),
  VIZ_5M_ARRIVE_07: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_arrive_07_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_arrive_07_male.mp3')),
  VIZ_5M_SEE_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_01_male.mp3')),
  VIZ_5M_SEE_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_02_male.mp3')),
  VIZ_5M_SEE_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_03_male.mp3')),
  VIZ_5M_SEE_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_04_male.mp3')),
  VIZ_5M_SEE_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_05_male.mp3')),
  VIZ_5M_SEE_06: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_06_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_06_male.mp3')),
  VIZ_5M_SEE_07: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_07_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_07_male.mp3')),
  VIZ_5M_SEE_08: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_08_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_08_male.mp3')),
  VIZ_5M_SEE_09: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_see_09_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_see_09_male.mp3')),
  VIZ_5M_FEEL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_01_male.mp3')),
  VIZ_5M_FEEL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_02_male.mp3')),
  VIZ_5M_FEEL_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_03_male.mp3')),
  VIZ_5M_FEEL_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_04_male.mp3')),
  VIZ_5M_FEEL_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_05_male.mp3')),
  VIZ_5M_FEEL_06: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_06_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_06_male.mp3')),
  VIZ_5M_FEEL_07: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_07_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_07_male.mp3')),
  VIZ_5M_FEEL_08: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_08_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_08_male.mp3')),
  VIZ_5M_FEEL_09: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_feel_09_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_feel_09_male.mp3')),
  VIZ_5M_SEAL_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_seal_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_seal_01_male.mp3')),
  VIZ_5M_SEAL_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_seal_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_seal_02_male.mp3')),
  VIZ_5M_SEAL_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_seal_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_seal_03_male.mp3')),
  VIZ_5M_SEAL_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_seal_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_seal_04_male.mp3')),
  VIZ_5M_SEAL_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_seal_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_seal_05_male.mp3')),
  VIZ_5M_RETURN_01: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_return_01_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_return_01_male.mp3')),
  VIZ_5M_RETURN_02: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_return_02_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_return_02_male.mp3')),
  VIZ_5M_RETURN_03: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_return_03_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_return_03_male.mp3')),
  VIZ_5M_RETURN_04: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_return_04_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_return_04_male.mp3')),
  VIZ_5M_RETURN_05: voiceAssets(require('../assets/sounds/visualize/voices/female/en-US/viz_5m_return_05_female.mp3'), require('../assets/sounds/visualize/voices/male/en-US/viz_5m_return_05_male.mp3')),
};

const AMBIENT_ASSETS: Record<VisualizeDurationSeconds, AudioSource> = {
  60: require('../assets/sounds/visualize/visualize_ambient_1m.mp3'),
  180: require('../assets/sounds/visualize/visualize_ambient_3m.mp3'),
  300: require('../assets/sounds/visualize/visualize_ambient_5m.mp3'),
};

const DEFAULT_DUCKING: VisualizeDuckingEnvelope = { attackMs: 160, releaseMs: 400 };

const cue = (
  id: keyof typeof VOICE_ASSETS,
  durationSeconds: VisualizeDurationSeconds,
  phase: VisualizePhaseId,
  startSeconds: number,
  text: string,
): VisualizeCueDefinition => {
  const expected = (VISUALIZE_CLIP_DURATIONS as Record<string, { female: number; male: number }>)[id] ?? { female: 0, male: 0 };
  return {
    id,
    durationSeconds,
    phase,
    startSeconds,
    text,
    ...VOICE_ASSETS[id],
    expectedClipDurationSeconds: expected,
    duckingEnvelope: DEFAULT_DUCKING,
    developmentValidation: {
      female: id === 'VIZ_1M_ARRIVE_01' ? 'verified_same_script_substitution' : 'verified',
      male: 'verified',
    },
  };
};

export const VISUALIZE_CUES: readonly VisualizeCueDefinition[] = [
  cue('VIZ_1M_ARRIVE_01', 60, 'arrive', 1, 'Let your attention settle on your anchor.'),
  cue('VIZ_1M_ARRIVE_02', 60, 'arrive', 5, 'Breathe in slowly, and let it go.'),
  cue('VIZ_1M_SEE_01', 60, 'see', 11, 'Bring your scene to mind.'),
  cue('VIZ_1M_SEE_02', 60, 'see', 15, 'Picture the moment this intention is already real.'),
  cue('VIZ_1M_SEE_03', 60, 'see', 21, 'Notice where you are and what happens first.'),
  cue('VIZ_1M_FEEL_01', 60, 'feel', 28, 'Step into the scene.'),
  cue('VIZ_1M_FEEL_02', 60, 'feel', 32, 'Notice your posture, your breathing, and the way you respond.'),
  cue('VIZ_1M_FEEL_03', 60, 'feel', 39, 'Let this version of you feel familiar.'),
  cue('VIZ_1M_SEAL_01', 60, 'seal', 45, 'Let the scene become smaller and clearer.'),
  cue('VIZ_1M_SEAL_02', 60, 'seal', 50, 'Place that feeling back into your anchor.'),
  cue('VIZ_1M_RETURN_01', 60, 'return', 55, 'Return to the room. Carry it into your next action.'),
  cue('VIZ_3M_ARRIVE_01', 180, 'arrive', 2, 'Let your attention settle on your anchor.'),
  cue('VIZ_3M_ARRIVE_02', 180, 'arrive', 8, 'Notice the shape, the lines, and the space around it.'),
  cue('VIZ_3M_ARRIVE_03', 180, 'arrive', 17, 'Take a slow breath in.'),
  cue('VIZ_3M_ARRIVE_04', 180, 'arrive', 22, 'And let it go.'),
  cue('VIZ_3M_ARRIVE_05', 180, 'arrive', 25, 'You do not need to force anything. Just become present.'),
  cue('VIZ_3M_SEE_01', 180, 'see', 31, 'Bring your scene to mind.'),
  cue('VIZ_3M_SEE_02', 180, 'see', 37, 'Picture the exact moment that shows this intention is already real.'),
  cue('VIZ_3M_SEE_03', 180, 'see', 48, 'Notice where you are.'),
  cue('VIZ_3M_SEE_04', 180, 'see', 55, 'What do you see first?'),
  cue('VIZ_3M_SEE_05', 180, 'see', 61, 'What is happening around you?'),
  cue('VIZ_3M_SEE_06', 180, 'see', 68, 'Let the scene become clear enough to enter without trying to control every detail.'),
  cue('VIZ_3M_FEEL_01', 180, 'feel', 81, 'Now step into the scene.'),
  cue('VIZ_3M_FEEL_02', 180, 'feel', 88, 'Notice your posture.'),
  cue('VIZ_3M_FEEL_03', 180, 'feel', 94, 'Notice your breathing.'),
  cue('VIZ_3M_FEEL_04', 180, 'feel', 100, 'Listen to the way you speak and the pace of your decisions.'),
  cue('VIZ_3M_FEEL_05', 180, 'feel', 110, 'See how you respond when the moment asks something of you.'),
  cue('VIZ_3M_FEEL_06', 180, 'feel', 120, 'Let this response feel practiced and familiar.'),
  cue('VIZ_3M_SEAL_01', 180, 'seal', 131, 'Let the scene become smaller and clearer.'),
  cue('VIZ_3M_SEAL_02', 180, 'seal', 139, 'Keep the posture, the calm, and the certainty.'),
  cue('VIZ_3M_SEAL_03', 180, 'seal', 147, 'Allow the image to move back into your anchor.'),
  cue('VIZ_3M_SEAL_04', 180, 'seal', 153, 'Let the anchor hold the memory of this response.'),
  cue('VIZ_3M_RETURN_01', 180, 'return', 160, 'Begin returning your attention to the room.'),
  cue('VIZ_3M_RETURN_02', 180, 'return', 167, 'Feel the surface beneath you.'),
  cue('VIZ_3M_RETURN_03', 180, 'return', 172, 'Take one natural breath.'),
  cue('VIZ_3M_RETURN_04', 180, 'return', 176, 'Carry this version of yourself into your next action.'),
  cue('VIZ_5M_ARRIVE_01', 300, 'arrive', 3, 'Let your attention settle on your anchor.'),
  cue('VIZ_5M_ARRIVE_02', 300, 'arrive', 11, 'Notice the shape, the lines, and the space around it.'),
  cue('VIZ_5M_ARRIVE_03', 300, 'arrive', 21, 'You do not need to solve anything right now.'),
  cue('VIZ_5M_ARRIVE_04', 300, 'arrive', 28, 'Take a slow breath in.'),
  cue('VIZ_5M_ARRIVE_05', 300, 'arrive', 34, 'Hold it gently.'),
  cue('VIZ_5M_ARRIVE_06', 300, 'arrive', 38, 'And let it go.'),
  cue('VIZ_5M_ARRIVE_07', 300, 'arrive', 42, 'Allow the noise around you to move farther away.'),
  cue('VIZ_5M_SEE_01', 300, 'see', 50, 'Bring your saved scene to mind.'),
  cue('VIZ_5M_SEE_02', 300, 'see', 58, 'Picture the exact moment that shows this intention is already real.'),
  cue('VIZ_5M_SEE_03', 300, 'see', 70, 'Notice where you are.'),
  cue('VIZ_5M_SEE_04', 300, 'see', 78, 'What can you see around you?'),
  cue('VIZ_5M_SEE_05', 300, 'see', 87, 'What is the first detail that makes this moment feel real?'),
  cue('VIZ_5M_SEE_06', 300, 'see', 98, 'Notice the people, objects, or movement within the scene.'),
  cue('VIZ_5M_SEE_07', 300, 'see', 109, 'Let the image sharpen naturally.'),
  cue('VIZ_5M_SEE_08', 300, 'see', 117, 'See the moment unfold from beginning to end.'),
  cue('VIZ_5M_SEE_09', 300, 'see', 125, 'Do not chase perfection. Let the scene feel real enough to enter.'),
  cue('VIZ_5M_FEEL_01', 300, 'feel', 134, 'Now step into the scene.'),
  cue('VIZ_5M_FEEL_02', 300, 'feel', 142, 'Look through your own eyes instead of watching yourself from a distance.'),
  cue('VIZ_5M_FEEL_03', 300, 'feel', 154, 'Notice your posture.'),
  cue('VIZ_5M_FEEL_04', 300, 'feel', 161, 'Notice your breathing.'),
  cue('VIZ_5M_FEEL_05', 300, 'feel', 168, 'Listen to the way you speak.'),
  cue('VIZ_5M_FEEL_06', 300, 'feel', 176, 'Feel the pace of your thoughts and decisions.'),
  cue('VIZ_5M_FEEL_07', 300, 'feel', 186, 'When the moment becomes difficult, notice how you respond.'),
  cue('VIZ_5M_FEEL_08', 300, 'feel', 197, 'See yourself remain connected to the intention behind this anchor.'),
  cue('VIZ_5M_FEEL_09', 300, 'feel', 208, 'Let this way of responding feel practiced, steady, and familiar.'),
  cue('VIZ_5M_SEAL_01', 300, 'seal', 218, 'Let the scene begin to narrow.'),
  cue('VIZ_5M_SEAL_02', 300, 'seal', 227, 'Keep only the clearest image of how you showed up.'),
  cue('VIZ_5M_SEAL_03', 300, 'seal', 237, 'Hold onto the posture, the calm, and the certainty.'),
  cue('VIZ_5M_SEAL_04', 300, 'seal', 247, 'Allow the scene to move back into your anchor.'),
  cue('VIZ_5M_SEAL_05', 300, 'seal', 256, 'Let the anchor hold the memory of this response.'),
  cue('VIZ_5M_RETURN_01', 300, 'return', 266, 'Begin returning your attention to the room.'),
  cue('VIZ_5M_RETURN_02', 300, 'return', 274, 'Feel the surface beneath you.'),
  cue('VIZ_5M_RETURN_03', 300, 'return', 281, 'Notice the sounds around you.'),
  cue('VIZ_5M_RETURN_04', 300, 'return', 287, 'Take one natural breath.'),
  cue('VIZ_5M_RETURN_05', 300, 'return', 292, 'Carry this version of yourself into the next thing you do.'),
];

const phase = (id: VisualizePhaseId, startSeconds: number, endSeconds: number): VisualizePhaseBoundary => ({
  id,
  startSeconds,
  endSeconds,
  durationSeconds: endSeconds - startSeconds,
});

export const VISUALIZE_PHASE_BOUNDARIES: Readonly<Record<VisualizeDurationSeconds, readonly VisualizePhaseBoundary[]>> = {
  60: [phase('arrive', 0, 10), phase('see', 10, 27), phase('feel', 27, 44), phase('seal', 44, 54), phase('return', 54, 60)],
  180: [phase('arrive', 0, 29), phase('see', 29, 79), phase('feel', 79, 129), phase('seal', 129, 158), phase('return', 158, 180)],
  300: [phase('arrive', 0, 48), phase('see', 48, 132), phase('feel', 132, 216), phase('seal', 216, 264), phase('return', 264, 300)],
};

export const VISUALIZE_AMBIENT: Readonly<Record<VisualizeDurationSeconds, VisualizeAmbientDefinition>> = {
  60: { durationSeconds: 60, asset: AMBIENT_ASSETS[60], expectedDurationSeconds: 60, fadeInMs: 1_200, fadeOutMs: 2_000 },
  180: { durationSeconds: 180, asset: AMBIENT_ASSETS[180], expectedDurationSeconds: 180, fadeInMs: 1_800, fadeOutMs: 3_000 },
  300: { durationSeconds: 300, asset: AMBIENT_ASSETS[300], expectedDurationSeconds: 300, fadeInMs: 2_200, fadeOutMs: 3_500 },
};

export const VISUALIZE_AUDIO_MANIFEST: Readonly<Record<VisualizeDurationSeconds, VisualizeSessionAudioManifest>> = {
  60: { durationSeconds: 60, phases: VISUALIZE_PHASE_BOUNDARIES[60], cues: VISUALIZE_CUES.filter(item => item.durationSeconds === 60), ambient: VISUALIZE_AMBIENT[60] },
  180: { durationSeconds: 180, phases: VISUALIZE_PHASE_BOUNDARIES[180], cues: VISUALIZE_CUES.filter(item => item.durationSeconds === 180), ambient: VISUALIZE_AMBIENT[180] },
  300: { durationSeconds: 300, phases: VISUALIZE_PHASE_BOUNDARIES[300], cues: VISUALIZE_CUES.filter(item => item.durationSeconds === 300), ambient: VISUALIZE_AMBIENT[300] },
};

export const getVisualizeSessionAudioManifest = (
  durationSeconds: VisualizeDurationSeconds,
): VisualizeSessionAudioManifest => VISUALIZE_AUDIO_MANIFEST[durationSeconds];

export const getVisualizeCueAsset = (
  definition: VisualizeCueDefinition,
  voice: GuidanceVoice,
): AudioSource | null =>
  voice === 'none' ? null : voice === 'female' ? definition.femaleAsset : definition.maleAsset;

