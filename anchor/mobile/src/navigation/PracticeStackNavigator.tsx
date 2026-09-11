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
import type { PracticeLaunchRequest } from './v2/PracticeLaunchHost';
// DEFERRED: import { PracticeScreen, StabilizeRitualScreen, EvolveScreen } from '@/screens/practice'; — restore post-launch
import { PracticeScreen, EvolveScreen, ThreadStrengthDetailScreen } from '@/screens/practice';
import {
  ActivationScreen,
  BreathingAnimation,
  ChargeCompleteScreen,
  ChargeSetupScreen,
  ConfirmBurnScreen,
  BurningRitualScreen,
  FirstPrimeCompleteScreen,
  RitualScreen,
  SealAnchorScreen,
} from '@/screens/rituals';
import { ManualReinforcementScreen } from '@/screens/create';
import {
  VisualizeCompletionScreen,
  VisualizePreparationScreen,
  VisualizeSessionScreen,
} from '@/screens/visualize';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

interface PracticeStackNavigatorProps {
  onRouteChange?: (routeName: string) => void;
  launchRequest?: PracticeLaunchRequest | null;
  onReturnToV2?: () => void;
}

export const PracticeStackNavigator: React.FC<PracticeStackNavigatorProps> = ({ onRouteChange, launchRequest, onReturnToV2 }) => {
  const navigationRef = useNavigationContainerRef<PracticeStackParamList>();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    onRouteChange?.('PracticeHome');
  }, [onRouteChange]);

  React.useEffect(() => {
    if (!launchRequest || !ready) return;
    if (launchRequest.mode === 'focus') navigationRef.navigate('ActivationRitual', { anchorId: launchRequest.anchorId, activationType: 'visual', durationOverride: launchRequest.durationSeconds, returnTo: 'practice', source: launchRequest.source });
    else if (launchRequest.mode === 'deep_prime') navigationRef.navigate('Ritual', { anchorId: launchRequest.anchorId, ritualType: 'ritual', durationSeconds: launchRequest.durationSeconds, returnTo: 'practice', source: launchRequest.source });
    else navigationRef.navigate('VisualizePreparation', { anchorId: launchRequest.anchorId, source: launchRequest.source });
  }, [launchRequest, navigationRef, ready]);

  return (
    <ErrorBoundary>
      <NavigationContainer
        independent={true}
        ref={navigationRef}
        onReady={() => {
          setReady(true);
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
          <Stack.Screen name="ThreadStrengthDetail" component={ThreadStrengthDetailScreen} />
          <Stack.Screen name="Evolve" component={EvolveScreen} />
          <Stack.Screen
            name="ChargeSetup"
            component={ChargeSetupScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="BreathingAnimation"
            component={BreathingAnimation}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="Ritual"
            component={RitualScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="SealAnchor"
            component={SealAnchorScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="ChargeComplete"
            component={ChargeCompleteScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="FirstPrimeComplete"
            component={FirstPrimeCompleteScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="ActivationRitual"
            component={ActivationScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="ManualReinforcement"
            component={ManualReinforcementScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="VisualizePreparation"
            component={VisualizePreparationScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="VisualizeSession"
            component={VisualizeSessionScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen
            name="VisualizeCompletion"
            component={VisualizeCompletionScreen}
            options={{ animation: 'none' }}
          />
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
