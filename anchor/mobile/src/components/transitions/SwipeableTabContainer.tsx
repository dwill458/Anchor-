/**
 * SwipeableTabContainer
 *
 * iOS-like swipeable container for Sanctuary ↔ Practice tabs.
 * Both screens animate simultaneously with parallax effect.
 *
 * Features:
 * - Horizontal swipe gesture support
 * - Spring physics for natural feel
 * - Parallax: outgoing screen moves at 30% speed
 * - Works with bottom tab navigation
 */

import React, { useCallback, useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  useReducedMotion,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animation constants
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // 25% of screen to trigger swipe
const VELOCITY_THRESHOLD = 500; // px/s

// Spring config for snappier, non-overlapping feel
const SPRING_CONFIG = {
  damping: 30, // Higher damping prevents wobble
  stiffness: 450, // Higher stiffness makes it faster
  mass: 0.5,
  overshootClamping: true, // Prevents bouncing past the edge
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

interface SwipeableTabContainerProps {
  children: React.ReactNode;
  /** Current tab index (0 = Sanctuary, 1 = Practice) */
  activeIndex: number;
  /** Called when swipe completes to change tab */
  onIndexChange: (index: number) => void;
  /** Total number of swipeable tabs */
  tabCount?: number;
  /** Whether swiping between tabs is enabled */
  swipeEnabled?: boolean;
}

export const SwipeableTabContainer: React.FC<SwipeableTabContainerProps> = ({
  children,
  activeIndex,
  onIndexChange,
  tabCount = 2,
  swipeEnabled = true,
}) => {
  const reducedMotion = useReducedMotion();

  // Animated position: 0 = first tab, 1 = second tab, etc.
  const position = useSharedValue(activeIndex);
  const gestureActive = useSharedValue(false);

  // Sync position when activeIndex changes externally (tab button press)
  useEffect(() => {
    if (!gestureActive.value) {
      if (reducedMotion) {
        position.value = activeIndex;
      } else {
        position.value = withSpring(activeIndex, SPRING_CONFIG);
      }
    }
  }, [activeIndex, reducedMotion]);

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      onIndexChange(newIndex);
    },
    [onIndexChange]
  );

  const panGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-10, 10]) // Activate after 10px horizontal movement
    .failOffsetY([-20, 20]) // Fail if vertical movement exceeds 20px
    .onStart(() => {
      gestureActive.value = true;
    })
    .onUpdate((event) => {
      // Convert translation to position offset
      const offset = -event.translationX / SCREEN_WIDTH;
      const newPosition = activeIndex + offset;

      // Clamp with rubber band effect at edges
      if (newPosition < 0) {
        position.value = newPosition * 0.3; // Rubber band
      } else if (newPosition > tabCount - 1) {
        position.value = tabCount - 1 + (newPosition - (tabCount - 1)) * 0.3;
      } else {
        position.value = newPosition;
      }
    })
    .onEnd((event) => {
      gestureActive.value = false;

      const velocity = -event.velocityX;
      const translation = -event.translationX;

      let targetIndex = activeIndex;

      // Determine if swipe should complete
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        // Velocity-based: fast swipe
        if (velocity > 0 && activeIndex < tabCount - 1) {
          targetIndex = activeIndex + 1;
        } else if (velocity < 0 && activeIndex > 0) {
          targetIndex = activeIndex - 1;
        }
      } else if (Math.abs(translation) > SWIPE_THRESHOLD) {
        // Distance-based: slow drag past threshold
        if (translation > 0 && activeIndex < tabCount - 1) {
          targetIndex = activeIndex + 1;
        } else if (translation < 0 && activeIndex > 0) {
          targetIndex = activeIndex - 1;
        }
      }

      // Animate to target
      position.value = withSpring(targetIndex, SPRING_CONFIG);

      if (targetIndex !== activeIndex) {
        runOnJS(handleIndexChange)(targetIndex);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.container}>
        {React.Children.map(children, (child, index) => (
          <TabPage
            key={index}
            index={index}
            position={position}
            reducedMotion={reducedMotion ?? false}
          >
            {child}
          </TabPage>
        ))}
      </Animated.View>
    </GestureDetector>
  );
};

interface TabPageProps {
  children: React.ReactNode;
  index: number;
  position: Animated.SharedValue<number>;
  reducedMotion: boolean;
}

const TabPage: React.FC<TabPageProps> = ({
  children,
  index,
  position,
  reducedMotion,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      // Instant switch for accessibility
      const isActive = Math.round(position.value) === index;
      return {
        transform: [{ translateX: isActive ? 0 : SCREEN_WIDTH }],
        opacity: isActive ? 1 : 0,
      };
    }

    // Calculate offset from current position
    const offset = index - position.value;
    const translateX = offset * SCREEN_WIDTH;

    return {
      transform: [{ translateX }],
      opacity: 1,
    };
  });

  return (
    <Animated.View style={[styles.page, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
});
