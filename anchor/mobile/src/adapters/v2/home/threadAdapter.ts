import type { Anchor } from '@/types';
import type { V2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';

/**
 * Presentation shape consumed by `V2ThreadStrength`. This adapter performs NO
 * progression, gain, decay, or delta math. It surfaces the value the domain
 * already stored on the Anchor, preferring the cached V2 server reading and
 * its movement fields when that context has arrived.
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
  },
  serverThread?: V2RecommendationContext['thread'],
): V2ThreadPresentation {
  const stored = typeof serverThread?.strength === 'number' && Number.isFinite(serverThread.strength)
    ? serverThread.strength : anchor.threadStrength;
  const hasStored = typeof stored === 'number' && Number.isFinite(stored);
  const delta = hasStored && serverThread?.delta7dStatus === 'AVAILABLE' && typeof serverThread.delta7d === 'number' && Number.isFinite(serverThread.delta7d)
    ? serverThread.delta7d : undefined;
  return {
    value: hasStored ? clamp(stored as number) : null,
    status: anchor.threadStatus ?? (hasStored ? 'active' : 'unestablished'),
    category: anchor.category,
    unmeasured: !hasStored,
    ...(delta === undefined ? {} : { delta, trend: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const }),
  };
}

import { getThreadStrengthLevel } from '@/constants/v2/threadEvents';

/**
 * Qualitative label for a strength value, shown beside it as Consistency
 * ("27% - Grounded"). Uses the central Thread Strength 2.0 level resolver so
 * one value never carries different names across screens.
 */
export function threadQualitativeLabel(value: number | null, unmeasured: boolean): string {
  if (unmeasured || value === null) return 'Not established yet';
  return getThreadStrengthLevel(value);
}

export function threadStatusSublabel(value: number | null, status?: string): string {
  if (value === null || status === 'unestablished') return 'Practice to establish it';
  if (value <= 10 || status === 'dormant') return 'Ready to rebuild';
  if (status === 'grace') return 'Grace period active';
  if (status === 'decaying') return 'Dipping';
  return 'Active reinforcement';
}
