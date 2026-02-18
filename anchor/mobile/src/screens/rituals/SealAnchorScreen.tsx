/**
 * Anchor App - Seal Anchor Screen
 *
 * Premium, meditation-like sealing ritual.
 * User presses and holds directly on their anchor symbol to seal it.
 * Zen Architect theme: minimalist, embodied, intentional.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { PremiumAnchorGlow } from '@/components/common';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { logger } from '@/utils/logger';
import { RitualScaffold } from './components/RitualScaffold';
import { InstructionGlassCard } from './components/InstructionGlassCard';

// Visual constants
const ORB_SIZE = 240;
const SIGIL_SIZE = 160;
const RING_RADIUS = 130;
const RING_STROKE_WIDTH = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const GLOW_SIZE = 360;

// Animation timing
const SEAL_DURATION = 3000; // 3 seconds
const HAPTIC_INTERVAL = 500; // Gentle haptic every 0.5s

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type SealAnchorRouteProp = RouteProp<RootStackParamList, 'SealAnchor'>;
type SealAnchorNavigationProp = StackNavigationProp<RootStackParamList, 'SealAnchor'>;

export const SealAnchorScreen: React.FC = () => {
  const navigation = useNavigation<SealAnchorNavigationProp>();
  const route = useRoute<SealAnchorRouteProp>();
  const { anchorId, returnTo } = route.params;

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const anchor = getAnchorById(anchorId);
  const reduceMotionEnabled = useReduceMotionEnabled();

  // State
  const [isHolding, setIsHolding] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Animated values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowScaleAnim = useRef(new Animated.Value(1)).current;
  const glowOpacityAnim = useRef(new Animated.Value(0.3)).current;
  const orbScaleAnim = useRef(new Animated.Value(1)).current;
  const bloomScaleAnim = useRef(new Animated.Value(1)).current;
  const bloomOpacityAnim = useRef(new Animated.Value(0)).current;

  // Refs for intervals/timeouts
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number>(0);

  // ══════════════════════════════════════════════════════════════
  // NULL SAFETY: Defensive handling
  // ═════════════════════════════════════════════════════════════

  if (!anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Anchor not found. Returning to vault...
          </Text>
        </View>
      </RitualScaffold>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // HANDLERS: Long-press interaction
  // ══════════════════════════════════════════════════════════════

  const handlePressIn = () => {
    if (isComplete) return;

    setIsHolding(true);
    holdStartTimeRef.current = Date.now();

    // Initial haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SEAL_DURATION,
      useNativeDriver: false,
    }).start();

    // Start glow intensification
    Animated.parallel([
      Animated.timing(glowScaleAnim, {
        toValue: 1.5,
        duration: SEAL_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacityAnim, {
        toValue: 0.8,
        duration: SEAL_DURATION,
        useNativeDriver: true,
      }),
    ]).start();

    // Start orb scale pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScaleAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(orbScaleAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Periodic haptics during hold
    hapticIntervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, HAPTIC_INTERVAL);

    // Set timer for completion
    holdTimerRef.current = setTimeout(() => {
      handleSealComplete();
    }, SEAL_DURATION);
  };

  const handlePressOut = () => {
    if (isComplete) return;

    const elapsedTime = Date.now() - holdStartTimeRef.current;

    // If released before completion, cancel
    if (elapsedTime < SEAL_DURATION) {
      cancelSeal();
    }
  };

  const cancelSeal = () => {
    setIsHolding(false);

    // Clear timers
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);

    // Reset animations
    progressAnim.stopAnimation();
    glowScaleAnim.stopAnimation();
    glowOpacityAnim.stopAnimation();
    orbScaleAnim.stopAnimation();

    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(glowScaleAnim, {
        toValue: 1.0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacityAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(orbScaleAnim, {
        toValue: 1.0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSealComplete = async () => {
    setIsComplete(true);

    // Clear intervals
    if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);

    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Bloom effect
    Animated.parallel([
      Animated.timing(bloomScaleAnim, {
        toValue: 2.5,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bloomOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(bloomOpacityAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Update anchor in store
    try {
      await updateAnchor(anchorId, {
        isCharged: true,
        chargedAt: new Date(),
      });

      // Navigate to completion screen after bloom
      setTimeout(() => {
        navigation.replace('ChargeComplete', { anchorId, returnTo });
      }, 800);
    } catch (error) {
      logger.warn('Failed to update anchor locally', error);
      Alert.alert('Error', 'Failed to save seal. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Sealing?',
      'Your anchor will be saved without the sealing ritual.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'default',
          onPress: async () => {
            await updateAnchor(anchorId, {
              isCharged: true,
              chargedAt: new Date(),
            });
            navigation.replace('ChargeComplete', { anchorId, returnTo });
          },
        },
      ]
    );
  };

  // ══════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════
  // RENDER: Progress ring
  // ══════════════════════════════════════════════════════════════

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <RitualScaffold>
      <View style={styles.topBar}>
        {/* Skip Button */}
        {!isHolding && !isComplete && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center Content */}
      <View style={styles.centerContent}>
        {/* Glow Halo (behind orb) */}
        <Animated.View
          style={[
            styles.glowContainer,
            {
              transform: [{ scale: glowScaleAnim }],
              opacity: glowOpacityAnim,
            },
          ]}
        >
          <PremiumAnchorGlow
            size={ORB_SIZE}
            state={isHolding ? 'active' : 'charged'}
            variant="ritual"
            reduceMotionEnabled={reduceMotionEnabled}
          />
        </Animated.View>

        {/* Orb + Sigil (Pressable) */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isComplete}
          style={styles.orbPressable}
        >
          <Animated.View
            style={[
              styles.orbContainer,
              {
                transform: [{ scale: orbScaleAnim }],
              },
            ]}
          >
            {/* Frosted Glass Orb */}
            {Platform.OS === 'ios' ? (
              <AnimatedBlurView
                intensity={40}
                tint="dark"
                style={styles.orbBlur}
              >
                <View style={styles.orbInner}>
                  {/* Sigil (masked, low opacity) */}
                  <View style={styles.sigilContainer}>
                    <SvgXml
                      xml={anchor.baseSigilSvg}
                      width={SIGIL_SIZE}
                      height={SIGIL_SIZE}
                      opacity={0.4}
                    />
                  </View>
                </View>
              </AnimatedBlurView>
            ) : (
              <Animated.View style={[styles.orbBlur, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
                <View style={styles.orbInner}>
                  {/* Sigil (masked, low opacity) */}
                  <View style={styles.sigilContainer}>
                    <SvgXml
                      xml={anchor.baseSigilSvg}
                      width={SIGIL_SIZE}
                      height={SIGIL_SIZE}
                      opacity={0.4}
                    />
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Progress Ring (SVG overlay) */}
            <Svg
              width={ORB_SIZE}
              height={ORB_SIZE}
              style={styles.progressRing}
            >
              {/* Background ring (subtle) */}
              <Circle
                cx={ORB_SIZE / 2}
                cy={ORB_SIZE / 2}
                r={RING_RADIUS}
                stroke={`${colors.gold}20`}
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
              />

              {/* Progress ring */}
              <AnimatedCircle
                cx={ORB_SIZE / 2}
                cy={ORB_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.gold}
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${ORB_SIZE / 2}, ${ORB_SIZE / 2}`}
              />
            </Svg>
          </Animated.View>
        </Pressable>

        {/* Instruction Text */}
        {!isComplete && (
          <View style={styles.instructionCardWrap}>
            <InstructionGlassCard text="Hold to seal" emphasized />
          </View>
        )}

        {/* Bloom Effect (on completion) */}
        <Animated.View
          style={[
            styles.bloomContainer,
            {
              transform: [{ scale: bloomScaleAnim }],
              opacity: bloomOpacityAnim,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.bloomCircle} />
        </Animated.View>
      </View>
    </RitualScaffold>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  topBar: {
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Skip Button
  // ────────────────────────────────────────────────────────────
  skipButton: {
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  skipText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },

  // ────────────────────────────────────────────────────────────
  // Center Content
  // ────────────────────────────────────────────────────────────
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Glow Halo
  // ────────────────────────────────────────────────────────────
  glowContainer: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Orb Container
  // ────────────────────────────────────────────────────────────
  orbPressable: {
    zIndex: 5,
  },
  orbContainer: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbBlur: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.gold}30`,
  },
  orbInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.background.secondary}60`,
  },
  sigilContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Progress Ring (SVG Overlay)
  // ────────────────────────────────────────────────────────────
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  instructionCardWrap: {
    width: '100%',
    maxWidth: 280,
    marginTop: spacing.xl,
  },

  // ────────────────────────────────────────────────────────────
  // Bloom Effect
  // ────────────────────────────────────────────────────────────
  bloomContainer: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloomCircle: {
    width: '100%',
    height: '100%',
    borderRadius: ORB_SIZE / 2,
    backgroundColor: '#FFF9E6', // Gold-white
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 30,
  },

  // ────────────────────────────────────────────────────────────
  // Error State
  // ────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
