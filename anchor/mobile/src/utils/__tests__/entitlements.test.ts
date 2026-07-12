import {
  computeEntitlements,
  FREE_WEEKLY_SESSION_LIMIT,
  PAID_PRO_DAILY_ANCHOR_LIMIT,
  TRIAL_ANCHOR_LIMIT,
} from '../entitlements';
import { isoWeekKey, localWeekStartString, type PrimingHistoryEntry } from '../primingAnalytics';

const now = new Date('2026-06-17T12:00:00.000Z');
const trialStartDate = '2026-06-15T09:00:00.000Z';

function anchors(count: number, createdAt: string): Array<{ createdAt: string }> {
  return Array.from({ length: count }, () => ({ createdAt }));
}

function sessions(count: number, completedAt = now): PrimingHistoryEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `session-${index}`,
    anchorId: 'anchor-1',
    type: index % 2 === 0 ? 'activate' : 'reinforce',
    completedAt: completedAt.toISOString(),
    localDate: '2026-06-17',
    weekKey: isoWeekKey(completedAt),
    weekStart: localWeekStartString(completedAt),
    weekdayIndex: 2,
    hourOfDay: 12,
    timeOfDay: 'afternoon',
  }));
}

describe('entitlements', () => {
  it('allows trial users to create anchors 1 through 7', () => {
    const entitlements = computeEntitlements({
      isSubscribed: false,
      isTrialActive: true,
      trialStartDate,
      anchors: anchors(TRIAL_ANCHOR_LIMIT - 1, '2026-06-16T10:00:00.000Z'),
      now,
    });

    expect(entitlements.isInTrial).toBe(true);
    expect(entitlements.isPro).toBe(true);
    expect(entitlements.canCreateAnchor).toBe(true);
    expect(entitlements.remainingTrialAnchors).toBe(1);
  });

  it('blocks trial user from creating anchor 8', () => {
    const entitlements = computeEntitlements({
      isSubscribed: false,
      isTrialActive: true,
      trialStartDate,
      anchors: anchors(TRIAL_ANCHOR_LIMIT, '2026-06-16T10:00:00.000Z'),
      now,
    });

    expect(entitlements.canCreateAnchor).toBe(false);
    expect(entitlements.anchorCreationLimitReason).toBe('trial_anchor_cap_reached');
    expect(entitlements.remainingTrialAnchors).toBe(0);
    expect(entitlements.canStartPracticeSession).toBe(true);
    expect(entitlements.canUseUnlimitedSessions).toBe(true);
  });

  it('moves expired trial users to Free without removing existing access affordances', () => {
    const entitlements = computeEntitlements({
      isSubscribed: false,
      isTrialActive: false,
      trialExpired: true,
      trialStartDate,
      anchors: anchors(3, '2026-06-16T10:00:00.000Z'),
      primingHistory: sessions(2),
      now,
    });

    expect(entitlements.isFree).toBe(true);
    expect(entitlements.canCreateAnchor).toBe(false);
    expect(entitlements.anchorCreationLimitReason).toBe('create_anchor_free_locked');
    expect(entitlements.canExportHD).toBe(true);
    expect(entitlements.canUseArchivedFilter).toBe(true);
    expect(entitlements.remainingWeeklyFreeSessions).toBe(FREE_WEEKLY_SESSION_LIMIT - 2);
  });

  it('blocks Free practice after the weekly session limit', () => {
    const entitlements = computeEntitlements({
      isSubscribed: false,
      isTrialActive: false,
      trialExpired: true,
      primingHistory: sessions(FREE_WEEKLY_SESSION_LIMIT),
      now,
    });

    expect(entitlements.canStartPracticeSession).toBe(false);
    expect(entitlements.practiceLimitReason).toBe('free_weekly_sessions_used');
    expect(entitlements.remainingWeeklyFreeSessions).toBe(0);
  });

  it('applies paid Pro daily anchor cap and resets on a new day', () => {
    const capped = computeEntitlements({
      isSubscribed: true,
      isTrialActive: false,
      anchors: anchors(PAID_PRO_DAILY_ANCHOR_LIMIT, '2026-06-17T09:00:00.000Z'),
      now,
    });

    const nextDay = computeEntitlements({
      isSubscribed: true,
      isTrialActive: false,
      anchors: anchors(PAID_PRO_DAILY_ANCHOR_LIMIT, '2026-06-17T09:00:00.000Z'),
      now: new Date('2026-06-18T09:00:00.000Z'),
    });

    expect(capped.canCreateAnchor).toBe(false);
    expect(capped.anchorCreationLimitReason).toBe('pro_daily_anchor_cap_reached');
    expect(nextDay.canCreateAnchor).toBe(true);
    expect(nextDay.remainingDailyProAnchors).toBe(PAID_PRO_DAILY_ANCHOR_LIMIT);
  });

  it('uses the same UTC day boundary as the backend', () => {
    const entitlements = computeEntitlements({
      isSubscribed: true,
      isTrialActive: false,
      anchors: anchors(PAID_PRO_DAILY_ANCHOR_LIMIT, '2026-06-17T23:30:00.000Z'),
      now: new Date('2026-06-18T00:30:00.000Z'),
    });

    expect(entitlements.anchorsCreatedToday).toBe(0);
    expect(entitlements.canCreateAnchor).toBe(true);
  });

  it('switches active trial users who upgrade to paid Pro onto paid limits', () => {
    const entitlements = computeEntitlements({
      isSubscribed: true,
      isTrialActive: true,
      trialStartDate,
      anchors: anchors(TRIAL_ANCHOR_LIMIT, '2026-06-17T10:00:00.000Z'),
      now,
    });

    expect(entitlements.tier).toBe('pro');
    expect(entitlements.isInTrial).toBe(false);
    expect(entitlements.canCreateAnchor).toBe(true);
    expect(entitlements.remainingDailyProAnchors).toBe(
      PAID_PRO_DAILY_ANCHOR_LIMIT - TRIAL_ANCHOR_LIMIT
    );
  });
});
