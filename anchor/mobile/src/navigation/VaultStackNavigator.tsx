/**
 * Anchor App - Vault Stack Navigator
 *
 * Vault flow: Vault → Detail → Charge/Activate
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { VaultScreen, AnchorDetailScreen } from '../screens/vault';
import {
  IntentionInputScreen,
  ReturningIntentionScreen,
  LetterDistillationScreen,
  DistillationAnimationScreen,
  StructureForgeScreen,
  ManualReinforcementScreen,
  LockStructureScreen,
  EnhancementChoiceScreen,
  StyleSelectionScreen,
  AIGeneratingScreen,
  AIVariationPickerScreen,
  ManualForgeScreen,
  AnchorRevealScreen,
  WallpaperPromptScreen,
} from '../screens/create';
import {
  ActivationScreen,
  ConfirmBurnScreen,
  BurningRitualScreen,
  ChargeSetupScreen,
  RitualScreen,
  SealAnchorScreen,
  ChargeCompleteScreen,
  FirstPrimeCompleteScreen,
} from '../screens/rituals';
import { AuthGateScreen, FirstAnchorAccountGateScreen, LoginScreen, SignUpScreen } from '../screens/auth';
import type { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { useAuthStore } from '@/stores/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface VaultStackNavigatorProps {
  onRouteChange?: (routeName: string) => void;
}

export const VaultStackNavigator: React.FC<VaultStackNavigatorProps> = ({ onRouteChange }) => {
  const shouldRedirectToCreation = useAuthStore((state) => state.shouldRedirectToCreation);
  const setShouldRedirectToCreation = useAuthStore((state) => state.setShouldRedirectToCreation);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const shouldGateFirstVaultEntry = Boolean(pendingFirstAnchorDraft?.requiresAccountGate);
  const initialRouteName = shouldRedirectToCreation
    ? 'FirstAnchorCreation'
    : shouldGateFirstVaultEntry
      ? 'FirstAnchorAccountGate'
      : 'Vault';

  React.useEffect(() => {
    if (shouldRedirectToCreation) {
      setShouldRedirectToCreation(false);
    }
  }, [setShouldRedirectToCreation, shouldRedirectToCreation]);

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenListeners={{
        state: (event) => {
          const state = event.data.state as {
            index: number;
            routes: Array<{ name: string }>;
          } | undefined;
          const routeName = state?.routes?.[state.index]?.name;
          if (routeName) onRouteChange?.(routeName);
        },
      }}
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        headerStyle: {
          backgroundColor: '#080C10',
        },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontFamily: 'Cinzel-Regular',
          fontSize: 15,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen
        name="Vault"
        component={VaultScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FirstAnchorAccountGate"
        component={FirstAnchorAccountGateScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="AuthGate"
        component={AuthGateScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AnchorDetail"
        component={AnchorDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FirstAnchorCreation"
        component={IntentionInputScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="CreateAnchor"
        component={ReturningIntentionScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="LetterDistillation"
        component={LetterDistillationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SigilSelection"
        component={StructureForgeScreen}
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
        options={{ headerShown: false }}
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
        options={{ headerShown: false }}
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
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="WallpaperPrompt"
        component={WallpaperPromptScreen}
        options={{ headerShown: false }}
      />
      {/* ════════════════════════════════════════════════════════ */}
      {/* Charging & Activation - Zen Architect (Phase 2.7)       */}
      {/* ════════════════════════════════════════════════════════ */}
      <Stack.Screen
        name="ChargeSetup"
        component={ChargeSetupScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="Ritual"
        component={RitualScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="SealAnchor"
        component={SealAnchorScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="ChargeComplete"
        component={ChargeCompleteScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="FirstPrimeComplete"
        component={FirstPrimeCompleteScreen}
        options={{ headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="ActivationRitual"
        component={ActivationScreen}
        options={{ title: 'Activate', headerShown: false, animation: 'fade_from_bottom' }}
      />
      {/* Phase 3: Burning Ritual */}
      <Stack.Screen
        name="ConfirmBurn"
        component={ConfirmBurnScreen}
        options={{ title: 'Burn & Release', headerShown: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="BurningRitual"
        component={BurningRitualScreen}
        options={{ title: 'Releasing...', headerShown: false, animation: 'fade_from_bottom' }}
      />
    </Stack.Navigator>
  );
};
