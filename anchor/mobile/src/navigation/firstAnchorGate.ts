import { useAuthStore } from '@/stores/authStore';

export type VaultEntryRouteName = 'Vault' | 'FirstAnchorAccountGate';

type VaultNavigationLike = {
  navigate: (name: VaultEntryRouteName) => void;
  replace?: (name: VaultEntryRouteName) => void;
};

export function shouldRequireFirstAnchorAccountGate(): boolean {
  const { pendingFirstAnchorDraft } = useAuthStore.getState();
  return Boolean(pendingFirstAnchorDraft?.requiresAccountGate);
}

export function getVaultEntryRouteName(): VaultEntryRouteName {
  return shouldRequireFirstAnchorAccountGate() ? 'FirstAnchorAccountGate' : 'Vault';
}

export function navigateToVaultDestination(
  navigation: VaultNavigationLike,
  action: 'navigate' | 'replace' = 'navigate'
): void {
  const routeName = getVaultEntryRouteName();

  if (action === 'replace' && typeof navigation.replace === 'function') {
    navigation.replace(routeName);
    return;
  }

  navigation.navigate(routeName);
}
