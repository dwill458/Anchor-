/**
 * Anchor App - Profile Stack Navigator
 *
 * Stack navigator for Profile/Account/Settings.
 * Accessed as a root-level modal route.
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import {
  SettingsScreen,
  DefaultChargeSettings,
  DefaultActivationSettings,
  DailyPracticeGoalScreen,
  ThemeSelectionScreen,
  AccentColorScreen,
  VaultViewScreen,
  MantraVoiceScreen,
  VoiceStyleScreen,
  HapticIntensityScreen,
  DataPrivacyScreen,
} from '../screens/profile';
import { colors } from '@/theme';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

export type ProfileStackParamList = {
  Settings: undefined;
  DefaultCharge: undefined;
  DefaultActivation: undefined;
  DailyPracticeGoal: undefined;
  ThemeSelection: undefined;
  AccentColor: undefined;
  VaultView: undefined;
  MantraVoice: undefined;
  VoiceStyle: undefined;
  HapticIntensity: undefined;
  DataPrivacy: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();
const CLOSE_DISMISS_DELAY_MS = 220;

export const ProfileStackNavigator: React.FC = () => {
  const rootNavigation = useNavigation<any>();
  const reveal = useSettingsReveal();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const bypassNextRemoveRef = useRef(false);

  useEffect(() => {
    const unsubscribe = rootNavigation.addListener('beforeRemove', (event: any) => {
      if (bypassNextRemoveRef.current || !reveal.isArmed || reduceMotionEnabled) {
        return;
      }

      event.preventDefault();
      reveal.beginClose({ reduceMotion: reduceMotionEnabled });

      setTimeout(() => {
        bypassNextRemoveRef.current = true;
        rootNavigation.dispatch(event.data.action);
      }, CLOSE_DISMISS_DELAY_MS);
    });

    return unsubscribe;
  }, [reduceMotionEnabled, reveal, rootNavigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        gestureEnabled: Platform.OS === 'ios',
        headerStyle: {
          backgroundColor: colors.background.secondary,
        },
        headerShadowVisible: false,
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: 'Account',
          headerLeft: () => (
            <Pressable
              onPress={() => rootNavigation.goBack()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close Settings"
              style={styles.closeButton}
            >
              <X color={colors.gold} size={22} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="DefaultCharge"
        component={DefaultChargeSettings}
        options={{ headerTitle: 'Default Charge' }}
      />
      <Stack.Screen
        name="DefaultActivation"
        component={DefaultActivationSettings}
        options={{ headerTitle: 'Default Activation' }}
      />
      <Stack.Screen
        name="DailyPracticeGoal"
        component={DailyPracticeGoalScreen}
        options={{ headerTitle: 'Daily Practice Goal' }}
      />
      <Stack.Screen
        name="ThemeSelection"
        component={ThemeSelectionScreen}
        options={{ headerTitle: 'Theme' }}
      />
      <Stack.Screen
        name="AccentColor"
        component={AccentColorScreen}
        options={{ headerTitle: 'Accent Color' }}
      />
      <Stack.Screen
        name="VaultView"
        component={VaultViewScreen}
        options={{ headerTitle: 'Vault View' }}
      />
      <Stack.Screen
        name="MantraVoice"
        component={MantraVoiceScreen}
        options={{ headerTitle: 'Mantra Voice' }}
      />
      <Stack.Screen
        name="VoiceStyle"
        component={VoiceStyleScreen}
        options={{ headerTitle: 'Voice Style' }}
      />
      <Stack.Screen
        name="HapticIntensity"
        component={HapticIntensityScreen}
        options={{ headerTitle: 'Haptic Feedback' }}
      />
      <Stack.Screen
        name="DataPrivacy"
        component={DataPrivacyScreen}
        options={{ headerTitle: 'Data & Privacy' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
