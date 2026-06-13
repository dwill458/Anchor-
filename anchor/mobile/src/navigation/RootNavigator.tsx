/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding and Main flows,
 * with Paywall presented over Main when an onboarded user's trial expires.
 *
 * Flow:
 * - First-time users: Onboarding
 * - Returning users: Main
 * - Expired trial after onboarding: PaywallScreen presented over Main via
 *   `App.tsx` (resetRoot once RevenueCat confirms the entitlement is expired)
 * - Profile: Accessed via header avatar (modal)
 */

import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import TrialEndScreen from '../screens/TrialEndScreen';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useTrialStatus } from '../hooks/useTrialStatus';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall: { source?: 'post_trial' | 'gated_feature' } | undefined;
  TrialEndScreen: undefined;
  Settings: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding, isAuthenticated } = useAuthStore();
  const developerMasterAccountEnabled = useSettingsStore(
    (state) => state.developerMasterAccountEnabled
  );
  const developerSkipOnboardingEnabled = useSettingsStore(
    (state) => state.developerSkipOnboardingEnabled
  );
  const shouldBypassOnboarding =
    __DEV__ && (developerSkipOnboardingEnabled || developerMasterAccountEnabled);
  const showOnboarding = !shouldBypassOnboarding && !hasCompletedOnboarding;

  const { hasExpired, isSubscribed } = useTrialStatus();
  const rcSynced = useSubscriptionStore((s) => s.rcSynced);
  const devOverrideEnabled = useSubscriptionStore((s) => s.devOverrideEnabled);
  const remoteCompedAccess = useSubscriptionStore((s) => s.remoteCompedAccess);
  // Only gate on trial expiry once RevenueCat has confirmed entitlement state
  // (same guard as App.tsx). Dev overrides and comped access bypass immediately.
  const entitlementResolved =
    rcSynced || (__DEV__ && devOverrideEnabled) || remoteCompedAccess;
  const showTrialEnd =
    isAuthenticated && !showOnboarding && hasExpired && !isSubscribed && entitlementResolved;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {showTrialEnd && (
            <Stack.Screen
              name="TrialEndScreen"
              component={TrialEndScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          )}
          {/* Profile/Settings as modal */}
          <Stack.Screen
            name="Settings"
            component={ProfileStackNavigator}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              gestureDirection: 'vertical',
              contentStyle: { backgroundColor: '#080C10' },
            }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              contentStyle: { backgroundColor: '#080C10' },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
