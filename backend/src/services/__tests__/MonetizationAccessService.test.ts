const mockGetRevenueCatAccess = jest.fn();

jest.mock('../RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: (...args: unknown[]) => mockGetRevenueCatAccess(...args),
}));

import { resolveMonetizationAccess } from '../MonetizationAccessService';

describe('MonetizationAccessService', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');
  const baseUser = {
    id: 'user-1',
    isComped: false,
    trialStartedAt: new Date('2026-08-29T00:00:00.000Z'),
  };
  const originalCutoff = process.env.MONETIZATION_MODEL_ACTIVATED_AT;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MONETIZATION_MODEL_ACTIVATED_AT;
    mockGetRevenueCatAccess.mockResolvedValue(null);
  });

  afterAll(() => {
    if (originalCutoff === undefined) delete process.env.MONETIZATION_MODEL_ACTIVATED_AT;
    else process.env.MONETIZATION_MODEL_ACTIVATED_AT = originalCutoff;
  });

  it('gives comped users access without consulting RevenueCat', async () => {
    const access = await resolveMonetizationAccess({ ...baseUser, isComped: true }, now);

    expect(access).toMatchObject({
      hasProAccess: true,
      entitlementVerified: true,
      source: 'comped',
    });
    expect(mockGetRevenueCatAccess).not.toHaveBeenCalled();
  });

  it('uses the canonical RevenueCat entitlement as the Pro authority', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: true,
      isTrialPeriod: true,
      productIdentifier: 'anchor_pro_annual',
      expiresAt: '2026-09-05T12:00:00.000Z',
    });

    const access = await resolveMonetizationAccess(baseUser, now);

    expect(access).toMatchObject({
      hasProAccess: true,
      entitlementVerified: true,
      isTrialPeriod: true,
      source: 'revenuecat',
      productIdentifier: 'anchor_pro_annual',
    });
  });

  it('does not grant a new local trial when RevenueCat has no verified access', async () => {
    const access = await resolveMonetizationAccess(baseUser, now);

    expect(access).toMatchObject({
      hasProAccess: false,
      entitlementVerified: false,
      source: 'free',
    });
  });

  it('allows only the bounded pre-rollout migration bridge', async () => {
    process.env.MONETIZATION_MODEL_ACTIVATED_AT = '2026-08-29T06:00:00.000Z';

    const migrated = await resolveMonetizationAccess(
      { ...baseUser, trialStartedAt: new Date('2026-08-28T12:00:00.000Z') },
      now,
    );
    const newAccount = await resolveMonetizationAccess(
      { ...baseUser, trialStartedAt: new Date('2026-08-29T08:00:00.000Z') },
      now,
    );
    const expired = await resolveMonetizationAccess(
      { ...baseUser, trialStartedAt: new Date('2026-08-20T12:00:00.000Z') },
      now,
    );

    expect(migrated).toMatchObject({ hasProAccess: true, source: 'legacy_migration' });
    expect(newAccount).toMatchObject({ hasProAccess: false, source: 'free' });
    expect(expired).toMatchObject({ hasProAccess: false, source: 'free' });
  });

  it('does not honor a cached entitlement after its store expiry', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: true,
      isStale: true,
      productIdentifier: 'anchor_pro_monthly',
      expiresAt: '2026-08-28T12:00:00.000Z',
    });

    const access = await resolveMonetizationAccess(baseUser, now);

    expect(access.hasProAccess).toBe(false);
    expect(access.source).toBe('free');
  });
});
