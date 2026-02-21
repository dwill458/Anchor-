/**
 * TabNavigationContext
 *
 * Provides cross-tab navigation for screens inside VaultStack or PracticeStack
 * that need to navigate to a different tab (e.g., Practice→Vault's ActivationRitual).
 *
 * Replaces the old `navigation.getParent()?.navigate('Vault', ...)` pattern
 * that broke when we moved from @react-navigation/bottom-tabs to SwipeableTabContainer.
 *
 * Usage:
 *   const { navigateToVault, navigateToPractice } = useTabNavigation();
 *   navigateToVault('ActivationRitual', { anchorId: '...', activationType: 'visual' });
 *   navigateToPractice();
 *
 * Registration (call from each tab's root screen on mount):
 *   const { registerTabNav } = useTabNavigation();
 *   const navigation = useNavigation<any>();
 *   useEffect(() => {
 *     registerTabNav(0, navigation);   // 0 = Vault, 1 = Practice
 *     return () => registerTabNav(0, null);
 *   }, []);
 */

import React, { createContext, useCallback, useContext, useRef } from 'react';

type TabIndex = 0 | 1 | 2;

interface StackNavRef {
  navigate: (screen: string, params?: object) => void;
  popToTop: () => void;
}

interface TabNavigationContextValue {
  /** Switch to Vault tab, optionally pushing a specific screen immediately */
  navigateToVault: (screen?: string, params?: object) => void;
  /** Switch to Practice tab */
  navigateToPractice: () => void;
  /** Register the navigation object from a tab's root screen */
  registerTabNav: (tabIndex: TabIndex, nav: StackNavRef | null) => void;
  /** Currently selected top-level tab index */
  activeTabIndex: number;
}

const TabNavigationContext = createContext<TabNavigationContextValue | null>(null);

interface TabNavigationProviderProps {
  children: React.ReactNode;
  onIndexChange: (index: number) => void;
  activeIndex?: number;
}

export const TabNavigationProvider: React.FC<TabNavigationProviderProps> = ({
  children,
  onIndexChange,
  activeIndex = 0,
}) => {
  // Refs to each tab's root screen navigation — registered by VaultScreen + PracticeScreen
  const tabNavRefs = useRef<(StackNavRef | null)[]>([null, null, null]);

  const registerTabNav = useCallback((tabIndex: TabIndex, nav: StackNavRef | null) => {
    tabNavRefs.current[tabIndex] = nav;
  }, []);

  const navigateToVault = useCallback(
    (screen?: string, params?: object) => {
      // Push the target screen onto VaultStack BEFORE switching tab.
      // VaultStack is always rendered (SwipeableTabContainer), so this works
      // even when Vault is currently off-screen. When the tab switches, the
      // target screen is already on top.
      if (screen && tabNavRefs.current[0]) {
        tabNavRefs.current[0].navigate(screen, params);
      }
      onIndexChange(0);
    },
    [onIndexChange],
  );

  const navigateToPractice = useCallback(() => {
    onIndexChange(1);
  }, [onIndexChange]);

  return (
    <TabNavigationContext.Provider
      value={{ navigateToVault, navigateToPractice, registerTabNav, activeTabIndex: activeIndex }}
    >
      {children}
    </TabNavigationContext.Provider>
  );
};

export const useTabNavigation = (): TabNavigationContextValue => {
  const ctx = useContext(TabNavigationContext);
  if (!ctx) {
    throw new Error('useTabNavigation must be used within a TabNavigationProvider');
  }
  return ctx;
};
