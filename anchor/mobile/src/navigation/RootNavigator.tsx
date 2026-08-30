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

import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNavigationResumeStore } from '../stores/navigationResumeStore';
import { claimInitialDeepLink, parseChartDeepLink } from './chartDeepLinks';
import type { AuthPreferredPlanId, PaywallSource, NavigationResumeTarget } from '../types';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
  Paywall:
    | {
        source?: PaywallSource;
        preferredPlanId?: AuthPreferredPlanId;
        resumeTarget?: NavigationResumeTarget;
      }
    | undefined;
  Settings: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

/** Captures Chart links while the auth/onboarding flow owns the screen. */
const UnauthenticatedChartDeepLinkHandler: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) return;

    const handleUrl = (url: string | null | undefined) => {
      const target = parseChartDeepLink(url);
      if (target) useNavigationResumeStore.getState().setChartDeepLink(target);
    };

    void Linking.getInitialURL().then((url) => {
      if (parseChartDeepLink(url) && claimInitialDeepLink()) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [isAuthenticated]);

  return null;
};

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

  return (
    <>
      {!isAuthenticated && <UnauthenticatedChartDeepLinkHandler />}
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
    </>
  );
};
