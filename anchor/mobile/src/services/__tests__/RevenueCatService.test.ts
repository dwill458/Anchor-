import RevenueCatService from '../RevenueCatService';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

jest.mock('@/config', () => ({
  REVENUECAT_API_KEY: 'test_api_key',
  REVENUECAT_DEFAULT_PACKAGE_ID: 'test_package',
  REVENUECAT_ENTITLEMENT_ID: 'pro',
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/stores/subscriptionStore', () => ({
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useSubscriptionStore.getState as jest.Mock).mockReturnValue({
      setRcTier: mockSetRcTier,
      setTrialState: mockSetTrialState,
      setSubscriptionStatus: mockSetSubscriptionStatus,
    });
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
});
