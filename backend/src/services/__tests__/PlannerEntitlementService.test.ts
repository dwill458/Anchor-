/**
 * Phase 0 amendment F1: server-authoritative planner entitlement and quota.
 *
 * These tests pin the entitlement mapping, the frozen caps, the counting
 * windows, and the fail-closed behavior for missing or malformed configuration.
 */

const mockGetRevenueCatAccess = jest.fn();
jest.mock('../RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: mockGetRevenueCatAccess,
}));

import {
  countPersistedProposals,
  evaluatePlannerQuota,
  nextUtcDayStart,
  resolvePlannerEntitlement,
  startOfUtcDay,
  type PlannerEntitlementUser,
} from '../PlannerEntitlementService';
import {
  PLANNER_FROZEN_EXPIRED_CAP,
  PLANNER_FROZEN_FREE_CAP,
  PLANNER_FROZEN_PRO_DAILY_CAP,
  PLANNER_FROZEN_TRIAL_LIFETIME_CAP,
  capForEntitlement,
  resolvePlannerQuotaConfig,
} from '../../config/plannerPolicy';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function user(overrides: Partial<PlannerEntitlementUser> = {}): PlannerEntitlementUser {
  return {
    id: 'user-1',
    isComped: false,
    subscriptionStatus: 'free',
    subscriptionId: null,
    // Trial started today, so the account is inside the 7-day window.
    trialStartedAt: new Date(NOW.getTime() - DAY_MS),
    ...overrides,
  };
}

function counter(count: number) {
  const spy = jest.fn().mockResolvedValue(count);
  return { client: { aIPlanProposal: { count: spy } }, spy };
}

const QUOTA_ENV_KEYS = [
  'CHART_PLANNER_TRIAL_LIFETIME_CAP',
  'CHART_PLANNER_PRO_DAILY_CAP',
  'CHART_PLANNER_FREE_CAP',
  'CHART_PLANNER_EXPIRED_CAP',
];

describe('planner quota configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of QUOTA_ENV_KEYS) delete process.env[key];
  });

  it('uses the frozen V1 caps by default', () => {
    expect(resolvePlannerQuotaConfig()).toEqual({
      trialLifetimeCap: 3,
      proDailyCap: 10,
      freeCap: 0,
      expiredCap: 0,
    });
    expect(PLANNER_FROZEN_TRIAL_LIFETIME_CAP).toBe(3);
    expect(PLANNER_FROZEN_PRO_DAILY_CAP).toBe(10);
    expect(PLANNER_FROZEN_FREE_CAP).toBe(0);
    expect(PLANNER_FROZEN_EXPIRED_CAP).toBe(0);
  });

  it('fails closed on a malformed cap rather than falling back to the default', () => {
    for (const raw of ['abc', '-1', '3.5', '1e3', 'Infinity', ' ten ']) {
      process.env.CHART_PLANNER_TRIAL_LIFETIME_CAP = raw;
      expect(resolvePlannerQuotaConfig()).toBeNull();
    }
  });

  it('fails closed when an unentitled state is given a non-zero allowance', () => {
    process.env.CHART_PLANNER_FREE_CAP = '5';
    expect(resolvePlannerQuotaConfig()).toBeNull();

    delete process.env.CHART_PLANNER_FREE_CAP;
    process.env.CHART_PLANNER_EXPIRED_CAP = '1';
    expect(resolvePlannerQuotaConfig()).toBeNull();
  });

  it('accepts a well-formed override', () => {
    process.env.CHART_PLANNER_PRO_DAILY_CAP = '25';
    expect(resolvePlannerQuotaConfig()?.proDailyCap).toBe(25);
  });

  it('maps each entitlement state to its frozen cap', () => {
    const config = resolvePlannerQuotaConfig()!;
    expect(capForEntitlement(config, 'trial')).toBe(3);
    expect(capForEntitlement(config, 'pro')).toBe(10);
    expect(capForEntitlement(config, 'free')).toBe(0);
    expect(capForEntitlement(config, 'expired')).toBe(0);
  });
});

describe('planner entitlement resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRevenueCatAccess.mockResolvedValue(null);
  });

  it('treats a comped account as Pro without calling the store', async () => {
    await expect(resolvePlannerEntitlement(user({ isComped: true }), NOW)).resolves.toBe('pro');
    expect(mockGetRevenueCatAccess).not.toHaveBeenCalled();
  });

  it('uses live entitlement when the store answers', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({ isActive: true, productIdentifier: 'annual' });
    await expect(resolvePlannerEntitlement(user(), NOW)).resolves.toBe('pro');
  });

  it('falls back to the persisted server status when the store is unavailable', async () => {
    mockGetRevenueCatAccess.mockResolvedValue(null);
    await expect(
      resolvePlannerEntitlement(user({ subscriptionStatus: 'pro_annual' }), NOW)
    ).resolves.toBe('pro');
  });

  it('does not treat an inactive live entitlement as Pro even when the row says pro', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({ isActive: false, productIdentifier: null });
    await expect(
      resolvePlannerEntitlement(
        user({ subscriptionStatus: 'pro', trialStartedAt: new Date(NOW.getTime() - 30 * DAY_MS) }),
        NOW
      )
    ).resolves.toBe('expired');
  });

  it('resolves trial inside the frozen 7-day window and expired after it', async () => {
    await expect(
      resolvePlannerEntitlement(user({ trialStartedAt: new Date(NOW.getTime() - 6 * DAY_MS) }), NOW)
    ).resolves.toBe('trial');
    await expect(
      resolvePlannerEntitlement(user({ trialStartedAt: new Date(NOW.getTime() - 8 * DAY_MS) }), NOW)
    ).resolves.toBe('expired');
  });

  it('fails closed when the trial anchor is missing or invalid', async () => {
    await expect(resolvePlannerEntitlement(user({ trialStartedAt: null }), NOW)).resolves.toBeNull();
    await expect(
      resolvePlannerEntitlement(user({ trialStartedAt: new Date(NaN) }), NOW)
    ).resolves.toBeNull();
  });
});

describe('planner quota evaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of QUOTA_ENV_KEYS) delete process.env[key];
    mockGetRevenueCatAccess.mockResolvedValue(null);
  });

  it('denies generation when quota configuration is unavailable', async () => {
    const { client, spy } = counter(0);
    const quota = await evaluatePlannerQuota(client, user({ isComped: true }), NOW, null);

    expect(quota).toMatchObject({
      eligible: false,
      reason: 'quota_config_unavailable',
      limit: 0,
      remaining: 0,
    });
    // No counting, and therefore no basis on which to allow anything.
    expect(spy).not.toHaveBeenCalled();
  });

  it('denies generation when entitlement cannot be established', async () => {
    const { client, spy } = counter(0);
    const quota = await evaluatePlannerQuota(client, user({ trialStartedAt: null }), NOW);

    expect(quota).toMatchObject({ eligible: false, reason: 'entitlement_unavailable' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('denies free accounts with a zero cap', async () => {
    // A free account past the trial window reports expired; an account whose
    // entitlement resolves but carries no allowance is denied either way.
    const { client } = counter(0);
    const quota = await evaluatePlannerQuota(
      client,
      user({ trialStartedAt: new Date(NOW.getTime() - 30 * DAY_MS) }),
      NOW
    );

    expect(quota).toMatchObject({
      eligible: false,
      entitlement: 'expired',
      reason: 'entitlement_expired',
      limit: 0,
      remaining: 0,
    });
  });

  it('allows a trial account exactly three lifetime proposals', async () => {
    for (const used of [0, 1, 2]) {
      const { client } = counter(used);
      const quota = await evaluatePlannerQuota(client, user(), NOW);
      expect(quota).toMatchObject({
        eligible: true,
        entitlement: 'trial',
        limit: 3,
        remaining: 3 - used,
        resetAt: null,
      });
    }

    const { client } = counter(3);
    await expect(evaluatePlannerQuota(client, user(), NOW)).resolves.toMatchObject({
      eligible: false,
      reason: 'quota_exhausted',
      limit: 3,
      remaining: 0,
    });
  });

  it('allows a Pro account exactly ten proposals per rolling UTC day', async () => {
    const pro = user({ isComped: true });

    const ninth = counter(9);
    await expect(evaluatePlannerQuota(ninth.client, pro, NOW)).resolves.toMatchObject({
      eligible: true,
      entitlement: 'pro',
      limit: 10,
      remaining: 1,
      resetAt: nextUtcDayStart(NOW).toISOString(),
    });

    const tenth = counter(10);
    await expect(evaluatePlannerQuota(tenth.client, pro, NOW)).resolves.toMatchObject({
      eligible: false,
      reason: 'quota_exhausted',
      limit: 10,
      remaining: 0,
    });
  });

  it('counts the Pro window from the start of the UTC day and the trial over its lifetime', async () => {
    const pro = counter(0);
    await evaluatePlannerQuota(pro.client, user({ isComped: true }), NOW);
    expect(pro.spy).toHaveBeenCalledWith({
      where: { userId: 'user-1', createdAt: { gte: startOfUtcDay(NOW) } },
    });

    const trial = counter(0);
    await evaluatePlannerQuota(trial.client, user(), NOW);
    expect(trial.spy).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('scopes every count to the authenticated account', async () => {
    const { client, spy } = counter(0);
    await evaluatePlannerQuota(client, user({ id: 'user-other' }), NOW);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-other' }),
    }));
  });

  it('never counts for a zero-cap state', async () => {
    await expect(countPersistedProposals(counter(99).client, 'user-1', 'free', NOW)).resolves.toBe(
      0
    );
    await expect(
      countPersistedProposals(counter(99).client, 'user-1', 'expired', NOW)
    ).resolves.toBe(0);
  });

  it('reports a UTC-day reset only for the windowed Pro cap', async () => {
    const proQuota = await evaluatePlannerQuota(counter(0).client, user({ isComped: true }), NOW);
    expect(proQuota.resetAt).toBe('2026-08-04T00:00:00.000Z');

    const trialQuota = await evaluatePlannerQuota(counter(0).client, user(), NOW);
    expect(trialQuota.resetAt).toBeNull();
  });

  it('exposes no subscription internals in the quota state', async () => {
    const quota = await evaluatePlannerQuota(counter(0).client, user({ isComped: true }), NOW);
    expect(Object.keys(quota).sort()).toEqual([
      'eligible',
      'entitlement',
      'limit',
      'reason',
      'remaining',
      'resetAt',
      'used',
    ]);
    expect(JSON.stringify(quota)).not.toContain('subscriptionId');
  });
});
