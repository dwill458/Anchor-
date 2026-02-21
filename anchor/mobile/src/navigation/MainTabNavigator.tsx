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

const INACTIVE_TAB_COLOR = 'rgba(180, 165, 135, 0.5)';

const CustomTabBar: React.FC<CustomTabBarProps> = ({ activeIndex, onTabPress }) => {
  const tabs = [
    {
      label: 'Sanctuary',
      icon: (active: boolean) => (
        <Home
          color={active ? colors.sanctuary.gold : INACTIVE_TAB_COLOR}
          size={22}
          fill="none"
          strokeWidth={active ? 2.2 : 1.8}
        />
      ),
    },
    {
      label: 'Practice',
      icon: (active: boolean) => (
        <Zap
          color={active ? colors.sanctuary.gold : INACTIVE_TAB_COLOR}
          size={24}
          fill={active ? colors.sanctuary.gold : 'none'}
        />
      ),
    },
    {
      label: 'Discover',
      icon: (active: boolean) => (
        <Compass
          color={active ? colors.sanctuary.gold : INACTIVE_TAB_COLOR}
          size={22}
          fill="none"
          strokeWidth={active ? 2.2 : 1.8}
        />
      ),
    },
  ];

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarBg}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 90}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <TabButton key={index} onPress={() => onTabPress(index)}>
            <View style={[styles.navItem, activeIndex === index && styles.navItemActive]}>
              <View style={[styles.iconContainer, activeIndex === index && styles.iconContainerActive]}>
                {tab.icon(activeIndex === index)}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeIndex === index && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </View>
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
          swipeEnabled={isTabBarVisible}
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2B1640',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(40, 20, 60, 0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
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
    justifyContent: 'center',
  },
  tabContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 24,
    gap: 4,
  },
  navItemActive: {
    backgroundColor: 'rgba(201,168,76,0.07)',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconContainerActive: {
    ...Platform.select({
      ios: {
        shadowColor: colors.sanctuary.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  tabLabel: {
    fontSize: 8,
    fontFamily: 'Cinzel-Regular',
    color: INACTIVE_TAB_COLOR,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: colors.sanctuary.gold,
  },
});
