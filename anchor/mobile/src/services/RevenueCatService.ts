import { Platform } from 'react-native';
import {
  REVENUECAT_API_KEY,
  REVENUECAT_DEFAULT_PACKAGE_ID,
  REVENUECAT_ENTITLEMENT_ID,
} from '@/config';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { logger } from '@/utils/logger';

export interface TrialStatusSnapshot {
  isInTrial: boolean;
  isSubscribed: boolean;
  hasActiveEntitlement: boolean;
  daysRemaining: number | null;
  trialExpired: boolean;
}

interface CustomerEntitlementInfo {
  isActive?: boolean;
  periodType?: string | null;
  expirationDate?: string | null;
}

interface CustomerInfo {
  entitlements?: {
    active?: Record<string, CustomerEntitlementInfo>;
    all?: Record<string, CustomerEntitlementInfo>;
  };
}

interface RevenueCatPackage {
  identifier?: string;
}

interface RevenueCatOffering {
  availablePackages?: RevenueCatPackage[];
}

interface RevenueCatOfferings {
  current?: RevenueCatOffering | null;
}

interface RevenueCatLogInResult {
  customerInfo?: CustomerInfo;
}

interface RevenueCatPurchaseResult {
  customerInfo?: CustomerInfo;
}

interface RevenueCatPurchases {
  configure?: (options: { apiKey: string; appUserID?: string }) => void;
  logIn?: (appUserID: string) => Promise<RevenueCatLogInResult | CustomerInfo>;
  getCustomerInfo?: () => Promise<CustomerInfo>;
  getOfferings?: () => Promise<RevenueCatOfferings>;
  purchasePackage?: (pkg: RevenueCatPackage) => Promise<RevenueCatPurchaseResult | CustomerInfo>;
  restorePurchases?: () => Promise<CustomerInfo>;
}

const DEFAULT_TRIAL_STATUS: TrialStatusSnapshot = {
  isInTrial: false,
  isSubscribed: false,
  hasActiveEntitlement: false,
  daysRemaining: null,
  trialExpired: false,
};

let configuredUserId: string | null = null;

function getPurchasesModule(): RevenueCatPurchases | null {
  try {
    const runtime = require('react-native-purchases') as {
      default?: RevenueCatPurchases;
    } & RevenueCatPurchases;
    return runtime.default ?? runtime;
  } catch (error) {
    logger.warn('[RevenueCatService] react-native-purchases is unavailable', error);
    return null;
  }
}

function getEntitlementInfo(customerInfo: CustomerInfo | null | undefined): CustomerEntitlementInfo | null {
  if (!customerInfo) return null;

  const activeEntitlement = customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  if (activeEntitlement) {
    return activeEntitlement;
  }

  const allEntitlement = customerInfo.entitlements?.all?.[REVENUECAT_ENTITLEMENT_ID];
  return allEntitlement ?? null;
}

function getDaysRemaining(expirationDate?: string | null): number | null {
  if (!expirationDate) return null;
  const expiration = new Date(expirationDate);
  const expirationMs = expiration.getTime();
  if (Number.isNaN(expirationMs)) return null;

  const diffMs = expirationMs - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

function deriveTrialStatus(customerInfo: CustomerInfo | null | undefined): TrialStatusSnapshot {
  const entitlement = getEntitlementInfo(customerInfo);
  if (!entitlement) {
    return DEFAULT_TRIAL_STATUS;
  }

  const isActive = entitlement.isActive === true;
  const isInTrial = isActive && entitlement.periodType === 'trial';
  const isSubscribed = isActive && !isInTrial;
  const daysRemaining = getDaysRemaining(entitlement.expirationDate);

  return {
    isInTrial,
    isSubscribed,
    hasActiveEntitlement: isInTrial || isSubscribed,
    daysRemaining,
    trialExpired: !isActive && entitlement.periodType === 'trial',
  };
}

function applyTrialStatus(status: TrialStatusSnapshot): TrialStatusSnapshot {
  const subscriptionStore = useSubscriptionStore.getState();
  subscriptionStore.setRcTier(status.hasActiveEntitlement ? 'pro' : 'free');
  subscriptionStore.setTrialState(status);
  return status;
}

function extractCustomerInfo(
  response: RevenueCatLogInResult | RevenueCatPurchaseResult | CustomerInfo | null | undefined
): CustomerInfo | null {
  if (!response) return null;
  if ('entitlements' in response) {
    return response;
  }
  if ('customerInfo' in response) {
    return response.customerInfo ?? null;
  }
  return null;
}

function isUserCancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) {
    return false;
  }

  if ('userCancelled' in error && (error as { userCancelled?: unknown }).userCancelled === true) {
    return true;
  }

  const message =
    'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : '';

  return message.includes('cancel') || message.includes('dismiss');
}

class RevenueCatService {
  configure(userId?: string): void {
    const purchases = getPurchasesModule();
    if (!purchases?.configure || !REVENUECAT_API_KEY) {
      return;
    }

    if (configuredUserId === userId) {
      return;
    }

    purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId,
    });
    configuredUserId = userId ?? null;
  }

  async logIn(userId: string): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.logIn) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    this.configure(userId);
    const response = await purchases.logIn(userId);
    const status = deriveTrialStatus(extractCustomerInfo(response));
    return applyTrialStatus(status);
  }

  async refreshTrialStatus(): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.getCustomerInfo) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    const customerInfo = await purchases.getCustomerInfo();
    const status = deriveTrialStatus(customerInfo);
    return applyTrialStatus(status);
  }

  async purchaseDefaultTrialPackage(): Promise<{
    status: TrialStatusSnapshot;
    dismissed: boolean;
  }> {
    const purchases = getPurchasesModule();
    if (!purchases?.getOfferings || !purchases.purchasePackage) {
      return {
        status: applyTrialStatus(DEFAULT_TRIAL_STATUS),
        dismissed: false,
      };
    }

    try {
      const offerings = await purchases.getOfferings();
      const currentOffering = offerings.current;
      const availablePackages = currentOffering?.availablePackages ?? [];
      const selectedPackage =
        availablePackages.find((pkg) => pkg.identifier === REVENUECAT_DEFAULT_PACKAGE_ID) ??
        availablePackages[0];

      if (!selectedPackage) {
        logger.warn('[RevenueCatService] No purchase package available for trial start');
        return {
          status: await this.refreshTrialStatus(),
          dismissed: false,
        };
      }

      const response = await purchases.purchasePackage(selectedPackage);
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return {
        status: applyTrialStatus(status),
        dismissed: false,
      };
    } catch (error) {
      if (isUserCancelled(error)) {
        logger.warn('[RevenueCatService] Trial purchase was dismissed by the user');
        return {
          status: await this.refreshTrialStatus(),
          dismissed: true,
        };
      }

      logger.error('[RevenueCatService] Failed to purchase trial package', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.restorePurchases) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    const customerInfo = await purchases.restorePurchases();
    const status = deriveTrialStatus(customerInfo);
    return applyTrialStatus(status);
  }

  getCurrentStatus(): TrialStatusSnapshot {
    const state = useSubscriptionStore.getState();
    return {
      isInTrial: state.isInTrial,
      isSubscribed: state.isSubscribed,
      hasActiveEntitlement: state.hasActiveEntitlement,
      daysRemaining: state.daysRemaining,
      trialExpired: state.trialExpired,
    };
  }

  getStorePlatform(): 'ios' | 'android' {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }
}

export default new RevenueCatService();
