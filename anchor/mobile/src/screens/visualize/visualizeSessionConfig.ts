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
  lines: readonly VisualizePromptLine[];
}

export const VISUALIZE_PHASE_DEFINITIONS: readonly VisualizePhaseDefinition[] = [
  {
    key: 'arrive',
    name: 'Arrive',
    weight: 0.16,
    lines: [
      { m: 'Let your attention settle.' },
      { m: 'Return to the Anchor.' },
      { m: 'Allow your breathing to slow.', s: 'In… and out.' },
    ],
  },
  {
    key: 'build',
    name: 'Build',
    weight: 0.24,
    lines: [
      { m: 'Let the moment begin.' },
      { m: 'Where are you?' },
      { m: 'What happens first?' },
      { m: 'What do you notice around you?' },
    ],
  },
  {
    key: 'rehearse',
    name: 'Rehearse',
    weight: 0.30,
    lines: [
      { m: 'Move through the moment.' },
      { m: 'Notice how you begin.' },
      { m: 'What do you say or do?' },
      { m: 'Notice your posture.' },
      { m: 'What does deliberate action look like here?' },
    ],
  },
  {
    key: 'adapt',
    name: 'Adapt',
    weight: 0.18,
    lines: [
      { m: 'Something shifts.' },
      { m: 'The moment becomes harder than expected.' },
      { m: 'What do you do next?' },
      { m: 'Return to the response you want to practice.' },
      { m: 'Continue without rushing.' },
    ],
  },
  {
    key: 'return',
    name: 'Return',
    weight: 0.12,
    lines: [
      { m: 'Let the scene fade.' },
      { m: 'Return your attention to the Anchor.' },
      { m: 'Let your attention widen to the room.' },
      { m: 'Carry one useful response into what comes next.' },
    ],
  },
];

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
  const lineCount = def.lines.length;
  const lineDuration = phaseDurationSeconds / lineCount;

  const voicePrefix = sessionDurationSeconds === 60 ? '1M' : sessionDurationSeconds === 180 ? '3M' : '5M';
  const phaseUpper = def.key.toUpperCase();

  const prompts: VisualizePromptConfig[] = def.lines.map((line, idx) => {
    const startSeconds = phaseStartSeconds + idx * lineDuration;
    const paddedIdx = String(idx + 1).padStart(2, '0');
    // Map voice assets gracefully; fallback safely to available asset IDs
    const voiceAssetId = `VIZ_${voicePrefix}_${phaseUpper}_${paddedIdx}`;
    return {
      id: `viz-${sessionDurationSeconds}-${def.key}-${idx + 1}`,
      startMs: Math.round(startSeconds * 1_000),
      text: line.m,
      subText: line.s,
      voiceAssetId: `VIZ_${voicePrefix}_${def.key === 'build' ? 'SEE' : def.key === 'rehearse' ? 'FEEL' : def.key === 'adapt' ? 'SEAL' : phaseUpper}_01`,
    };
  });

  return {
    id: def.key,
    name: def.name,
    durationMs: phaseDurationSeconds * 1_000,
    lines: def.lines,
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
