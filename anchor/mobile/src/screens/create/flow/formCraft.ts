import { FORM_SLOW_CAPTION_AFTER } from './creationFlowConfig';
import { FORM_REVEAL_SECONDS, FORM_TIMING } from './scenes/FormScene';

export type FormCue = { id: string; haptic?: 'light' | 'medium'; sound?: 'formTick'; volume?: number };

/** Crossed moments only. The screen owns playback, foreground gating and retry deduplication. */
export function formCraftCues(prevTf: number, tf: number, opts: { slow: boolean }): FormCue[] {
  if (!Number.isFinite(prevTf) || !Number.isFinite(tf) || tf <= prevTf) return [];
  const cues: FormCue[] = [];
  // Seconds assembled from timing constants can differ from the clock by a floating-point ulp.
  const epsilon = 1e-9;
  const crossed = (at: number) => prevTf < at - epsilon && tf >= at - epsilon;
  if (crossed(FORM_TIMING.redrawStart)) cues.push({ id: 'pen-start', haptic: 'light' });
  if (crossed(FORM_REVEAL_SECONDS)) cues.push({ id: 'material-arrived', haptic: 'medium' });

  const period = FORM_TIMING.sheenPeriod;
  const normalPasses = Math.floor((FORM_SLOW_CAPTION_AFTER - FORM_REVEAL_SECONDS) / period);
  const normalEnd = opts.slow ? Math.min(tf, FORM_SLOW_CAPTION_AFTER) : tf;
  for (let n = Math.max(1, Math.floor((prevTf - FORM_REVEAL_SECONDS) / period) + 1);
    FORM_REVEAL_SECONDS + n * period <= normalEnd + epsilon; n += 1) {
    if (crossed(FORM_REVEAL_SECONDS + n * period)) {
      cues.push({ id: `sheen-${n}`, haptic: 'light', sound: 'formTick', volume: 0.30 });
    }
  }

  if (opts.slow) {
    // Keep the last pass as the origin: slowing the wait never adds an extra tick at 12 seconds.
    const origin = FORM_REVEAL_SECONDS + normalPasses * period;
    const slowPeriod = period * 1.5;
    for (let n = Math.max(1, Math.floor((prevTf - origin) / slowPeriod) + 1);
      origin + n * slowPeriod <= tf + epsilon; n += 1) {
      if (crossed(origin + n * slowPeriod)) {
        cues.push({ id: `slow-sheen-${n}`, ...(n % 2 === 1 ? { haptic: 'light' as const } : {}), sound: 'formTick', volume: 0.21 });
      }
    }
  }
  return cues;
}
