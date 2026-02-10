/**
 * Anchor Focal Point Component
 *
 * Sacred symbol display for ritual threshold screen.
 * The anchor is the source - UI emerges from it, not the other way around.
 *
 * Features:
 * - Radial gradient glow centered on anchor
 * - Breathing animation (7s cycle: scale 1.0 → 1.02 → 1.0)
 * - Periodic shimmer sweep (every ~12 seconds)
 * - Full reduce motion support
 * - Enhanced symbol (AI-generated) or base sigil (SVG)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { colors, spacing } from '@/theme';
import { OptimizedImage } from '@/components/common';
import { TIMING, EASING, GLOW_COLORS } from '../utils/transitionConstants';

const { width } = Dimensions.get('window');

// Anchor size - increased for visual dominance
const ANCHOR_SIZE = width * 0.65;

interface AnchorFocalPointProps {
  anchor: Anchor;
  breathScale: Animated.Value;
  glowOpacity: Animated.Value;
  shimmerX: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  translateY: Animated.Value;
  reduceMotionEnabled: boolean;
  onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
}

export const AnchorFocalPoint: React.FC<AnchorFocalPointProps> = ({
  anchor,
  breathScale,
  glowOpacity,
  shimmerX,
  opacity,
  scale,
  translateY,
  reduceMotionEnabled,
  onLayout,
}) => {
  const isMountedRef = useRef(true);

  // ══════════════════════════════════════════════════════════════
  // BREATHING ANIMATION (Continuous)
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (reduceMotionEnabled) {
      // Static state for reduce motion
      breathScale.setValue(TIMING.BREATH_SCALE_MIN);
      glowOpacity.setValue(0.4);
      return;
    }

    const breathSequence = Animated.loop(
      Animated.sequence([
        // Inhale phase: scale up, glow increases
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: TIMING.BREATH_SCALE_MAX,
            duration: TIMING.BREATH_CYCLE_DURATION / 2,
            easing: EASING.BREATH,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: TIMING.GLOW_OPACITY_MAX,
            duration: TIMING.BREATH_CYCLE_DURATION / 2,
            easing: EASING.BREATH,
            useNativeDriver: true,
          }),
        ]),
        // Exhale phase: scale down, glow decreases
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: TIMING.BREATH_SCALE_MIN,
            duration: TIMING.BREATH_CYCLE_DURATION / 2,
            easing: EASING.BREATH,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: TIMING.GLOW_OPACITY_MIN,
            duration: TIMING.BREATH_CYCLE_DURATION / 2,
            easing: EASING.BREATH,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    breathSequence.start();

    return () => {
      isMountedRef.current = false;
      breathSequence.stop();
    };
  }, [reduceMotionEnabled]);

  // ══════════════════════════════════════════════════════════════
  // SHIMMER SWEEP ANIMATION (Periodic)
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (reduceMotionEnabled) {
      shimmerX.setValue(-300);
      return;
    }

    const shimmerSequence = Animated.loop(
      Animated.sequence([
        // Sweep across anchor (left to right)
        Animated.timing(shimmerX, {
          toValue: 400,
          duration: TIMING.SHIMMER_SWEEP_DURATION,
          easing: EASING.LINEAR,
          useNativeDriver: true,
        }),
        // Long pause (9 seconds)
        Animated.delay(TIMING.SHIMMER_PAUSE_DURATION),
        // Reset instantly to start position
        Animated.timing(shimmerX, {
          toValue: -300,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerSequence.start();

    return () => {
      shimmerSequence.stop();
    };
  }, [reduceMotionEnabled]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [
            { scale },
            { translateY },
          ],
        },
      ]}
      onLayout={onLayout}
    >
      {/* Radial glow background */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[GLOW_COLORS.RADIAL_CENTER, GLOW_COLORS.RADIAL_EDGE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Shimmer sweep overlay */}
      {!reduceMotionEnabled && (
        <Animated.View
          style={[
            styles.shimmerContainer,
            {
              transform: [{ translateX: shimmerX }],
            },
          ]}
        >
          <LinearGradient
            colors={GLOW_COLORS.SHIMMER}
            style={styles.shimmerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      )}

      {/* Animated anchor symbol */}
      <Animated.View
        style={[
          styles.anchorContainer,
          {
            transform: [{ scale: breathScale }],
          },
        ]}
      >
        {renderAnchorSymbol()}
      </Animated.View>
    </Animated.View>
  );

  // ══════════════════════════════════════════════════════════════
  // ANCHOR SYMBOL RENDERING
  // ══════════════════════════════════════════════════════════════

  function renderAnchorSymbol() {
    // Priority: Enhanced image > Base SVG > Placeholder
    if (anchor.enhancedImageUrl) {
      return (
        <OptimizedImage
          uri={anchor.enhancedImageUrl}
          style={styles.anchorImage}
          resizeMode="cover"
        />
      );
    }

    if (anchor.baseSigilSvg) {
      return (
        <SvgXml
          xml={anchor.baseSigilSvg}
          width={ANCHOR_SIZE}
          height={ANCHOR_SIZE}
        />
      );
    }

    // Fallback: simple gold symbol
    return (
      <View style={styles.placeholderContainer}>
        <Animated.Text
          style={[
            styles.placeholderText,
            {
              opacity: glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.6],
              }),
            },
          ]}
        >
          ◈
        </Animated.Text>
      </View>
    );
  }
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    position: 'relative',
  },

  glowContainer: {
    position: 'absolute',
    width: ANCHOR_SIZE * 1.6,
    height: ANCHOR_SIZE * 1.6,
    borderRadius: ANCHOR_SIZE * 0.8,
  },

  shimmerContainer: {
    position: 'absolute',
    width: 220,
    height: ANCHOR_SIZE * 1.3,
    overflow: 'visible',
  },

  shimmerGradient: {
    width: '100%',
    height: '100%',
  },

  anchorContainer: {
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  anchorImage: {
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
    borderRadius: ANCHOR_SIZE / 2,
  },

  placeholderContainer: {
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    fontSize: 88,
    color: colors.gold,
    textAlign: 'center',
  },
});
