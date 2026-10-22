import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyV2PaywallPricing,
  loadV2PaywallPricing,
  resolvePricingStatus,
  type V2PaywallPricing,
  type V2PaywallPricingStatus,
} from '@/adapters/v2/paywall';
import { logger } from '@/utils/logger';

export type V2PaywallPricingHook = {
  pricing: V2PaywallPricing;
  status: V2PaywallPricingStatus;
  /** Recoverable: the user can retry when the store was unreachable. */
  retry: () => void;
};

/**
 * Loads live RevenueCat pricing once (with a manual retry). While loading or on
 * failure the UI shows accessible, recoverable states rather than a fake price.
 */
export function useV2PaywallPricing(): V2PaywallPricingHook {
  const [pricing, setPricing] = useState<V2PaywallPricing>(emptyV2PaywallPricing);
  const [status, setStatus] = useState<V2PaywallPricingStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadV2PaywallPricing()
      .then((next) => {
        if (cancelled || !mounted.current) return;
        setPricing(next);
        setStatus(resolvePricingStatus(next));
      })
      .catch((error) => {
        if (cancelled || !mounted.current) return;
        logger.warn('[v2/paywall] pricing load failed', error);
        setPricing(emptyV2PaywallPricing());
        setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { pricing, status, retry };
}
