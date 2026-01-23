/**
 * OnboardingNavigator - Stack navigator for first-run onboarding
 *
 * Flow: LogoBreath (500ms) → Welcome → (5-screen narrative)
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OnboardingStackParamList } from '@/types';
import {
  LogoBreathScreen,
  NarrativeOnboardingScreen,
} from '@/screens/onboarding';

const Stack = createStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
        animationEnabled: true,
        gestureEnabled: false, // Disable swipe back during onboarding
      }}
      initialRouteName="LogoBreath"
    >
      <Stack.Screen
        name="LogoBreath"
        component={LogoBreathScreen}
        options={{
          animationEnabled: false, // No animation for initial screen
        }}
      />
      <Stack.Screen
        name="Welcome"
        component={NarrativeOnboardingScreen}
        options={{
          animationEnabled: true,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 100, // Quick fade from logo to screen 1
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 300,
              },
            },
          },
        }}
      />
    </Stack.Navigator>
  );
};
