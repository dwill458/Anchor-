/**
 * Anchor App - Main Tab Navigator
 *
 * Bottom tab navigation with glassmorphic design
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Home, Compass, ShoppingBag, User } from 'lucide-react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { VaultStackNavigator } from './VaultStackNavigator';
import { DiscoverScreen } from '../screens/discover';
import { ShopScreen } from '../screens/shop';
import { SettingsScreen } from '../screens/profile';
import type { MainTabParamList } from '@/types';
import { colors, spacing } from '@/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: 'transparent' }} // Fix white background issue
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
          overflow: 'hidden', // Ensure proper corner clipping
          // Premium shadow
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          // Border for glassmorphic effect
          borderWidth: 1,
          borderColor: 'rgba(212, 175, 55, 0.15)',
        },
        tabBarBackground: () => (
          <View style={styles.tabBarBackgroundContainer}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 40 : 80}
              tint="dark"
              style={styles.blurView}
            >
              <LinearGradient
                colors={[
                  'rgba(62, 44, 91, 0.85)',  // deepPurple with transparency
                  'rgba(26, 26, 29, 0.75)',  // background.secondary with transparency
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabBarGradient}
              />
            </BlurView>
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
        component={SettingsScreen}
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
    overflow: 'hidden', // Critical for clipping corners
    backgroundColor: 'transparent',
  },
  blurView: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden', // Ensure blur respects border radius
  },
  tabBarGradient: {
    flex: 1,
    borderRadius: 30,
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
    backgroundColor: 'rgba(212, 175, 55, 0.25)', // More visible gold glow
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)', // Stronger gold outline
    zIndex: 1,
    // Subtle shadow for depth
    shadowColor: colors.gold,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
});
