/**
 * Anchor App - Vault Stack Navigator
 *
 * Vault flow: Vault → Detail → Charge/Activate
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { VaultScreen, AnchorDetailScreen } from '../screens/vault';
import { IntentionInputScreen, SigilSelectionScreen } from '../screens/create';
import {
  ChargeChoiceScreen,
  QuickChargeScreen,
  DeepChargeScreen,
  ActivationScreen,
} from '../screens/rituals';
import type { RootStackParamList } from '@/types';
import { colors } from '@/theme';

const Stack = createStackNavigator<RootStackParamList>();

export const VaultStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background.secondary,
        },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontFamily: 'Cinzel-Regular',
          fontSize: 18,
        },
        cardStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen
        name="Vault"
        component={VaultScreen}
        options={{ title: 'My Anchors' }}
      />
      <Stack.Screen
        name="AnchorDetail"
        component={AnchorDetailScreen}
        options={{ title: 'Anchor Details' }}
      />
      <Stack.Screen
        name="CreateAnchor"
        component={IntentionInputScreen}
        options={{ title: 'Create Anchor' }}
      />
      <Stack.Screen
        name="SigilSelection"
        component={SigilSelectionScreen}
        options={{ title: 'Select Your Symbol' }}
      />
      <Stack.Screen
        name="ChargingRitual"
        component={ChargeChoiceScreen}
        options={{ title: 'Charge Anchor' }}
      />
      <Stack.Screen
        name="QuickCharge"
        component={QuickChargeScreen}
        options={{ title: 'Quick Charge', headerShown: false }}
      />
      <Stack.Screen
        name="DeepCharge"
        component={DeepChargeScreen}
        options={{ title: 'Deep Charge', headerShown: false }}
      />
      <Stack.Screen
        name="ActivationRitual"
        component={ActivationScreen}
        options={{ title: 'Activate', headerShown: false }}
      />
    </Stack.Navigator>
  );
};
