export const VISUALIZE_DURATIONS = [60, 180, 300] as const;
export type VisualizeDuration = (typeof VISUALIZE_DURATIONS)[number];

export const VISUALIZE_PHASE_IDS = [
  'see',
  'feel',
  'choose',
  'rehearse',
  'seal',
] as const;
export type VisualizePhaseId = (typeof VISUALIZE_PHASE_IDS)[number];

export type VisualizeRingMotion =
  | 'outward'
  | 'inward'
  | 'orbit'
  | 'directional'
  | 'depth'
  | 'settle';

export interface VisualizeAnimationProfile {
  ringMotion: VisualizeRingMotion;
  ringDurationMs: number;
  breathDurationMs: number;
  breathAmount: number;
  glow: number;
  depth: number;
  contrast: number;
}

export interface VisualizePromptConfig {
  id: string;
  /** Offset from the beginning of the session. */
  startMs: number;
  text: string;
  /** Existing recorded clip used for the selected voice, when available. */
  voiceAssetId: string;
}

export interface VisualizePhaseConfig {
  id: VisualizePhaseId;
  durationMs: number;
  prompts: readonly VisualizePromptConfig[];
  animationProfile: VisualizeAnimationProfile;
}

export interface VisualizeSessionConfig {
  totalDurationMs: number;
  phases: readonly VisualizePhaseConfig[];
}

const PROFILES: Record<VisualizePhaseId, VisualizeAnimationProfile> = {
  see: {
    ringMotion: 'outward',
    ringDurationMs: 15_000,
    breathDurationMs: 8_400,
    breathAmount: 0.012,
    glow: 0.3,
    depth: 0.22,
    contrast: 0.9,
  },
  feel: {
    ringMotion: 'inward',
    ringDurationMs: 13_000,
    breathDurationMs: 7_200,
    breathAmount: 0.018,
    glow: 0.43,
    depth: 0.3,
    contrast: 0.96,
  },
  choose: {
    ringMotion: 'orbit',
    ringDurationMs: 12_000,
    breathDurationMs: 6_800,
    breathAmount: 0.014,
    glow: 0.56,
    depth: 0.4,
    contrast: 1,
  },
  rehearse: {
    ringMotion: 'directional',
    ringDurationMs: 9_500,
    breathDurationMs: 5_800,
    breathAmount: 0.02,
    glow: 0.68,
    depth: 0.62,
    contrast: 1.04,
  },
  seal: {
    ringMotion: 'settle',
    ringDurationMs: 28_000,
    breathDurationMs: 11_000,
    breathAmount: 0.006,
    glow: 0.76,
    depth: 0.35,
    contrast: 0.98,
  },
};

const prompt = (
  id: string,
  startSeconds: number,
  text: string,
  voiceAssetId: string,
): VisualizePromptConfig => ({
  id,
  startMs: startSeconds * 1_000,
  text,
  voiceAssetId,
});

const phase = (
  id: VisualizePhaseId,
  durationSeconds: number,
  prompts: readonly VisualizePromptConfig[],
): VisualizePhaseConfig => ({
  id,
  durationMs: durationSeconds * 1_000,
  prompts,
  animationProfile: PROFILES[id],
});

/**
 * One timing table for every supported session length. Prompt gaps are
 * intentional practice windows; narration does not fill the session.
 */
export const VISUALIZE_SESSION_CONFIGS: Readonly<
  Record<VisualizeDuration, VisualizeSessionConfig>
> = {
  60: {
    totalDurationMs: 60_000,
    phases: [
      phase('see', 12, [
        prompt('visualize-60-see-1', 1.5, 'Bring the scene into focus.', 'VIZ_1M_SEE_01'),
      ]),
      phase('feel', 11, [
        prompt(
          'visualize-60-feel-1',
          13.5,
          'Notice what this moment feels like in your body.',
          'VIZ_1M_FEEL_02',
        ),
      ]),
      phase('choose', 11, [
        prompt(
          'visualize-60-choose-1',
          24.5,
          'Choose the response that matches who you are becoming.',
          'VIZ_1M_FEEL_03',
        ),
      ]),
      phase('rehearse', 16, [
        prompt(
          'visualize-60-rehearse-1',
          36,
          'See yourself take that action clearly and naturally.',
          'VIZ_1M_SEE_03',
        ),
      ]),
      phase('seal', 10, [
        prompt(
          'visualize-60-seal-1',
          52,
          'Let this response settle into your Anchor.',
          'VIZ_1M_SEAL_02',
        ),
      ]),
    ],
  },
  180: {
    totalDurationMs: 180_000,
    phases: [
      phase('see', 35, [
        prompt('visualize-180-see-1', 2, 'Bring the scene into focus.', 'VIZ_3M_SEE_01'),
        prompt(
          'visualize-180-see-2',
          19,
          'Notice the first detail that makes this moment real.',
          'VIZ_3M_SEE_02',
        ),
      ]),
      phase('feel', 30, [
        prompt(
          'visualize-180-feel-1',
          38,
          'Step inside the scene and notice your posture.',
          'VIZ_3M_FEEL_01',
        ),
        prompt(
          'visualize-180-feel-2',
          54,
          'Feel the pace of your breathing and attention.',
          'VIZ_3M_FEEL_04',
        ),
      ]),
      phase('choose', 30, [
        prompt(
          'visualize-180-choose-1',
          69,
          'Name the response that matches your intention.',
          'VIZ_3M_FEEL_05',
        ),
        prompt(
          'visualize-180-choose-2',
          84,
          'Let that choice become clear and specific.',
          'VIZ_3M_SEE_03',
        ),
      ]),
      phase('rehearse', 55, [
        prompt(
          'visualize-180-rehearse-1',
          99,
          'See yourself take the first step without rushing.',
          'VIZ_3M_SEAL_01',
        ),
        prompt(
          'visualize-180-rehearse-2',
          117,
          'Run the moment again, letting your words and actions follow naturally.',
          'VIZ_3M_SEAL_02',
        ),
        prompt(
          'visualize-180-rehearse-3',
          135,
          'Practice continuing forward after the choice is made.',
          'VIZ_3M_FEEL_06',
        ),
      ]),
      phase('seal', 30, [
        prompt(
          'visualize-180-seal-1',
          155,
          'Keep the clearest image of how you showed up.',
          'VIZ_3M_SEAL_03',
        ),
        prompt(
          'visualize-180-seal-2',
          171,
          'Let this response settle into your Anchor.',
          'VIZ_3M_SEAL_04',
        ),
      ]),
    ],
  },
  300: {
    totalDurationMs: 300_000,
    phases: [
      phase('see', 55, [
        prompt('visualize-300-see-1', 3, 'Bring the scene into focus.', 'VIZ_5M_SEE_01'),
        prompt(
          'visualize-300-see-2',
          20,
          'Notice the people, objects, and movement around you.',
          'VIZ_5M_SEE_02',
        ),
        prompt(
          'visualize-300-see-3',
          38,
          'Let the image sharpen naturally without forcing detail.',
          'VIZ_5M_SEE_05',
        ),
      ]),
      phase('feel', 50, [
        prompt(
          'visualize-300-feel-1',
          60,
          'Step inside the scene and look through your own eyes.',
          'VIZ_5M_FEEL_01',
        ),
        prompt(
          'visualize-300-feel-2',
          77,
          'Notice your posture, breathing, and physical steadiness.',
          'VIZ_5M_FEEL_03',
        ),
        prompt(
          'visualize-300-feel-3',
          94,
          'Feel the pace of your thoughts as the moment asks something of you.',
          'VIZ_5M_FEEL_07',
        ),
      ]),
      phase('choose', 50, [
        prompt(
          'visualize-300-choose-1',
          110,
          'Identify the response that matches the person you are becoming.',
          'VIZ_5M_FEEL_08',
        ),
        prompt(
          'visualize-300-choose-2',
          127,
          'Make the decision precise: what will you say or do first?',
          'VIZ_5M_SEE_06',
        ),
        prompt(
          'visualize-300-choose-3',
          144,
          'Feel the alignment of choosing and moving forward.',
          'VIZ_5M_FEEL_09',
        ),
      ]),
      phase('rehearse', 95, [
        prompt(
          'visualize-300-rehearse-1',
          160,
          'See yourself take the first step clearly and naturally.',
          'VIZ_5M_SEAL_01',
        ),
        prompt(
          'visualize-300-rehearse-2',
          181,
          'Run the moment again, letting your words carry the intention.',
          'VIZ_5M_SEAL_02',
        ),
        prompt(
          'visualize-300-rehearse-3',
          204,
          'Practice meeting the difficult turn without leaving yourself.',
          'VIZ_5M_SEAL_03',
        ),
        prompt(
          'visualize-300-rehearse-4',
          230,
          'See the action complete, then continue forward with confidence.',
          'VIZ_5M_FEEL_06',
        ),
      ]),
      phase('seal', 50, [
        prompt(
          'visualize-300-seal-1',
          255,
          'Keep only the clearest image of how you showed up.',
          'VIZ_5M_SEAL_04',
        ),
        prompt(
          'visualize-300-seal-2',
          273,
          'Let the posture, calm, and certainty settle into your Anchor.',
          'VIZ_5M_SEAL_05',
        ),
        prompt(
          'visualize-300-seal-3',
          290,
          'Let this response be available to you when the moment arrives.',
          'VIZ_5M_RETURN_05',
        ),
      ]),
    ],
  },
};

export function getVisualizeSessionConfig(
  durationSeconds: VisualizeDuration,
): VisualizeSessionConfig {
  return VISUALIZE_SESSION_CONFIGS[durationSeconds];
}

export function flattenVisualizePrompts(
  config: VisualizeSessionConfig,
): readonly VisualizePromptConfig[] {
  return config.phases.flatMap((phaseConfig) => phaseConfig.prompts);
}

export function getVisualizePromptAtElapsed(
  config: VisualizeSessionConfig,
  elapsedMs: number,
): VisualizePromptConfig | null {
  let phaseStartMs = 0;
  for (const phaseConfig of config.phases) {
    const phaseEndMs = phaseStartMs + phaseConfig.durationMs;
    if (elapsedMs >= phaseStartMs && elapsedMs < phaseEndMs) {
      return (
        [...phaseConfig.prompts]
          .reverse()
          .find((item) => elapsedMs >= item.startMs) ?? null
      );
    }
    phaseStartMs = phaseEndMs;
  }

  return elapsedMs >= config.totalDurationMs
    ? [...config.phases.at(-1)?.prompts ?? []].reverse()[0] ?? null
    : null;
}

export function assertVisualizeSessionConfig(
  config: VisualizeSessionConfig,
): void {
  const phaseTotal = config.phases.reduce(
    (total, phaseConfig) => total + phaseConfig.durationMs,
    0,
  );
  if (phaseTotal !== config.totalDurationMs) {
    throw new Error('Visualize phase durations must equal the session duration.');
  }

  const phaseStartMs = config.phases.reduce((startMs, phaseConfig) => {
    const phaseEndMs = startMs + phaseConfig.durationMs;
    for (const item of phaseConfig.prompts) {
      if (item.startMs < startMs || item.startMs >= phaseEndMs) {
        throw new Error(`Visualize prompt ${item.id} is outside its phase.`);
      }
    }
    return phaseEndMs;
  }, 0);
  if (phaseStartMs !== config.totalDurationMs) {
    throw new Error('Visualize phase boundaries must end at the session duration.');
  }
}

for (const config of Object.values(VISUALIZE_SESSION_CONFIGS)) {
  assertVisualizeSessionConfig(config);
}
