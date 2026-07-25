import {
  VISUALIZE_SESSION_CONFIGS,
  type VisualizePhaseId,
  type VisualizeRingMotion,
} from './visualizeSessionConfig';

export const VISUALIZE_PRESENTATION_PHASES = [
  'see',
  'feel',
  'choose',
  'rehearse',
  'seal',
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
}

const RUNTIME_TO_PRESENTATION_PHASE: Record<VisualizePhaseId, VisualizePresentationPhase> = {
  see: 'see',
  feel: 'feel',
  choose: 'choose',
  rehearse: 'rehearse',
  seal: 'seal',
};

const animationProfile = (phase: VisualizePresentationPhase) =>
  VISUALIZE_SESSION_CONFIGS[60].phases.find((item) => item.id === phase)!
    .animationProfile;

export const VISUALIZE_PHASE_PRESENTATION: Record<
  VisualizePresentationPhase,
  VisualizePhasePresentation
> = {
  see: {
    id: 'see',
    title: 'SEE',
    supportingInstruction: 'Bring the scene into focus.',
    gradient: ['#040D1B', '#0B2D52', '#06111F'],
    ...animationProfile('see'),
  },
  feel: {
    id: 'feel',
    title: 'FEEL',
    supportingInstruction: 'Notice the moment in your body.',
    gradient: ['#071525', '#173A5A', '#0A1423'],
    ...animationProfile('feel'),
  },
  choose: {
    id: 'choose',
    title: 'CHOOSE',
    supportingInstruction: 'Align with the response you choose.',
    gradient: ['#061321', '#12456A', '#081421'],
    ...animationProfile('choose'),
  },
  rehearse: {
    id: 'rehearse',
    title: 'REHEARSE',
    supportingInstruction: 'Practice the action until it feels natural.',
    gradient: ['#04101E', '#0E355A', '#0A1829'],
    ...animationProfile('rehearse'),
  },
  seal: {
    id: 'seal',
    title: 'SEAL',
    supportingInstruction: 'Let the response settle into your Anchor.',
    gradient: ['#050F1D', '#12304D', '#07111E'],
    ...animationProfile('seal'),
  },
};

export const getVisualizePresentationPhase = (
  runtimePhase: VisualizePhaseId,
): VisualizePresentationPhase => RUNTIME_TO_PRESENTATION_PHASE[runtimePhase];

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
