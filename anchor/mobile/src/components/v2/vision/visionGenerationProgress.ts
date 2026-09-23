import type { VisionGenerationJob } from '@/hooks/v2/vision';

/** The backend plans and renders this many candidates per set. */
export const VISION_SET_SIZE = 8;

export type VisionGenerationPhase = 'forming' | 'revealing' | 'ready' | 'failed';

export interface VisionGenerationProgress {
  phase: VisionGenerationPhase;
  title: string;
  detail: string;
  ready: number;
  total: number;
}

/**
 * A single human status line. The image field is the progress indicator; this
 * deliberately never exposes stages, counts, or provider mechanics.
 */
export function visionGenerationProgress(
  job: VisionGenerationJob | null | undefined,
  presentationSettled = true,
): VisionGenerationProgress {
  const ready = job?.candidates.length ?? 0;
  const total = VISION_SET_SIZE;
  const failed = job?.status === 'FAILED';
  const complete = job?.status === 'COMPLETE';
  const phase: VisionGenerationPhase = failed
    ? 'failed'
    : complete
      ? 'ready'
      : ready > 0
        ? 'revealing'
        : 'forming';

  const copy: Record<VisionGenerationPhase, { title: string; detail: string }> = {
    forming: { title: 'Finding the first moment…', detail: 'Finding the moments that make it real.' },
    revealing: { title: ready > 1 ? 'Finding another moment…' : 'Bringing the details into focus…', detail: 'Finding the moments that make it real.' },
    ready: { title: 'Your Vision is ready.', detail: 'Your future is ready to choose from.' },
    failed: { title: 'Your Vision paused.', detail: job?.error ?? 'Your images could not be completed.' },
  };
  const finalCopy = complete && !presentationSettled
    ? { title: 'Bringing your future into focus…', detail: 'Finding the moments that make it real.' }
    : copy[phase];
  return { phase, ...finalCopy, ready, total };
}
