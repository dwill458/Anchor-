/**
 * Shared Tab Transition State
 *
 * Allows multiple TabSlideWrapper instances to coordinate animations.
 * When a tab transition occurs, both outgoing and incoming tabs animate simultaneously.
 */

import { Easing, makeMutable, runOnJS, withTiming } from 'react-native-reanimated';

export const TAB_TIMING_CONFIG = {
  duration: 320,
  easing: Easing.bezier(0.32, 0.72, 0, 1),
};

// Shared animated values accessible from any component
// Position represents which tab is active (0 = Sanctuary, 1 = Practice)
export const tabPosition = makeMutable(0);
// Transition direction: 1 = rightward (0 -> 1), -1 = leftward (1 -> 0)
export const tabDirection = makeMutable(0);

// Track if a gesture is in progress
export const isGestureActive = makeMutable(false);

// Visual tab index: updates immediately on press so tab bar icons respond
// before React Navigation completes the navigation (which takes 320ms)
export const visualTabIndex = makeMutable(0);

// Trigger a tab transition with spring animation
export const animateToTab = (targetIndex: number, immediate = false) => {
  const direction = targetIndex > tabPosition.value ? 1 : targetIndex < tabPosition.value ? -1 : 0;
  tabDirection.value = direction;

  if (immediate) {
    tabPosition.value = targetIndex;
  } else {
    tabPosition.value = withTiming(targetIndex, TAB_TIMING_CONFIG);
  }
};

// Update position during gesture (no spring, direct value)
export const setTabPositionDirect = (value: number) => {
  tabPosition.value = value;
};

// Get current tab position
export const getTabPosition = () => tabPosition.value;

/**
 * Animate to a tab and invoke a JS callback once the animation finishes.
 * Used by tabPress listeners with e.preventDefault() so both screens
 * remain visible during the transition — fixing the "only one side animates"
 * bug caused by @react-navigation/bottom-tabs applying display:none before
 * Reanimated can run the outgoing screen's animation.
 */
export const animateToTabWithCallback = (
  targetIndex: number,
  onComplete: () => void,
) => {
  const direction =
    targetIndex > tabPosition.value ? 1 : targetIndex < tabPosition.value ? -1 : 0;
  tabDirection.value = direction;
  visualTabIndex.value = targetIndex;
  tabPosition.value = withTiming(targetIndex, TAB_TIMING_CONFIG, (finished) => {
    'worklet';
    if (finished) runOnJS(onComplete)();
  });
};
