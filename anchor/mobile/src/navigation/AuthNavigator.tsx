/**
 * Anchor App - Auth Navigator
 *
 * Authentication flow: Login → SignUp ↔ Onboarding
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen, SignUpScreen, OnboardingScreen } from '../screens/auth';
import { colors } from '@/theme';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
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
    </Stack.Navigator>
  );
};
