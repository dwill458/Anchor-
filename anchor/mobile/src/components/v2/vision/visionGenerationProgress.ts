import type { VisionGenerationJob } from '@/hooks/v2/vision';

/** The backend plans and renders this many candidates per set. */
export const VISION_SET_SIZE = 8;

export type VisionGenerationPhase = 'reading' | 'building' | 'shaping' | 'ready' | 'failed';
export type VisionGenerationStepState = 'done' | 'active' | 'pending';

export interface VisionGenerationProgress {
  phase: VisionGenerationPhase;
  title: string;
  detail: string;
  ready: number;
  total: number;
  steps: Array<{ key: string; label: string; state: VisionGenerationStepState }>;
}

/**
 * Presentation of a generation job, derived only from what the server has
 * reported: job status, its stage, and candidates that actually exist. No
 * timers, no simulated percentages.
 *
 * `presentationSettled` is the one UI input: the server may finish before the
 * screen has finished showing what arrived, so "Almost ready" completes only
 * when both are true. It never marks unfinished work as done.
 */
export function visionGenerationProgress(
  job: VisionGenerationJob | null | undefined,
  presentationSettled = true,
): VisionGenerationProgress {
  const ready = job?.candidates.length ?? 0;
  const total = VISION_SET_SIZE;
  const failed = job?.status === 'FAILED';
  const complete = job?.status === 'COMPLETE';
  const reading = !job || job.status === 'QUEUED';
  const planned = Boolean(job && (job.stage === 'creating_images' || job.status === 'PARTIAL' || complete || ready > 0));
  const rendered = complete || ready >= total;
  const phase: VisionGenerationPhase = failed
    ? 'failed'
    : complete
      ? 'ready'
      : ready > 0
        ? 'shaping'
        : planned
          ? 'building'
          : 'reading';

  const step = (done: boolean, active: boolean): VisionGenerationStepState => (done ? 'done' : active && !failed ? 'active' : 'pending');
  const steps = [
    { key: 'read', label: 'Reading your Vision', state: step(!reading, reading) },
    { key: 'plan', label: 'Planning the scenes', state: step(planned, !reading && !planned) },
    { key: 'render', label: 'Creating your images', state: step(rendered, planned && !rendered) },
    { key: 'ready', label: 'Almost ready', state: step(complete && presentationSettled, rendered) },
  ];

  const copy: Record<VisionGenerationPhase, { title: string; detail: string }> = {
    reading: { title: 'Reading your Vision', detail: 'Finding the moments that make it real.' },
    building: { title: 'Planning the scenes', detail: 'Turning those details into scenes you can return to.' },
    shaping: { title: 'Creating your images', detail: `${ready} of ${total} images ready` },
    ready: { title: 'Your Vision is ready', detail: `${ready} scenes to choose from` },
    failed: { title: 'Your Vision paused', detail: job?.error ?? 'Some images could not be created.' },
  };
  return { phase, ...copy[phase], ready, total, steps };
}
