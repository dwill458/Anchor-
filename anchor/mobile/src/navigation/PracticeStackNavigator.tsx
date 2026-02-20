/**
 * Anchor App - Practice Stack Navigator
 *
 * Practice flow: PracticeHome → StabilizeRitual → Evolve
 */

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PracticeStackParamList } from '@/types';
import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

interface PracticeStackNavigatorProps {
  onRouteChange?: (routeName: string) => void;
}

export const PracticeStackNavigator: React.FC<PracticeStackNavigatorProps> = ({ onRouteChange }) => {
  const navigationRef = useNavigationContainerRef<PracticeStackParamList>();

  React.useEffect(() => {
    onRouteChange?.('PracticeHome');
  }, [onRouteChange]);

  return (
    <NavigationContainer
      independent={true}
      ref={navigationRef}
      onReady={() => {
        const routeName = navigationRef.getCurrentRoute()?.name;
        if (routeName) onRouteChange?.(routeName);
      }}
      onStateChange={() => {
        const routeName = navigationRef.getCurrentRoute()?.name;
        if (routeName) onRouteChange?.(routeName);
      }}
    >
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
