/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Onboarding and Main flows
 *
 * Flow:
 * - First-time users: Onboarding → Main
 * - Returning users: Main
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuthStore } from '../stores/authStore';

export type RootNavigatorParamList = {
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createStackNavigator<RootNavigatorParamList>();

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasCompletedOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
};
