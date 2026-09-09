import { useCallback, useMemo, useRef, useState } from 'react';
import revenueCatService from '@/services/RevenueCatService';
import { refreshServerEntitlement } from '@/services/BillingService';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { logger } from '@/utils/logger';
import {
  activateV2Trial,
  packageIdForPlan,
  planForId,
  type V2PaywallPricing,
} from '@/adapters/v2/paywall';
import {
  V2_PAYWALL_COPY,
  V2_TRIAL_PLAN_ID,
  contextAllowsTrial,
  type V2PaywallContext,
  type V2PaywallPlanId,
} from '@/constants/v2/paywall';
import { useV2PaywallPricing } from './useV2PaywallPricing';
import { useV2TrialState } from './useV2TrialState';
import { useV2PaywallArtifact, type V2PaywallArtifact } from './useV2PaywallArtifact';

export type V2PurchaseState = 'idle' | 'submitting' | 'success' | 'cancelled' | 'error';
export type V2RestoreState = 'idle' | 'restoring' | 'success' | 'no_purchases_found' | 'error';

/** Passed to `onEntitled` so the caller can resume the exact original intent. */
export type V2PaywallEntitlementResult = {
  context: V2PaywallContext;
  outcome: 'trial_started' | 'purchased' | 'restored';
  plan?: V2PaywallPlanId;
};

export type V2PaywallController = {
  context: V2PaywallContext;
  copy: (typeof V2_PAYWALL_COPY)[V2PaywallContext];
  artifact: V2PaywallArtifact;
  pricing: V2PaywallPricing;
  pricingStatus: ReturnType<typeof useV2PaywallPricing>['status'];
  retryPricing: () => void;

  selectedPlan: V2PaywallPlanId;
  setSelectedPlan: (plan: V2PaywallPlanId) => void;

  /** The primary CTA should present the trial rather than a direct purchase. */
  offersTrial: boolean;
  isActiveSubscriber: boolean;
  trialState: ReturnType<typeof useV2TrialState>['trialState'];
  daysRemaining: number;

  purchaseState: V2PurchaseState;
  restoreState: V2RestoreState;
  /** Any in-flight submission — CTA and restore must both be disabled. */
  busy: boolean;
  errorMessage: string | null;

  /** Explicit "Start 7-Day Free Trial". No-op if the trial is spent. */
  startTrial: () => Promise<void>;
  /** Direct paid purchase of the selected plan (no free days). */
  purchaseSelectedPlan: () => Promise<void>;
  /** The context-correct primary action. */
  submitPrimary: () => Promise<void>;
  restore: () => Promise<void>;
  clearTransientState: () => void;
};

export type UseV2PaywallOptions = {
  context: V2PaywallContext;
  /**
   * Called once a real entitlement has been granted (trial start, purchase, or
   * restore). The caller resumes the user's original intent here.
   */
  onEntitled?: (result: V2PaywallEntitlementResult) => void;
};

export function useV2Paywall({ context, onEntitled }: UseV2PaywallOptions): V2PaywallController {
  const copy = V2_PAYWALL_COPY[context];
  const { pricing, status: pricingStatus, retry: retryPricing } = useV2PaywallPricing();
  const trial = useV2TrialState();
  const artifact = useV2PaywallArtifact(context);
  const applyServerEntitlement = useSubscriptionStore((s) => s.applyServerEntitlement);

  const [selectedPlan, setSelectedPlan] = useState<V2PaywallPlanId>(V2_TRIAL_PLAN_ID);
  const [purchaseState, setPurchaseState] = useState<V2PurchaseState>('idle');
  const [restoreState, setRestoreState] = useState<V2RestoreState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const offersTrial =
    contextAllowsTrial(context) && trial.canStartTrial && planForId(pricing, V2_TRIAL_PLAN_ID).trialEligible;

  const busy = purchaseState === 'submitting' || restoreState === 'restoring';

  const finishEntitled = useCallback(
    (outcome: V2PaywallEntitlementResult['outcome'], plan?: V2PaywallPlanId) => {
      applyServerEntitlement(true);
      // Best-effort backend reconciliation; the store entitlement already unlocks.
      void refreshServerEntitlement().catch((error) => {
        logger.warn('[v2/paywall] deferred backend entitlement sync', error);
      });
      onEntitled?.({ context, outcome, plan });
    },
    [applyServerEntitlement, context, onEntitled],
  );

  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await task();
    } finally {
      inFlight.current = false;
    }
  }, []);

  const startTrial = useCallback(
    () =>
      runExclusive(async () => {
        if (!contextAllowsTrial(context) || !trial.canStartTrial || trial.isActiveSubscriber) return;
        setErrorMessage(null);
        setPurchaseState('submitting');
        try {
          const packageId = packageIdForPlan(pricing, V2_TRIAL_PLAN_ID);
          const { status, dismissed } = await revenueCatService.purchasePackageByIdentifier(packageId, {
            syncStatus: false,
          });
          if (dismissed) {
            setPurchaseState('cancelled');
            return;
          }
          // The server stamps `trialStartedAt`; the client never fabricates it.
          const activation = await activateV2Trial();
          if (activation.status === 'error') {
            logger.warn('[v2/paywall] trial activation reported an error after store success');
          }
          if (!status.hasActiveEntitlement && activation.status !== 'activated') {
            setPurchaseState('error');
            setErrorMessage('Your trial is still being confirmed. Your receipt is safe.');
            return;
          }
          setPurchaseState('success');
          finishEntitled('trial_started', V2_TRIAL_PLAN_ID);
        } catch (error) {
          logger.error('[v2/paywall] startTrial failed', error);
          setPurchaseState('error');
          setErrorMessage('We could not start your trial. Please try again.');
        }
      }),
    [context, finishEntitled, pricing, runExclusive, trial.canStartTrial, trial.isActiveSubscriber],
  );

  const purchaseSelectedPlan = useCallback(
    () =>
      runExclusive(async () => {
        if (trial.isActiveSubscriber) return;
        setErrorMessage(null);
        setPurchaseState('submitting');
        try {
          const packageId = packageIdForPlan(pricing, selectedPlan);
          const { status, dismissed } = await revenueCatService.purchasePackageByIdentifier(packageId, {
            syncStatus: false,
          });
          if (dismissed) {
            setPurchaseState('cancelled');
            return;
          }
          if (!status.hasActiveEntitlement) {
            setPurchaseState('error');
            setErrorMessage('Your purchase is still being confirmed. Your receipt is safe.');
            return;
          }
          setPurchaseState('success');
          finishEntitled('purchased', selectedPlan);
        } catch (error) {
          logger.error('[v2/paywall] purchase failed', error);
          setPurchaseState('error');
          setErrorMessage('We could not complete the purchase. Please try again.');
        }
      }),
    [finishEntitled, pricing, runExclusive, selectedPlan, trial.isActiveSubscriber],
  );

  const submitPrimary = useCallback(
    () => (offersTrial && selectedPlan === V2_TRIAL_PLAN_ID ? startTrial() : purchaseSelectedPlan()),
    [offersTrial, purchaseSelectedPlan, selectedPlan, startTrial],
  );

  const restore = useCallback(
    () =>
      runExclusive(async () => {
        setErrorMessage(null);
        setRestoreState('restoring');
        try {
          const status = await revenueCatService.restorePurchases({ syncStatus: false });
          if (!status.hasActiveEntitlement) {
            setRestoreState('no_purchases_found');
            return;
          }
          setRestoreState('success');
          finishEntitled('restored');
        } catch (error) {
          logger.error('[v2/paywall] restore failed', error);
          setRestoreState('error');
        }
      }),
    [finishEntitled, runExclusive],
  );

  const clearTransientState = useCallback(() => {
    setPurchaseState('idle');
    setRestoreState('idle');
    setErrorMessage(null);
  }, []);

  return useMemo<V2PaywallController>(
    () => ({
      context,
      copy,
      artifact,
      pricing,
      pricingStatus,
      retryPricing,
      selectedPlan,
      setSelectedPlan,
      offersTrial,
      isActiveSubscriber: trial.isActiveSubscriber,
      trialState: trial.trialState,
      daysRemaining: trial.daysRemaining,
      purchaseState,
      restoreState,
      busy,
      errorMessage,
      startTrial,
      purchaseSelectedPlan,
      submitPrimary,
      restore,
      clearTransientState,
    }),
    [
      artifact,
      busy,
      clearTransientState,
      context,
      copy,
      errorMessage,
      offersTrial,
      pricing,
      pricingStatus,
      purchaseSelectedPlan,
      purchaseState,
      restore,
      restoreState,
      retryPricing,
      selectedPlan,
      startTrial,
      submitPrimary,
      trial.daysRemaining,
      trial.isActiveSubscriber,
      trial.trialState,
    ],
  );
}
