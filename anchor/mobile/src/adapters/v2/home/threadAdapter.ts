import type { Anchor } from '@/types';

/**
 * Presentation shape consumed by `V2ThreadStrength`. This adapter performs NO
 * progression, gain, decay, or delta math. It surfaces the value the domain
 * already stored on the Anchor and leaves movement fields undefined until a
 * server-authoritative Thread movement contract (THREAD_V2) is available.
 */
export type V2ThreadPresentation = {
  value: number | null;
  status?: 'unestablished' | 'active' | 'grace' | 'decaying' | 'dormant';
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

export function toThreadPresentation(
  anchor: Pick<Anchor, 'category' | 'threadStrength'> & {
    threadStatus?: 'unestablished' | 'active' | 'grace' | 'decaying' | 'dormant';
  }
): V2ThreadPresentation {
  const stored = anchor.threadStrength;
  const hasStored = typeof stored === 'number' && Number.isFinite(stored);
  return {
    value: hasStored ? clamp(stored as number) : null,
    status: anchor.threadStatus ?? (hasStored ? 'active' : 'unestablished'),
    category: anchor.category,
    unmeasured: !hasStored,
  };
}

/** Qualitative label for a strength value matching Anchor's progression levels. */
export function threadQualitativeLabel(value: number | null, unmeasured: boolean): string {
  if (unmeasured || value === null) return 'Not established';
  if (value <= 10) return 'Dormant';
  if (value < 25) return 'Forming';
  if (value < 50) return 'Building';
  if (value < 75) return 'Established';
  if (value < 90) return 'Integrated';
  return 'Reinforced';
}

export function threadStatusSublabel(value: number | null, status?: string): string {
  if (value === null || status === 'unestablished') return 'Begin reinforcing';
  if (value <= 10 || status === 'dormant') return 'Ready to rebuild';
  if (status === 'grace') return 'Grace period active';
  if (status === 'decaying') return 'Softening';
  return 'Active reinforcement';
}
