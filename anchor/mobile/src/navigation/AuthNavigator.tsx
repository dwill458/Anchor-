/**
 * Anchor App - Auth Navigator
 *
 * Authentication flow: Login → SignUp ↔ Onboarding
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen, SignUpScreen, OnboardingScreen } from '../screens/auth';
import { SaveProgressScreen } from '../screens/auth/SaveProgressScreen';
import { colors } from '@/theme';
import type { AuthScreenParams } from '@/types';

export type AuthStackParamList = {
  Login: AuthScreenParams | undefined;
  SignUp: AuthScreenParams | undefined;
  Onboarding: undefined;
  SaveProgress: {
    anchorIntention: string;
    anchorSvg: string;
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen
        name="SaveProgress"
        component={SaveProgressScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};
