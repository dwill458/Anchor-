import type { Anchor } from '@/types';

/**
 * Presentation shape consumed by `V2ThreadStrength`. This adapter performs NO
 * progression, gain, decay, or delta math. It surfaces the value the domain
 * already stored on the Anchor and leaves movement fields undefined until a
 * server-authoritative Thread movement contract (THREAD_V2) is available.
 */
export type V2ThreadPresentation = {
  value: number;
  category?: string | null;
  /** Only set when a real, domain-provided movement value exists. */
  previousValue?: number;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  detail?: string;
  /** True when no stored strength exists yet (no sessions recorded). */
  unmeasured: boolean;
};

const clamp = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export function toThreadPresentation(anchor: Pick<Anchor, 'category' | 'threadStrength'>): V2ThreadPresentation {
  const stored = anchor.threadStrength;
  const hasStored = typeof stored === 'number' && Number.isFinite(stored);
  return {
    value: hasStored ? clamp(stored as number) : 0,
    category: anchor.category,
    unmeasured: !hasStored,
  };
}

/** Grounded qualitative label for a strength value. Mirrors the locked mockup copy. */
export function threadQualitativeLabel(value: number, unmeasured: boolean): string {
  if (unmeasured) return 'Not yet measured';
  if (value === 0) return 'Dormant';
  if (value < 25) return 'Fraying';
  if (value < 45) return 'Slipping';
  if (value < 70) return 'Taking shape';
  if (value < 90) return 'Holding strong';
  return 'Fully tensioned';
}
