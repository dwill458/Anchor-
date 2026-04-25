/**
 * Anchor App - Profile Stack Navigator
 *
 * Stack navigator for Profile/Account/Settings.
 * Accessed as a root-level modal route.
 */

import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import { SettingsIcon } from '@/components/icons';
import {
  ProfileScreen,
  SettingsScreen,
  SessionDefaultsScreen,
  DailyPracticeGoalScreen,
  ThreadStrengthScreen,
  RestDaysScreen,
  ThemeSelectionScreen,
  AccentColorScreen,
  VaultViewScreen,
  MantraVoiceScreen,
  VoiceStyleScreen,
  HapticIntensityScreen,
  DataPrivacyScreen,
} from '../screens/profile';
import { HapticFeedbackScreen } from '../screens/settings';
import { colors } from '@/theme';

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  SessionDefaults: undefined;
  DailyPracticeGoal: undefined;
  ThreadStrength: undefined;
  RestDays: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen.
  DefaultCharge: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen.
  DefaultActivation: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen.
  PrimingDefaults: undefined;
  // DEFERRED: replaced by SessionDefaultsScreen.
  DefaultFocusMode: undefined;
  ThemeSelection: undefined;
  AccentColor: undefined;
  VaultView: undefined;
  MantraVoice: undefined;
  VoiceStyle: undefined;
  HapticFeedback: undefined;
  HapticIntensity: undefined;
  DataPrivacy: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => {
  const rootNavigation = useNavigation<any>();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        gestureEnabled: Platform.OS === 'ios',
        headerStyle: {
          backgroundColor: '#080C10',
        },
        headerShadowVisible: false,
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontFamily: 'Cinzel-Regular',
          fontSize: 15,
        },
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: '#080C10' },
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ navigation }) => ({
          headerTitle: 'Profile',
          headerLeft: () => (
            <Pressable
              onPress={() => rootNavigation.goBack()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <X color={colors.gold} size={22} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={styles.navButton}
            >
              <SettingsIcon size={17} color={colors.gold} glow={false} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerTitle: 'Settings' }}
      />
      <Stack.Screen
        name="SessionDefaults"
        component={SessionDefaultsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DailyPracticeGoal"
        component={DailyPracticeGoalScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ThreadStrength"
        component={ThreadStrengthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RestDays"
        component={RestDaysScreen}
        options={{ headerShown: false }}
      />
      {/* DEFERRED: legacy practice-settings routes replaced by SessionDefaultsScreen. */}
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
        name="HapticFeedback"
        component={HapticFeedbackScreen}
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
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
