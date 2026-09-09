/**
 * Normalises live RevenueCat offering metadata into the shape the paywall UI
 * renders. Localised price, currency and period always come from the store —
 * this module never emits a hard-coded amount or currency.
 */

import revenueCatService, {
  type RevenueCatOfferingDisplayMetadata,
  type RevenueCatPlanDisplayMetadata,
} from '@/services/RevenueCatService';
import { V2_PAYWALL_PLAN_PACKAGE_IDS, type V2PaywallPlanId } from '@/constants/v2/paywall';

export type V2PlanPricing = {
  planId: V2PaywallPlanId;
  packageId: string | null;
  /** Localised, e.g. "£59.99" / "US$7.99". Never fabricated. */
  priceLabel: string | null;
  /** Localised per-month equivalent for the annual plan, when the store gives one. */
  perMonthLabel: string | null;
  currencyCode: string | null;
  /** Raw amount, kept only for a derived per-month fallback. */
  priceValue: number | null;
  /** The store confirmed this package is introductory-trial eligible. */
  trialEligible: boolean;
  /** Enough data to actually offer this plan. */
  purchasable: boolean;
};

export type V2PaywallPricing = {
  offeringId: string | null;
  annual: V2PlanPricing;
  monthly: V2PlanPricing;
};

export type V2PaywallPricingStatus = 'loading' | 'ready' | 'unavailable';

function normalisePlan(
  planId: V2PaywallPlanId,
  live: RevenueCatPlanDisplayMetadata | undefined,
): V2PlanPricing {
  const priceValue = typeof live?.price === 'number' ? live.price : null;
  const packageId = live?.packageId ?? null;
  return {
    planId,
    packageId,
    priceLabel: live?.priceString ?? null,
    perMonthLabel: live?.pricePerMonthString ?? null,
    currencyCode: live?.currencyCode ?? null,
    priceValue,
    trialEligible: live?.trialEligible === true,
    purchasable: Boolean(packageId && (live?.priceString || priceValue != null)),
  };
}

export function toV2PaywallPricing(metadata: RevenueCatOfferingDisplayMetadata): V2PaywallPricing {
  return {
    offeringId: metadata.offeringId ?? null,
    annual: normalisePlan('annual', metadata.annual),
    monthly: normalisePlan('monthly', metadata.monthly),
  };
}

/** `ready` only when at least one plan is actually purchasable. */
export function resolvePricingStatus(pricing: V2PaywallPricing | null): V2PaywallPricingStatus {
  if (!pricing) return 'loading';
  return pricing.annual.purchasable || pricing.monthly.purchasable ? 'ready' : 'unavailable';
}

/** Empty scaffold so the UI can render skeleton rows before the store responds. */
export function emptyV2PaywallPricing(): V2PaywallPricing {
  return {
    offeringId: null,
    annual: normalisePlan('annual', undefined),
    monthly: normalisePlan('monthly', undefined),
  };
}

/** Localised per-month string for a plan, deriving one only from a real amount + currency. */
export function planPerMonthLabel(plan: V2PlanPricing): string | null {
  if (plan.perMonthLabel) return plan.perMonthLabel;
  if (plan.planId !== 'annual' || plan.priceValue == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: plan.currencyCode ?? 'USD',
      maximumFractionDigits: 2,
    }).format(plan.priceValue / 12);
  } catch {
    return null;
  }
}

export function planForId(pricing: V2PaywallPricing, planId: V2PaywallPlanId): V2PlanPricing {
  return planId === 'annual' ? pricing.annual : pricing.monthly;
}

/** Package id the purchase call needs, falling back to the configured package. */
export function packageIdForPlan(pricing: V2PaywallPricing | null, planId: V2PaywallPlanId): string {
  return planForId(pricing ?? emptyV2PaywallPricing(), planId).packageId ?? V2_PAYWALL_PLAN_PACKAGE_IDS[planId];
}

export async function loadV2PaywallPricing(): Promise<V2PaywallPricing> {
  const metadata = await revenueCatService.getOfferingDisplayMetadata();
  return toV2PaywallPricing(metadata);
}
