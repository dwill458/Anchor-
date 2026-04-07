/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding, Main, and Paywall flows.
 *
 * Flow:
 * - Trial expired + no subscription: PaywallScreen (blocks all navigation)
 * - First-time users: Onboarding → Main
 * - Returning users with active trial/subscription: Main
 * - Profile: Accessed via header avatar (modal)
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useTrialStatus } from '../hooks/useTrialStatus';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall: undefined;
} & ProfileStackParamList; // Merge ProfileStack routes into root

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

/**
 * useTrialInit — sets trialStartDate on first app open if not already set,
 * and transitions expired trials to 'expired' status on every mount.
 */
function useTrialInit() {
  const trialStartDate = useSubscriptionStore((s) => s.trialStartDate);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);
  const setTrialStartDate = useSubscriptionStore((s) => s.setTrialStartDate);
  const setSubscriptionStatus = useSubscriptionStore((s) => s.setSubscriptionStatus);

  useEffect(() => {
    // First launch: stamp the trial start date
    if (!trialStartDate && subscriptionStatus !== 'active') {
      setTrialStartDate(new Date().toISOString());
      setSubscriptionStatus('trial');
      return;
    }

    // Daily check: expire the trial if 7 days have passed
    if (trialStartDate && subscriptionStatus === 'trial') {
      const msElapsed = Date.now() - new Date(trialStartDate).getTime();
      const daysElapsed = Math.floor(msElapsed / 86_400_000);
      if (daysElapsed >= 7) {
        setSubscriptionStatus('expired');
      }
    }
  }, [trialStartDate, subscriptionStatus, setTrialStartDate, setSubscriptionStatus]);
}

export const RootNavigator: React.FC = () => {
  useTrialInit();

  const { hasCompletedOnboarding } = useAuthStore();
  const developerSkipOnboardingEnabled = useSettingsStore(
    (state) => state.developerSkipOnboardingEnabled
  );
  const shouldBypassOnboarding = __DEV__ && developerSkipOnboardingEnabled;

  const { hasExpired, isSubscribed } = useTrialStatus();
  const showPaywall = hasExpired && !isSubscribed;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showPaywall ? (
        <Stack.Screen name="Paywall" component={PaywallScreen} />
      ) : !hasCompletedOnboarding && !shouldBypassOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
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
        </>
      )}
    </Stack.Navigator>
  );
};
