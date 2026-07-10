import { isoWeekKey, type PrimingHistoryEntry } from './primingAnalytics';
import { FREE_WEEKLY_SESSION_LIMIT } from './entitlements';

export type PrimeSessionKind = 'focus' | 'deep';

export interface WeeklyPrimeUsage {
  focusUsed: number;
  deepUsed: number;
  totalUsed: number;
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
      usage.totalUsed += 1;

      return usage;
    },
    {
      focusUsed: 0,
      deepUsed: 0,
      totalUsed: 0,
      weekKey,
    }
  );
}

export function getPrimeSessionAllowance(params: {
  tier: 'free' | 'trial' | 'pro';
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
  const usage = getWeeklyPrimeUsage(primingHistory, now);
  const hasUnlimitedAccess = !enforceLimits || tier !== 'free';
  const limit = hasUnlimitedAccess ? Infinity : FREE_WEEKLY_SESSION_LIMIT;
  const remaining = hasUnlimitedAccess
    ? Infinity
    : Math.max(0, FREE_WEEKLY_SESSION_LIMIT - usage.totalUsed);

  return {
    kind,
    limit,
    remaining,
    hasUnlimitedAccess,
    isAllowed: hasUnlimitedAccess || remaining > 0,
    ...usage,
  };
}
