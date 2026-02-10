/**
 * Sigil Hero Card Component
 *
 * Premium animated sigil display with:
 * - Glassmorphic container
 * - Breathing animation (scale 1.0 → 1.02 → 1.0)
 * - Glow pulse synchronized with breathing
 * - Periodic shimmer sweep effect
 * - State-based visual intensity
 * - Reduce motion support
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Anchor } from '@/types';
import { colors, spacing } from '@/theme';
import { AnchorState } from '../utils/anchorStateHelpers';
import { OptimizedImage, SacredRing } from '@/components/common';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.6;

interface SigilHeroCardProps {
  anchor: Anchor;
  anchorState: AnchorState;
  reduceMotionEnabled: boolean;
}

export const SigilHeroCard: React.FC<SigilHeroCardProps> = ({
  anchor,
  anchorState,
  reduceMotionEnabled,
}) => {
  // Determine animation intensity based on state
  const isHighIntensity = anchorState === 'active' || anchorState === 'charged';
  const breathingDuration = isHighIntensity ? 2000 : 3000;
  const glowIntensity = isHighIntensity ? 1.0 : 0.5;

  // Animation refs
  const breathScale = useRef(new Animated.Value(1.0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3 * glowIntensity)).current;
  const shimmerX = useRef(new Animated.Value(-300)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  // Breathing animation (continuous loop)
  useEffect(() => {
    if (reduceMotionEnabled) {
      // Static state for reduce motion
      breathScale.setValue(1.0);
      glowOpacity.setValue(0.5 * glowIntensity);
      return;
    }

    const breathSequence = Animated.loop(
      Animated.sequence([
        // Inhale phase
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1.02,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.6 * glowIntensity,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        // Exhale phase
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1.0,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3 * glowIntensity,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.sin),
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
  }, [reduceMotionEnabled, breathingDuration, glowIntensity]);

  // Rotation animation for the ring
  useEffect(() => {
    if (anchor.isCharged && !reduceMotionEnabled) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [anchor.isCharged, reduceMotionEnabled]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Shimmer sweep animation (periodic)
  useEffect(() => {
    if (reduceMotionEnabled) {
      shimmerX.setValue(-300);
      return;
    }

    const shimmerSequence = Animated.loop(
      Animated.sequence([
        // Sweep across
        Animated.timing(shimmerX, {
          toValue: 300,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Pause
        Animated.delay(9000),
        // Reset instantly
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

  return (
    <View style={styles.container}>
      <View style={[
        styles.glassmorphicCard,
        anchor.isCharged && styles.chargedCard
      ]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={anchor.isCharged ? 30 : 20} tint="dark" style={StyleSheet.absoluteFill}>
            {renderSigilContent()}
          </BlurView>
        ) : (
          <View style={styles.androidFallback}>{renderSigilContent()}</View>
        )}
      </View>
    </View>
  );

  function renderSigilContent() {
    return (
      <View style={styles.content}>
        {/* Radial glow background (Enhanced for charged) */}
        <Animated.View
          style={[
            styles.glowContainer,
            {
              opacity: glowOpacity,
              transform: [{ scale: anchor.isCharged ? 1.4 : 1.0 }]
            },
          ]}
        >
          <LinearGradient
            colors={[`${colors.gold}${anchor.isCharged ? '80' : '60'}`, `${colors.gold}00`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Animated Sacred Ring (New for details) */}
        {anchor.isCharged && (
          <Animated.View style={[styles.ringWrapper, { transform: [{ rotate: spin }] }]}>
            <SacredRing size={SIGIL_SIZE * 1.3} />
          </Animated.View>
        )}

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
              colors={['transparent', `${colors.gold}40`, 'transparent']}
              style={styles.shimmerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        )}

        {/* Animated sigil */}
        <Animated.View
          style={[
            styles.sigilContainer,
            {
              transform: [{ scale: breathScale }],
            },
          ]}
        >
          {anchor.enhancedImageUrl ? (
            <OptimizedImage
              uri={anchor.enhancedImageUrl}
              style={styles.sigilImage}
              resizeMode="cover"
            />
          ) : anchor.baseSigilSvg ? (
            <SvgXml xml={anchor.baseSigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
          ) : (
            // Fallback placeholder
            <View style={styles.placeholderContainer}>
              <Animated.Text
                style={[
                  styles.placeholderText,
                  {
                    opacity: glowOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.6],
                    })
                  },
                ]}
              >
                ◈
              </Animated.Text>
            </View>
          )}
        </Animated.View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  glassmorphicCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.15)`,
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 26, 29, 0.9)',
  },
  chargedCard: {
    borderColor: `rgba(212, 175, 55, 0.4)`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  androidFallback: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowContainer: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.5,
    height: SIGIL_SIZE * 1.5,
    borderRadius: SIGIL_SIZE * 0.75,
  },
  ringWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  shimmerContainer: {
    position: 'absolute',
    width: 200,
    height: SIGIL_SIZE * 1.2,
    overflow: 'visible',
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },
  sigilContainer: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilImage: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
  },
  placeholderContainer: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 72,
    color: colors.gold,
  },
});
