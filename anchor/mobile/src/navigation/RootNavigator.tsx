/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding and Main flows,
 * with Paywall presented over Main when an onboarded user's trial expires.
 *
 * Flow:
 * - First-time users: Onboarding
 * - Returning users: Main
 * - Expired trial after onboarding: PaywallScreen presented over Main
 * - Profile: Accessed via header avatar (modal)
 */

import React, { useEffect } from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import TrialEndScreen from '../screens/TrialEndScreen';
import { shouldShowOnboardingFlow } from './rootNavigationState';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useTrialStatus } from '../hooks/useTrialStatus';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall: undefined;
  TrialEndScreen: undefined;
  Settings: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

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
  const developerMasterAccountEnabled = useSettingsStore(
    (state) => state.developerMasterAccountEnabled
  );
  const developerSkipOnboardingEnabled = useSettingsStore(
    (state) => state.developerSkipOnboardingEnabled
  );
  const shouldBypassOnboarding =
    __DEV__ && (developerSkipOnboardingEnabled || developerMasterAccountEnabled);
  const showOnboarding = shouldShowOnboardingFlow(
    hasCompletedOnboarding,
    shouldBypassOnboarding
  );

  const { hasExpired, isSubscribed } = useTrialStatus();
  const showTrialEnd = !showOnboarding && hasExpired && !isSubscribed;

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
              options={{ animation: 'default' }}
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
