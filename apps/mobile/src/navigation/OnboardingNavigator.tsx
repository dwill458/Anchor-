/**
 * OnboardingNavigator - Stack navigator for first-run onboarding
 *
 * Flow: Welcome → Reframe → HowItWorks → DailyLoop → SaveProgress
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OnboardingStackParamList } from '@/types';
import {
  WelcomeScreen,
  ReframeScreen,
  HowItWorksScreen,
  DailyLoopScreen,
  SaveProgressScreen,
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
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Reframe" component={ReframeScreen} />
      <Stack.Screen name="HowItWorks" component={HowItWorksScreen} />
      <Stack.Screen name="DailyLoop" component={DailyLoopScreen} />
      <Stack.Screen name="SaveProgress" component={SaveProgressScreen} />
    </Stack.Navigator>
  );
};
