import type { VisionGenerationCandidate, VisionGenerationJob } from '@/hooks/v2/vision';

/** Every generated moment is a choice between exactly two. */
export const VISION_TWO_UP_COUNT = 2;

export type VisionTwoUpPhase =
  /** No job yet, or it is queued: nothing has been made. */
  | 'starting'
  /** Work is under way and at least one image is still missing. */
  | 'developing'
  /** The images that will arrive are here; the person picks one by tapping it. */
  | 'choose'
  /** The job failed. Whatever finished is still choosable; Retry stays offered. */
  | 'failed';

export type VisionTwoUpState = {
  phase: VisionTwoUpPhase;
  /** The two slots, in the server's order. A slot is null until its candidate exists. */
  slots: Array<VisionGenerationCandidate | null>;
  /** Candidates that have a picture. */
  ready: VisionGenerationCandidate[];
  /** True when tapping an image should choose it. */
  selectable: boolean;
  title: string;
  subtitle: string;
};

const TITLE_DEVELOPING = 'Your future\nis taking shape.';
const SUBTITLE_DEVELOPING = 'Finding the moments that make it real.';
const TITLE_CHOOSE = 'Your future\nis ready to choose from.';
const SUBTITLE_CHOOSE = 'Tap the one that feels right.';

/**
 * Turns the real job state into what the screen shows. It adds nothing: no
 * invented stages and no percentages. The pictures developing is the progress.
 */
export function visionTwoUpState(job: VisionGenerationJob | null): VisionTwoUpState {
  const candidates = [...(job?.candidates ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const slots: Array<VisionGenerationCandidate | null> = Array.from({ length: VISION_TWO_UP_COUNT }, (_, index) => candidates[index] ?? null);
  const ready = candidates.filter(candidate => Boolean(candidate.imageUrl)).slice(0, VISION_TWO_UP_COUNT);
  const status = job?.status;

  let phase: VisionTwoUpPhase;
  if (!job || status === 'QUEUED') phase = 'starting';
  else if (status === 'FAILED') phase = 'failed';
  else if (status === 'COMPLETE' && ready.length > 0) phase = 'choose';
  else phase = 'developing';

  const choosing = phase === 'choose' || (phase === 'failed' && ready.length > 0);
  return {
    phase,
    slots,
    ready,
    selectable: choosing,
    title: phase === 'choose' ? TITLE_CHOOSE : TITLE_DEVELOPING,
    subtitle: phase === 'choose' ? SUBTITLE_CHOOSE : SUBTITLE_DEVELOPING,
  };
}

/** Durations are kept together so the choreography can be tuned in one place. */
export const VISION_TWO_UP_TIMING = {
  surfacesInMs: 700,
  developMs: 1400,
  selectLiftMs: 240,
  /** Time the selection settles before the hand-off to the board begins. */
  selectHandoffMs: 300,
  anchorBreathMs: 3200,
} as const;
