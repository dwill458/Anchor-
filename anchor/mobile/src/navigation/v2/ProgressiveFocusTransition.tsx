import React, { createContext, useContext, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnchorMotion, colors } from '@/theme/v2';

type FocusTransitionContextValue = {
  progress: SharedValue<number>;
  begin: () => void;
  reverse: () => void;
  reduceMotion: boolean;
  active: boolean;
};

const FocusTransitionContext = createContext<FocusTransitionContextValue | null>(null);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * Owns the UI-thread progress shared by the Home source and Details destination.
 * The native stack still owns pushes, gestures and interruption handling.
 */
export function ProgressiveFocusTransitionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReduceMotionEnabled();
  const progress = useSharedValue(1);
  const [active, setActive] = useState(false);
  const value = useMemo<FocusTransitionContextValue>(() => ({
    progress,
    reduceMotion,
    active,
    begin: () => {
      cancelAnimation(progress);
      setActive(true);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reduceMotion ? AnchorMotion.duration.quick : 560,
        easing: AnchorMotion.easing.emphasized,
      }, (finished) => { if (finished) runOnJS(setActive)(false); });
    },
    reverse: () => {
      cancelAnimation(progress);
      setActive(true);
      progress.value = withTiming(0, {
        duration: reduceMotion ? AnchorMotion.duration.quick : 420,
        easing: AnchorMotion.easing.enter,
      }, (finished) => { if (finished) runOnJS(setActive)(false); });
    },
  }), [active, progress, reduceMotion]);

  return <FocusTransitionContext.Provider value={value}>{children}</FocusTransitionContext.Provider>;
}

export function useProgressiveFocusTransition(): FocusTransitionContextValue {
  const value = useContext(FocusTransitionContext);
  if (!value) {
    throw new Error('ProgressiveFocusTransitionProvider is required for this screen.');
  }
  return value;
}

/**
 * Reusable screen layer. Source mode sends a narrow blur boundary through the
 * departing composition; destination mode gently resolves the incoming screen.
 * Blur is bounded in height and time so Android does not blur a full-screen tree.
 * The Expo 54 blur renderer is isolated here; a future stable masked-blur API
 * can replace it without changing the shared progress or screen call sites.
 */
export function ProgressiveFocusTransition({
  role,
  children,
}: {
  role: 'source' | 'destination';
  children?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const { active, progress, reduceMotion } = useProgressiveFocusTransition();
  const bandHeight = Math.max(160, Math.round(height * 0.34));

  const destinationStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.48, 1], 'clamp'),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [reduceMotion ? 0 : 14, 0], 'clamp') },
      { scale: interpolate(progress.value, [0, 1], [reduceMotion ? 1 : 0.975, 1], 'clamp') },
    ],
  }), [reduceMotion]);

  const bandStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(progress.value, [0, 0.12, 0.88, 1], [0, 0.94, 0.94, 0], 'clamp'),
    transform: [{
      translateY: interpolate(progress.value, [0, 1], [-bandHeight, height], 'clamp'),
    }],
  }), [bandHeight, height, reduceMotion]);
  const softeningStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, height], 'clamp'),
  }), [height]);

  if (role === 'destination') {
    return <Animated.View style={[styles.destination, destinationStyle]}>{children}</Animated.View>;
  }
  if (!active) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.source}>
      <Animated.View style={[styles.softeningTrail, softeningStyle]} />
      <Animated.View style={[styles.blurBand, { height: bandHeight }, bandStyle]}>
        <AnimatedBlurView
          tint="light"
          intensity={reduceMotion ? 0 : Platform.OS === 'android' ? 40 : 44}
          blurReductionFactor={Platform.OS === 'android' ? 2 : 4}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.softeningWash} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  destination: { flex: 1 },
  source: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  softeningTrail: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.canvas, opacity: 0.22 },
  blurBand: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  softeningWash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.canvas, opacity: 0.12 },
});
