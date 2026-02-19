/**
 * TabSlideWrapper
 *
 * Wraps tab screen content to provide iOS-like slide transitions.
 * Uses shared animated state so both outgoing and incoming tabs
 * animate simultaneously with parallax effect.
 *
 * Motion spec:
 * - Spring physics for natural iOS feel
 * - Parallax: outgoing screen moves at 30% speed
 * - No opacity fade during transition
 */

import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useDerivedValue,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { tabPosition, tabDirection, visualTabIndex } from './tabTransitionState';
import { colors } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IOS_PARALLAX_FACTOR = 0.28;

interface TabSlideWrapperProps {
  children: React.ReactNode;
  /** The index of this tab (0 = Sanctuary, 1 = Practice) */
  tabIndex: number;
}

export const TabSlideWrapper: React.FC<TabSlideWrapperProps> = ({
  children,
  tabIndex,
}) => {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();

  // On mount: set the initial position for this tab so the animated style
  // starts at the correct translateX without requiring a tabPress.
  // Animation is now driven exclusively by tabPress listeners in MainTabNavigator
  // via animateToTabWithCallback — not by useEffect — so that both outgoing and
  // incoming screens remain visible (display:flex) during the full transition.
  useEffect(() => {
    if (isFocused) {
      tabPosition.value = tabIndex;
      visualTabIndex.value = tabIndex;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived value for this tab's offset from current position
  const offset = useDerivedValue(() => {
    return tabIndex - tabPosition.value;
  });

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      // Accessibility: instant switch
      const isActive = Math.round(tabPosition.value) === tabIndex;
      return {
        transform: [{ translateX: isActive ? 0 : SCREEN_WIDTH }],
        zIndex: isActive ? 1 : 0,
      };
    }

    const currentOffset = offset.value;
    const absOffset = Math.abs(currentOffset);
    const direction = tabDirection.value;
    const offsetSign = currentOffset === 0 ? 0 : currentOffset > 0 ? 1 : -1;
    const isIncoming = direction !== 0 && offsetSign === direction;

    const translateX = isIncoming
      ? currentOffset * SCREEN_WIDTH
      : currentOffset * SCREEN_WIDTH * IOS_PARALLAX_FACTOR;

    const isActive = absOffset < 0.001;
    const zIndex = isActive ? 3 : isIncoming ? 2 : 1;
    return {
      transform: [{ translateX }],
      zIndex,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.primary,
  },
});

// Re-export transition utilities for external use
export { animateToTab, animateToTabWithCallback, tabPosition, visualTabIndex } from './tabTransitionState';
