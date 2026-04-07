/**
 * Anchor App - Main Tab Navigator
 *
 * Bottom tab navigation for main app sections
 */

import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { VaultStackNavigator } from './VaultStackNavigator';
import { DiscoverScreen } from '../screens/discover';
import { ShopScreen } from '../screens/shop';
import { ProfileScreen } from '../screens/profile';
import type { MainTabParamList } from '@/types';
import { colors, spacing } from '@/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopColor: colors.background.card,
          borderTopWidth: 1,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          height: 60,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-Regular',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Vault"
        component={VaultStackNavigator}
        options={{
          tabBarLabel: 'Vault',
          tabBarIcon: ({ color }) => <TabIcon icon="⚓" color={color} />,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color }) => <TabIcon icon="🔮" color={color} />,
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color }) => <TabIcon icon="🖼️" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Simple emoji icon component
const TabIcon: React.FC<{ icon: string; color: string }> = ({ icon }) => {
  return <Text style={{ fontSize: 24 }}>{icon}</Text>;
};
