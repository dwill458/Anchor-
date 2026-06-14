import RevenueCatService from '../RevenueCatService';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

jest.mock('@/config', () => ({
  REVENUECAT_API_KEY: 'test_api_key',
  REVENUECAT_ANNUAL_PACKAGE_ID: '$rc_annual',
  REVENUECAT_DEFAULT_PACKAGE_ID: 'test_package',
  REVENUECAT_ENTITLEMENT_ID: 'pro',
  REVENUECAT_MONTHLY_PACKAGE_ID: '$rc_monthly',
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/stores/subscriptionStore', () => ({
  isLocalTrialActive: (trialStartDate: string | null) => {
    if (!trialStartDate) return false;
    return Date.now() - new Date(trialStartDate).getTime() < 7 * 86_400_000;
  },
  useSubscriptionStore: {
    getState: jest.fn(),
  },
}));

const mockPurchases = {
  configure: jest.fn(),
  logIn: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
};

jest.mock('react-native-purchases', () => {
  return {
    __esModule: true,
    default: mockPurchases,
  };
});

describe('RevenueCatService', () => {
  const mockSetRcTier = jest.fn();
  const mockSetTrialState = jest.fn();
  const mockSetSubscriptionStatus = jest.fn();
  const mockSetRcSynced = jest.fn();
  let mockSubscriptionState: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptionState = {
      setRcTier: mockSetRcTier,
      setTrialState: mockSetTrialState,
      setSubscriptionStatus: mockSetSubscriptionStatus,
      setRcSynced: mockSetRcSynced,
      subscriptionStatus: 'expired',
      trialStartDate: null,
      // Fields read by getCurrentStatus() (fallback path on caught errors)
      isInTrial: false,
      isSubscribed: false,
      hasActiveEntitlement: false,
      daysRemaining: null,
      trialExpired: false,
    };
    (useSubscriptionStore.getState as jest.Mock).mockImplementation(() => mockSubscriptionState);
  });

  const activeCustomerInfo = {
    entitlements: {
      active: {
        pro: {
          isActive: true,
          periodType: 'normal',
          expirationDate: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    },
  };

  it('configures purchases module', () => {
    RevenueCatService.configure('test_user_id');
    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'test_api_key',
      appUserID: 'test_user_id',
    });
  });

  it('logs in and returns trial status snapshot', async () => {
    mockPurchases.logIn.mockResolvedValueOnce({ customerInfo: activeCustomerInfo });
    const status = await RevenueCatService.logIn('user_123');

    expect(mockPurchases.logIn).toHaveBeenCalledWith('user_123');
    expect(status.hasActiveEntitlement).toBe(true);
    expect(status.isSubscribed).toBe(true);
    expect(status.isInTrial).toBe(false);
    expect(mockSetRcTier).toHaveBeenCalledWith('pro');
  });

  it('refreshes trial status and applies state', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(activeCustomerInfo);
    const status = await RevenueCatService.refreshTrialStatus();

    expect(mockPurchases.getCustomerInfo).toHaveBeenCalled();
    expect(status.hasActiveEntitlement).toBe(true);
    expect(mockSetRcTier).toHaveBeenCalledWith('pro');
  });

  it('preserves a valid local account trial when RevenueCat has no active entitlement', async () => {
    mockSubscriptionState.subscriptionStatus = 'trial';
    mockSubscriptionState.trialStartDate = new Date().toISOString();
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({});

    const status = await RevenueCatService.refreshTrialStatus();

    expect(status.hasActiveEntitlement).toBe(false);
    expect(mockSetSubscriptionStatus).toHaveBeenCalledWith('trial');
  });

  it('purchases package by identifier successfully', async () => {
    const pkg = { identifier: 'test_product' };
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: { availablePackages: [pkg] },
    });
    mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo: activeCustomerInfo });

    const result = await RevenueCatService.purchasePackageByIdentifier('test_product');

    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(pkg);
    expect(result.dismissed).toBe(false);
    expect(result.status.hasActiveEntitlement).toBe(true);
  });

  it('handles user cancellation during purchase', async () => {
    const pkg = { identifier: 'test_product' };
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: { availablePackages: [pkg] },
    });
    mockPurchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({}); // For refreshTrialStatus

    const result = await RevenueCatService.purchasePackageByIdentifier('test_product');

    expect(result.dismissed).toBe(true);
    expect(result.status.hasActiveEntitlement).toBe(false);
  });

  it('restores purchases', async () => {
    mockPurchases.restorePurchases.mockResolvedValueOnce(activeCustomerInfo);
    const status = await RevenueCatService.restorePurchases();

    expect(mockPurchases.restorePurchases).toHaveBeenCalled();
    expect(status.hasActiveEntitlement).toBe(true);
    expect(status.isSubscribed).toBe(true);
  });

  it('returns monthly and annual display metadata from current offerings', async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: {
        availablePackages: [
          {
            identifier: '$rc_monthly',
            product: {
              identifier: 'anchor_monthly',
              price: 7.99,
              priceString: '$7.99',
              pricePerMonth: 7.99,
              pricePerMonthString: '$7.99',
              pricePerYear: 95.88,
              pricePerYearString: '$95.88',
              currencyCode: 'USD',
            },
          },
          {
            identifier: '$rc_annual',
            product: {
              identifier: 'anchor_annual',
              price: 59.99,
              priceString: '$59.99',
              pricePerMonth: 5,
              pricePerMonthString: '$5.00',
              pricePerYear: 59.99,
              pricePerYearString: '$59.99',
              currencyCode: 'USD',
            },
          },
        ],
      },
    });

    const metadata = await RevenueCatService.getOfferingDisplayMetadata();

    expect(metadata.monthly).toEqual({
      planId: 'monthly',
      packageId: '$rc_monthly',
      price: 7.99,
      priceString: '$7.99',
      pricePerMonth: 7.99,
      pricePerMonthString: '$7.99',
      pricePerYear: 95.88,
      pricePerYearString: '$95.88',
      currencyCode: 'USD',
    });
    expect(metadata.annual).toMatchObject({
      planId: 'annual',
      packageId: '$rc_annual',
      price: 59.99,
      priceString: '$59.99',
      pricePerMonthString: '$5.00',
      currencyCode: 'USD',
    });
  });

  it('returns empty display metadata when offerings are missing', async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: null,
    });

    await expect(RevenueCatService.getOfferingDisplayMetadata()).resolves.toEqual({});
  });

  it('throws an error if no current offering is found', async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: null,
    });

    await expect(
      RevenueCatService.purchasePackageByIdentifier('test_product')
    ).rejects.toThrow('[RevenueCat] No active offerings found.');
  });

  it('falls back to an offering from offerings.all when current is empty', async () => {
    const pkg = { identifier: '$rc_monthly' };
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: null,
      all: {
        current_offering: { availablePackages: [pkg] },
      },
    });
    mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo: activeCustomerInfo });

    const result = await RevenueCatService.purchasePackageByIdentifier('$rc_monthly');

    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(pkg);
    expect(result.status.hasActiveEntitlement).toBe(true);
  });

  it('uses offerings.all for display metadata when current is empty', async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: null,
      all: {
        current_offering: {
          availablePackages: [
            {
              identifier: '$rc_monthly',
              product: {
                price: 7.99,
                priceString: '$7.99',
                pricePerMonth: 7.99,
                pricePerMonthString: '$7.99',
                pricePerYear: 95.88,
                pricePerYearString: '$95.88',
                currencyCode: 'USD',
              },
            },
            {
              identifier: '$rc_annual',
              product: {
                price: 59.99,
                priceString: '$59.99',
                pricePerMonth: 5,
                pricePerMonthString: '$5.00',
                pricePerYear: 59.99,
                pricePerYearString: '$59.99',
                currencyCode: 'USD',
              },
            },
          ],
        },
      },
    });

    const metadata = await RevenueCatService.getOfferingDisplayMetadata();

    expect(metadata.monthly?.priceString).toBe('$7.99');
    expect(metadata.annual?.priceString).toBe('$59.99');
  });

  it('throws an error if the selected package is not found in offerings', async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: { availablePackages: [] },
    });

    await expect(
      RevenueCatService.purchasePackageByIdentifier('test_product')
    ).rejects.toThrow('[RevenueCat] Package "test_product" was not found in the available offerings.');
  });
});
