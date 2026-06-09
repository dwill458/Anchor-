import { Platform } from 'react-native';
import {
  REVENUECAT_API_KEY,
  REVENUECAT_ANNUAL_PACKAGE_ID,
  REVENUECAT_DEFAULT_PACKAGE_ID,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_MONTHLY_PACKAGE_ID,
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

interface RevenueCatProduct {
  identifier?: string;
  price?: number;
  priceString?: string;
  pricePerMonth?: number | null;
  pricePerMonthString?: string | null;
  pricePerYear?: number | null;
  pricePerYearString?: string | null;
  currencyCode?: string;
}

interface RevenueCatPackage {
  identifier?: string;
  product?: RevenueCatProduct;
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
  /** SDK v8+ listener API — resolves to an unsubscribe function. */
  addCustomerInfoUpdateListener?: (listener: (info: CustomerInfo) => void) => () => void;
}

/** Callback type for CustomerInfo update listeners. */
export type CustomerInfoUpdateListener = (customerInfo: CustomerInfo) => void;

export type RevenueCatPlanId = 'monthly' | 'annual';

export interface RevenueCatPlanDisplayMetadata {
  planId: RevenueCatPlanId;
  packageId: string;
  price: number | null;
  priceString: string | null;
  pricePerMonth: number | null;
  pricePerMonthString: string | null;
  pricePerYear: number | null;
  pricePerYearString: string | null;
  currencyCode: string | null;
}

export type RevenueCatOfferingDisplayMetadata = Partial<
  Record<RevenueCatPlanId, RevenueCatPlanDisplayMetadata>
>;

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

function applyTrialStatus(status: TrialStatusSnapshot, synced = false): TrialStatusSnapshot {
  const subscriptionStore = useSubscriptionStore.getState();
  subscriptionStore.setRcTier(status.hasActiveEntitlement ? 'pro' : 'free');
  subscriptionStore.setTrialState(status);
  if (synced) {
    subscriptionStore.setRcSynced(true);
  }
  if (status.hasActiveEntitlement) {
    subscriptionStore.setSubscriptionStatus('active');
  }
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

function buildPlanMetadata(
  planId: RevenueCatPlanId,
  packageId: string,
  pkg: RevenueCatPackage | undefined
): RevenueCatPlanDisplayMetadata | undefined {
  if (!pkg) return undefined;

  return {
    planId,
    packageId,
    price: typeof pkg.product?.price === 'number' ? pkg.product.price : null,
    priceString: pkg.product?.priceString ?? null,
    pricePerMonth: typeof pkg.product?.pricePerMonth === 'number' ? pkg.product.pricePerMonth : null,
    pricePerMonthString: pkg.product?.pricePerMonthString ?? null,
    pricePerYear: typeof pkg.product?.pricePerYear === 'number' ? pkg.product.pricePerYear : null,
    pricePerYearString: pkg.product?.pricePerYearString ?? null,
    currencyCode: pkg.product?.currencyCode ?? null,
  };
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
    try {
      const response = await purchases.logIn(userId);
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return applyTrialStatus(status, true);
    } catch (error) {
      logger.error('[RevenueCatService] logIn failed', error);
      return this.getCurrentStatus();
    }
  }

  async refreshTrialStatus(): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.getCustomerInfo) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    try {
      const customerInfo = await purchases.getCustomerInfo();
      const status = deriveTrialStatus(customerInfo);
      return applyTrialStatus(status, true);
    } catch (error) {
      logger.error('[RevenueCatService] refreshTrialStatus failed', error);
      return this.getCurrentStatus();
    }
  }

  async purchaseDefaultTrialPackage(): Promise<{
    status: TrialStatusSnapshot;
    dismissed: boolean;
  }> {
    const purchases = getPurchasesModule();
    if (!purchases) {
      throw new Error('[RevenueCat] Billing service is unavailable. The native module react-native-purchases is not loaded.');
    }
    if (!purchases.getOfferings || !purchases.purchasePackage) {
      throw new Error('[RevenueCat] Billing service is misconfigured or unavailable on this platform.');
    }

    try {
      const offerings = await purchases.getOfferings();
      const currentOffering = offerings.current;
      if (!currentOffering) {
        throw new Error('[RevenueCat] No active offerings found. Please ensure you have set a Current Offering in the RevenueCat dashboard.');
      }

      const availablePackages = currentOffering.availablePackages ?? [];
      const selectedPackage =
        availablePackages.find((pkg) => pkg.identifier === REVENUECAT_DEFAULT_PACKAGE_ID) ??
        availablePackages[0];

      if (!selectedPackage) {
        throw new Error(`[RevenueCat] No purchase package available for trial start (expected "${REVENUECAT_DEFAULT_PACKAGE_ID}"). Please check your RevenueCat dashboard package configuration.`);
      }

      const response = await purchases.purchasePackage(selectedPackage);
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return {
        status: applyTrialStatus(status, true),
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

  async purchasePackageByIdentifier(productId: string): Promise<{
    status: TrialStatusSnapshot;
    dismissed: boolean;
  }> {
    const purchases = getPurchasesModule();
    if (!purchases) {
      throw new Error('[RevenueCat] Billing service is unavailable. The native module react-native-purchases is not loaded.');
    }
    if (!purchases.getOfferings || !purchases.purchasePackage) {
      throw new Error('[RevenueCat] Billing service is misconfigured or unavailable on this platform.');
    }

    try {
      const offerings = await purchases.getOfferings();
      const currentOffering = offerings.current;
      if (!currentOffering) {
        throw new Error('[RevenueCat] No active offerings found. Please ensure you have set a Current Offering in the RevenueCat dashboard.');
      }

      const availablePackages = currentOffering.availablePackages ?? [];
      const selectedPackage =
        availablePackages.find((pkg) => pkg.identifier === productId) ??
        availablePackages[0];

      if (!selectedPackage) {
        throw new Error(`[RevenueCat] Package "${productId}" was not found in the available offerings. Please verify your RevenueCat package mappings and Google Play Console product IDs.`);
      }

      const response = await purchases.purchasePackage(selectedPackage);
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return { status: applyTrialStatus(status, true), dismissed: false };
    } catch (error) {
      if (isUserCancelled(error)) {
        return { status: await this.refreshTrialStatus(), dismissed: true };
      }
      logger.error('[RevenueCatService] Failed to purchase package', error);
      throw error;
    }
  }

  async getOfferingDisplayMetadata(): Promise<RevenueCatOfferingDisplayMetadata> {
    const purchases = getPurchasesModule();
    if (!purchases?.getOfferings) {
      return {};
    }

    try {
      const offerings = await purchases.getOfferings();
      const availablePackages = offerings.current?.availablePackages ?? [];
      const monthlyPackage = availablePackages.find(
        (pkg) => pkg.identifier === REVENUECAT_MONTHLY_PACKAGE_ID
      );
      const annualPackage = availablePackages.find(
        (pkg) => pkg.identifier === REVENUECAT_ANNUAL_PACKAGE_ID
      );
      const metadata: RevenueCatOfferingDisplayMetadata = {};
      const monthlyMetadata = buildPlanMetadata('monthly', REVENUECAT_MONTHLY_PACKAGE_ID, monthlyPackage);
      const annualMetadata = buildPlanMetadata('annual', REVENUECAT_ANNUAL_PACKAGE_ID, annualPackage);

      if (monthlyMetadata) metadata.monthly = monthlyMetadata;
      if (annualMetadata) metadata.annual = annualMetadata;

      return metadata;
    } catch (error) {
      logger.warn('[RevenueCatService] Failed to load offering display metadata', error);
      return {};
    }
  }

  async restorePurchases(): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases) {
      throw new Error('[RevenueCat] Billing service is unavailable. The native module react-native-purchases is not loaded.');
    }
    if (!purchases.restorePurchases) {
      throw new Error('[RevenueCat] Restore purchases is not supported on this platform.');
    }

    try {
      const customerInfo = await purchases.restorePurchases();
      const status = deriveTrialStatus(customerInfo);
      return applyTrialStatus(status, true);
    } catch (error) {
      logger.error('[RevenueCatService] restorePurchases failed', error);
      throw error;
    }
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

  /**
   * Subscribe to real-time CustomerInfo updates from RevenueCat.
   *
   * Call this once after the user authenticates so entitlement changes
   * (purchases, cancellations, renewals) are reflected immediately in the app
   * without a manual refresh.
   *
   * The listener also updates the Zustand subscriptionStore automatically,
   * so any component reading `useSubscriptionStore` or `useTrialStatus` will
   * react without extra wiring.
   *
   * Returns an **unsubscribe** function — call it on component unmount or
   * whenever the listener is no longer needed (e.g. on sign-out):
   *
   * @example
   * useEffect(() => {
   *   // Guard: only show AuthGate if the user loses their Pro entitlement.
   *   return revenueCatService.addCustomerInfoUpdateListener((info) => {
   *     const hasPro = revenueCatService.checkHasProEntitlement(info);
   *     if (!hasPro) {
   *       navigation.navigate('AuthGate');
   *     }
   *   });
   * }, [navigation]);
   */
  addCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): () => void {
    const purchases = getPurchasesModule();
    if (!purchases?.addCustomerInfoUpdateListener) {
      logger.warn('[RevenueCatService] addCustomerInfoUpdateListener is not available on this SDK version');
      return () => {};
    }

    return purchases.addCustomerInfoUpdateListener((info) => {
      // Keep the Zustand store in sync on every entitlement change.
      applyTrialStatus(deriveTrialStatus(info), true);
      listener(info);
    });
  }

  /**
   * Check whether a CustomerInfo snapshot contains an active Pro entitlement.
   *
   * Use this inside an `addCustomerInfoUpdateListener` callback or after any
   * purchase/restore call to decide whether to gate a screen:
   *
   * @example
   * const hasPro = revenueCatService.checkHasProEntitlement(customerInfo);
   * if (!hasPro) { navigation.navigate('AuthGate'); }
   */
  checkHasProEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
    return getEntitlementInfo(customerInfo)?.isActive === true;
  }

  getStorePlatform(): 'ios' | 'android' {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }
}

export default new RevenueCatService();
