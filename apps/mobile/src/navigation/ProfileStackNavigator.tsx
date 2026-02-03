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
    ExportDataScreen,
    OfflineStatusScreen,
    LegalWebViewScreen,
    MantraVoiceScreen,
    VoiceStyleScreen,
    HapticFeedbackScreen,
} from '../screens/profile';
import { colors } from '@/theme';
import type { SettingsStackParamList } from '@/types';

export type ProfileStackParamList = SettingsStackParamList;

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
                presentation: 'modal',
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
                name="ExportData"
                component={ExportDataScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="OfflineStatus"
                component={OfflineStatusScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="LegalWebView"
                component={LegalWebViewScreen}
                options={{ headerShown: false }}
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
                name="HapticFeedback"
                component={HapticFeedbackScreen}
                options={{
                    headerTitle: 'Haptic Feedback',
                }}
            />
        </Stack.Navigator>
    );
};
