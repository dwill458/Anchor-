import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type ZenBackgroundVariant = 'default' | 'sanctuary' | 'practice';

type OrbPreset = {
  id: string;
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  color: string;
  opacity: number;
  driftX: number;
  driftY: number;
  scale: number;
  duration: number;
  phase: number;
};

interface ZenBackgroundProps {
  variant?: ZenBackgroundVariant;
  showOrbs?: boolean;
  orbOpacity?: number;
  animationDuration?: number;
  showGrain?: boolean;
  showVignette?: boolean;
}

const GRAIN_POINTS = [
  [2, 6], [11, 14], [20, 7], [27, 18], [34, 5], [42, 12], [50, 9], [58, 16], [66, 8], [74, 15],
  [82, 6], [90, 10], [7, 27], [15, 34], [24, 29], [31, 37], [39, 26], [47, 31], [55, 35], [63, 28],
  [71, 33], [79, 26], [87, 38], [5, 56], [13, 66], [22, 58], [30, 70], [38, 61], [46, 67], [54, 59],
  [62, 71], [70, 63], [78, 68], [86, 60], [94, 74], [3, 83], [12, 90], [19, 86], [27, 93], [35, 84],
  [43, 91], [51, 87], [60, 94], [68, 85], [76, 92], [84, 88], [92, 95],
];

const OrbLayer: React.FC<{
  preset: OrbPreset;
  orbOpacity: number;
  reduceMotionEnabled: boolean;
}> = ({ preset, orbOpacity, reduceMotionEnabled }) => {
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    phase.value = withRepeat(
      withTiming(1, {
        duration: preset.duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [phase, preset.duration, reduceMotionEnabled]);

  const style = useAnimatedStyle(() => {
    const eased = reduceMotionEnabled ? 0 : interpolate(phase.value, [0, 1], [0, 1]);
    return {
      opacity: preset.opacity * orbOpacity,
      transform: [
        { translateX: eased * preset.driftX },
        { translateY: eased * preset.driftY },
        { scale: 1 + eased * preset.scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.orb,
        style,
        {
          width: preset.size,
          height: preset.size,
          borderRadius: preset.size / 2,
          top: preset.top,
          right: preset.right,
          bottom: preset.bottom,
          left: preset.left,
          backgroundColor: preset.color,
        },
      ]}
      pointerEvents="none"
    />
  );
};

export const ZenBackground: React.FC<ZenBackgroundProps> = ({
  variant = 'default',
  showOrbs = true,
  orbOpacity = 1,
  animationDuration = 800,
  showGrain = true,
  showVignette = true,
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const fade = useSharedValue(0);
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    fade.value = withTiming(1, {
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
    });
  }, [animationDuration, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const palette = useMemo(() => {
    if (variant === 'sanctuary') {
      return {
        gradient: [colors.navy, colors.deepPurple, colors.charcoal, '#0A0812'] as const,
        orbPresets: [
          {
            id: 's1',
            size: 320,
            top: -90,
            left: -80,
            color: 'rgba(88, 56, 148, 0.7)',
            opacity: 0.28,
            driftX: 16,
            driftY: 12,
            scale: 0.07,
            duration: 12000,
            phase: 0.2,
          },
          {
            id: 's2',
            size: 250,
            top: 120,
            right: -100,
            color: 'rgba(212, 175, 55, 0.55)',
            opacity: 0.14,
            driftX: -12,
            driftY: 18,
            scale: 0.05,
            duration: 15000,
            phase: 1.4,
          },
          {
            id: 's3',
            size: 360,
            bottom: 40,
            left: -130,
            color: 'rgba(56, 28, 120, 0.7)',
            opacity: 0.24,
            driftX: 20,
            driftY: -12,
            scale: 0.08,
            duration: 17000,
            phase: 2.2,
          },
        ] as OrbPreset[],
        grainOpacity: 0.06,
        vignetteStrength: 0.2,
      };
    }

    if (variant === 'practice') {
      return {
        gradient: ['#070A10', '#0A0F17', '#130F1E', '#090D14'] as const,
        orbPresets: [
          {
            id: 'p1',
            size: 250,
            top: -90,
            right: -70,
            color: 'rgba(114, 78, 172, 0.65)',
            opacity: 0.17,
            driftX: 9,
            driftY: 12,
            scale: 0.04,
            duration: 18000,
            phase: 0.4,
          },
          {
            id: 'p2',
            size: 210,
            bottom: 90,
            left: -70,
            color: 'rgba(212, 175, 55, 0.42)',
            opacity: 0.08,
            driftX: -8,
            driftY: 10,
            scale: 0.03,
            duration: 22000,
            phase: 1.8,
          },
        ] as OrbPreset[],
        grainOpacity: 0.045,
        vignetteStrength: 0.9,
      };
    }

    return {
      gradient: [colors.navy, colors.deepPurple, colors.charcoal, colors.charcoal] as const,
      orbPresets: [
        {
          id: 'd1',
          size: 240,
          top: -80,
          right: -80,
          color: 'rgba(212, 175, 55, 0.72)',
          opacity: 0.12,
          driftX: 10,
          driftY: 8,
          scale: 0.05,
          duration: 12000,
          phase: 0.1,
        },
        {
          id: 'd2',
          size: 180,
          bottom: 100,
          left: -60,
          color: 'rgba(212, 175, 55, 0.65)',
          opacity: 0.08,
          driftX: -9,
          driftY: 10,
          scale: 0.04,
          duration: 13000,
          phase: 1.5,
        },
      ] as OrbPreset[],
      grainOpacity: 0.04,
      vignetteStrength: 0.76,
    };
  }, [variant]);

  const visibleOrbs = useMemo(() => {
    if (!showOrbs) return [] as OrbPreset[];
    if (!isAndroid) return palette.orbPresets;
    return palette.orbPresets.slice(0, variant === 'practice' ? 1 : 2);
  }, [isAndroid, palette.orbPresets, showOrbs, variant]);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, fadeStyle]}>
      <LinearGradient
        colors={palette.gradient}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {visibleOrbs.map((orb) => (
        <OrbLayer
          key={orb.id}
          preset={orb}
          orbOpacity={orbOpacity}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ))}

      {showGrain ? (
        <View style={[styles.grainWrap, { opacity: palette.grainOpacity }]}>
          {GRAIN_POINTS.map(([x, y], index) => (
            <View
              key={`grain-${index}`}
              style={[
                styles.grainDot,
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  opacity: index % 2 === 0 ? 0.65 : 0.4,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {showVignette ? (
        <View style={styles.vignetteWrap}>
          <LinearGradient
            colors={[`rgba(0,0,0,${palette.vignetteStrength * 0.48})`, 'rgba(0,0,0,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.vignetteTop}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', `rgba(0,0,0,${palette.vignetteStrength * 0.68})`]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.vignetteBottom}
          />
          <LinearGradient
            colors={[`rgba(0,0,0,${palette.vignetteStrength * 0.4})`, 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.vignetteLeft}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', `rgba(0,0,0,${palette.vignetteStrength * 0.46})`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.vignetteRight}
          />
        </View>
      ) : null}
    </Animated.View>
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
  grainWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  grainDot: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  vignetteWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '36%',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '44%',
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '34%',
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '34%',
  },
});
