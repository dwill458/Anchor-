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
  ReturningIntentionScreen,
  DistillationAnimationScreen,
  StructureForgeScreen,
  ManualReinforcementScreen,
  LockStructureScreen,
  EnhancementChoiceScreen,
  StyleSelectionScreen,
  AIGeneratingScreen,
  AIVariationPickerScreen,
  MantraCreationScreen,
  ManualForgeScreen,
  AnchorRevealScreen,
} from '../screens/create';
import {
  ActivationScreen,
  ConfirmBurnScreen,
  BurningRitualScreen,
  ChargeSetupScreen,
  RitualScreen,
  SealAnchorScreen,
  ChargeCompleteScreen,
} from '../screens/rituals';
import { SettingsScreen } from '../screens/profile';
import type { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { useAuthStore } from '@/stores/authStore';

const Stack = createStackNavigator<RootStackParamList>();

export const VaultStackNavigator: React.FC = () => {
  // Determine which intention screen to show
  // shouldRedirectToCreation = true means they just completed onboarding (first time)
  const { shouldRedirectToCreation } = useAuthStore();
  const IntentionScreen = shouldRedirectToCreation
    ? IntentionInputScreen
    : ReturningIntentionScreen;

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
        component={IntentionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DistillationAnimation"
        component={DistillationAnimationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StructureForge"
        component={StructureForgeScreen}
        options={{
          headerTransparent: true,
          title: '',
          headerTintColor: colors.gold,
        }}
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
        options={{
          headerTransparent: true,
          title: '',
          headerTintColor: colors.gold,
        }}
      />
      {/* Phase 3: Style Selection & ControlNet Enhancement */}
      <Stack.Screen
        name="StyleSelection"
        component={StyleSelectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManualForge"
        component={ManualForgeScreen}
        options={{ title: 'Forge Your Sigil', headerShown: false }}
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
        name="EnhancedVersionPicker"
        component={AIVariationPickerScreen}
        options={{ title: 'Choose Variation' }}
      />
      <Stack.Screen
        name="AnchorReveal"
        component={AnchorRevealScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MantraCreation"
        component={MantraCreationScreen}
        options={{ title: 'Create Mantra' }}
      />
      {/* ════════════════════════════════════════════════════════ */}
      {/* Charging & Activation - Zen Architect (Phase 2.7)       */}
      {/* ════════════════════════════════════════════════════════ */}
      <Stack.Screen
        name="ChargeSetup"
        component={ChargeSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Ritual"
        component={RitualScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SealAnchor"
        component={SealAnchorScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChargeComplete"
        component={ChargeCompleteScreen}
        options={{ headerShown: false }}
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
      {/* Profile & Settings */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
