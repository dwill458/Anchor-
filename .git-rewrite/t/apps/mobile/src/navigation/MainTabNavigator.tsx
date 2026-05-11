/**
 * Anchor App - Main Tab Navigator
 *
 * Bottom tab navigation with glassmorphic design
 * Three tabs: Sanctuary, Practice, Discover
 * Profile accessible via top-right avatar on all screens
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Home, Compass, Zap } from 'lucide-react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultStackNavigator } from './VaultStackNavigator';
import { DiscoverScreen } from '../screens/discover';
import { PracticeScreen } from '../screens/practice';
import { SettingsButton } from '../components/header/SettingsButton';
import type { MainTabParamList, RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Navigation hook type for accessing RootStack (Settings modal)
type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const MainTabNavigator: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { openDailyAnchorAutomatically } = useSettingsStore();
  const { anchors } = useAnchorStore();
  const hasCheckedAutoOpen = useRef(false);

  useEffect(() => {
    if (openDailyAnchorAutomatically && anchors.length > 0 && !hasCheckedAutoOpen.current) {
      hasCheckedAutoOpen.current = true;
      // Navigate to the primary (first) anchor detail
      setTimeout(() => {
        // @ts-ignore - navigation might not be fully typed here but we know the route exists
        navigation.navigate('Vault', {
          screen: 'AnchorDetail',
          params: { anchorId: anchors[0].id }
        });
      }, 500);
    }
  }, []);

  return (
    <Tab.Navigator
      detachInactiveScreens
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
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
          overflow: 'hidden',
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
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(192, 192, 192, 0.6)',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
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
            tabBarIcon: ({ color, size }) => (
              <View style={styles.sanctuaryIconContainer}>
                <Home color={color} size={24} />
              </View>
            ),
            ...(isTabBarVisible ? {} : { tabBarStyle: { display: 'none' } }),
          };
        }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background.primary,
            shadowColor: 'transparent',
            elevation: 0,
          },
          headerTintColor: colors.gold,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerTitle: 'Practice',
          headerRight: () => {
            const nav = (navigation as any).getParent();
            return (
              <SettingsButton
                onPress={() => nav?.navigate('Settings')}
              />
            );
          },
          tabBarLabel: 'Practice',
          tabBarIcon: ({ color, size }) => <Zap color={color} size={24} />,
        })}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background.primary,
            shadowColor: 'transparent',
            elevation: 0,
          },
          headerTintColor: colors.gold,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerTitle: 'Discover',
          headerRight: () => {
            const nav = (navigation as any).getParent();
            return (
              <SettingsButton
                onPress={() => nav?.navigate('Settings')}
              />
            );
          },
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={24} />,
        })}
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
    backgroundColor: 'transparent',
  },
  blurView: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
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
});
