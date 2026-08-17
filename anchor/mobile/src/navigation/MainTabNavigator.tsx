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

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  AppState,
  BackHandler,
  Dimensions,
  Platform,
  View,
  Text,
  StyleSheet,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Zap, Compass } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { VaultStackNavigator } from './VaultStackNavigator';
import { PracticeStackNavigator } from './PracticeStackNavigator';
import { ChartStackNavigator } from './ChartStackNavigator';
import { SwipeableTabContainer } from '../components/transitions/SwipeableTabContainer';
import { TabNavigationProvider } from '../contexts/TabNavigationContext';
import { colors, typography } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { safeHaptics } from '@/utils/haptics';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import VisualizationSceneService from '@/services/VisualizationSceneService';
import { WidgetDeepLinkHandler } from '@/widgets/WidgetDeepLinkHandler';
import { ResumeTargetHandler } from './ResumeTargetHandler';
import { WIDGETS_ENABLED } from '@/config';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import type { RootStackParamList } from '@/types';
import type { RootNavigatorParamList } from './RootNavigator';

// ─── Floating Glass Capsule Tab Bar ──────────────────────────────────────────

export const ACTIVE_COLOR = '#E8E8E8';
export const INACTIVE_COLOR = 'rgba(192, 192, 192, 0.45)';
export const TAB_ICON_SIZE = 22;
export const TAB_ICON_STROKE_WIDTH = 1.5;

export const TABS = [
  {
    index: 0,
    label: 'SANCTUARY',
    icon: (active: boolean) => (
      <Home
        color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
        size={TAB_ICON_SIZE}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
        fill="none"
        testID="tab-icon-sanctuary"
      />
    ),
  },
  {
    index: 1,
    label: 'PRACTICE',
    icon: (active: boolean) => (
      <Zap
        color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
        size={TAB_ICON_SIZE}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
        fill="none"
        testID="tab-icon-practice"
      />
    ),
  },
  {
    index: 2,
    label: 'CHART',
    icon: (active: boolean) => (
      <Compass
        color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
        size={TAB_ICON_SIZE}
        strokeWidth={TAB_ICON_STROKE_WIDTH}
        fill="none"
        testID="tab-icon-chart"
      />
    ),
  },
];

export interface CustomTabBarProps {
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({
  activeIndex,
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const initialWidth = Math.max(0, Dimensions.get('window').width - 40);
  const [barWidth, setBarWidth] = useState(initialWidth);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialTabWidth = initialWidth > 0 ? initialWidth / TABS.length : 0;
  const pillX = useSharedValue(initialTabWidth > 0 ? activeIndex * initialTabWidth + 6 : 0);
  const pillWidth = useSharedValue(initialTabWidth > 0 ? initialTabWidth - 12 : 0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== barWidth) {
      setBarWidth(width);
      const tabWidth = width / TABS.length;
      pillWidth.value = tabWidth - 12;
      pillX.value = activeIndex * tabWidth + 6;
    }
  };

  useEffect(() => {
    if (barWidth > 0) {
      const tabWidth = barWidth / TABS.length;
      const targetX = activeIndex * tabWidth + 6;
      pillWidth.value = tabWidth - 12;
      if (reduceMotionEnabled) {
        pillX.value = targetX;
      } else {
        pillX.value = withSpring(targetX, {
          damping: 18,
          stiffness: 150,
          mass: 0.8,
        });
      }
    }
  }, [activeIndex, barWidth, reduceMotionEnabled, pillX, pillWidth]);

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
  }));

  const handleTabPress = (tabIndex: number) => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (barWidth > 0) {
      const tabWidth = barWidth / TABS.length;
      const targetX = tabIndex * tabWidth + 6;
      if (reduceMotionEnabled) {
        pillX.value = targetX;
      } else {
        pillX.value = withSpring(targetX, {
          damping: 18,
          stiffness: 150,
          mass: 0.8,
        });
      }
    }

    const delay = reduceMotionEnabled ? 0 : 460;
    if (delay > 0) {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        onTabPress(tabIndex);
      }, delay);
    } else {
      onTabPress(tabIndex);
    }
  };

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View
      style={[
        styles.bottomNavContainer,
        { bottom: Math.max(46, insets.bottom + 12) },
      ]}
      onLayout={handleLayout}
      testID="custom-tab-bar"
    >
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.09)', 'rgba(255, 255, 255, 0.02)', 'rgba(0, 0, 0, 0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.capsuleBorder} pointerEvents="none" />

      {/* Animated Sliding Silver Pill */}
      {barWidth > 0 && (
        <Animated.View
          style={[styles.pillContainer, animatedPillStyle]}
          pointerEvents="none"
          testID={`tab-indicator-${TABS[activeIndex]?.label.toLowerCase()}`}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0.05)', 'rgba(192, 192, 192, 0.14)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.pillBorder} />
        </Animated.View>
      )}

      {/* Tab Buttons */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeIndex === tab.index;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
          return (
            <Pressable
              key={tab.index}
              onPress={() => handleTabPress(tab.index)}
              accessibilityRole="button"
              accessibilityLabel={tab.label === 'CHART' ? 'Chart' : tab.label[0] + tab.label.slice(1).toLowerCase()}
              accessibilityHint={tab.label === 'CHART' ? 'Where am I going?' : `Open ${tab.label.toLowerCase()}`}
              accessibilityState={{ selected: isActive }}
              style={styles.tabButton}
            >
              <View style={[styles.tabContent, isActive && styles.tabContentActive]}>
                <View style={styles.iconWrap}>{tab.icon(isActive)}</View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ─── Main Navigator ───────────────────────────────────────────────────────────

export const MainTabNavigator: React.FC = () => {
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootNavigatorParamList>>();
  const openDailyAnchorAutomatically = useSettingsStore(
    (state) => state.openDailyAnchorAutomatically,
  );
  const anchorCount = useAnchorStore((state) => state.anchors.length);
  const shouldRedirectToCreation = useAuthStore(
    (state) => state.shouldRedirectToCreation,
  );
  const hasCheckedAutoOpen = useRef(false);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [vaultRouteName, setVaultRouteName] = React.useState(
    shouldRedirectToCreation ? 'FirstAnchorCreation' : 'Vault',
  );
  const [practiceRouteName, setPracticeRouteName] =
    React.useState('PracticeHome');
  const [practiceRouteParams, setPracticeRouteParams] = React.useState<unknown>(undefined);
  const [chartRouteName, setChartRouteName] = React.useState('ChartHome');

  const flushPracticeWrites = useCallback(() => {
    const accountId = useAuthStore.getState().user?.id;
    if (!accountId) return;
    void PracticeCompletionService.flush(accountId);
    void VisualizationSceneService.flushPending(
      useAnchorStore.getState().anchors,
      accountId,
    );
  }, []);

  React.useEffect(() => {
    flushPracticeWrites();
  }, [flushPracticeWrites]);

  React.useEffect(() => {
    if (shouldRedirectToCreation) {
      setActiveIndex(0);
      setVaultRouteName('FirstAnchorCreation');
    }
  }, [shouldRedirectToCreation]);

  const handleIndexChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  // Practice owns an independent navigation container, so its local navigation
  // object cannot resolve RootNavigator's Paywall route. Keep that boundary in
  // the tab host and expose only this typed intent to child tabs.
  const handlePaywallNavigation = useCallback(
    (params?: RootStackParamList['Paywall']) => {
      rootNavigation.navigate('Paywall', params);
    },
    [rootNavigation],
  );

  const isTabBarVisible = React.useMemo(() => {
    if (activeIndex === 0) return vaultRouteName === 'Vault';
    if (activeIndex === 1) {
      // The reference keeps primary chrome on a Practice-origin Weave, but an
      // Anchor Detail-origin Weave behaves like a focused detail surface.
      const weaveOrigin = (practiceRouteParams as { origin?: unknown } | undefined)?.origin;
      return practiceRouteName === 'PracticeHome' ||
        (practiceRouteName === 'TheWeave' && weaveOrigin === 'practice');
    }
    return chartRouteName === 'ChartHome';
  }, [activeIndex, vaultRouteName, practiceRouteName, practiceRouteParams, chartRouteName]);

  // Auto-open daily anchor
  React.useEffect(() => {
    if (
      openDailyAnchorAutomatically &&
      anchorCount > 0 &&
      !hasCheckedAutoOpen.current
    ) {
      hasCheckedAutoOpen.current = true;
      autoOpenTimerRef.current = setTimeout(() => {
        setActiveIndex(0);
      }, 500);
    }

    return () => {
      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
        autoOpenTimerRef.current = null;
      }
    };
  }, [anchorCount, openDailyAnchorAutomatically]);

  // Flush practice writes on app foreground
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        flushPracticeWrites();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [flushPracticeWrites]);

  const handleVaultRouteChange = useCallback((name: string) => {
    setVaultRouteName(name);
  }, []);

  const handlePracticeRouteChange = useCallback((name: string, params?: unknown) => {
    setPracticeRouteName(name);
    setPracticeRouteParams(params);
  }, []);

  const handleChartRouteChange = useCallback((name: string) => {
    setChartRouteName(name);
  }, []);

  // Handle Android universal back button for top-level tab switching
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const onBackPress = () => {
      // If user is on a secondary tab at its root screen, navigate back to Sanctuary (Tab 0)
      if (activeIndex === 1 && practiceRouteName === 'PracticeHome') {
        handleIndexChange(0);
        return true;
      }
      if (activeIndex === 2 && chartRouteName === 'ChartHome') {
        handleIndexChange(0);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeIndex, chartRouteName, handleIndexChange, practiceRouteName]);

  return (
    <TabNavigationProvider
      onIndexChange={handleIndexChange}
      onNavigateToPaywall={handlePaywallNavigation}
      activeIndex={activeIndex}
    >
      {/* Routes the home screen widget CTA (anchor://practice) to the Practice tab */}
      {WIDGETS_ENABLED && <WidgetDeepLinkHandler />}
      <ResumeTargetHandler />
      <View style={styles.container}>
        <SwipeableTabContainer
          activeIndex={activeIndex}
          onIndexChange={handleIndexChange}
          tabCount={3}
          swipeEnabled={isTabBarVisible}
        >
          <VaultStackNavigator onRouteChange={handleVaultRouteChange} />
          <PracticeStackNavigator onRouteChange={handlePracticeRouteChange} />
          <ChartStackNavigator onRouteChange={handleChartRouteChange} />
        </SwipeableTabContainer>

        {isTabBarVisible && (
          <CustomTabBar
            activeIndex={activeIndex}
            onTabPress={handleIndexChange}
          />
        )}
      </View>
    </TabNavigationProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    zIndex: 50,
    backgroundColor: 'rgba(16, 21, 27, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 8,
  },
  capsuleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillContainer: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#C0C0C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  tabButton: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  tabContentActive: {
    transform: [{ translateY: -1 }, { scale: 1.05 }],
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: typography.fontFamily.ritual || 'Cinzel-Regular',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.08, // 0.12em
    textTransform: 'uppercase',
  },
});
