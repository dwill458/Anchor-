import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { safeHaptics } from '@/utils/haptics';
import { AnchorSplashMark } from './AnchorSplashMark';
import {
  SPLASH_BACKGROUND_COLOR,
  SPLASH_INK_COLOR,
  SPLASH_LIFT_DP,
  SPLASH_MARK_HEIGHT,
  SPLASH_REDUCED_MOTION_DURATION_MS,
  SPLASH_RETURN_EXIT_SCALE,
  SPLASH_TIMINGS,
  type SplashVariant,
} from './splashAnimation.constants';

interface AnimatedSplashScreenProps {
  /** Which sequence to run once `active`; `null` while it is still being resolved. */
  variant: SplashVariant | null;
  /** Start the sequence. */
  active: boolean;
  /** The native splash is gone but startup is not ready: breathe the star in place. */
  waiting: boolean;
  onComplete: () => void;
  onRootLayout: () => void;
  onLogoReady: () => void;
  reduceMotionEnabled: boolean;
}

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);

const timed = (to: number, { delay, duration }: { delay: number; duration: number }, easing = easeInOut) =>
  withDelay(delay, withTiming(to, { duration, easing }));

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  variant,
  active,
  waiting,
  onComplete,
  onRootLayout,
  onLogoReady,
  reduceMotionEnabled,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  // Frame 0 is the native launch screen: cream paper and the gold star, nothing else.
  const draw = useSharedValue(0);
  const texture = useSharedValue(0);
  const glow = useSharedValue(0);
  const starScale = useSharedValue(1);
  const lift = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);
  const exitScale = useSharedValue(1);
  const hasStarted = useRef(false);
  const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const complete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!waiting || active || reduceMotionEnabled) {
      return undefined;
    }
    const half = SPLASH_TIMINGS.waitBreathMs / 2;
    glow.value = withRepeat(
      withSequence(withTiming(0.7, { duration: half, easing: easeInOut }), withTiming(0.2, { duration: half, easing: easeInOut })),
      -1,
      false
    );
    return () => cancelAnimation(glow);
  }, [active, glow, reduceMotionEnabled, waiting]);

  useEffect(() => {
    if (!active || !variant || hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    cancelAnimation(glow);

    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) {
        runOnJS(complete)();
      }
    };

    if (reduceMotionEnabled) {
      // The finished state, shown at once, then a plain fade.
      draw.value = 1;
      texture.value = 1;
      glow.value = 0;
      if (variant === 'first') {
        lift.value = 1;
        wordmark.value = 1;
        tagline.value = 1;
      }
      exit.value = withTiming(1, { duration: SPLASH_REDUCED_MOTION_DURATION_MS, easing: easeOut }, finish);
      return;
    }

    if (variant === 'first') {
      const t = SPLASH_TIMINGS.first;
      glow.value = withSequence(
        timed(1, t.glowIn, easeOut),
        withDelay(t.draw.delay + t.draw.duration - t.glowIn.duration, withTiming(0.35, { duration: 900, easing: easeInOut }))
      );
      draw.value = timed(1, t.draw);
      texture.value = timed(1, t.texture);
      lift.value = timed(1, t.lift);
      wordmark.value = timed(1, t.wordmark, easeOut);
      tagline.value = timed(1, t.tagline, easeOut);
      exit.value = withDelay(t.exit.delay, withTiming(1, { duration: t.exit.duration, easing: easeInOut }, finish));
      // The sigil closing is the one tactile beat of the ceremony.
      hapticTimer.current = setTimeout(() => {
        void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      }, t.hapticAt);
      return;
    }

    const t = SPLASH_TIMINGS.return;
    // The sigil is already known on a return: no trace, it settles in around the star.
    draw.value = 1;
    texture.value = timed(1, t.reveal, easeOut);
    const halfBreath = t.breath.duration / 2;
    starScale.value = withDelay(
      t.breath.delay,
      withSequence(withTiming(1.08, { duration: halfBreath, easing: easeOut }), withTiming(1, { duration: halfBreath, easing: easeInOut }))
    );
    glow.value = withDelay(
      t.breath.delay,
      withSequence(withTiming(0.8, { duration: halfBreath, easing: easeOut }), withTiming(0, { duration: halfBreath, easing: easeInOut }))
    );
    exitScale.value = timed(SPLASH_RETURN_EXIT_SCALE, t.exit);
    exit.value = withDelay(t.exit.delay, withTiming(1, { duration: t.exit.duration, easing: easeInOut }, finish));
  }, [active, complete, draw, exit, exitScale, glow, lift, reduceMotionEnabled, starScale, tagline, texture, variant, wordmark]);

  useEffect(
    () => () => {
      if (hapticTimer.current) {
        clearTimeout(hapticTimer.current);
      }
      [draw, texture, glow, starScale, lift, wordmark, tagline, exit, exitScale].forEach((value) => cancelAnimation(value));
    },
    [draw, exit, exitScale, glow, lift, starScale, tagline, texture, wordmark]
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: exitScale.value }],
  }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -SPLASH_LIFT_DP * lift.value }] }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: 8 * (1 - wordmark.value) }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: 6 * (1 - tagline.value) }],
  }));

  return (
    <Animated.View
      testID="animated-splash"
      pointerEvents="auto"
      onLayout={onRootLayout}
      style={[styles.root, containerStyle]}
      accessibilityLabel="Anchor"
    >
      <StatusBar style="dark" />
      <View style={styles.slot}>
        <Animated.View style={markStyle}>
          <AnchorSplashMark draw={draw} texture={texture} glow={glow} starScale={starScale} onStarReady={onLogoReady} />
        </Animated.View>
        {variant === 'first' ? (
          <View style={[styles.lockupText, { width: Math.min(320, Math.max(0, windowWidth - 32)) }]} pointerEvents="none">
            <Animated.Text testID="splash-wordmark" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false} style={[styles.wordmark, wordmarkStyle]}>
              ANCHOR
            </Animated.Text>
            <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false} style={[styles.tagline, taglineStyle]}>VISUAL GOAL SETTING</Animated.Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The mark stays centred exactly where the native splash put it; the text hangs beneath.
  slot: { alignItems: 'center' },
  lockupText: {
    position: 'absolute',
    top: SPLASH_MARK_HEIGHT - SPLASH_LIFT_DP + 18,
    alignItems: 'center',
  },
  wordmark: {
    width: '100%',
    color: SPLASH_INK_COLOR,
    fontFamily: 'Inter-SemiBold',
    fontSize: 24,
    letterSpacing: 9,
    textAlign: 'center',
    // Letter-spacing trails the last glyph; pad the start so the word stays optically centred.
    paddingLeft: 9,
  },
  tagline: {
    width: '100%',
    color: 'rgba(11, 14, 21, 0.62)',
    fontFamily: 'Inter-SemiBold',
    fontSize: 10.5,
    letterSpacing: 3.5,
    textAlign: 'center',
    paddingLeft: 3.5,
    marginTop: 8,
  },
});
