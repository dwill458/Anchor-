/**
 * Anchor App - Vault Stack Navigator
 *
 * Vault flow: Vault → Detail → Charge/Activate
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { VaultScreen, AnchorDetailScreen } from '../screens/vault';
import {
  IntentionInputScreen,
  DistillationAnimationScreen,
  StructureForgeScreen,
  ManualReinforcementScreen,
  LockStructureScreen,
  EnhancementChoiceScreen,
  AIAnalysisScreen,
  AIGeneratingScreen,
  AIVariationPickerScreen,
  MantraCreationScreen,
  ManualForgeScreen,
  PostForgeChoiceScreen,
} from '../screens/create';
import {
  ChargeChoiceScreen,
  EmotionalPrimingScreen,
  QuickChargeScreen,
  DeepChargeScreen,
  ActivationScreen,
  ConfirmBurnScreen,
  BurningRitualScreen,
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
        options={{ headerShown: false }}
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
        name="DistillationAnimation"
        component={DistillationAnimationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StructureForge"
        component={StructureForgeScreen}
        options={{ title: 'Choose Structure' }}
      />
      <Stack.Screen
        name="ManualReinforcement"
        component={ManualReinforcementScreen}
        options={{ title: 'Reinforce Structure', headerShown: false }}
      />
      <Stack.Screen
        name="LockStructure"
        component={LockStructureScreen}
        options={{ title: 'Structure Locked', headerShown: false }}
      />
      {/* Phase 2: AI Enhancement Flow */}
      <Stack.Screen
        name="EnhancementChoice"
        component={EnhancementChoiceScreen}
        options={{ title: 'Finalize Anchor' }}
      />
      <Stack.Screen
        name="ManualForge"
        component={ManualForgeScreen}
        options={{ title: 'Forge Your Sigil', headerShown: false }}
      />
      <Stack.Screen
        name="PostForgeChoice"
        component={PostForgeChoiceScreen}
        options={{ title: 'Enhance Your Creation?' }}
      />
      <Stack.Screen
        name="AIAnalysis"
        component={AIAnalysisScreen}
        options={{ title: 'AI Analysis' }}
      />
      <Stack.Screen
        name="AIGenerating"
        component={AIGeneratingScreen}
        options={{ title: 'Generating...', headerShown: false }}
      />
      <Stack.Screen
        name="AIVariationPicker"
        component={AIVariationPickerScreen}
        options={{ title: 'Choose Variation' }}
      />
      <Stack.Screen
        name="MantraCreation"
        component={MantraCreationScreen}
        options={{ title: 'Create Mantra' }}
      />
      {/* Charging Rituals */}
      <Stack.Screen
        name="ChargeChoice"
        component={ChargeChoiceScreen}
        options={{ title: 'Charge Anchor' }}
      />
      <Stack.Screen
        name="ChargingRitual"
        component={ChargeChoiceScreen}
        options={{ title: 'Charge Anchor' }}
      />
      {/* Phase 2.6: Emotional Priming */}
      <Stack.Screen
        name="EmotionalPriming"
        component={EmotionalPrimingScreen}
        options={{ title: 'Prepare', headerShown: false }}
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
      {/* Phase 3: Burning Ritual */}
      <Stack.Screen
        name="ConfirmBurn"
        component={ConfirmBurnScreen}
        options={{ title: '🔥 Burn & Release' }}
      />
      <Stack.Screen
        name="BurningRitual"
        component={BurningRitualScreen}
        options={{ title: 'Releasing...', headerShown: false }}
      />
    </Stack.Navigator>
  );
};
