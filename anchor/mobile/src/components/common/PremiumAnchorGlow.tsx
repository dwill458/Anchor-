import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export type PremiumGlowState = 'dormant' | 'charged' | 'active' | 'stale';
export type PremiumGlowVariant = 'card' | 'detail' | 'ritual';

interface PremiumAnchorGlowProps {
  size: number;
  state: PremiumGlowState;
  variant: PremiumGlowVariant;
  reduceMotionEnabled?: boolean;
}

interface VariantConfig {
  auraScale: number;
  ringScale: number;
  ringStroke: number;
  highlightStroke: number;
  auraOpacityMultiplier: number;
  ringOpacityMultiplier: number;
}

const getVariantConfig = (variant: PremiumGlowVariant): VariantConfig => {
  switch (variant) {
    case 'ritual':
      return {
        auraScale: 1.75,
        ringScale: 1.45,
        ringStroke: 1.8,
        highlightStroke: 2.6,
        auraOpacityMultiplier: 1.08,
        ringOpacityMultiplier: 1.12,
      };
    case 'detail':
      return {
        auraScale: 1.65,
        ringScale: 1.35,
        ringStroke: 1.7,
        highlightStroke: 2.4,
        auraOpacityMultiplier: 1.0,
        ringOpacityMultiplier: 1.0,
      };
    case 'card':
    default:
      return {
        auraScale: 1.35,
        ringScale: 1.15,
        ringStroke: 1.35,
        highlightStroke: 1.9,
        auraOpacityMultiplier: 0.74,
        ringOpacityMultiplier: 0.68,
      };
  }
};

const getStateOpacity = (state: PremiumGlowState): { aura: number; ring: number; pulse: number } => {
  switch (state) {
    case 'active':
      return { aura: 0.46, ring: 0.92, pulse: 0.2 };
    case 'charged':
      return { aura: 0.36, ring: 0.78, pulse: 0.16 };
    case 'stale':
      return { aura: 0.16, ring: 0, pulse: 0.04 };
    case 'dormant':
    default:
      return { aura: 0.12, ring: 0, pulse: 0.03 };
  }
};

export const PremiumAnchorGlow: React.FC<PremiumAnchorGlowProps> = ({
  size,
  state,
  variant,
  reduceMotionEnabled = false,
}) => {
  const animationsEnabled = !reduceMotionEnabled && process.env.NODE_ENV !== 'test';
  const hasRingLayers = state === 'charged' || state === 'active';
  const variantConfig = useMemo(() => getVariantConfig(variant), [variant]);
  const opacityConfig = useMemo(() => getStateOpacity(state), [state]);

  const breath = useRef(new Animated.Value(0)).current;
  const slowRotation = useRef(new Animated.Value(0)).current;
  const counterRotation = useRef(new Animated.Value(0)).current;
  const highlightRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animationsEnabled) {
      breath.stopAnimation();
      slowRotation.stopAnimation();
      counterRotation.stopAnimation();
      highlightRotation.stopAnimation();
      breath.setValue(0);
      slowRotation.setValue(0);
      counterRotation.setValue(0);
      highlightRotation.setValue(0);
      return;
    }

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const slowRotationLoop = Animated.loop(
      Animated.timing(slowRotation, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const counterRotationLoop = Animated.loop(
      Animated.timing(counterRotation, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const highlightRotationLoop = Animated.loop(
      Animated.timing(highlightRotation, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    breathLoop.start();
    slowRotationLoop.start();
    counterRotationLoop.start();
    highlightRotationLoop.start();

    return () => {
      breathLoop.stop();
      slowRotationLoop.stop();
      counterRotationLoop.stop();
      highlightRotationLoop.stop();
    };
  }, [animationsEnabled, breath, counterRotation, highlightRotation, slowRotation]);

  const auraOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [
      opacityConfig.aura * variantConfig.auraOpacityMultiplier,
      Math.min(1, (opacityConfig.aura + opacityConfig.pulse) * variantConfig.auraOpacityMultiplier),
    ],
  });

  const auraScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, animationsEnabled ? 1.09 : 1],
  });

  const slowSpin = slowRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const counterSpin = counterRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const highlightSpin = highlightRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const auraSize = size * variantConfig.auraScale;
  const ringSize = size * variantConfig.ringScale;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.auraLayer,
          {
            width: auraSize,
            height: auraSize,
            borderRadius: auraSize / 2,
            opacity: auraOpacity,
            transform: [{ scale: auraScale }],
          },
        ]}
      >
        <View style={[styles.auraCore, { borderRadius: auraSize / 2 }]} />
      </Animated.View>

      {hasRingLayers && (
        <>
          <Animated.View
            style={[
              styles.ringBase,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: variantConfig.ringStroke,
                borderColor: `${colors.gold}66`,
                opacity: Math.min(1, opacityConfig.ring * variantConfig.ringOpacityMultiplier),
                transform: [{ rotate: slowSpin }],
              },
            ]}
            pointerEvents="none"
          />

          <Animated.View
            style={[
              styles.ringBase,
              {
                width: ringSize * 0.92,
                height: ringSize * 0.92,
                borderRadius: (ringSize * 0.92) / 2,
                borderWidth: Math.max(1, variantConfig.ringStroke * 0.75),
                borderColor: `${colors.gold}40`,
                opacity: Math.min(1, opacityConfig.ring * 0.8 * variantConfig.ringOpacityMultiplier),
                transform: [{ rotate: counterSpin }],
              },
            ]}
            pointerEvents="none"
          />

          <Animated.View
            style={[
              styles.highlightArc,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: variantConfig.highlightStroke,
                borderTopColor: `${colors.gold}D9`,
                borderRightColor: `${colors.gold}B8`,
                borderBottomColor: 'transparent',
                borderLeftColor: 'transparent',
                opacity: Math.min(1, opacityConfig.ring * 0.9 * variantConfig.ringOpacityMultiplier),
                transform: [{ rotate: highlightSpin }],
              },
            ]}
            pointerEvents="none"
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringBase: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  highlightArc: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraCore: {
    width: '100%',
    height: '100%',
    backgroundColor: `${colors.gold}22`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 32,
    elevation: 14,
  },
});
