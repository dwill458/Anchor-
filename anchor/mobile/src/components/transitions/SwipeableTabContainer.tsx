/**
 * SwipeableTabContainer
 *
 * iOS-like swipeable container for Sanctuary ↔ Practice tabs.
 *
 * The inactive tab is only kept mounted while a swipe gesture is actively
 * dragging (needed so both screens are visible for the live drag preview).
 * Outside of an active swipe — including every tab-button press — only the
 * active tab is mounted. A real mount always forces Android to do a full
 * fresh layout + draw of a brand-new native view, which sidesteps a
 * device/OS-level rendering bug where an existing view's opacity-only
 * update can silently fail to get recomposited until the next unrelated
 * touch event (confirmed via `adb shell dumpsys gfxinfo`: zero new frames
 * were produced during the stuck period). Swiping itself never showed the
 * bug, since the live touch keeps the compositor continuously producing
 * frames for the whole gesture.
 *
 * Features:
 * - Horizontal swipe gesture support with a live drag preview
 * - Spring/timing-based settle animation while swiping
 * - Instant, animation-free mount swap for tab-button presses
 */

import React, { useCallback, useState } from 'react';
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

// Crossfade/settle timing while a swipe is in progress
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
  // Only kept true while a swipe is actively dragging or settling — see
  // file header. Outside of that window, only the active tab is mounted.
  const [isSwiping, setIsSwiping] = useState(false);

  // Animated position: 0 = first tab, 1 = second tab, etc.
  const position = useSharedValue(activeIndex);
  const gestureActive = useSharedValue(false);

  // Tracks the index our own gesture last asked the parent to switch to, so
  // the effect below can tell "this activeIndex change is our own completed
  // swipe settling in" (leave its animation/mount-drop alone) apart from
  // "this came from somewhere else" (a tab-button press, or invalidating an
  // abandoned gesture — snap and drop the extra mount immediately).
  const lastRequestedIndexRef = React.useRef<number | null>(null);

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      lastRequestedIndexRef.current = newIndex;
      onIndexChange(newIndex);
    },
    [onIndexChange]
  );

  const endSwiping = useCallback(() => {
    setIsSwiping(false);
  }, []);

  React.useEffect(() => {
    // Any activeIndex change invalidates an in-flight/stale gesture
    // immediately — otherwise a late onUpdate/onEnd from an abandoned swipe
    // could still clobber position or fire a duplicate onIndexChange.
    gestureActive.value = false;

    if (lastRequestedIndexRef.current === activeIndex) {
      // Our own gesture's onEnd already started the settle animation and
      // owns clearing `isSwiping` once it finishes — don't interfere.
      lastRequestedIndexRef.current = null;
      return;
    }

    // External change (tab-button press, or invalidating a stale gesture):
    // no second tab is mounted to crossfade against here, so place the
    // active page directly. The repaint is guaranteed by the fresh mount
    // this triggers, not by this assignment.
    setIsSwiping(false);
    position.value = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, reducedMotion]);

  const panGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-25, 25]) // Activate after 25px horizontal movement (avoids stealing from inner ScrollViews)
    .failOffsetY([-15, 15]) // Fail if vertical movement exceeds 15px
    .onStart(() => {
      gestureActive.value = true;
      runOnJS(setIsSwiping)(true);
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

      // Animate to target, then drop the now-inactive tab's mount once the
      // settle animation has actually finished painting.
      position.value = withTiming(targetIndex, CROSSFADE_TIMING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(endSwiping)();
        }
      });

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
        {React.Children.map(children, (child, index) => {
          const shouldMount = isSwiping || index === activeIndex;
          return (
            <TabPage
              key={index}
              index={index}
              isActive={index === activeIndex}
              position={position}
              reducedMotion={reducedMotion ?? false}
            >
              {shouldMount ? child : null}
            </TabPage>
          );
        })}
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
      style={[styles.page, { zIndex: isActive ? 1 : 0, elevation: isActive ? 1 : 0 }, animatedStyle]}
      pointerEvents={isActive ? 'auto' : 'none'}
      collapsable={false}
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
