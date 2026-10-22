import { scheduleAfterInteractions } from '@/utils/scheduleAfterInteractions';
import { useEffect } from 'react';
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

    const task = scheduleAfterInteractions(() => {
      navigateToVaultDestination(navigation, mode);
    });

    return () => task.cancel();
  }, [hasAnchor, mode, navigation]);
}
