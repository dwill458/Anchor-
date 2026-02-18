/**
 * Anchor App - Practice Stack Navigator
 *
 * Practice flow: PracticeHome → StabilizeRitual → Evolve
 */

import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabSlideWrapper } from '../components/transitions';
import type { PracticeStackParamList } from '@/types';
import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice';

const Stack = createNativeStackNavigator<PracticeStackParamList>();
const PRACTICE_TAB_INDEX = 1;

export const PracticeStackNavigator: React.FC = () => {
  return (
    <TabSlideWrapper tabIndex={PRACTICE_TAB_INDEX}>
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
    </TabSlideWrapper>
  );
};
