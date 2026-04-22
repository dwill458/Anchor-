/**
 * Anchor App - Main Tab Navigator (Premium iOS swipe animation)
 *
 * Uses SwipeableTabContainer so active tab screens stay mounted and
 * visible simultaneously — both the incoming and outgoing screens animate
 * (true parallax: outgoing moves at 28% speed).
 *
 * Navigation context for cross-tab navigation is provided via
 * TabNavigationContext (replaces navigation.getParent() pattern).
 */

import React, { useCallback, useRef } from 'react';
import { AppState, View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useAuthStore } from '@/stores/authStore';
import { safeHaptics } from '@/utils/haptics';
import { useTeachingStore } from '@/stores/teachingStore';
import { useToast } from '@/components/ToastProvider';
import { TEACHINGS } from '@/constants/teaching';

// ─── Tab Button ───────────────────────────────────────────────────────────────

interface TabButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  showDivider?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ onPress, children, showDivider = false }) => {
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
      style={[styles.tabButton, showDivider && styles.tabButtonDivider]}
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

const GOLD = '#D4AF37';
const INACTIVE_COLOR = 'rgba(192,192,192,0.3)';
const TAB_ICON_SIZE = 22;
const TAB_ICON_STROKE_WIDTH = 1.8;

const TABS = [
  {
    label: 'SANCTUARY',
    icon: (active: boolean) => (
      <Home
        color={active ? GOLD : INACTIVE_COLOR}
        size={TAB_ICON_SIZE}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
        fill="none"
        testID="tab-icon-sanctuary"
      />
    ),
  },
  {
    label: 'PRACTICE',
    icon: (active: boolean) => (
      <Zap
        color={active ? GOLD : INACTIVE_COLOR}
        size={TAB_ICON_SIZE}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
        fill="none"
        testID="tab-icon-practice"
      />
    ),
  },
  // DEFERRED: Re-enable Discovery when the tab has a functional destination and bottom-nav space is intentionally expanded back to three items.
  // {
  //   label: 'DISCOVER',
  //   icon: (active: boolean) => (
  //     <Compass
  //       color={active ? GOLD : INACTIVE_COLOR}
  //       size={TAB_ICON_SIZE}
  //       strokeWidth={TAB_ICON_STROKE_WIDTH}
  //       fill="none"
  //       testID="tab-icon-discover"
  //     />
  //   ),
  // },
];

const ACTIVE_TAB_COUNT = TABS.length;

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ activeIndex, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const isCompactTabSet = ACTIVE_TAB_COUNT < 3;

  return (
    <View
      style={[
        styles.bar,
        isCompactTabSet && styles.barCompact,
        { height: 82 + Math.max(insets.bottom, 0) },
      ]}
      testID="custom-tab-bar"
    >
      {TABS.map((tab, index) => {
        const isActive = activeIndex === index;
        return (
          <TabButton
            key={index}
            onPress={() => onTabPress(index)}
            showDivider={index < TABS.length - 1}
          >
            <View style={styles.col}>
              {isActive && (
                <View
                  style={styles.activeIndicator}
                  testID={`tab-indicator-${tab.label.toLowerCase()}`}
                />
              )}
              <View style={styles.iconWrap}>
                {tab.icon(isActive)}
              </View>
              <Text style={[styles.colLabel, isActive && styles.colLabelActive]}>
                {tab.label}
              </Text>
            </View>
          </TabButton>
        );
      })}
    </View>
  );
};

// ─── Main Navigator ───────────────────────────────────────────────────────────

export const MainTabNavigator: React.FC = () => {
  const openDailyAnchorAutomatically = useSettingsStore((state) => state.openDailyAnchorAutomatically);
  const anchorCount = useAnchorStore((state) => state.anchors.length);
  const shouldRedirectToCreation = useAuthStore((state) => state.shouldRedirectToCreation);
  const hasCheckedAutoOpen = useRef(false);
  const toast = useToast();

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [vaultRouteName, setVaultRouteName] = React.useState(
    shouldRedirectToCreation ? 'FirstAnchorCreation' : 'Vault'
  );
  const [practiceRouteName, setPracticeRouteName] = React.useState('PracticeHome');

  React.useEffect(() => {
    if (shouldRedirectToCreation) {
      setActiveIndex(0);
      setVaultRouteName('FirstAnchorCreation');
    }
  }, [shouldRedirectToCreation]);

  const handleIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const isTabBarVisible = React.useMemo(() => {
    if (activeIndex === 0) return vaultRouteName === 'Vault';
    if (activeIndex === 1) return practiceRouteName === 'PracticeHome';
    return false;
  }, [activeIndex, vaultRouteName, practiceRouteName]);

  // Auto-open daily anchor
  React.useEffect(() => {
    if (openDailyAnchorAutomatically && anchorCount > 0 && !hasCheckedAutoOpen.current) {
      hasCheckedAutoOpen.current = true;
      setTimeout(() => {
        setActiveIndex(0);
      }, 500);
    }
  }, [anchorCount, openDailyAnchorAutomatically]);

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
    <TabNavigationProvider onIndexChange={handleIndexChange} activeIndex={activeIndex}>
      <View style={styles.container}>
        <SwipeableTabContainer
          activeIndex={activeIndex}
          onIndexChange={handleIndexChange}
          tabCount={ACTIVE_TAB_COUNT}
          swipeEnabled={isTabBarVisible}
        >
          <VaultStackNavigator onRouteChange={setVaultRouteName} />
          <PracticeStackNavigator onRouteChange={setPracticeRouteName} />
          {/* DEFERRED: Restore DiscoverScreen here if the bottom nav returns to a three-tab layout. */}
          {/* <DiscoverScreen /> */}
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
  // ─── Tab bar (column segment design) ────────────────────────────────────────
  bar: {
    flexDirection: 'row',
    backgroundColor: '#080C10',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.08)',
    alignItems: 'stretch',
    paddingTop: 14,
    paddingBottom: 0,
    height: 82,
  },
  barCompact: {
    justifyContent: 'space-evenly',
    paddingHorizontal: 18,
  },
  tabButton: {
    flex: 1,
    alignItems: 'stretch',
  },
  tabButtonDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -14,
    width: 28,
    height: 2,
    backgroundColor: '#D4AF37',
    borderRadius: 1,
    alignSelf: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  colLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 7.5,
    letterSpacing: 1.35,
    color: 'rgba(255, 255, 255, 0.35)',
    zIndex: 2,
  },
  colLabelActive: {
    color: 'rgba(212, 175, 55, 0.6)',
  },
});
