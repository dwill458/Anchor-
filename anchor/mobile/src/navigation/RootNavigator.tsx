/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding and Main flows
 * Now includes ProfileStack for modal access to account/settings
 *
 * Flow:
 * - First-time users: Onboarding → Main
 * - Returning users: Main
 * - Profile: Accessed via header avatar (modal)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { useAuthStore } from '../stores/authStore';
import type { ProfileStackParamList } from './ProfileStackNavigator';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
} & ProfileStackParamList; // Merge ProfileStack routes into root

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {/* Profile/Settings as modal */}
          <Stack.Screen
            name="Settings"
            component={ProfileStackNavigator}
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
