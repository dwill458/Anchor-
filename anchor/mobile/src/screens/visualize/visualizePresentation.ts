import {
  VISUALIZE_SESSION_CONFIGS,
  type VisualizePhaseId,
  type VisualizeRingMotion,
} from './visualizeSessionConfig';

export const VISUALIZE_PRESENTATION_PHASES = [
  'arrive',
  'build',
  'rehearse',
  'adapt',
  'return',
] as const;

export type VisualizePresentationPhase =
  (typeof VISUALIZE_PRESENTATION_PHASES)[number];

export interface VisualizePhasePresentation {
  id: VisualizePresentationPhase;
  title: string;
  supportingInstruction: string;
  gradient: readonly [string, string, string];
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

const RUNTIME_TO_PRESENTATION_PHASE: Record<VisualizePhaseId, VisualizePresentationPhase> = {
  arrive: 'arrive',
  build: 'build',
  rehearse: 'rehearse',
  adapt: 'adapt',
  return: 'return',
};

const animationProfile = (phase: VisualizePresentationPhase) =>
  VISUALIZE_SESSION_CONFIGS[60].phases.find((item) => item.id === phase)!
    .animationProfile;

export const VISUALIZE_PHASE_PRESENTATION: Record<
  VisualizePresentationPhase,
  VisualizePhasePresentation
> = {
  arrive: {
    id: 'arrive',
    title: 'ARRIVE',
    supportingInstruction: 'Let your attention settle.',
    gradient: ['#04060C', '#132244', '#0A1122'],
    ...animationProfile('arrive'),
  },
  build: {
    id: 'build',
    title: 'BUILD',
    supportingInstruction: 'Let the moment begin.',
    gradient: ['#04060C', '#1C2F57', '#132244'],
    ...animationProfile('build'),
  },
  rehearse: {
    id: 'rehearse',
    title: 'REHEARSE',
    supportingInstruction: 'Move through the moment.',
    gradient: ['#04060C', '#0E1D3A', '#080D1B'],
    ...animationProfile('rehearse'),
  },
  adapt: {
    id: 'adapt',
    title: 'ADAPT',
    supportingInstruction: 'Something shifts.',
    gradient: ['#04060C', '#221915', '#0C0E18'],
    ...animationProfile('adapt'),
  },
  return: {
    id: 'return',
    title: 'RETURN',
    supportingInstruction: 'Let the scene fade.',
    gradient: ['#04060C', '#16294D', '#080D1A'],
    ...animationProfile('return'),
  },
};

export const getVisualizePresentationPhase = (
  runtimePhase: VisualizePhaseId,
): VisualizePresentationPhase => RUNTIME_TO_PRESENTATION_PHASE[runtimePhase] ?? 'arrive';

export type VisualizeSegmentState = 'completed' | 'current' | 'upcoming';

export const getVisualizeSegmentState = (
  segmentIndex: number,
  currentIndex: number,
): VisualizeSegmentState => {
  if (segmentIndex < currentIndex) return 'completed';
  if (segmentIndex === currentIndex) return 'current';
  return 'upcoming';
};

export interface VisualizeSceneCue {
  title: string;
  qualities: string;
}

const LEADING_ACTIONS =
  /^(stay|move|make|begin|pause|review|recognize|enter|notice|take|meet|give|i)\s+/i;
const SCENE_TITLE_PHRASES = [
  'meaningful conversation',
  'important task',
  'clear decision',
  'next useful step',
  'specific challenge',
  'shared moment',
  'unfamiliar moment',
  'one clear piece',
] as const;

const QUALITY_GROUPS = [
  { label: 'Present', words: ['present', 'awareness', 'attention'] },
  { label: 'Listening', words: ['listen', 'listening'] },
  { label: 'Honest', words: ['honest', 'honesty'] },
  { label: 'Clear', words: ['clear', 'clarity', 'decision'] },
  { label: 'Steady', words: ['steady', 'steadiness'] },
  { label: 'Calm', words: ['calm'] },
  { label: 'Confident', words: ['confidence', 'confident'] },
  { label: 'Care', words: ['care'] },
  { label: 'Curious', words: ['curiosity'] },
  { label: 'Warm', words: ['warmth'] },
  { label: 'Patient', words: ['patience'] },
  { label: 'Forward', words: ['follow through', 'forward'] },
] as const;

/** Turns the saved sentence into a low-cognitive-load cue for active practice. */
export const getVisualizeSceneCue = (sceneText: string): VisualizeSceneCue => {
  const normalized = sceneText.replace(/\s+/g, ' ').trim();
  const firstClause = normalized.split(/[,.!?]/)[0] ?? normalized;
  const normalizedLower = normalized.toLowerCase();
  const titlePhrase = SCENE_TITLE_PHRASES.find((phrase) =>
    normalizedLower.includes(phrase),
  );
  const title = (titlePhrase
    ? titlePhrase
    : firstClause
        .replace(LEADING_ACTIONS, '')
        .replace(/^(through|into|in|with|the|a|an)\s+/i, '')
        .trim()
  )
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 42);
  const qualities = QUALITY_GROUPS.filter(({ words }) =>
    words.some((word) => normalizedLower.includes(word)),
  )
    .slice(0, 3)
    .map(({ label }) => label)
    .join(' · ');

  return {
    title: title || 'Your chosen moment',
    qualities: qualities || 'Present · Clear · Steady',
  };
};

export const shouldPinPreparationCta = (
  contentHeight: number,
  viewportHeight: number,
  keyboardVisible: boolean,
): boolean =>
  !keyboardVisible && viewportHeight > 0 && contentHeight > viewportHeight + 1;

export type VisualizationLensVariant = 'entrance' | 'practice' | 'completion';

export const getVisualizationLensSize = (
  variant: VisualizationLensVariant,
  screenWidth: number,
): number => {
  const sizes: Record<VisualizationLensVariant, [number, number]> = {
    entrance: [0.52, 210],
    practice: [0.72, 290],
    completion: [0.56, 225],
  };
  const [ratio, maximum] = sizes[variant];
  return Math.min(Math.round(screenWidth * ratio), maximum);
};
