/**
 * usePostFirstAnchorPaywall
 *
 * Triggers the AuthGate paywall the moment a user saves their **first** anchor
 * while they are not yet authenticated and have no active subscription
 * entitlement.
 *
 * Mount this hook once in the screen or navigator that is active during the
 * anchor creation flow (e.g. VaultScreen or your root tab navigator).  It is
 * safe to mount it on multiple screens — the `hasTriggeredRef` guard ensures
 * the paywall only fires once per session.
 *
 * Paywall trigger conditions (all must be true):
 *   1. Exactly one anchor exists in the store (just created the first one).
 *   2. The user is **not** authenticated (no Firebase session).
 *   3. The user has **no** active RevenueCat entitlement (free tier).
 *
 * RevenueCat Pro check wiring
 * ---------------------------
 * Before rendering AuthGateScreen you can add a listener in that screen's
 * parent to skip the paywall for already-subscribed users:
 *
 * @example — in your root navigator or home screen:
 * ```tsx
 * import { usePostFirstAnchorPaywall } from '@/hooks/usePostFirstAnchorPaywall';
 *
 * export default function VaultScreen() {
 *   usePostFirstAnchorPaywall();
 *   // ...
 * }
 * ```
 *
 * @example — wiring the RevenueCat CustomerInfo listener alongside this hook:
 * ```tsx
 * import { useEffect } from 'react';
 * import { useNavigation } from '@react-navigation/native';
 * import revenueCatService from '@/services/RevenueCatService';
 * import { usePostFirstAnchorPaywall } from '@/hooks/usePostFirstAnchorPaywall';
 *
 * export default function VaultScreen() {
 *   const navigation = useNavigation();
 *
 *   // Trigger paywall after first anchor if the user is not authenticated.
 *   usePostFirstAnchorPaywall();
 *
 *   // Also listen for real-time entitlement changes (subscription cancelled, etc.)
 *   useEffect(() => {
 *     return revenueCatService.addCustomerInfoUpdateListener((info) => {
 *       const hasPro = revenueCatService.checkHasProEntitlement(info);
 *       if (!hasPro) {
 *         navigation.navigate('AuthGate');
 *       }
 *     });
 *   }, [navigation]);
 *
 *   // ...
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { RootStackParamList } from '@/types';

type RootNavProp = NavigationProp<RootStackParamList>;

/**
 * Returns `true` when the user already has access and should NOT see the
 * paywall:
 *   - authenticated with a Firebase session, OR
 *   - holding an active RevenueCat entitlement (trial or paid).
 */
function userHasAccess(isAuthenticated: boolean, hasActiveEntitlement: boolean): boolean {
  return isAuthenticated || hasActiveEntitlement;
}

export function usePostFirstAnchorPaywall(): void {
  const navigation = useNavigation<RootNavProp>();

  // Subscribe to individual slices so unrelated store updates don't re-run
  // the effect (e.g. anchor metadata updates won't fire the paywall again).
  const anchorCount = useAnchorStore((state) => state.anchors.length);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasActiveEntitlement = useSubscriptionStore((state) => state.hasActiveEntitlement);

  // Ensure the paywall fires at most once per component lifetime, even if the
  // effect re-runs because anchorCount flickers around 1.
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Only trigger on the exact moment the first anchor is present.
    if (anchorCount !== 1) {
      return;
    }

    // Users with an active session or active entitlement go straight to their
    // content — no paywall needed.
    if (userHasAccess(isAuthenticated, hasActiveEntitlement)) {
      return;
    }

    // Guard against multiple navigations in one session.
    if (hasTriggeredRef.current) {
      return;
    }

    hasTriggeredRef.current = true;
    navigation.navigate('AuthGate');
  }, [anchorCount, isAuthenticated, hasActiveEntitlement, navigation]);
}
