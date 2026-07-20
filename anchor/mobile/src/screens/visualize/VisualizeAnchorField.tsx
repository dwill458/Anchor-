import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import type { PerformanceTier } from '@/hooks/usePerformanceTier';
import {
  VISUALIZE_PHASE_PRESENTATION,
  type VisualizePresentationPhase,
} from './visualizePresentation';

interface VisualizeAnchorFieldProps {
  phase: VisualizePresentationPhase;
  phaseProgress: number;
  totalProgress: number;
  active: boolean;
  reduceMotion: boolean;
  performanceTier: PerformanceTier;
  compact?: boolean;
  children: React.ReactNode;
}

const PARTICLES = [
  { top: '18%', left: '24%', size: 2, opacity: 0.22 },
  { top: '27%', right: '19%', size: 1.5, opacity: 0.18 },
  { top: '64%', left: '18%', size: 1, opacity: 0.2 },
  { top: '73%', right: '22%', size: 2, opacity: 0.14 },
  { top: '47%', right: '11%', size: 1, opacity: 0.16 },
] as const;

const startBreathLoop = (
  value: Animated.Value,
  duration: number,
): Animated.CompositeAnimation => {
  value.setValue(0);
  const animation = Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: Math.round(duration * 0.54),
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: Math.round(duration * 0.46),
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
  animation.start();
  return animation;
};

const startRotationLoop = (
  value: Animated.Value,
  duration: number,
): Animated.CompositeAnimation => {
  value.setValue(0);
  const animation = Animated.loop(
    Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );
  animation.start();
  return animation;
};

export const VisualizeAnchorField: React.FC<VisualizeAnchorFieldProps> = ({
  phase,
  phaseProgress,
  totalProgress,
  active,
  reduceMotion,
  performanceTier,
  compact = false,
  children,
}) => {
  const presentation = VISUALIZE_PHASE_PRESENTATION[phase];
  const breath = useRef(new Animated.Value(0)).current;
  const ringFlow = useRef(new Animated.Value(0)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const shimmerRotation = useRef(new Animated.Value(0)).current;
  const particleDrift = useRef(new Animated.Value(0)).current;
  const phasePulse = useRef(new Animated.Value(0)).current;
  const sealPulse = useRef(new Animated.Value(0)).current;
  const sealPulseTriggered = useRef(false);

  useEffect(() => {
    if (reduceMotion || !active) {
      breath.stopAnimation();
      ringFlow.stopAnimation();
      ringRotation.stopAnimation();
      shimmerRotation.stopAnimation();
      particleDrift.stopAnimation();
      return;
    }

    const animations = [
      startBreathLoop(breath, presentation.breathDurationMs),
      startBreathLoop(ringFlow, presentation.ringDurationMs),
      startRotationLoop(ringRotation, presentation.ringDurationMs * 2.2),
      startRotationLoop(shimmerRotation, 8_600),
      startBreathLoop(particleDrift, 17_000),
    ];

    return () => animations.forEach((animation) => animation.stop());
  }, [
    active,
    breath,
    particleDrift,
    presentation.breathDurationMs,
    presentation.ringDurationMs,
    reduceMotion,
    ringFlow,
    ringRotation,
    shimmerRotation,
  ]);

  useEffect(() => {
    phasePulse.stopAnimation();
    if (reduceMotion) {
      phasePulse.setValue(0);
      return;
    }
    phasePulse.setValue(0);
    Animated.sequence([
      Animated.timing(phasePulse, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(phasePulse, {
        toValue: 0,
        duration: 540,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, phasePulse, reduceMotion]);

  useEffect(() => {
    if (phase !== 'seal') {
      sealPulseTriggered.current = false;
      sealPulse.setValue(0);
      return;
    }
    if (
      reduceMotion ||
      phaseProgress < 0.82 ||
      sealPulseTriggered.current
    ) {
      return;
    }
    sealPulseTriggered.current = true;
    Animated.sequence([
      Animated.timing(sealPulse, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sealPulse, {
        toValue: 0,
        duration: 760,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, phaseProgress, reduceMotion, sealPulse]);

  useEffect(
    () => () => {
      breath.stopAnimation();
      ringFlow.stopAnimation();
      ringRotation.stopAnimation();
      shimmerRotation.stopAnimation();
      particleDrift.stopAnimation();
      phasePulse.stopAnimation();
      sealPulse.stopAnimation();
    }, [
      breath,
      particleDrift,
      phasePulse,
      ringFlow,
      ringRotation,
      sealPulse,
      shimmerRotation,
    ],
  );

  const ringScaleRange = useMemo<[number, number]>(() => {
    switch (presentation.ringMotion) {
      case 'outward':
        return [0.86, 1.12];
      case 'inward':
        return [1.1, 0.92];
      case 'depth':
        return [0.9, 1.14];
      case 'settle':
        return [1.015, 1];
      default:
        return [0.98, 1.025];
    }
  }, [presentation.ringMotion]);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 + presentation.breathAmount],
  });
  const ringScale = ringFlow.interpolate({
    inputRange: [0, 1],
    outputRange: ringScaleRange,
  });
  const ringOpacity = ringFlow.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange:
      presentation.ringMotion === 'settle'
        ? [0.2, 0.24, 0.2]
        : [0.09, 0.3, 0.09],
  });
  const rotate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const shimmerRotate = shimmerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const particleTranslateX = particleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-5, 7],
  });
  const particleTranslateY = particleDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [7, -6],
  });
  const pulseScale = phasePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.055],
  });
  const sealScale = sealPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.18],
  });
  const sealOpacity = sealPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.42],
  });
  const tierParticleCount =
    performanceTier === 'high' ? PARTICLES.length : performanceTier === 'medium' ? 3 : 0;
  const visibleParticleCount =
    Platform.OS === 'android' ? Math.min(3, tierParticleCount) : tierParticleCount;
  const accumulatedGlow = Math.min(
    0.86,
    presentation.glow + totalProgress * 0.12,
  );

  return (
    <View
      testID="visualize-anchor-field"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.field, compact && styles.fieldCompact]}
    >
      <LinearGradient
        colors={['rgba(101,153,204,0)', `rgba(87,139,190,${0.08 + presentation.depth * 0.08})`, 'rgba(101,153,204,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.beam}
      />

      <View style={[styles.radialField, { opacity: 0.18 + presentation.depth * 0.2 }]} />
      <View style={[styles.radialFieldInner, { opacity: accumulatedGlow * 0.26 }]} />

      {visibleParticleCount > 0 ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { transform: [{ translateX: particleTranslateX }, { translateY: particleTranslateY }] },
          ]}
        >
          {PARTICLES.slice(0, visibleParticleCount).map((particle, index) => {
            const { size, ...position } = particle;
            return (
              <View
                key={`visualize-particle-${index}`}
                style={[
                  styles.particle,
                  position,
                  { width: size, height: size, borderRadius: size },
                ]}
              />
            );
          })}
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.wideRing,
          { opacity: ringOpacity, transform: [{ scale: ringScale }, { rotate }] },
        ]}
        renderToHardwareTextureAndroid={Platform.OS === 'android'}
      >
        <View style={styles.ringTick} />
        <View style={styles.ringTickOpposite} />
      </Animated.View>

      <Animated.View
        style={[
          styles.violetOrbit,
          {
            opacity: 0.2 + presentation.depth * 0.22,
            transform: [{ rotate: rotate }],
          },
        ]}
      >
        <View style={styles.violetThread} />
      </Animated.View>

      <Animated.View
        style={[
          styles.goldTrace,
          {
            opacity: 0.28 + presentation.glow * 0.34,
            transform: [{ rotate: shimmerRotate }],
          },
        ]}
      >
        <Svg width={224} height={224} viewBox="0 0 224 224">
          <Circle
            cx="112"
            cy="112"
            r="103"
            fill="none"
            stroke="rgba(231,197,91,0.72)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="34 614"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.sealPulse,
          { opacity: sealOpacity, transform: [{ scale: sealScale }] },
        ]}
      />

      <Animated.View
        style={[
          styles.anchorGlow,
          {
            opacity: accumulatedGlow,
            transform: [{ scale: pulseScale }, { scale: breathScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.anchor,
          { transform: [{ scale: pulseScale }, { scale: breathScale }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    width: 330,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fieldCompact: { transform: [{ scale: 0.84 }] },
  beam: {
    position: 'absolute',
    top: -28,
    bottom: -28,
    width: 112,
  },
  radialField: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(42,92,139,0.2)',
  },
  radialFieldInner: {
    position: 'absolute',
    width: 212,
    height: 212,
    borderRadius: 106,
    backgroundColor: 'rgba(225,188,75,0.18)',
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(212,226,242,0.78)',
  },
  wideRing: {
    position: 'absolute',
    width: 286,
    height: 286,
    borderRadius: 143,
    borderWidth: 1,
    borderColor: 'rgba(112,167,216,0.7)',
  },
  ringTick: {
    position: 'absolute',
    top: -2,
    left: 138,
    width: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.75)',
  },
  ringTickOpposite: {
    position: 'absolute',
    bottom: -1,
    left: 140,
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(145,111,202,0.65)',
  },
  violetOrbit: {
    position: 'absolute',
    width: 252,
    height: 252,
    borderRadius: 126,
    borderWidth: 1,
    borderColor: 'rgba(145,111,202,0.25)',
  },
  violetThread: {
    position: 'absolute',
    top: 34,
    right: 25,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(170,137,225,0.84)',
  },
  goldTrace: {
    position: 'absolute',
    width: 224,
    height: 224,
  },
  sealPulse: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 1,
    borderColor: 'rgba(232,198,91,0.8)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  anchorGlow: {
    position: 'absolute',
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: 'rgba(212,175,55,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(225,191,83,0.25)',
  },
  anchor: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
