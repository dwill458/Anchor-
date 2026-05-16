/**
 * Anchor App - Ritual Screen
 *
 * Reusable immersive ritual screen for both Quick and Deep charge.
 * Features: centered symbol, animated charging ring, phase transitions, seal gesture.
 * Zen Architect theme: premium, focused, minimal UI.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import { useRitualController } from '@/hooks/useRitualController';
import { getRitualConfig } from '@/config/ritualConfigs';
import { apiClient } from '@/services/ApiClient';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg, OptimizedImage } from '@/components/common';
import { logger } from '@/utils/logger';

const { width, height } = Dimensions.get('window');
const SYMBOL_SIZE = 200;
const RING_RADIUS = 120;
const RING_STROKE_WIDTH = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ARRIVE_PHASE_SECONDS = 8;
const ARRIVE_CHROME_FADE_MS = 500;
const ARRIVE_BREATH_PHASE_MS = 4000;

type RitualRouteProp = RouteProp<RootStackParamList, 'Ritual'>;
type RitualNavigationProp = StackNavigationProp<RootStackParamList, 'Ritual'>;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const RitualScreen: React.FC = () => {
  const navigation = useNavigation<RitualNavigationProp>();
  const route = useRoute<RitualRouteProp>();
  const { anchorId, ritualType, durationSeconds } = route.params;
  const isMountedRef = useRef(true);
  const isCompletingRef = useRef(false);

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  // DEBUG: Log visual asset state
  useEffect(() => {
    if (anchor) {
      console.log('🔍 [RitualScreen] Anchor visual state:', {
        id: anchor.id,
        baseSigilSvg: anchor.baseSigilSvg
          ? `${anchor.baseSigilSvg.substring(0, 50)}...`
          : 'MISSING ❌',
        reinforcedSigilSvg: anchor.reinforcedSigilSvg ? 'present' : 'none',
        enhancedImageUrl: anchor.enhancedImageUrl || 'none',
      });
    }
  }, [anchor?.id]);

  // Get ritual config - handles both legacy (quick/deep) and new (focus/ritual) types
  // If custom durationSeconds provided, uses dynamic config generator
  const config = getRitualConfig(ritualType, durationSeconds);

  const arrivePhaseEnabled =
    (ritualType === 'focus' || ritualType === 'quick') &&
    config.totalDurationSeconds > 5;

  // Animated values for charging ring
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sessionChromeOpacity = useRef(
    new Animated.Value(arrivePhaseEnabled ? 0 : 1),
  ).current;
  const arriveBreathScaleAnim = useRef(new Animated.Value(1)).current;
  const arriveBreathOpacityAnim = useRef(new Animated.Value(0.55)).current;

  // Instruction fade animation
  const instructionFadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedInstruction, setDisplayedInstruction] = useState('');

  // Ritual controller
  const { state, actions } = useRitualController({
    config,
    onComplete: handleRitualComplete,
    onPhaseChange: handlePhaseChange,
    onSealComplete: handleSealComplete,
  });

  const isArrivePhase =
    arrivePhaseEnabled &&
    state.elapsedSeconds < ARRIVE_PHASE_SECONDS &&
    !state.isComplete &&
    !state.isSealPhase;

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Auto-start ritual on mount
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    isMountedRef.current = true;
    actions.start();

    return () => {
      isMountedRef.current = false;
      actions.reset();
    };
  }, []);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Arrive phase breath cue + chrome transition
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    Animated.timing(sessionChromeOpacity, {
      toValue: isArrivePhase ? 0 : 1,
      duration: ARRIVE_CHROME_FADE_MS,
      useNativeDriver: true,
    }).start();

    if (!isArrivePhase) {
      arriveBreathScaleAnim.setValue(1);
      arriveBreathOpacityAnim.setValue(0.55);
      return;
    }

    const breathLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(arriveBreathScaleAnim, {
            toValue: 1.08,
            duration: ARRIVE_BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(arriveBreathScaleAnim, {
            toValue: 1,
            duration: ARRIVE_BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(arriveBreathOpacityAnim, {
            toValue: 0.85,
            duration: ARRIVE_BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(arriveBreathOpacityAnim, {
            toValue: 0.55,
            duration: ARRIVE_BREATH_PHASE_MS,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    breathLoop.start();

    return () => breathLoop.stop();
  }, [isArrivePhase]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Update progress ring animation
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: state.progress,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [state.progress]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Glow pulse during seal phase
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (state.isSealPhase && !state.isSealComplete) {
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      glowLoop.start();

      return () => glowLoop.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [state.isSealPhase, state.isSealComplete]);

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE: Instruction text fade transition
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (state.currentInstruction === displayedInstruction) return;

    // Fade out old instruction
    Animated.timing(instructionFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Update text
      setDisplayedInstruction(state.currentInstruction);

      // Fade in new instruction
      Animated.timing(instructionFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  }, [state.currentInstruction]);

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  function handlePhaseChange(phase: any, index: number) {
    // Phase change haptic is already handled in useRitualController
    logger.info('Ritual phase change', {
      index: index + 1,
      title: phase.title,
    });
  }

  function handleRitualComplete() {
    // Navigation will happen after seal gesture completes
    logger.info('Ritual time complete, waiting for seal...');
  }

  async function handleSealComplete() {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    // Mark anchor as charged (backend + local)
    try {
      // Determine charge type based on ritual type (handles both legacy and new types)
      // Legacy: 'quick' -> 'initial_quick', 'deep' -> 'initial_deep'
      // New: 'focus' -> 'initial_quick', 'ritual' -> 'initial_deep'
      let chargeType: 'initial_quick' | 'initial_deep' | 'recharge' =
        'initial_quick';

      if (ritualType === 'quick' || ritualType === 'focus') {
        chargeType = 'initial_quick';
      } else if (ritualType === 'deep' || ritualType === 'ritual') {
        chargeType = 'initial_deep';
      }

      // CRITICAL: Update backend first (for cross-device sync)
      await apiClient.post(`/api/anchors/${anchorId}/charge`, {
        chargeType,
        durationSeconds: config.totalDurationSeconds,
      });

      // Then update local state
      await updateAnchor(anchorId, {
        isCharged: true,
        chargedAt: new Date(),
      });

      // Navigate to completion screen
      if (isMountedRef.current) {
        navigation.replace('ChargeComplete', { anchorId });
      }
    } catch (error) {
      isCompletingRef.current = false;
      logger.error('Failed to update anchor', error);
      Alert.alert('Error', 'Failed to save charge. Please try again.');
    }
  }

  function handleBack() {
    Alert.alert('Exit Ritual?', 'Your progress will be lost if you exit now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  }

  // ══════════════════════════════════════════════════════════════
  // SEAL GESTURE HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleSealPressIn = () => {
    if (state.isSealPhase && !state.isSealComplete) {
      actions.startSeal();
    }
  };

  const handleSealPressOut = () => {
    if (!state.isSealComplete) {
      actions.cancelSeal();
    }
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER: Progress Ring
  // ══════════════════════════════════════════════════════════════

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const ringOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const sealStrokeDashoffset =
    RING_CIRCUMFERENCE - RING_CIRCUMFERENCE * state.sealProgress;

  // ══════════════════════════════════════════════════════════════
  // NULL SAFETY: Defensive handling
  // ══════════════════════════════════════════════════════════════

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Anchor not found. Returning to vault...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.container}>
      {isArrivePhase && (
        <View style={styles.arriveContainer}>
          <Animated.View
            style={[
              styles.arriveBreathHalo,
              {
                opacity: arriveBreathOpacityAnim,
                transform: [{ scale: arriveBreathScaleAnim }],
              },
            ]}
          />
          <Text style={styles.arriveIntentionText}>
            “{anchor.intentionText}”
          </Text>
          <Text style={styles.arriveBreathCue}>Breathe into it</Text>
        </View>
      )}

      <Animated.View
        style={[styles.sessionChrome, { opacity: sessionChromeOpacity }]}
        pointerEvents={isArrivePhase ? 'none' : 'auto'}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>×</Text>
        </TouchableOpacity>

        {/* Phase Indicator (Deep only) */}
        {config.phases.length > 1 && state.currentPhase && (
          <View style={styles.phaseIndicator}>
            <Text style={styles.phaseText}>
              Phase {state.currentPhaseIndex + 1} of {state.totalPhases}
            </Text>
          </View>
        )}

        {/* Center Content */}
        <View style={styles.centerContent}>
          {/* Charging Ring + Symbol */}
          <View style={styles.symbolWrapper}>
            {/* SVG Charging Ring */}
            <Svg
              width={RING_RADIUS * 2 + RING_STROKE_WIDTH * 4}
              height={RING_RADIUS * 2 + RING_STROKE_WIDTH * 4}
              style={styles.ringContainer}
            >
              {/* Background ring */}
              <Circle
                cx={RING_RADIUS + RING_STROKE_WIDTH * 2}
                cy={RING_RADIUS + RING_STROKE_WIDTH * 2}
                r={RING_RADIUS}
                stroke={`${colors.gold}30`}
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
              />

              {/* Seal progress ring (during seal gesture) */}
              {state.isSealPhase && !state.isSealComplete && (
                <Circle
                  cx={RING_RADIUS + RING_STROKE_WIDTH * 2}
                  cy={RING_RADIUS + RING_STROKE_WIDTH * 2}
                  r={RING_RADIUS}
                  stroke={colors.bronze}
                  strokeWidth={RING_STROKE_WIDTH + 2}
                  fill="none"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={sealStrokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${RING_RADIUS + RING_STROKE_WIDTH * 2}, ${
                    RING_RADIUS + RING_STROKE_WIDTH * 2
                  }`}
                />
              )}

              {/* Progress ring */}
              <AnimatedCircle
                cx={RING_RADIUS + RING_STROKE_WIDTH * 2}
                cy={RING_RADIUS + RING_STROKE_WIDTH * 2}
                r={RING_RADIUS}
                stroke={colors.gold}
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${RING_RADIUS + RING_STROKE_WIDTH * 2}, ${
                  RING_RADIUS + RING_STROKE_WIDTH * 2
                }`}
                opacity={ringOpacity}
              />
            </Svg>

            {/* Anchor Symbol (centered inside ring) */}
            <View style={styles.symbolContainer}>
              {anchor.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={{
                    width: SYMBOL_SIZE,
                    height: SYMBOL_SIZE,
                    borderRadius: 8,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <SigilSvg
                  xml={anchor.baseSigilSvg}
                  width={SYMBOL_SIZE}
                  height={SYMBOL_SIZE}
                />
              )}
            </View>
          </View>

          {/* Phase Title */}
          {state.currentPhase && (
            <Text style={styles.phaseTitle}>{state.currentPhase.title}</Text>
          )}

          {/* Instruction Text */}
          <Animated.View
            style={[
              styles.instructionContainer,
              { opacity: instructionFadeAnim },
            ]}
          >
            <Text style={styles.instructionText}>{displayedInstruction}</Text>
          </Animated.View>
        </View>

        {/* Bottom Section: Timer or Seal Gesture */}
        <View style={styles.bottomSection}>
          {state.isSealPhase && !state.isSealComplete ? (
            // Seal Gesture Prompt
            <TouchableOpacity
              style={styles.sealGesture}
              onPressIn={handleSealPressIn}
              onPressOut={handleSealPressOut}
              activeOpacity={1}
            >
              <Animated.View style={[styles.sealPrompt, { opacity: glowAnim }]}>
                <Text style={styles.sealText}>Press and hold to seal</Text>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            // Timer Display
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {state.formattedRemaining} remaining
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  sessionChrome: {
    flex: 1,
  },

  arriveContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 5,
  },

  arriveBreathHalo: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: (width * 0.72) / 2,
    borderWidth: 1,
    borderColor: `${colors.gold}30`,
    backgroundColor: `${colors.gold}08`,
  },

  arriveIntentionText: {
    ...typography.bodySerifItalic,
    fontSize: typography.sizes.h2 + 4,
    lineHeight: typography.lineHeights.h2 + 8,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  arriveBreathCue: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    textAlign: 'center',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },

  // ────────────────────────────────────────────────────────────
  // Back Button
  // ────────────────────────────────────────────────────────────
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? spacing.xxxl : spacing.lg,
    left: spacing.lg,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: `${colors.background.secondary}80`,
    zIndex: 10,
  },
  backIcon: {
    fontSize: 32,
    color: colors.text.tertiary,
    fontWeight: '300',
  },

  // ────────────────────────────────────────────────────────────
  // Phase Indicator
  // ────────────────────────────────────────────────────────────
  phaseIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? spacing.xxxl : spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.background.secondary}80`,
    borderRadius: 16,
    zIndex: 10,
  },
  phaseText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },

  // ────────────────────────────────────────────────────────────
  // Center Content
  // ────────────────────────────────────────────────────────────
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  symbolWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },

  ringContainer: {
    position: 'absolute',
  },

  symbolContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  phaseTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  instructionContainer: {
    paddingHorizontal: spacing.lg,
    minHeight: 80,
    justifyContent: 'center',
  },

  instructionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },

  // ────────────────────────────────────────────────────────────
  // Bottom Section
  // ────────────────────────────────────────────────────────────
  bottomSection: {
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },

  timerContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },

  timerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Seal Gesture
  // ────────────────────────────────────────────────────────────
  sealGesture: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sealPrompt: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.gold}20`,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 12,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },

  sealText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    textAlign: 'center',
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
