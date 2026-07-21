import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SplashLogo } from './SplashLogo';
import {
  SPLASH_BACKGROUND_COLOR,
  SPLASH_GOLD,
  SPLASH_IVORY,
  SPLASH_PHASES,
  SPLASH_PURPLE,
  SPLASH_REDUCED_MOTION_DURATION_MS,
} from './splashAnimation.constants';

interface AnimatedSplashScreenProps {
  active: boolean;
  onComplete: () => void;
  onRootLayout: () => void;
  onLogoReady: () => void;
  reduceMotionEnabled: boolean;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  active,
  onComplete,
  onRootLayout,
  onLogoReady,
  reduceMotionEnabled,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ambient = useSharedValue(0);
  const illumination = useSharedValue(0);
  const pulse = useSharedValue(0);
  const brand = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const exit = useSharedValue(0);
  const hasStarted = React.useRef(false);

  const logoSize = Math.min(Math.max(width * 0.56, 180), 300);
  const logoTop = insets.top + Math.max(96, height * 0.22);
  const logoContainerSize = logoSize * 1.34;
  const centerX = width / 2;

  const complete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!active || hasStarted.current) {
      return undefined;
    }

    hasStarted.current = true;

    if (reduceMotionEnabled) {
      ambient.value = 1;
      illumination.value = 1;
      pulse.value = 1;
      brand.value = 1;
      subtitle.value = 1;
      exit.value = withTiming(
        1,
        { duration: SPLASH_REDUCED_MOTION_DURATION_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(complete)();
          }
        }
      );
      return undefined;
    }

    ambient.value = withTiming(1, {
      duration: SPLASH_PHASES.ambient.duration,
      easing: Easing.out(Easing.cubic),
    });
    illumination.value = withDelay(
      SPLASH_PHASES.illumination.delay,
      withTiming(1, {
        duration: SPLASH_PHASES.illumination.duration,
        easing: Easing.out(Easing.cubic),
      })
    );
    pulse.value = withDelay(
      SPLASH_PHASES.pulse.delay,
      withTiming(1, {
        duration: SPLASH_PHASES.pulse.duration,
        easing: Easing.out(Easing.cubic),
      })
    );
    brand.value = withDelay(
      SPLASH_PHASES.brand.delay,
      withTiming(1, {
        duration: SPLASH_PHASES.brand.duration,
        easing: Easing.out(Easing.cubic),
      })
    );
    subtitle.value = withDelay(
      SPLASH_PHASES.subtitle.delay,
      withTiming(1, {
        duration: SPLASH_PHASES.subtitle.duration,
        easing: Easing.out(Easing.cubic),
      })
    );
    exit.value = withDelay(
      SPLASH_PHASES.exit.delay,
      withTiming(1, {
        duration: SPLASH_PHASES.exit.duration,
        easing: Easing.inOut(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(complete)();
        }
      })
    );

    return () => {
      cancelAnimation(ambient);
      cancelAnimation(illumination);
      cancelAnimation(pulse);
      cancelAnimation(brand);
      cancelAnimation(subtitle);
      cancelAnimation(exit);
    };
  }, [active, ambient, brand, complete, exit, illumination, pulse, reduceMotionEnabled, subtitle]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const ambientStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + ambient.value * 0.22,
    transform: [{ scale: 0.85 + ambient.value * 0.15 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: 0.88 + illumination.value * 0.12,
    transform: [{ scale: 0.96 + illumination.value * 0.04 + exit.value * 0.02 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: illumination.value * 0.95,
    transform: [{ scale: 0.7 + illumination.value * 0.3 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: illumination.value * 0.42,
    transform: [{ scale: 0.82 + illumination.value * 0.18 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - pulse.value),
    transform: [{ scale: 0.8 + pulse.value * 0.6 }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: 12 - brand.value * 12 }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitle.value }));

  return (
    <Animated.View
      testID="animated-splash"
      pointerEvents="auto"
      onLayout={onRootLayout}
      style={[styles.root, { backgroundColor: SPLASH_BACKGROUND_COLOR }, containerStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            width: logoSize * 1.75,
            height: logoSize * 1.75,
            borderRadius: logoSize,
            left: centerX - logoSize * 0.875,
            top: logoTop + logoSize * 0.5 - logoSize * 0.875,
          },
          ambientStyle,
        ]}
      />
      <View style={[styles.logoPosition, { top: logoTop, left: centerX - logoContainerSize / 2 }]}>
        <SplashLogo
          size={logoSize}
          logoStyle={logoStyle}
          glowStyle={glowStyle}
          haloStyle={haloStyle}
          pulseStyle={pulseStyle}
          onLogoReady={onLogoReady}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.wordmark, { top: logoTop + logoSize + 28 }, brandStyle]}
      >
        <Text style={styles.wordmarkText}>ANCHOR</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.subtitle, { top: logoTop + logoSize + 92 }, subtitleStyle]}
      >
        <Text style={styles.subtitleText}>VISUAL GOAL SETTING</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: SPLASH_PURPLE,
    opacity: 0.2,
  },
  logoPosition: {
    position: 'absolute',
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wordmarkText: {
    color: SPLASH_GOLD,
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 32,
    letterSpacing: 4.5,
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  subtitleText: {
    color: SPLASH_IVORY,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 3,
  },
});
