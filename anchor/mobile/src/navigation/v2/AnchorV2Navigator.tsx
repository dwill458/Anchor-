import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { V2DevelopmentHome } from '@/screens/v2/home';
import { V2SystemGallery } from '@/screens/v2/system';
import { V2FirstRunFlow } from '@/screens/v2/onboarding';
import type { AnchorV2StackParamList } from './types';

const Stack = createNativeStackNavigator<AnchorV2StackParamList>();

/** Development-only navigator. It must never be imported by production screens. */
export function AnchorV2Navigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="V2FirstRun" component={V2FirstRunFlow} />
      <Stack.Screen name="V2DevelopmentHome" component={V2DevelopmentHome} />
      <Stack.Screen name="V2SystemGallery" component={V2SystemGallery} />
    </Stack.Navigator>
  );
}
