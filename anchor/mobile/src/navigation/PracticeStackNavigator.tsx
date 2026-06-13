/**
 * Anchor App - Practice Stack Navigator
 *
 * Practice flow: PracticeHome → Evolve
 */

import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { PracticeStackParamList } from '@/types';
// DEFERRED: import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice'; — restore post-launch
import { PracticeScreen, EvolveScreen } from '@/screens/practice';
import { ConfirmBurnScreen, BurningRitualScreen } from '@/screens/rituals';

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
    <ErrorBoundary>
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
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: { backgroundColor: '#080C10' },
          }}
        >
          <Stack.Screen name="PracticeHome" component={PracticeScreen} />
          <Stack.Screen name="Evolve" component={EvolveScreen} />
          <Stack.Screen
            name="ConfirmBurn"
            component={ConfirmBurnScreen}
            options={{ headerShown: false, animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="BurningRitual"
            component={BurningRitualScreen}
            options={{ headerShown: false, animation: 'fade_from_bottom' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};
