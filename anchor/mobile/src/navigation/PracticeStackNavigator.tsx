/**
 * Anchor App - Practice Stack Navigator
 *
 * Practice flow: PracticeHome → StabilizeRitual → Evolve
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { PracticeStackParamList } from '@/types';
import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice';

const Stack = createStackNavigator<PracticeStackParamList>();

export const PracticeStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      detachInactiveScreens={true}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PracticeHome" component={PracticeScreen} />
      <Stack.Screen name="StabilizeRitual" component={StabilizeRitualScreen} />
      <Stack.Screen name="Evolve" component={EvolveScreen} />
    </Stack.Navigator>
  );
};

