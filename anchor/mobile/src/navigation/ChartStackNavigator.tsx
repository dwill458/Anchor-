import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { colors } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import type { ChartStackParamList } from '@/types/chart';
import {
  ChartHomeScreen,
  AIPlanReviewScreen,
  CompletedJourneyScreen,
  CourseCompletionScreen,
  CourseDetailsScreen,
  CourseEditorScreen,
  CourseSetupScreen,
  WaypointDetailScreen,
  CourseLogScreen,
  ReflectionComposerScreen,
  WaypointActivationScreen,
  WaypointReachedScreen,
} from '@/screens/chart';

const Stack = createNativeStackNavigator<ChartStackParamList>();

interface ChartStackNavigatorProps {
  onRouteChange?: (routeName: string) => void;
}

export const ChartStackNavigator: React.FC<ChartStackNavigatorProps> = ({ onRouteChange }) => {
  const navigationRef = useNavigationContainerRef<ChartStackParamList>();
  const reduceMotion = useReduceMotionEnabled();

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
          screenListeners={{
            state: (event) => {
              const state = event.data.state as { index: number; routes: Array<{ name: string }> } | undefined;
              const routeName = state?.routes?.[state.index]?.name;
              if (routeName) onRouteChange?.(routeName);
            },
          }}
          screenOptions={{
            headerShown: false,
            animation: reduceMotion ? 'none' : 'slide_from_right',
            gestureEnabled: true,
            contentStyle: { backgroundColor: colors.background.primary },
          }}
        >
      <Stack.Screen name="ChartHome" component={ChartHomeScreen} />
      <Stack.Screen name="CourseSetup" component={CourseSetupScreen} options={{ presentation: 'modal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }} />
      <Stack.Screen name="CourseEditor" component={CourseEditorScreen} />
      <Stack.Screen name="AIPlanReview" component={AIPlanReviewScreen} />
      <Stack.Screen
        name="WaypointActivation"
        component={WaypointActivationScreen}
        options={{ gestureEnabled: false, animation: reduceMotion ? 'none' : 'fade' }}
      />
      <Stack.Screen
        name="WaypointDetail"
        component={WaypointDetailScreen}
        options={{ presentation: 'formSheet', gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="WaypointReached"
        component={WaypointReachedScreen}
        options={{ gestureEnabled: false, animation: reduceMotion ? 'none' : 'fade' }}
      />
      <Stack.Screen name="CourseLog" component={CourseLogScreen} />
      <Stack.Screen
        name="ReflectionComposer"
        component={ReflectionComposerScreen}
        options={{ presentation: 'formSheet', gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="CourseDetails"
        component={CourseDetailsScreen}
        options={{ presentation: 'formSheet', gestureDirection: 'vertical' }}
      />
      <Stack.Screen
        name="CourseCompletion"
        component={CourseCompletionScreen}
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
          animation: reduceMotion ? 'none' : 'fade',
        }}
      />
      <Stack.Screen name="CompletedJourney" component={CompletedJourneyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

export default ChartStackNavigator;
