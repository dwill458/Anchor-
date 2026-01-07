/**
 * Anchor App - Root Navigator
 *
 * Top-level navigator that switches between Auth and Main flows
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { useAuthStore } from '../stores/authStore';

export type RootNavigatorParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createStackNavigator<RootNavigatorParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, hasCompletedOnboarding } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated || !hasCompletedOnboarding ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
};
