import { isoWeekKey, type PrimingHistoryEntry } from './primingAnalytics';
import { getEntitlements } from './entitlements';

export type PrimeSessionKind = 'focus' | 'deep';

export interface WeeklyPrimeUsage {
  focusUsed: number;
  deepUsed: number;
  weekKey: string;
}

export interface PrimeSessionAllowance extends WeeklyPrimeUsage {
  kind: PrimeSessionKind;
  limit: number;
  remaining: number;
  hasUnlimitedAccess: boolean;
  isAllowed: boolean;
}

function normalizePrimingHistory(entries: unknown): PrimingHistoryEntry[] {
  return Array.isArray(entries) ? (entries as PrimingHistoryEntry[]) : [];
}

export function getWeeklyPrimeUsage(
  primingHistory: unknown,
  now: Date = new Date()
): WeeklyPrimeUsage {
  const weekKey = isoWeekKey(now);
  const history = normalizePrimingHistory(primingHistory);

  return history.reduce<WeeklyPrimeUsage>(
    (usage, entry) => {
      if (!entry || entry.weekKey !== weekKey) {
        return usage;
      }

      if (entry.type === 'activate') {
        usage.focusUsed += 1;
      } else if (entry.type === 'reinforce') {
        usage.deepUsed += 1;
      }

      return usage;
    },
    {
      focusUsed: 0,
      deepUsed: 0,
      weekKey,
    }
  );
}

export function getPrimeSessionAllowance(params: {
  tier: 'free' | 'pro';
  kind: PrimeSessionKind;
  primingHistory: unknown;
  now?: Date;
  enforceLimits?: boolean;
}): PrimeSessionAllowance {
  const {
    tier,
    kind,
    primingHistory,
    now = new Date(),
    enforceLimits = true,
  } = params;
  const entitlements = getEntitlements(tier);
  const usage = getWeeklyPrimeUsage(primingHistory, now);
  const limit =
    kind === 'focus'
      ? entitlements.focusSessionsPerWeek
      : entitlements.deepPrimeSessionsPerWeek;
  const used = kind === 'focus' ? usage.focusUsed : usage.deepUsed;
  const hasUnlimitedAccess = !enforceLimits || !Number.isFinite(limit);
  const remaining = hasUnlimitedAccess ? Infinity : Math.max(0, limit - used);

  return {
    kind,
    limit,
    remaining,
    hasUnlimitedAccess,
    isAllowed: hasUnlimitedAccess || remaining > 0,
    ...usage,
  };
}
