import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor } from '@/types';
import { logger } from '@/utils/logger';

export type VaultEntryRouteName = 'Vault';

export type VaultNavigationLike = {
  navigate: (...args: any[]) => void;
  replace?: (...args: any[]) => void;
};

/**
 * A guest who has forged their first anchor but has not yet created an account
 * must always pass through the SaveProgress account gate before the Vault can
 * be reached — no matter which screen attempts the navigation. Returns the
 * gate params (anchor) when the gate must run, or null otherwise.
 *
 * This self-clears: once the user authenticates, `finalizePendingFirstAnchorDraft`
 * nulls out the draft and this returns null, allowing normal Vault entry.
 */
export function getPendingFirstAnchorGate(): { anchor: Anchor } | null {
  const { pendingFirstAnchorDraft, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated && pendingFirstAnchorDraft) {
    const anchor = useAnchorStore.getState().getAnchorById(pendingFirstAnchorDraft.tempAnchorId);
    if (!anchor) {
      logger.warn('[firstAnchorGate] Pending first anchor missing from local store', {
        anchorId: pendingFirstAnchorDraft.tempAnchorId,
      });
      return null;
    }
    return { anchor };
  }
  return null;
}

export function getVaultEntryRouteName(): VaultEntryRouteName {
  return 'Vault';
}

export function navigateToVaultDestination(
  navigation: VaultNavigationLike,
  action: 'navigate' | 'replace' = 'navigate'
): void {
  // Account gate first: an unauthenticated guest with a pending first anchor can
  // never slip into the Vault, regardless of which exit/back path called us.
  const gate = getPendingFirstAnchorGate();
  if (gate) {
    if (action === 'replace' && typeof navigation.replace === 'function') {
      navigation.replace('SaveProgress', gate);
      return;
    }
    navigation.navigate('SaveProgress', gate);
    return;
  }

  const routeName = getVaultEntryRouteName();

  if (action === 'replace' && typeof navigation.replace === 'function') {
    navigation.replace(routeName);
    return;
  }

  navigation.navigate(routeName);
}
