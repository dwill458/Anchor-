/**
 * Anchor App - Profile Stack Navigator
 *
 * Stack navigator for Profile/Account/Settings
 * Accessed via header avatar button from main tabs
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { SettingsScreen, DefaultChargeSettings, DefaultActivationSettings } from '../screens/profile';
import { colors } from '@/theme';

export type ProfileStackParamList = {
    Settings: undefined;
    DefaultCharge: undefined;
    DefaultActivation: undefined;
    // Add more profile-related screens here in the future
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
                name="DefaultCharge"
                component={DefaultChargeSettings}
                options={{
                    headerTitle: 'Default Charge',
                    headerBackTitleVisible: false,
                }}
            />
            <Stack.Screen
                name="DefaultActivation"
                component={DefaultActivationSettings}
                options={{
                    headerTitle: 'Default Activation',
                    headerBackTitleVisible: false,
                }}
            />
        </Stack.Navigator>
    );
};
