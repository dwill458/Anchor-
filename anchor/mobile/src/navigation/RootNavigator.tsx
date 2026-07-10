/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding and Main flows.
 *
 * Flow:
 * - First-time users: Onboarding
 * - Returning users: Main
 * - Profile: Accessed via header avatar (modal)
 */

import React from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { AuthPreferredPlanId, PaywallSource } from '../types';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall:
    | {
        source?: PaywallSource;
        preferredPlanId?: AuthPreferredPlanId;
      }
    | undefined;
  Settings: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding } = useAuthStore();
  const developerMasterAccountEnabled = useSettingsStore(
    (state) => state.developerMasterAccountEnabled
  );
  const developerSkipOnboardingEnabled = useSettingsStore(
    (state) => state.developerSkipOnboardingEnabled
  );
  const shouldBypassOnboarding =
    __DEV__ && (developerSkipOnboardingEnabled || developerMasterAccountEnabled);
  const showOnboarding = !shouldBypassOnboarding && !hasCompletedOnboarding;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding ? (
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
