import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  withDelay,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type OrbMotion = {
  translateX: number;
  translateY: number;
  scale: number;
  duration: number;
  phase: number;
};

interface OrbProps {
  id: string;
  size: number;
  color: string;
  style: StyleProp<ViewStyle>;
  motion: OrbMotion;
  mountDelay: number;
  reduceMotionEnabled: boolean;
  /** Stop the drift while the orb is off-screen, without disturbing its state. */
  paused?: boolean;
}

const Orb: React.FC<OrbProps> = ({
  id,
  size,
  color,
  style,
  motion,
  mountDelay,
  reduceMotionEnabled,
  paused = false,
}) => {
  const t = useSharedValue(0);
  const mountProgress = useSharedValue(reduceMotionEnabled ? 1 : 0);

  // The entrance plays once per mount and is deliberately not keyed on the
  // motion flags. `mountProgress` drives opacity, so re-running this drops the
  // orb to fully transparent and fades it back in — which, on a screen whose
  // motion flag used to flip with tab visibility, read as the whole Sanctuary
  // reloading every time the user came back to it.
  useEffect(() => {
    if (reduceMotionEnabled) {
      mountProgress.value = 1;
      return;
    }

    mountProgress.value = withDelay(
      mountDelay,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entrance is mount-only
  }, []);

  // Honour the accessibility setting being turned on mid-session by settling
  // the orb at rest rather than mid-fade.
  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(mountProgress);
      mountProgress.value = 1;
    }
  }, [mountProgress, reduceMotionEnabled]);

  useEffect(() => {
    if (reduceMotionEnabled || paused) {
      // Leave `t` where it stopped so resuming continues the drift.
      cancelAnimation(t);
      return;
    }

    // Each repetition restarts from `origin`, and the drift is read through
    // `Math.sin`, so travelling exactly 2π per cycle makes the wrap invisible
    // from wherever the previous pause left off.
    const origin = t.value % (Math.PI * 2);
    t.value = origin;
    t.value = withRepeat(
      withTiming(origin + Math.PI * 2, {
        duration: motion.duration,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(t);
    };
  }, [motion.duration, paused, reduceMotionEnabled, t]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = reduceMotionEnabled ? 0 : (Math.sin(t.value + motion.phase) + 1) / 2;
    const fadeOffset = (1 - mountProgress.value) * 14;
    return {
      opacity: mountProgress.value,
      transform: [
        { translateX: p * motion.translateX },
        { translateY: fadeOffset + p * motion.translateY },
        { scale: 1 + p * motion.scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }, style, animatedStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}-gradient`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset="70%" stopColor={color} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={`url(#${id}-gradient)`} />
      </Svg>
    </Animated.View>
  );
};

interface AtmosphericOrbsProps {
  reduceMotionEnabled: boolean;
  /** Stop the drift while the host screen is off-screen. */
  paused?: boolean;
}

export const AtmosphericOrbs: React.FC<AtmosphericOrbsProps> = ({
  reduceMotionEnabled,
  paused = false,
}) => {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Orb
        id="orb-1"
        size={320}
        color="rgba(70,35,150,0.28)"
        style={styles.orb1}
        motion={{ translateX: 18, translateY: 14, scale: 0.07, duration: 9000, phase: 0 }}
        mountDelay={0}
        reduceMotionEnabled={reduceMotionEnabled}
        paused={paused}
      />
      <Orb
        id="orb-2"
        size={260}
        color="rgba(201,168,76,0.07)"
        style={styles.orb2}
        motion={{ translateX: -12, translateY: 18, scale: 0.05, duration: 11000, phase: 1.3 }}
        mountDelay={50}
        reduceMotionEnabled={reduceMotionEnabled}
        paused={paused}
      />
      <Orb
        id="orb-3"
        size={380}
        color="rgba(50,15,110,0.22)"
        style={styles.orb3}
        motion={{ translateX: 22, translateY: -12, scale: 0.09, duration: 13000, phase: 2.1 }}
        mountDelay={100}
        reduceMotionEnabled={reduceMotionEnabled}
        paused={paused}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
  },
  orb1: {
    top: -80,
    left: -80,
  },
  orb2: {
    top: 80,
    right: -90,
  },
  orb3: {
    bottom: 60,
    left: -120,
  },
});
