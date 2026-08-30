import { Platform } from 'react-native';
import {
  REVENUECAT_API_KEY,
  REVENUECAT_ANNUAL_PACKAGE_ID,
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
  activeSubscriptions?: string[];
  allPurchasedProductIdentifiers?: string[];
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

interface RevenueCatStoreProduct {
  identifier?: string;
  price?: number;
  priceString?: string;
  pricePerMonth?: number | null;
  pricePerMonthString?: string | null;
  pricePerYear?: number | null;
  pricePerYearString?: string | null;
  currencyCode?: string;
  subscriptionPeriod?: string | null;
  introPrice?: {
    priceString?: string;
    cycles?: number;
    period?: string;
  } | null;
  defaultOption?: {
    freePhase?: {
      price?: number | { amountMicros?: number };
      period?: { iso8601?: string };
      billingPeriod?: { iso8601?: string };
    } | null;
    pricingPhases?: Array<{ price?: { amountMicros?: number }; billingPeriod?: { iso8601?: string } }>;
  } | null;
}

interface RevenueCatPackage {
  identifier?: string;
  product?: RevenueCatProduct;
  packageType?: string;
  storeProduct?: RevenueCatStoreProduct;
}

interface RevenueCatOffering {
  identifier?: string;
  availablePackages?: RevenueCatPackage[];
}

interface RevenueCatOfferings {
  current?: RevenueCatOffering | null;
  all?: Record<string, RevenueCatOffering> | null;
}

export interface RevenueCatPackagePresentation {
  identifier: string;
  packageType: string | null;
  priceString: string | null;
  pricePerMonthString: string | null;
  pricePerYearString: string | null;
  subscriptionPeriod: string | null;
  introPriceString: string | null;
  introPriceCycles: number | null;
  introPricePeriod: string | null;
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
  checkTrialOrIntroductoryPriceEligibility?: (productIDs: string[]) => Promise<Record<string, { status?: number }>>;
  trackCustomPaywallImpression?: (params?: { paywallId?: string | null; offeringId?: string | null }) => Promise<void>;
  /**
   * The native SDK registers the listener and returns void. Removal is done
   * via removeCustomerInfoUpdateListener with the same listener reference.
   */
  addCustomerInfoUpdateListener?: (listener: (info: CustomerInfo) => void) => void;
  removeCustomerInfoUpdateListener?: (listener: (info: CustomerInfo) => void) => boolean;
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
  trialEligible?: boolean | null;
}

export interface RevenueCatOfferingDisplayMetadata {
  offeringId?: string | null;
  monthly?: RevenueCatPlanDisplayMetadata;
  annual?: RevenueCatPlanDisplayMetadata;
}

/**
 * Use server-confirmed status for a purchase/restore when a screen needs the
 * backend to be the unlock authority. The default preserves normal SDK syncs.
 */
interface RevenueCatStatusSyncOptions {
  syncStatus?: boolean;
}

const DEFAULT_TRIAL_STATUS: TrialStatusSnapshot = {
  isInTrial: false,
  isSubscribed: false,
  hasActiveEntitlement: false,
  daysRemaining: null,
  trialExpired: false,
};

let sdkConfigured = false;
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

  return customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID] ?? null;
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
  const periodType = typeof entitlement.periodType === 'string' ? entitlement.periodType.toLowerCase() : '';
  const isInTrial = isActive && periodType === 'trial';
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
  subscriptionStore.setEntitlementReady?.(true);
  if (synced) {
    subscriptionStore.setRcSynced(true);
  }
  if (status.isSubscribed) {
    subscriptionStore.setSubscriptionStatus('active');
  } else if (status.isInTrial) {
    subscriptionStore.setSubscriptionStatus('trial');
  } else {
    subscriptionStore.setSubscriptionStatus('expired');
  }
  return status;
}

function applyStatusWhenEnabled(
  status: TrialStatusSnapshot,
  _options: RevenueCatStatusSyncOptions,
  synced = true
): TrialStatusSnapshot {
  // A completed store transaction must update local UI immediately. The
  // option is retained for call-site compatibility; backend synchronization is
  // handled separately by BillingService.
  return applyTrialStatus(status, synced);
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
  const product = pkg.product ?? pkg.storeProduct;

  return {
    planId,
    packageId,
    price: typeof product?.price === 'number' ? product.price : null,
    priceString: product?.priceString ?? null,
    pricePerMonth: typeof product?.pricePerMonth === 'number' ? product.pricePerMonth : null,
    pricePerMonthString: product?.pricePerMonthString ?? null,
    pricePerYear: typeof product?.pricePerYear === 'number' ? product.pricePerYear : null,
    pricePerYearString: product?.pricePerYearString ?? null,
    currencyCode: product?.currencyCode ?? null,
  };
}

class RevenueCatService {
  private resolveOfferingFromCollection(offerings: RevenueCatOfferings): RevenueCatOffering | null {
    if (offerings.current) {
      return offerings.current;
    }

    const allOfferings = offerings.all ? Object.entries(offerings.all) : [];
    if (allOfferings.length === 0) {
      return null;
    }

    const preferredOffering = allOfferings.find(([, offering]) => {
      const packageIds = new Set((offering.availablePackages ?? []).map((pkg) => pkg.identifier));
      return (
        packageIds.has(REVENUECAT_MONTHLY_PACKAGE_ID) ||
        packageIds.has(REVENUECAT_ANNUAL_PACKAGE_ID)
      );
    });

    if (preferredOffering) {
      const [identifier, offering] = preferredOffering;
      logger.warn(
        `[RevenueCatService] offerings.current was empty; falling back to offering "${identifier}" from offerings.all`
      );
      return offering;
    }

    if (allOfferings.length === 1) {
      const [identifier, offering] = allOfferings[0];
      logger.warn(
        `[RevenueCatService] offerings.current was empty; falling back to sole offering "${identifier}" from offerings.all`
      );
      return offering;
    }

    return null;
  }

  private async getCurrentOffering(): Promise<RevenueCatOffering> {
    const purchases = getPurchasesModule();
    if (!purchases) {
      throw new Error('[RevenueCat] Billing service is unavailable. The native module react-native-purchases is not loaded.');
    }
    if (!purchases.getOfferings) {
      throw new Error('[RevenueCat] Billing service is misconfigured or unavailable on this platform.');
    }

    const offerings = await purchases.getOfferings();
    const currentOffering = this.resolveOfferingFromCollection(offerings);
    if (!currentOffering) {
      throw new Error(
        '[RevenueCat] No active offerings found. Please ensure you have set a Current Offering in the RevenueCat dashboard and that the offering includes $rc_monthly / $rc_annual for this app.'
      );
    }

    return currentOffering;
  }

  private findPackageByIdentifier(
    availablePackages: RevenueCatPackage[],
    productId: string
  ): RevenueCatPackage {
    const selectedPackage = availablePackages.find((pkg) => pkg.identifier === productId);

    if (!selectedPackage) {
      throw new Error(`[RevenueCat] Package "${productId}" was not found in the current offering. Please verify your RevenueCat package mappings and store product IDs.`);
    }

    return selectedPackage;
  }

  configure(userId?: string): void {
    const purchases = getPurchasesModule();
    if (!purchases?.configure || !REVENUECAT_API_KEY) {
      return;
    }

    if (sdkConfigured) {
      return;
    }

    const options: { apiKey: string; appUserID?: string } = {
      apiKey: REVENUECAT_API_KEY,
    };
    if (userId) {
      options.appUserID = userId;
    }

    purchases.configure(options);
    sdkConfigured = true;
    configuredUserId = userId ?? null;
  }

  async logIn(userId: string): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.logIn) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    // Configure the SDK without stamping the requested user as already
    // logged in; the explicit RevenueCat logIn call below performs the
    // identity switch and returns that customer's CustomerInfo.
    this.configure();
    if (configuredUserId === userId) {
      return this.refreshTrialStatus();
    }

    try {
      const response = await purchases.logIn(userId);
      configuredUserId = userId;
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return applyTrialStatus(status, true);
    } catch (error) {
      logger.error('[RevenueCatService] logIn failed', error);
      return this.getCurrentStatus();
    }
  }

  async refreshTrialStatus(options: RevenueCatStatusSyncOptions = {}): Promise<TrialStatusSnapshot> {
    const purchases = getPurchasesModule();
    if (!purchases?.getCustomerInfo) {
      return applyTrialStatus(DEFAULT_TRIAL_STATUS);
    }

    try {
      const customerInfo = await purchases.getCustomerInfo();
      const status = deriveTrialStatus(customerInfo);
      return applyStatusWhenEnabled(status, options);
    } catch (error) {
      logger.error('[RevenueCatService] refreshTrialStatus failed', error);
      return this.getCurrentStatus();
    }
  }

  async purchasePackageByIdentifier(productId: string, options: RevenueCatStatusSyncOptions = {}): Promise<{
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
      const currentOffering = await this.getCurrentOffering();
      const availablePackages = currentOffering.availablePackages ?? [];
      const selectedPackage = this.findPackageByIdentifier(availablePackages, productId);

      const response = await purchases.purchasePackage(selectedPackage);
      const status = deriveTrialStatus(extractCustomerInfo(response));
      return { status: applyStatusWhenEnabled(status, options), dismissed: false };
    } catch (error) {
      if (isUserCancelled(error)) {
        return { status: await this.refreshTrialStatus(options), dismissed: true };
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
      const offering = this.resolveOfferingFromCollection(offerings);
      const availablePackages = offering?.availablePackages ?? [];
      const monthlyPackage = availablePackages.find(
        (pkg) => pkg.identifier === REVENUECAT_MONTHLY_PACKAGE_ID
      );
      const annualPackage = availablePackages.find(
        (pkg) => pkg.identifier === REVENUECAT_ANNUAL_PACKAGE_ID
      );
      const metadata: RevenueCatOfferingDisplayMetadata = {};
      if (offering?.identifier) metadata.offeringId = offering.identifier;
      const monthlyMetadata = buildPlanMetadata('monthly', REVENUECAT_MONTHLY_PACKAGE_ID, monthlyPackage);
      const annualMetadata = buildPlanMetadata('annual', REVENUECAT_ANNUAL_PACKAGE_ID, annualPackage);

      if (monthlyMetadata) metadata.monthly = monthlyMetadata;
      if (annualMetadata) metadata.annual = annualMetadata;

      const packageProducts = [monthlyPackage, annualPackage]
        .map((pkg) => pkg?.storeProduct)
        .filter((product): product is RevenueCatStoreProduct => Boolean(product));
      const purchasesWithEligibility = purchases as RevenueCatPurchases & {
        checkTrialOrIntroductoryPriceEligibility?: (productIDs: string[]) => Promise<Record<string, { status?: number }>>;
      };
      if (Platform.OS === 'ios' && purchasesWithEligibility.checkTrialOrIntroductoryPriceEligibility) {
        const productIds = packageProducts
          .map((product) => (product as RevenueCatStoreProduct & { identifier?: string }).identifier)
          .filter((id): id is string => Boolean(id));
        if (productIds.length > 0) {
          const eligibility = await purchasesWithEligibility.checkTrialOrIntroductoryPriceEligibility(productIds);
          for (const [planId, pkg] of [['monthly', monthlyPackage], ['annual', annualPackage] ] as const) {
            const productId = (pkg?.storeProduct as (RevenueCatStoreProduct & { identifier?: string }) | undefined)?.identifier;
            if (productId && metadata[planId]) {
              metadata[planId] = { ...metadata[planId]!, trialEligible: eligibility[productId]?.status === 2 };
            }
          }
        }
      } else if (Platform.OS === 'android') {
        for (const [planId, pkg] of [['monthly', monthlyPackage], ['annual', annualPackage] ] as const) {
          const product = pkg?.storeProduct;
          const freePhase = product?.defaultOption?.freePhase;
          const amountMicros =
            typeof freePhase?.price === 'object'
              ? freePhase.price?.amountMicros
              : freePhase?.price === 0
                ? 0
                : undefined;
          const period = freePhase?.billingPeriod?.iso8601 ?? freePhase?.period?.iso8601;
          const trialEligible = amountMicros === 0 && (!period || period === 'P7D');
          if (metadata[planId]) metadata[planId] = { ...metadata[planId]!, trialEligible };
        }
      }

      return metadata;
    } catch (error) {
      logger.warn('[RevenueCatService] Failed to load offering display metadata', error);
      return {};
    }
  }

  async restorePurchases(options: RevenueCatStatusSyncOptions = {}): Promise<TrialStatusSnapshot> {
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
      return applyStatusWhenEnabled(status, options);
    } catch (error) {
      logger.error('[RevenueCatService] restorePurchases failed', error);
      throw error;
    }
  }

  async getPackagePresentations(productIds: string[]): Promise<Record<string, RevenueCatPackagePresentation>> {
    const currentOffering = await this.getCurrentOffering();
    const availablePackages = currentOffering.availablePackages ?? [];

    return productIds.reduce<Record<string, RevenueCatPackagePresentation>>((accumulator, productId) => {
      const selectedPackage = availablePackages.find((pkg) => pkg.identifier === productId);
      if (!selectedPackage) {
        return accumulator;
      }

      accumulator[productId] = {
        identifier: productId,
        packageType: selectedPackage.packageType ?? null,
        priceString: selectedPackage.storeProduct?.priceString ?? null,
        pricePerMonthString: selectedPackage.storeProduct?.pricePerMonthString ?? null,
        pricePerYearString: selectedPackage.storeProduct?.pricePerYearString ?? null,
        subscriptionPeriod: selectedPackage.storeProduct?.subscriptionPeriod ?? null,
        introPriceString: selectedPackage.storeProduct?.introPrice?.priceString ?? null,
        introPriceCycles: selectedPackage.storeProduct?.introPrice?.cycles ?? null,
        introPricePeriod: selectedPackage.storeProduct?.introPrice?.period ?? null,
      };
      return accumulator;
    }, {});
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

    const wrappedListener = (info: CustomerInfo) => {
      // Keep the Zustand store in sync on every entitlement change.
      applyTrialStatus(deriveTrialStatus(info), true);
      listener(info);
    };

    purchases.addCustomerInfoUpdateListener(wrappedListener);

    // The native SDK returns void from add; unsubscribe via remove using the
    // exact same wrapped reference so the listener does not leak across
    // account switches or sign-out.
    return () => {
      purchases.removeCustomerInfoUpdateListener?.(wrappedListener);
    };
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

  async trackCustomPaywallImpression(offeringId?: string | null): Promise<void> {
    const purchases = getPurchasesModule();
    if (!purchases?.trackCustomPaywallImpression) return;
    await purchases.trackCustomPaywallImpression({
      paywallId: 'anchor_pro_custom_v1',
      offeringId: offeringId ?? null,
    });
  }
}

export default new RevenueCatService();
