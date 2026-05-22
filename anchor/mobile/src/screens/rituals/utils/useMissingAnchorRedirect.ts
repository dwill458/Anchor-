import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';

export function useMissingAnchorRedirect(
  hasAnchor: boolean,
  navigation: unknown,
  mode: 'replace' | 'navigate' = 'replace'
): void {
  useEffect(() => {
    if (hasAnchor) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      navigateToVaultDestination(navigation as any, mode);
    });

    return () => task.cancel();
  }, [hasAnchor, mode, navigation]);
}
