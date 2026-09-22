import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AnchorMotion, colors } from '@/theme/v2';

/**
 * Anchor 2.0 screen-transition system.
 *
 * Every V2 stack takes its options from here, so a push feels the same from
 * Home, from Anchor Details and from Practice. Transitions stay on the native
 * stack (UI thread, no JS per frame):
 *
 * - iOS `default` is UIKit's own push. It is the only iOS transition whose
 *   edge back-swipe is the system gesture tracking the finger 1:1; every
 *   react-native-screens custom animation (`simple_push`, `fade_from_bottom`)
 *   either loses interactive back or swaps in a re-implemented gesture. The
 *   iOS feel gap is therefore closed by removing work from the push (image
 *   decode, loading-state swaps, background refreshes), not by replacing it.
 * - Android `default` (API 33+) is the platform shared-axis push: a 10% shift
 *   with the incoming screen visible after ~130ms. That is the "small offset,
 *   near-immediate opacity" motion this system wants, and it replaces the
 *   400ms full-width `slide_from_right` the Home/Details stack used to run.
 *
 * Reduce Motion swaps spatial travel for a short cross-dissolve so navigation
 * still acknowledges the tap immediately.
 */

/**
 * Upper bound of a V2 push/pop on either platform (UIKit's push is the
 * longest). Background work a screen triggers on focus waits this long so its
 * results never land on the frames of the transition that revealed it.
 */
export const V2_TRANSITION_SETTLE_MS = 450;

/** Duration of the reduced-motion cross-dissolve (iOS honours it; Android uses its short system fade). */
export const V2_REDUCED_MOTION_TRANSITION_MS = AnchorMotion.duration.quick;

/**
 * Opaque backgrounds per V2 surface. The app's navigation theme is
 * transparent, so without these a pushed screen is see-through until React
 * paints it: the previous screen shows through for a frame, and the GPU
 * blends two full-screen layers for the whole transition.
 */
export const V2_SCREEN_BACKGROUND = {
  cream: colors.canvas,
  paper: colors.surface,
  graphite: colors.ink.base,
} as const;

export function v2StackScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: reduceMotion ? 'fade' : 'default',
    animationDuration: reduceMotion ? V2_REDUCED_MOTION_TRANSITION_MS : undefined,
    animationTypeForReplace: 'push',
    gestureEnabled: true,
    // Edge-only back swipe. A full-width back gesture would compete with the
    // Home carousel, the elastic scroll and horizontal Chart gestures.
    fullScreenGestureEnabled: false,
    contentStyle: { backgroundColor: V2_SCREEN_BACKGROUND.cream },
  };
}

/** Per-route background, matched to what each screen paints as its root. */
export function v2ScreenBackground(background: keyof typeof V2_SCREEN_BACKGROUND): NativeStackNavigationOptions {
  return { contentStyle: { backgroundColor: V2_SCREEN_BACKGROUND[background] } };
}

/** Travel and duration of an in-screen layer change (Practice hub -> prepare -> back). */
export const V2_LAYER_TRAVEL = 12;
export const V2_LAYER_ENTER_MS = 240;
