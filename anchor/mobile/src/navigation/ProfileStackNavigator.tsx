/**
 * Anchor App - Profile Stack Navigator
 *
 * Stack navigator for Profile/Account/Settings.
 * Accessed as a root-level modal route.
 */

import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProfileScreen } from '../screens/profile';
import { SettingsScreen, SessionDefaultsScreen } from '../screens/settings';
import { LoginScreen } from '../screens/auth';
import type { AuthScreenParams } from '@/types';

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  SessionDefaults: undefined;
  Login: AuthScreenParams | undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => {
  return (
    <ErrorBoundary>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: Platform.OS === 'ios',
          contentStyle: { backgroundColor: '#080C10' },
        }}
      >
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SessionDefaults"
          component={SessionDefaultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </ErrorBoundary>
  );
};
