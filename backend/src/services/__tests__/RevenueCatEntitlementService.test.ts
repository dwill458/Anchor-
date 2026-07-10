import axios from 'axios';
import { clearRevenueCatAccessCache, getRevenueCatAccess } from '../RevenueCatEntitlementService';

describe('RevenueCatEntitlementService', () => {
  const originalApiKey = process.env.REVENUECAT_API_KEY;
  const originalEntitlementId = process.env.REVENUECAT_ENTITLEMENT_ID;

  beforeEach(() => {
    clearRevenueCatAccessCache();
    process.env.REVENUECAT_API_KEY = 'test-server-key';
    process.env.REVENUECAT_ENTITLEMENT_ID = 'pro';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.REVENUECAT_API_KEY;
    else process.env.REVENUECAT_API_KEY = originalApiKey;

    if (originalEntitlementId === undefined) delete process.env.REVENUECAT_ENTITLEMENT_ID;
    else process.env.REVENUECAT_ENTITLEMENT_ID = originalEntitlementId;
  });

  it('returns active access for an unexpired entitlement', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        subscriber: {
          entitlements: {
            pro: {
              expires_date: '2026-07-20T00:00:00.000Z',
              product_identifier: 'anchor_pro_annual',
            },
          },
        },
      },
    });

    await expect(
      getRevenueCatAccess('user/id', new Date('2026-07-10T00:00:00.000Z'))
    ).resolves.toEqual({
      isActive: true,
      productIdentifier: 'anchor_pro_annual',
    });
    expect(getSpy).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2Fid',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-server-key' },
        timeout: 5_000,
      })
    );
  });

  it('returns inactive access for an expired entitlement', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        subscriber: {
          entitlements: {
            pro: {
              expires_date: '2026-07-01T00:00:00.000Z',
              product_identifier: 'anchor_pro_monthly',
            },
          },
        },
      },
    });

    await expect(
      getRevenueCatAccess('expired-user', new Date('2026-07-10T00:00:00.000Z'))
    ).resolves.toEqual({
      isActive: false,
      productIdentifier: 'anchor_pro_monthly',
    });
  });

  it('returns null when server-side RevenueCat access is not configured', async () => {
    delete process.env.REVENUECAT_API_KEY;
    const getSpy = jest.spyOn(axios, 'get');

    await expect(getRevenueCatAccess('user-1')).resolves.toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('falls back to persisted state when RevenueCat is unavailable', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('timeout'));

    await expect(getRevenueCatAccess('user-1')).resolves.toBeNull();
  });
});
