/**
 * Anchor App - Main Tab Navigator (Premium iOS swipe animation)
 *
 * Uses SwipeableTabContainer so all three tab screens stay mounted and
 * visible simultaneously — both the incoming and outgoing screens animate
 * (true parallax: outgoing moves at 28% speed).
 *
 * Navigation context for cross-tab navigation is provided via
 * TabNavigationContext (replaces navigation.getParent() pattern).
 */

import React, { useCallback, useRef } from 'react';
import { AppState, View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Home, Compass, Zap } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { VaultStackNavigator } from './VaultStackNavigator';
import { PracticeStackNavigator } from './PracticeStackNavigator';
import { DiscoverScreen } from '../screens/discover';
import { SwipeableTabContainer } from '../components/transitions/SwipeableTabContainer';
import { TabNavigationProvider } from '../contexts/TabNavigationContext';
import { colors } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { safeHaptics } from '@/utils/haptics';
import { useTeachingStore } from '@/stores/teachingStore';
import { useToast } from '@/components/ToastProvider';
import { TEACHINGS } from '@/constants/teaching';

// ─── Tab Button ───────────────────────────────────────────────────────────────

interface TabButtonProps {
  onPress: () => void;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ onPress, children }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.92, { duration: 100 });
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 220 });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      accessibilityRole="button"
      style={styles.tabButton}
    >
      <Animated.View style={[animatedStyle, styles.tabContent]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

interface CustomTabBarProps {
  activeIndex: number;
  onTabPress: (index: number) => void;
}

const CustomTabBar: React.FC<CustomTabBarProps> = ({ activeIndex, onTabPress }) => {
  const tabs = [
    {
      label: 'Sanctuary',
      icon: (active: boolean) => (
        <View style={[styles.iconContainer, active && styles.iconFocusedBg]}>
          <Home
            color={active ? colors.gold : 'rgba(192,192,192,0.6)'}
            size={22}
            fill="none"
            strokeWidth={active ? 2.2 : 1.8}
          />
        </View>
      ),
    },
    {
      label: 'Practice',
      icon: (active: boolean) => (
        <Zap
          color={active ? colors.gold : 'rgba(192,192,192,0.6)'}
          size={24}
          fill={active ? colors.gold : 'none'}
        />
      ),
    },
    {
      label: 'Discover',
      icon: (active: boolean) => (
        <View style={[styles.iconContainer, active && styles.iconFocusedBg]}>
          <Compass
            color={active ? colors.gold : 'rgba(192,192,192,0.6)'}
            size={22}
            fill="none"
            strokeWidth={active ? 2.2 : 1.8}
          />
        </View>
      ),
    },
  ];

  return (
    <View style={styles.tabBarWrapper}>
      {/* Glassmorphic background */}
      <View style={[styles.tabBarBg, styles.tabBarBorder]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 80}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        >
          <LinearGradient
            colors={['rgba(62,44,91,0.85)', 'rgba(26,26,29,0.75)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </BlurView>
      </View>

      {/* Tab buttons */}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <TabButton key={index} onPress={() => onTabPress(index)}>
            {tab.icon(activeIndex === index)}
            <Text
              style={[
                styles.tabLabel,
                activeIndex === index && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TabButton>
        ))}
      </View>
    </View>
  );
};

// ─── Main Navigator ───────────────────────────────────────────────────────────

export const MainTabNavigator: React.FC = () => {
  const { openDailyAnchorAutomatically } = useSettingsStore();
  const { anchors } = useAnchorStore();
  const hasCheckedAutoOpen = useRef(false);
  const toast = useToast();

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [vaultRouteName, setVaultRouteName] = React.useState('Vault');
  const [practiceRouteName, setPracticeRouteName] = React.useState('PracticeHome');

  const handleIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const isTabBarVisible = React.useMemo(() => {
    if (activeIndex === 0) return vaultRouteName === 'Vault';
    if (activeIndex === 1) return practiceRouteName === 'PracticeHome';
    return true; // Discover
  }, [activeIndex, vaultRouteName, practiceRouteName]);

  // Auto-open daily anchor
  React.useEffect(() => {
    if (openDailyAnchorAutomatically && anchors.length > 0 && !hasCheckedAutoOpen.current) {
      hasCheckedAutoOpen.current = true;
      setTimeout(() => {
        setActiveIndex(0);
      }, 500);
    }
  }, []);

  // Milestone queue drain — one milestone toast per 10s on app foreground
  React.useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const drain = () => {
      const milestoneId = useTeachingStore.getState().dequeueMilestone();
      if (!milestoneId) return;
      const content = TEACHINGS[milestoneId];
      if (content) toast.success(content.copy);
      timerId = setTimeout(drain, 10000);
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (timerId) clearTimeout(timerId);
        drain();
      } else {
        if (timerId) clearTimeout(timerId);
      }
    });

    return () => {
      subscription.remove();
      if (timerId) clearTimeout(timerId);
    };
  }, [toast]);

  return (
    <TabNavigationProvider onIndexChange={handleIndexChange}>
      <View style={styles.container}>
        <SwipeableTabContainer
          activeIndex={activeIndex}
          onIndexChange={handleIndexChange}
          tabCount={3}
        >
          <VaultStackNavigator onRouteChange={setVaultRouteName} />
          <PracticeStackNavigator onRouteChange={setPracticeRouteName} />
          <DiscoverScreen />
        </SwipeableTabContainer>

        {isTabBarVisible && (
          <CustomTabBar activeIndex={activeIndex} onTabPress={handleIndexChange} />
        )}
      </View>
    </TabNavigationProvider>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Tab bar
  tabBarWrapper: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabBarBorder: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    gap: 3,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconFocusedBg: {
    backgroundColor: 'rgba(212,175,55,0.18)',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    color: 'rgba(192,192,192,0.6)',
  },
  tabLabelActive: {
    color: colors.gold,
    fontWeight: '600',
  },
});
