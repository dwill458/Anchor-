import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  SPLASH_ARTWORK_ASSET,
  SPLASH_BACKGROUND_COLOR,
  SPLASH_EXIT_DURATION_MS,
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
  const exit = useSharedValue(0);
  const hasStarted = React.useRef(false);

  const complete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!active || hasStarted.current) {
      return undefined;
    }

    hasStarted.current = true;

    if (reduceMotionEnabled) {
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

    exit.value = withDelay(
      80,
      withTiming(1, {
        duration: SPLASH_EXIT_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(complete)();
        }
      })
    );

    return () => {
      cancelAnimation(exit);
    };
  }, [active, complete, exit, reduceMotionEnabled]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));

  return (
    <Animated.View
      testID="animated-splash"
      pointerEvents="auto"
      onLayout={onRootLayout}
      style={[styles.root, { backgroundColor: SPLASH_BACKGROUND_COLOR }, containerStyle]}
    >
      <Animated.Image
        testID="splash-artwork"
        accessibilityIgnoresInvertColors
        source={SPLASH_ARTWORK_ASSET}
        resizeMode="cover"
        onLoad={onLogoReady}
        onError={onLogoReady}
        style={styles.artwork}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  artwork: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
