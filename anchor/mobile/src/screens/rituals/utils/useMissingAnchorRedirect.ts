import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { navigateToVaultDestination, type VaultNavigationLike } from '@/navigation/firstAnchorGate';

export function useMissingAnchorRedirect(
  hasAnchor: boolean,
  navigation: VaultNavigationLike,
  mode: 'replace' | 'navigate' = 'replace'
): void {
  useEffect(() => {
    if (hasAnchor) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      navigateToVaultDestination(navigation, mode);
    });

    return () => task.cancel();
  }, [hasAnchor, mode, navigation]);
}
