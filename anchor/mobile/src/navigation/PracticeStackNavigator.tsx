/**
 * Anchor App - Practice Stack Navigator
 *
 * Practice flow: PracticeHome → StabilizeRitual → Evolve
 */

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PracticeStackParamList } from '@/types';
import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export const PracticeStackNavigator: React.FC = () => {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: Platform.OS === 'ios',
        }}
      >
        <Stack.Screen name="PracticeHome" component={PracticeScreen} />
        <Stack.Screen name="StabilizeRitual" component={StabilizeRitualScreen} />
        <Stack.Screen name="Evolve" component={EvolveScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
