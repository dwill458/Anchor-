/**
 * useRitualTransition Hook
 *
 * Orchestrates the sacred threshold transition sequence.
 * Transforms ChargeSetupScreen into the Ritual screen through 5 choreographed phases.
 *
 * Phases:
 * 1. CTA Press - Button glow intensifies, text fades (150ms)
 * 2. UI Withdrawal - Depth cards, prompt, UI fade out (350ms)
 * 3. Anchor Takeover - Anchor scales and centers (600ms)
 * 4. Stillness Beat - Hold at center, no motion (300ms)
 * 5. Navigation - Fade and navigate to Ritual (200ms)
 *
 * Total: ~1400ms (intentionally slower than standard navigation)
 */

import { useRef, useCallback } from 'react';
import { Animated, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { TIMING, EASING, type TransitionPhase } from '../utils/transitionConstants';

const { height: screenHeight } = Dimensions.get('window');

interface UseRitualTransitionParams {
  reduceMotionEnabled: boolean;
  onTransitionComplete: () => void;
}

interface UseRitualTransitionReturn {
  // Animation values
  ctaGlow: Animated.Value;
  buttonTextOpacity: Animated.Value;
  uiOpacity: Animated.Value;
  anchorScale: Animated.Value;
  anchorTranslateY: Animated.Value;
  backgroundDarken: Animated.Value;

  // Methods
  beginTransition: (anchorY: number, breathAnimationRef: Animated.CompositeAnimation, shimmerAnimationRef: Animated.CompositeAnimation) => void;
  resetTransition: () => void;

  // State
  isTransitioning: boolean;
}

export const useRitualTransition = ({
  reduceMotionEnabled,
  onTransitionComplete,
}: UseRitualTransitionParams): UseRitualTransitionReturn => {
  // ══════════════════════════════════════════════════════════════
  // ANIMATION VALUES
  // ══════════════════════════════════════════════════════════════

  const ctaGlow = useRef(new Animated.Value(0)).current;
  const buttonTextOpacity = useRef(new Animated.Value(1)).current;
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const anchorScale = useRef(new Animated.Value(1)).current;
  const anchorTranslateY = useRef(new Animated.Value(0)).current;
  const backgroundDarken = useRef(new Animated.Value(0)).current;

  const isTransitioningRef = useRef(false);

  // ══════════════════════════════════════════════════════════════
  // BEGIN TRANSITION
  // ══════════════════════════════════════════════════════════════

  const beginTransition = useCallback(
    (
      anchorY: number,
      breathAnimationRef: Animated.CompositeAnimation,
      shimmerAnimationRef: Animated.CompositeAnimation
    ) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      // Immediate haptic feedback
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

      // If reduce motion enabled, skip animations
      if (reduceMotionEnabled) {
        onTransitionComplete();
        return;
      }

      // Stop breathing and shimmer animations
      breathAnimationRef.stop();
      shimmerAnimationRef.stop();

      // Calculate anchor center position
      const screenCenterY = screenHeight / 2;
      const translateY = screenCenterY - anchorY;

      // ══════════════════════════════════════════════════════════════
      // PHASE 1: CTA PRESS (150ms)
      // ══════════════════════════════════════════════════════════════

      Animated.sequence([
        // Glow intensifies
        Animated.timing(ctaGlow, {
          toValue: 1,
          duration: TIMING.CTA_GLOW_INTENSITY,
          easing: EASING.TRANSITION,
          useNativeDriver: false,
        }),

        // ══════════════════════════════════════════════════════════════
        // PHASE 2: UI WITHDRAWAL (350ms)
        // ══════════════════════════════════════════════════════════════

        Animated.parallel([
          // UI elements fade out
          Animated.timing(uiOpacity, {
            toValue: 0,
            duration: TIMING.UI_WITHDRAWAL,
            easing: EASING.EXIT,
            useNativeDriver: true,
          }),
          // Button text fades out
          Animated.timing(buttonTextOpacity, {
            toValue: 0,
            duration: TIMING.UI_WITHDRAWAL,
            easing: EASING.EXIT,
            useNativeDriver: true,
          }),
          // Background darkens subtly
          Animated.timing(backgroundDarken, {
            toValue: TIMING.BACKGROUND_DARKEN_AMOUNT,
            duration: TIMING.UI_WITHDRAWAL,
            easing: EASING.EXIT,
            useNativeDriver: false,
          }),
        ]),

        // ══════════════════════════════════════════════════════════════
        // PHASE 3: ANCHOR TAKEOVER (600ms)
        // ══════════════════════════════════════════════════════════════

        Animated.parallel([
          // Anchor scales up
          Animated.timing(anchorScale, {
            toValue: TIMING.ANCHOR_TAKEOVER_SCALE,
            duration: TIMING.ANCHOR_TAKEOVER,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          // Anchor moves to screen center
          Animated.timing(anchorTranslateY, {
            toValue: translateY,
            duration: TIMING.ANCHOR_TAKEOVER,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
        ]),

        // ══════════════════════════════════════════════════════════════
        // PHASE 4: STILLNESS BEAT (300ms)
        // ══════════════════════════════════════════════════════════════

        // Hold at center - this is the threshold crossing moment
        Animated.delay(TIMING.STILLNESS_BEAT),

        // ══════════════════════════════════════════════════════════════
        // PHASE 5: NAVIGATION FADE (200ms)
        // ══════════════════════════════════════════════════════════════

        Animated.timing(anchorScale, {
          toValue: 0,
          duration: TIMING.FINAL_FADE,
          easing: EASING.EXIT,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          isTransitioningRef.current = false;
          onTransitionComplete();
        }
      });
    },
    [reduceMotionEnabled, onTransitionComplete]
  );

  // ══════════════════════════════════════════════════════════════
  // RESET TRANSITION
  // ══════════════════════════════════════════════════════════════

  const resetTransition = useCallback(() => {
    isTransitioningRef.current = false;
    ctaGlow.setValue(0);
    buttonTextOpacity.setValue(1);
    uiOpacity.setValue(1);
    anchorScale.setValue(1);
    anchorTranslateY.setValue(0);
    backgroundDarken.setValue(0);
  }, []);

  // ══════════════════════════════════════════════════════════════
  // RETURN
  // ══════════════════════════════════════════════════════════════

  return {
    // Animation values
    ctaGlow,
    buttonTextOpacity,
    uiOpacity,
    anchorScale,
    anchorTranslateY,
    backgroundDarken,

    // Methods
    beginTransition,
    resetTransition,

    // State
    isTransitioning: isTransitioningRef.current,
  };
};
