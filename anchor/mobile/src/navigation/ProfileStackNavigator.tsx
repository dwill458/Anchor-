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
import {
  ProfileScreen,
  SettingsScreen,
  SessionDefaultsScreen,
  DailyPracticeGoalScreen,
  ThreadStrengthScreen,
  RestDaysScreen,
  ThemeSelectionScreen,
  AccentColorScreen,
  VaultViewScreen,
  HapticIntensityScreen,
  DataPrivacyScreen,
} from '../screens/profile';
import { HapticFeedbackScreen } from '../screens/settings';
import { LoginScreen } from '../screens/auth';
import type { AuthScreenParams } from '@/types';

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  SessionDefaults: undefined;
  DailyPracticeGoal: undefined;
  ThreadStrength: undefined;
  RestDays: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultCharge: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultActivation: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  PrimingDefaults: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen — remove post-launch.
  DefaultFocusMode: undefined;
  ThemeSelection: undefined;
  AccentColor: undefined;
  VaultView: undefined;
  HapticFeedback: undefined;
  HapticIntensity: undefined;
  DataPrivacy: undefined;
  Login: AuthScreenParams | undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => {
  return (
    <ErrorBoundary>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          animation: 'slide_from_right',
          gestureEnabled: Platform.OS === 'ios',
          headerStyle: {
            backgroundColor: '#080C10',
          },
          headerShadowVisible: false,
          headerTintColor: '#D9B36C',
          headerTitleStyle: {
            fontFamily: 'Cinzel-Regular',
            fontSize: 15,
          },
          headerBackTitleVisible: false,
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
          name="DefaultCharge"
          component={SessionDefaultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DefaultActivation"
          component={SessionDefaultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrimingDefaults"
          component={SessionDefaultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DefaultFocusMode"
          component={SessionDefaultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DailyPracticeGoal"
          component={DailyPracticeGoalScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ThreadStrength"
          component={ThreadStrengthScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RestDays"
          component={RestDaysScreen}
          options={{ headerShown: false }}
        />
        {/* DEFERRED: legacy practice-settings routes replaced by SessionDefaultsScreen — remove post-launch. */}
        <Stack.Screen
          name="ThemeSelection"
          component={ThemeSelectionScreen}
          options={{ headerTitle: 'Theme' }}
        />
        <Stack.Screen
          name="AccentColor"
          component={AccentColorScreen}
          options={{ headerTitle: 'Accent Color' }}
        />
        <Stack.Screen
          name="VaultView"
          component={VaultViewScreen}
          options={{ headerTitle: 'Vault View' }}
        />
        <Stack.Screen
          name="HapticFeedback"
          component={HapticFeedbackScreen}
          options={{ headerTitle: 'Haptic Feedback' }}
        />
        <Stack.Screen
          name="HapticIntensity"
          component={HapticIntensityScreen}
          options={{ headerTitle: 'Haptic Intensity' }}
        />
        <Stack.Screen
          name="DataPrivacy"
          component={DataPrivacyScreen}
          options={{ headerTitle: 'Data & Privacy' }}
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
