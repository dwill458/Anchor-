/**
 * Anchor App - Main Tab Navigator
 *
 * Bottom tab navigation for main app sections
 */

import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Compass, ShoppingBag, User } from 'lucide-react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
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
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: 'transparent',
          borderRadius: 30,
          height: 70,
          borderTopWidth: 0,
          // Shadow for iOS
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 4.65,
        },
        tabBarBackground: () => (
          <View style={styles.tabBarBackgroundContainer}>
            <LinearGradient
              colors={[colors.deepPurple, colors.background.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabBarGradient}
            />
          </View>
        ),
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }), // Fallback font
          marginBottom: 8,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        }
      }}
    >
      <Tab.Screen
        name="Vault"
        component={VaultStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Vault';
          // Hide tab bar for any screen other than the main 'Vault' list
          const isTabBarVisible = routeName === 'Vault';

          return {
            tabBarLabel: 'Sanctuary',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.sanctuaryIconContainer}>
                {focused && <View style={styles.sanctuaryPill} />}
                <Home color={color} size={24} style={{ zIndex: 2 }} />
              </View>
            ),
            tabBarStyle: isTabBarVisible ? undefined : { display: 'none' },
          };
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={24} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabBarGradient: {
    flex: 1,
  },
  sanctuaryIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sanctuaryPill: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.12)', // Subtle gold glow
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.20)', // Gentle gold outline
    zIndex: 1,
  },
});
