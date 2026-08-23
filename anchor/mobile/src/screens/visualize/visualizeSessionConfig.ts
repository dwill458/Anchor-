export const VISUALIZE_DURATIONS = [60, 180, 300] as const;
export type VisualizeDuration = (typeof VISUALIZE_DURATIONS)[number];

export const VISUALIZE_PHASE_IDS = [
  'arrive',
  'build',
  'rehearse',
  'adapt',
  'return',
] as const;
export type VisualizePhaseId = (typeof VISUALIZE_PHASE_IDS)[number];

export interface VisualizePromptLine {
  m: string;
  s?: string;
}

export interface VisualizePhaseDefinition {
  key: VisualizePhaseId;
  name: string;
  weight: number;
}

export const VISUALIZE_PHASE_DEFINITIONS: readonly VisualizePhaseDefinition[] = [
  {
    key: 'arrive',
    name: 'Arrive',
    weight: 0.16,
  },
  {
    key: 'build',
    name: 'Build',
    weight: 0.28,
  },
  {
    key: 'rehearse',
    name: 'Rehearse',
    weight: 0.28,
  },
  {
    key: 'adapt',
    name: 'Adapt',
    weight: 0.16,
  },
  {
    key: 'return',
    name: 'Return',
    weight: 0.12,
  },
];

interface PromptSourceSpec {
  m: string;
  s?: string;
  voiceAssetId: string;
}

const VISUALIZE_PROMPTS_BY_DURATION: Record<
  VisualizeDuration,
  Record<VisualizePhaseId, readonly PromptSourceSpec[]>
> = {
  60: {
    arrive: [
      { m: 'Let your attention settle on your anchor.', voiceAssetId: 'VIZ_1M_ARRIVE_01' },
      { m: 'Take a slow breath in.', s: 'And let it go.', voiceAssetId: 'VIZ_1M_ARRIVE_02' },
    ],
    build: [
      { m: 'Bring your scene to mind.', voiceAssetId: 'VIZ_1M_SEE_01' },
      { m: 'Picture the exact moment that shows this intention is real.', voiceAssetId: 'VIZ_1M_SEE_02' },
      { m: 'What is the clearest detail you see?', voiceAssetId: 'VIZ_1M_SEE_03' },
    ],
    rehearse: [
      { m: 'Step into the scene.', voiceAssetId: 'VIZ_1M_FEEL_01' },
      { m: 'Notice your posture, your breathing, and the way you respond.', voiceAssetId: 'VIZ_1M_FEEL_02' },
      { m: 'Let this version of you feel familiar.', voiceAssetId: 'VIZ_1M_FEEL_03' },
    ],
    adapt: [
      { m: 'Let the scene become smaller and clearer.', voiceAssetId: 'VIZ_1M_SEAL_01' },
      { m: 'Place that feeling back into your anchor.', voiceAssetId: 'VIZ_1M_SEAL_02' },
    ],
    return: [
      { m: 'Return to the room.', s: 'Carry it into your next action.', voiceAssetId: 'VIZ_1M_RETURN_01' },
    ],
  },
  180: {
    arrive: [
      { m: 'Let your attention settle on your anchor.', voiceAssetId: 'VIZ_3M_ARRIVE_01' },
      { m: 'Notice the shape, the lines, and the space around it.', voiceAssetId: 'VIZ_3M_ARRIVE_02' },
      { m: 'Take a slow breath in.', voiceAssetId: 'VIZ_3M_ARRIVE_03' },
      { m: 'And let it go.', voiceAssetId: 'VIZ_3M_ARRIVE_04' },
      { m: 'You do not need to force anything. Just become present.', voiceAssetId: 'VIZ_3M_ARRIVE_05' },
    ],
    build: [
      { m: 'Bring your scene to mind.', voiceAssetId: 'VIZ_3M_SEE_01' },
      { m: 'Picture the exact moment that shows this intention is already real.', voiceAssetId: 'VIZ_3M_SEE_02' },
      { m: 'Notice where you are.', voiceAssetId: 'VIZ_3M_SEE_03' },
      { m: 'What do you see first?', voiceAssetId: 'VIZ_3M_SEE_04' },
      { m: 'What is happening around you?', voiceAssetId: 'VIZ_3M_SEE_05' },
      { m: 'Let the scene become clear enough to enter without trying to control every detail.', voiceAssetId: 'VIZ_3M_SEE_06' },
    ],
    rehearse: [
      { m: 'Now step into the scene.', voiceAssetId: 'VIZ_3M_FEEL_01' },
      { m: 'Notice your posture.', voiceAssetId: 'VIZ_3M_FEEL_02' },
      { m: 'Notice your breathing.', voiceAssetId: 'VIZ_3M_FEEL_03' },
      { m: 'Listen to the way you speak and the pace of your decisions.', voiceAssetId: 'VIZ_3M_FEEL_04' },
      { m: 'See how you respond when the moment asks something of you.', voiceAssetId: 'VIZ_3M_FEEL_05' },
      { m: 'Let this response feel practiced and familiar.', voiceAssetId: 'VIZ_3M_FEEL_06' },
    ],
    adapt: [
      { m: 'Let the scene become smaller and clearer.', voiceAssetId: 'VIZ_3M_SEAL_01' },
      { m: 'Keep the posture, the calm, and the certainty.', voiceAssetId: 'VIZ_3M_SEAL_02' },
      { m: 'Allow the image to move back into your anchor.', voiceAssetId: 'VIZ_3M_SEAL_03' },
      { m: 'Let the anchor hold the memory of this response.', voiceAssetId: 'VIZ_3M_SEAL_04' },
    ],
    return: [
      { m: 'Begin returning your attention to the room.', voiceAssetId: 'VIZ_3M_RETURN_01' },
      { m: 'Feel the surface beneath you.', voiceAssetId: 'VIZ_3M_RETURN_02' },
      { m: 'Take one natural breath.', voiceAssetId: 'VIZ_3M_RETURN_03' },
      { m: 'Carry this version of yourself into your next action.', voiceAssetId: 'VIZ_3M_RETURN_04' },
    ],
  },
  300: {
    arrive: [
      { m: 'Let your attention settle on your anchor.', voiceAssetId: 'VIZ_5M_ARRIVE_01' },
      { m: 'Notice the shape, the lines, and the space around it.', voiceAssetId: 'VIZ_5M_ARRIVE_02' },
      { m: 'You do not need to solve anything right now.', voiceAssetId: 'VIZ_5M_ARRIVE_03' },
      { m: 'Take a slow breath in.', voiceAssetId: 'VIZ_5M_ARRIVE_04' },
      { m: 'Hold it gently.', voiceAssetId: 'VIZ_5M_ARRIVE_05' },
      { m: 'And let it go.', voiceAssetId: 'VIZ_5M_ARRIVE_06' },
      { m: 'Allow the noise around you to move farther away.', voiceAssetId: 'VIZ_5M_ARRIVE_07' },
    ],
    build: [
      { m: 'Bring your saved scene to mind.', voiceAssetId: 'VIZ_5M_SEE_01' },
      { m: 'Picture the exact moment that shows this intention is already real.', voiceAssetId: 'VIZ_5M_SEE_02' },
      { m: 'Notice where you are.', voiceAssetId: 'VIZ_5M_SEE_03' },
      { m: 'What can you see around you?', voiceAssetId: 'VIZ_5M_SEE_04' },
      { m: 'What is the first detail that makes this moment feel real?', voiceAssetId: 'VIZ_5M_SEE_05' },
      { m: 'Notice the people, objects, or movement within the scene.', voiceAssetId: 'VIZ_5M_SEE_06' },
      { m: 'Let the image sharpen naturally.', voiceAssetId: 'VIZ_5M_SEE_07' },
      { m: 'See the moment unfold from beginning to end.', voiceAssetId: 'VIZ_5M_SEE_08' },
      { m: 'Do not chase perfection. Let the scene feel real enough to enter.', voiceAssetId: 'VIZ_5M_SEE_09' },
    ],
    rehearse: [
      { m: 'Now step into the scene.', voiceAssetId: 'VIZ_5M_FEEL_01' },
      { m: 'Look through your own eyes instead of watching yourself from a distance.', voiceAssetId: 'VIZ_5M_FEEL_02' },
      { m: 'Notice your posture.', voiceAssetId: 'VIZ_5M_FEEL_03' },
      { m: 'Notice your breathing.', voiceAssetId: 'VIZ_5M_FEEL_04' },
      { m: 'Listen to the way you speak.', voiceAssetId: 'VIZ_5M_FEEL_05' },
      { m: 'Feel the pace of your thoughts and decisions.', voiceAssetId: 'VIZ_5M_FEEL_06' },
      { m: 'When the moment becomes difficult, notice how you respond.', voiceAssetId: 'VIZ_5M_FEEL_07' },
      { m: 'See yourself remain connected to the intention behind this anchor.', voiceAssetId: 'VIZ_5M_FEEL_08' },
      { m: 'Let this way of responding feel practiced, steady, and familiar.', voiceAssetId: 'VIZ_5M_FEEL_09' },
    ],
    adapt: [
      { m: 'Let the scene begin to narrow.', voiceAssetId: 'VIZ_5M_SEAL_01' },
      { m: 'Keep only the clearest image of how you showed up.', voiceAssetId: 'VIZ_5M_SEAL_02' },
      { m: 'Hold onto the posture, the calm, and the certainty.', voiceAssetId: 'VIZ_5M_SEAL_03' },
      { m: 'Allow the scene to move back into your anchor.', voiceAssetId: 'VIZ_5M_SEAL_04' },
      { m: 'Let the anchor hold the memory of this response.', voiceAssetId: 'VIZ_5M_SEAL_05' },
    ],
    return: [
      { m: 'Begin returning your attention to the room.', voiceAssetId: 'VIZ_5M_RETURN_01' },
      { m: 'Feel the surface beneath you.', voiceAssetId: 'VIZ_5M_RETURN_02' },
      { m: 'Notice the sounds around you.', voiceAssetId: 'VIZ_5M_RETURN_03' },
      { m: 'Take one natural breath.', voiceAssetId: 'VIZ_5M_RETURN_04' },
      { m: 'Carry this version of yourself into the next thing you do.', voiceAssetId: 'VIZ_5M_RETURN_05' },
    ],
  },
};

/** Haptic pulse moments (fraction within phase) - one light pulse per phase entry */
export const VISUALIZE_PULSES: Record<VisualizePhaseId, readonly number[]> = {
  arrive: [0.04],
  build: [0.04],
  rehearse: [0.04],
  adapt: [0.04],
  return: [0.04],
};

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
  sigilScale: number;
  sigilOpacity: number;
  frameOpacity: number;
}

export interface VisualizePromptConfig {
  id: string;
  startMs: number;
  text: string;
  subText?: string;
  voiceAssetId: string;
}

export interface VisualizePhaseConfig {
  id: VisualizePhaseId;
  name: string;
  durationMs: number;
  lines: readonly VisualizePromptLine[];
  prompts: readonly VisualizePromptConfig[];
  animationProfile: VisualizeAnimationProfile;
}

export interface VisualizeSessionConfig {
  totalDurationMs: number;
  phases: readonly VisualizePhaseConfig[];
}

const PROFILES: Record<VisualizePhaseId, VisualizeAnimationProfile> = {
  arrive: {
    ringMotion: 'outward',
    ringDurationMs: 9_000,
    breathDurationMs: 9_000,
    breathAmount: 0.045,
    glow: 0.35,
    depth: 0.22,
    contrast: 0.9,
    sigilScale: 1.05,
    sigilOpacity: 1.0,
    frameOpacity: 1.0,
  },
  build: {
    ringMotion: 'orbit',
    ringDurationMs: 8_000,
    breathDurationMs: 8_000,
    breathAmount: 0.02,
    glow: 0.55,
    depth: 0.4,
    contrast: 1,
    sigilScale: 0.82,
    sigilOpacity: 1.0,
    frameOpacity: 1.0,
  },
  rehearse: {
    ringMotion: 'directional',
    ringDurationMs: 10_000,
    breathDurationMs: 10_000,
    breathAmount: 0.015,
    glow: 0.3,
    depth: 0.62,
    contrast: 1.04,
    sigilScale: 0.56,
    sigilOpacity: 0.55,
    frameOpacity: 0.62,
  },
  adapt: {
    ringMotion: 'inward',
    ringDurationMs: 7_000,
    breathDurationMs: 7_000,
    breathAmount: 0.018,
    glow: 0.45,
    depth: 0.5,
    contrast: 1.0,
    sigilScale: 0.56,
    sigilOpacity: 0.5,
    frameOpacity: 0.62,
  },
  return: {
    ringMotion: 'settle',
    ringDurationMs: 12_000,
    breathDurationMs: 11_000,
    breathAmount: 0.006,
    glow: 0.6,
    depth: 0.35,
    contrast: 0.98,
    sigilScale: 1.05,
    sigilOpacity: 1.0,
    frameOpacity: 1.0,
  },
};

const buildPhaseConfig = (
  def: VisualizePhaseDefinition,
  phaseDurationSeconds: number,
  phaseStartSeconds: number,
  sessionDurationSeconds: number,
): VisualizePhaseConfig => {
  const phasePrompts =
    VISUALIZE_PROMPTS_BY_DURATION[sessionDurationSeconds as VisualizeDuration]?.[def.key] ?? [];
  const lineCount = Math.max(1, phasePrompts.length);
  const lineDuration = phaseDurationSeconds / lineCount;

  const prompts: VisualizePromptConfig[] = phasePrompts.map((item, idx) => {
    const startSeconds = phaseStartSeconds + idx * lineDuration;
    return {
      id: `viz-${sessionDurationSeconds}-${def.key}-${idx + 1}`,
      startMs: Math.round(startSeconds * 1_000),
      text: item.m,
      subText: item.s,
      voiceAssetId: item.voiceAssetId,
    };
  });

  const lines: VisualizePromptLine[] = phasePrompts.map((item) => ({
    m: item.m,
    s: item.s,
  }));

  return {
    id: def.key,
    name: def.name,
    durationMs: phaseDurationSeconds * 1_000,
    lines,
    prompts,
    animationProfile: PROFILES[def.key],
  };
};

const createSessionConfig = (totalDuration: VisualizeDuration): VisualizeSessionConfig => {
  const segs = VISUALIZE_PHASE_DEFINITIONS.map((p, i) => {
    if (i === VISUALIZE_PHASE_DEFINITIONS.length - 1) {
      // remainder to ensure exact sum
      const prevSum = VISUALIZE_PHASE_DEFINITIONS.slice(0, -1)
        .map((prev) => Math.max(4, Math.round(prev.weight * totalDuration)))
        .reduce((a, b) => a + b, 0);
      return totalDuration - prevSum;
    }
    return Math.max(4, Math.round(p.weight * totalDuration));
  });

  let currentStart = 0;
  const phases: VisualizePhaseConfig[] = VISUALIZE_PHASE_DEFINITIONS.map((def, i) => {
    const phaseDur = segs[i];
    const cfg = buildPhaseConfig(def, phaseDur, currentStart, totalDuration);
    currentStart += phaseDur;
    return cfg;
  });

  return {
    totalDurationMs: totalDuration * 1_000,
    phases,
  };
};

export const VISUALIZE_SESSION_CONFIGS: Readonly<
  Record<VisualizeDuration, VisualizeSessionConfig>
> = {
  60: createSessionConfig(60),
  180: createSessionConfig(180),
  300: createSessionConfig(300),
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
