/**
 * OnboardingNavigator - Stack navigator for first-run onboarding
 *
 * Flow: Welcome → Reframe → HowItWorks → DailyLoop → SaveProgress
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OnboardingStackParamList } from '@/types';
import {
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
    >
      <Stack.Screen name="Welcome" component={NarrativeOnboardingScreen} />
    </Stack.Navigator>
  );
};
