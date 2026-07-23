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

import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useReducedMotion,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animation constants
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // 25% of screen to trigger swipe
const VELOCITY_THRESHOLD = 500; // px/s

// Crossfade timing for tab button presses (200ms ease-out per spec)
const CROSSFADE_TIMING_CONFIG = {
  duration: 200,
  easing: Easing.out(Easing.ease),
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
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([activeIndex]));

  // Animated position: 0 = first tab, 1 = second tab, etc.
  const position = useSharedValue(activeIndex);
  const gestureActive = useSharedValue(false);

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeIndex)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  // Sync position whenever the selected tab changes. `gestureActive.value` is
  // owned by the UI thread. A tab-button press must cancel any in-flight pan
  // before starting the crossfade; otherwise the old pan worklet can continue
  // writing the old page position after React has selected the new tab.
  useEffect(() => {
    gestureActive.value = false;
    cancelAnimation(position);

    if (reducedMotion) {
      position.value = activeIndex;
    } else {
      position.value = withTiming(activeIndex, CROSSFADE_TIMING_CONFIG);
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
    .activeOffsetX([-25, 25]) // Activate after 25px horizontal movement (avoids stealing from inner ScrollViews)
    .failOffsetY([-15, 15]) // Fail if vertical movement exceeds 15px
    .onStart(() => {
      gestureActive.value = true;
    })
    .onUpdate((event) => {
      if (!gestureActive.value) {
        return;
      }

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
      // The selected tab may have changed from a tab-button press while this
      // pan was settling. In that case the tab-button transition owns the
      // position and this stale gesture must not write it back.
      if (!gestureActive.value) {
        return;
      }

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

      // Animate to target with crossfade timing
      position.value = withTiming(targetIndex, CROSSFADE_TIMING_CONFIG);

      if (targetIndex !== activeIndex) {
        runOnJS(handleIndexChange)(targetIndex);
      }
    })
    .onFinalize(() => {
      gestureActive.value = false;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.container}>
        {React.Children.map(children, (child, index) => (
          <TabPage
            key={index}
            index={index}
            isActive={index === activeIndex}
            position={position}
            reducedMotion={reducedMotion ?? false}
          >
            {mountedTabs.has(index) || index === activeIndex ? child : null}
          </TabPage>
        ))}
      </Animated.View>
    </GestureDetector>
  );
};

interface TabPageProps {
  children: React.ReactNode;
  index: number;
  isActive: boolean;
  position: SharedValue<number>;
  reducedMotion: boolean;
}

const TabPage: React.FC<TabPageProps> = ({
  children,
  index,
  isActive,
  position,
  reducedMotion,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      const isActive = Math.round(position.value) === index;
      return {
        opacity: isActive ? 1 : 0,
      };
    }

    // Pure crossfade — no translation, tabs are spatial siblings
    const absOffset = Math.abs(index - position.value);

    const opacity = interpolate(
      absOffset,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  return (
    <Animated.View
      testID={`tab-page-${index}`}
      style={[styles.page, animatedStyle]}
      pointerEvents={isActive ? 'auto' : 'none'}
    >
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
