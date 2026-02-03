/**
 * Anchor App - Subscription Service (RevenueCat)
 *
 * Handles subscription status, purchases, and management.
 */

import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { SubscriptionStatus } from '@/types';
import { MobileEnv } from '@/config/env';

type PurchaseResult = {
  customerInfo: CustomerInfo;
  status: SubscriptionStatus;
};

class Subscriptions {
  private enabled = true;
  private initialized = false;
  private userId: string | null = null;
  private apiKey: string | null = null;

  private ensureInitialized(): boolean {
    if (!this.enabled) return false;
    if (!this.initialized) {
      this.initialize({ userId: this.userId || undefined });
    }
    return this.initialized;
  }

  initialize(config?: { enabled?: boolean; userId?: string }): void {
    this.enabled = config?.enabled ?? true;
    this.userId = config?.userId ?? this.userId;

    const platformKey =
      Platform.OS === 'ios'
        ? MobileEnv.REVENUECAT_IOS_API_KEY
        : MobileEnv.REVENUECAT_ANDROID_API_KEY;

    this.apiKey = platformKey || MobileEnv.REVENUECAT_API_KEY;

    if (!this.enabled) return;
    if (!this.apiKey) {
      console.warn('[Subscriptions] RevenueCat API key missing; subscriptions disabled.');
      this.enabled = false;
      return;
    }

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: this.apiKey, appUserID: this.userId || undefined });
    this.initialized = true;
  }

  async setUser(userId: string): Promise<void> {
    if (!this.ensureInitialized()) return;
    this.userId = userId;
    await Purchases.logIn(userId);
  }

  async logOut(): Promise<void> {
    if (!this.ensureInitialized()) return;
    this.userId = null;
    await Purchases.logOut();
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.ensureInitialized()) return null;
    return Purchases.getCustomerInfo();
  }

  getSubscriptionStatus(info: CustomerInfo | null): SubscriptionStatus {
    if (!info) return 'free';
    const entitlementId = MobileEnv.REVENUECAT_ENTITLEMENT_PRO;
    const entitlement = info.entitlements.active[entitlementId];
    if (!entitlement) return 'free';

    const productId = entitlement.productIdentifier || '';
    const lower = productId.toLowerCase();
    if (lower.includes('annual') || lower.includes('year')) {
      return 'pro_annual';
    }
    return 'pro';
  }

  async refreshStatus(): Promise<SubscriptionStatus> {
    const info = await this.getCustomerInfo();
    return this.getSubscriptionStatus(info);
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!this.ensureInitialized()) return null;
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
    const customerInfo = await Purchases.purchasePackage(pkg);
    return {
      customerInfo,
      status: this.getSubscriptionStatus(customerInfo),
    };
  }

  async presentPaywall(): Promise<PurchaseResult | null> {
    if (!this.ensureInitialized()) return null;
    try {
      const offering = await this.getOfferings();
      if (!offering || offering.availablePackages.length === 0) {
        throw new Error('No subscription packages available');
      }
      const pkg = offering.availablePackages[0];
      return this.purchasePackage(pkg);
    } catch (error: any) {
      if (error?.userCancelled) {
        return null;
      }
      throw error;
    }
  }

  async restorePurchases(): Promise<SubscriptionStatus> {
    if (!this.ensureInitialized()) return 'free';
    const info = await Purchases.restorePurchases();
    return this.getSubscriptionStatus(info);
  }

  async openManageSubscriptions(): Promise<boolean> {
    if (!this.ensureInitialized()) return false;
    if (typeof Purchases.showManageSubscriptions === 'function') {
      await Purchases.showManageSubscriptions();
      return true;
    }
    return false;
  }
}

export const SubscriptionService = new Subscriptions();
