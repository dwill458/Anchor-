/**
 * Anchor App - Profile Stack Navigator
 *
 * Stack navigator for Profile/Account/Settings
 * Accessed via header avatar button from main tabs
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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
    DataPrivacyScreen
} from '../screens/profile';
import { colors } from '@/theme';

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

const Stack = createStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: true,
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                    shadowColor: 'transparent',
                    elevation: 0,
                },
                headerTintColor: colors.gold,
                headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                },
                headerBackTitleVisible: false,
                presentation: 'card',
            }}
        >
            <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    headerTitle: 'Account',
                }}
            />
            <Stack.Screen
                name="DefaultCharge"
                component={DefaultChargeSettings}
                options={{
                    headerTitle: 'Default Charge',
                }}
            />
            <Stack.Screen
                name="DefaultActivation"
                component={DefaultActivationSettings}
                options={{
                    headerTitle: 'Default Activation',
                }}
            />
            <Stack.Screen
                name="DailyPracticeGoal"
                component={DailyPracticeGoalScreen}
                options={{
                    headerTitle: 'Daily Practice Goal',
                }}
            />
            <Stack.Screen
                name="ThemeSelection"
                component={ThemeSelectionScreen}
                options={{
                    headerTitle: 'Theme',
                }}
            />
            <Stack.Screen
                name="AccentColor"
                component={AccentColorScreen}
                options={{
                    headerTitle: 'Accent Color',
                }}
            />
            <Stack.Screen
                name="VaultView"
                component={VaultViewScreen}
                options={{
                    headerTitle: 'Vault View',
                }}
            />
            <Stack.Screen
                name="MantraVoice"
                component={MantraVoiceScreen}
                options={{
                    headerTitle: 'Mantra Voice',
                }}
            />
            <Stack.Screen
                name="VoiceStyle"
                component={VoiceStyleScreen}
                options={{
                    headerTitle: 'Voice Style',
                }}
            />
            <Stack.Screen
                name="HapticIntensity"
                component={HapticIntensityScreen}
                options={{
                    headerTitle: 'Haptic Feedback',
                }}
            />
            <Stack.Screen
                name="DataPrivacy"
                component={DataPrivacyScreen}
                options={{
                    headerTitle: 'Data & Privacy',
                }}
            />
        </Stack.Navigator>
    );
};
