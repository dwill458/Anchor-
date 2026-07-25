import type { AudioSource } from 'expo-audio';

import type { GuidanceVoice } from '@/types/sessionAudio';
import { VISUALIZE_CLIP_DURATIONS } from './visualizeAudioDurations.generated';
import {
  VISUALIZE_DURATIONS,
  VISUALIZE_PHASE_IDS,
  VISUALIZE_SESSION_CONFIGS,
  type VisualizeDuration,
  type VisualizePhaseId,
} from '@/screens/visualize/visualizeSessionConfig';

export const VISUALIZE_DURATIONS_SECONDS = VISUALIZE_DURATIONS;
export type VisualizeDurationSeconds = VisualizeDuration;
export { VISUALIZE_PHASE_IDS };
export type { VisualizePhaseId };

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
  /** 3m and 5m assets are loop-safe production derivatives. */
  loop: boolean;
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

const cueFromPrompt = (
  promptConfig: {
    id: string;
    startMs: number;
    text: string;
    voiceAssetId: string;
  },
  durationSeconds: VisualizeDurationSeconds,
  phase: VisualizePhaseId,
): VisualizeCueDefinition => {
  const assets = VOICE_ASSETS[promptConfig.voiceAssetId];
  if (!assets) {
    throw new Error(`Missing Visualize voice asset ${promptConfig.voiceAssetId}.`);
  }
  const expected =
    (VISUALIZE_CLIP_DURATIONS as Record<
      string,
      { female: number; male: number }
    >)[promptConfig.voiceAssetId] ?? { female: 0, male: 0 };
  return {
    id: promptConfig.id,
    durationSeconds,
    phase,
    startSeconds: promptConfig.startMs / 1_000,
    text: promptConfig.text,
    ...assets,
    expectedClipDurationSeconds: expected,
    duckingEnvelope: DEFAULT_DUCKING,
    developmentValidation: {
      female: 'verified',
      male: 'verified',
    },
  };
};

const buildCues = (
  durationSeconds: VisualizeDurationSeconds,
): readonly VisualizeCueDefinition[] =>
  VISUALIZE_SESSION_CONFIGS[durationSeconds].phases.flatMap((phaseConfig) =>
    phaseConfig.prompts.map((promptConfig) =>
      cueFromPrompt(promptConfig, durationSeconds, phaseConfig.id),
    ),
  );

export const VISUALIZE_CUES: readonly VisualizeCueDefinition[] = VISUALIZE_DURATIONS_SECONDS.flatMap(
  (durationSeconds) => buildCues(durationSeconds),
);

const phaseBoundary = (
  id: VisualizePhaseId,
  startMs: number,
  durationMs: number,
): VisualizePhaseBoundary => ({
  id,
  startSeconds: startMs / 1_000,
  endSeconds: (startMs + durationMs) / 1_000,
  durationSeconds: durationMs / 1_000,
});

export const VISUALIZE_PHASE_BOUNDARIES: Readonly<
  Record<
    VisualizeDurationSeconds,
    readonly VisualizePhaseBoundary[]
  >
> = VISUALIZE_DURATIONS_SECONDS.reduce(
  (result, durationSeconds) => {
    let startMs = 0;
    result[durationSeconds] = VISUALIZE_SESSION_CONFIGS[durationSeconds].phases.map(
      (phaseConfig) => {
        const boundary = phaseBoundary(
          phaseConfig.id,
          startMs,
          phaseConfig.durationMs,
        );
        startMs += phaseConfig.durationMs;
        return boundary;
      },
    );
    return result;
  },
  {} as Record<VisualizeDurationSeconds, readonly VisualizePhaseBoundary[]>,
);

export const VISUALIZE_AMBIENT: Readonly<
  Record<VisualizeDurationSeconds, VisualizeAmbientDefinition>
> = {
  60: {
    durationSeconds: 60,
    asset: AMBIENT_ASSETS[60],
    expectedDurationSeconds: 60,
    loop: false,
    fadeInMs: 1_200,
    fadeOutMs: 700,
  },
  180: {
    durationSeconds: 180,
    asset: AMBIENT_ASSETS[180],
    expectedDurationSeconds: 180,
    loop: true,
    fadeInMs: 1_600,
    fadeOutMs: 800,
  },
  300: {
    durationSeconds: 300,
    asset: AMBIENT_ASSETS[300],
    expectedDurationSeconds: 300,
    loop: true,
    fadeInMs: 2_000,
    fadeOutMs: 900,
  },
};

export const VISUALIZE_AUDIO_MANIFEST: Readonly<
  Record<VisualizeDurationSeconds, VisualizeSessionAudioManifest>
> = VISUALIZE_DURATIONS_SECONDS.reduce(
  (result, durationSeconds) => {
    result[durationSeconds] = {
      durationSeconds,
      phases: VISUALIZE_PHASE_BOUNDARIES[durationSeconds],
      cues: VISUALIZE_CUES.filter(
        (item) => item.durationSeconds === durationSeconds,
      ),
      ambient: VISUALIZE_AMBIENT[durationSeconds],
    };
    return result;
  },
  {} as Record<VisualizeDurationSeconds, VisualizeSessionAudioManifest>,
);

export const getVisualizeSessionAudioManifest = (
  durationSeconds: VisualizeDurationSeconds,
): VisualizeSessionAudioManifest => VISUALIZE_AUDIO_MANIFEST[durationSeconds];

export const getVisualizeCueAsset = (
  definition: VisualizeCueDefinition,
  voice: GuidanceVoice,
): AudioSource | null =>
  voice === 'none' ? null : voice === 'female' ? definition.femaleAsset : definition.maleAsset;
