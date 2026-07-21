import type { VisualizationPhaseId } from '@/utils/visualizationSchedule';

export const VISUALIZE_PRESENTATION_PHASES = [
  'see',
  'feel',
  'choose',
  'rehearse',
  'seal',
] as const;

export type VisualizePresentationPhase =
  (typeof VISUALIZE_PRESENTATION_PHASES)[number];

export type VisualizeRingMotion = 'outward' | 'inward' | 'orbit' | 'depth' | 'settle';

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

const RUNTIME_TO_PRESENTATION_PHASE: Record<
  VisualizationPhaseId,
  VisualizePresentationPhase
> = {
  arrive: 'see',
  see: 'feel',
  feel: 'choose',
  seal: 'rehearse',
  return: 'seal',
};

export const VISUALIZE_PHASE_PRESENTATION: Record<
  VisualizePresentationPhase,
  VisualizePhasePresentation
> = {
  see: {
    id: 'see',
    title: 'SEE',
    supportingInstruction: 'Observe the moment without trying to change it.',
    gradient: ['#050E1C', '#0A2948', '#06111F'],
    ringMotion: 'outward',
    ringDurationMs: 15_000,
    breathDurationMs: 8_400,
    breathAmount: 0.012,
    glow: 0.32,
    depth: 0.24,
    contrast: 0.92,
  },
  feel: {
    id: 'feel',
    title: 'FEEL',
    supportingInstruction: 'Step inside the scene and let it become familiar.',
    gradient: ['#081525', '#263142', '#171623'],
    ringMotion: 'inward',
    ringDurationMs: 13_000,
    breathDurationMs: 7_200,
    breathAmount: 0.018,
    glow: 0.46,
    depth: 0.32,
    contrast: 0.96,
  },
  choose: {
    id: 'choose',
    title: 'CHOOSE',
    supportingInstruction: 'Notice the response that matches your intention.',
    gradient: ['#071321', '#17324C', '#0B101C'],
    ringMotion: 'orbit',
    ringDurationMs: 12_000,
    breathDurationMs: 6_800,
    breathAmount: 0.02,
    glow: 0.56,
    depth: 0.4,
    contrast: 1,
  },
  rehearse: {
    id: 'rehearse',
    title: 'REHEARSE',
    supportingInstruction: 'Move through the choice until it feels natural.',
    gradient: ['#050F1D', '#152C49', '#160F22'],
    ringMotion: 'depth',
    ringDurationMs: 9_500,
    breathDurationMs: 5_800,
    breathAmount: 0.025,
    glow: 0.68,
    depth: 0.62,
    contrast: 1.04,
  },
  seal: {
    id: 'seal',
    title: 'SEAL',
    supportingInstruction: 'Let the scene settle into one calm, certain choice.',
    gradient: ['#06101D', '#17263A', '#0A0E18'],
    ringMotion: 'settle',
    ringDurationMs: 28_000,
    breathDurationMs: 11_000,
    breathAmount: 0.008,
    glow: 0.76,
    depth: 0.35,
    contrast: 0.98,
  },
};

export const getVisualizePresentationPhase = (
  runtimePhase: VisualizationPhaseId,
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

export const shouldPinPreparationCta = (
  contentHeight: number,
  viewportHeight: number,
  keyboardVisible: boolean,
): boolean =>
  !keyboardVisible && viewportHeight > 0 && contentHeight > viewportHeight + 1;

export const getPreparationArtworkSize = (screenHeight: number): number =>
  screenHeight < 720 ? 180 : 192;
