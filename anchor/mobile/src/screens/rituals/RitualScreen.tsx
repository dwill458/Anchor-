/**
 * Anchor App - Ritual Screen
 *
 * Reusable immersive ritual screen for both quick and deep charge.
 * Keeps existing ritual behavior while upgrading the surface language.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRitualController } from '@/hooks/useRitualController';
import { getRitualConfig } from '@/config/ritualConfigs';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg, OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { logger } from '@/utils/logger';
import { RitualScaffold } from './components/RitualScaffold';
import { RitualTopBar } from './components/RitualTopBar';
import { InstructionGlassCard } from './components/InstructionGlassCard';
import { ProgressHaloRing } from './components/ProgressHaloRing';
import { TIMING, EASING } from './utils/transitionConstants';
import * as Speech from 'expo-speech';

const { width } = Dimensions.get('window');

const SYMBOL_SIZE = Math.min(width * 0.54, 220);
const RING_RADIUS = 124;
const RING_STROKE_WIDTH = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type RitualRouteProp = RouteProp<RootStackParamList, 'Ritual'>;
type RitualNavigationProp = StackNavigationProp<RootStackParamList, 'Ritual'>;

export const RitualScreen: React.FC = () => {
  const navigation = useNavigation<RitualNavigationProp>();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<RitualRouteProp>();
  const { anchorId, ritualType, durationSeconds, mantraAudioEnabled, returnTo } = route.params;
  const isMountedRef = useRef(true);
  const isCompletingRef = useRef(false);
  const mantraIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const { soundEffectsEnabled } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  // Keep this config generation before hook initialization so initial UI text is stable.
  const config = getRitualConfig(ritualType, durationSeconds);

  // Animated values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const ringOpacityAnim = useRef(new Animated.Value(0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const phaseIndicatorOpacityAnim = useRef(new Animated.Value(0)).current;
  const instructionContainerOpacityAnim = useRef(new Animated.Value(0)).current;
  const bottomSectionOpacityAnim = useRef(new Animated.Value(0)).current;

  const instructionFadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedInstruction, setDisplayedInstruction] = useState(
    config.phases[0]?.instructions[0] ?? ''
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    return () => subscription.remove();
  }, []);

  // Ritual controller
  const { state, actions } = useRitualController({
    config,
    onComplete: handleRitualComplete,
    onPhaseChange: handlePhaseChange,
    onSealComplete: handleSealComplete,
  });

  useEffect(() => {
    if (reduceMotionEnabled) {
      ringOpacityAnim.setValue(1);
      phaseIndicatorOpacityAnim.setValue(1);
      instructionContainerOpacityAnim.setValue(1);
      bottomSectionOpacityAnim.setValue(1);
      return;
    }

    Animated.stagger(TIMING.RITUAL_ENTRY_STAGGER, [
      Animated.timing(ringOpacityAnim, {
        toValue: 1,
        duration: TIMING.RITUAL_ENTRY_FADE,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }),
      Animated.timing(phaseIndicatorOpacityAnim, {
        toValue: 1,
        duration: TIMING.RITUAL_ENTRY_FADE,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }),
      Animated.timing(instructionContainerOpacityAnim, {
        toValue: 1,
        duration: TIMING.RITUAL_ENTRY_FADE,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }),
      Animated.timing(bottomSectionOpacityAnim, {
        toValue: 1,
        duration: TIMING.RITUAL_ENTRY_FADE,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    reduceMotionEnabled,
    ringOpacityAnim,
    phaseIndicatorOpacityAnim,
    instructionContainerOpacityAnim,
    bottomSectionOpacityAnim,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    actions.start();

    return () => {
      isMountedRef.current = false;
      actions.reset();
    };
  }, [actions.start, actions.reset]);

  const speakMantra = useCallback(() => {
    if (!anchor) return;

    const phrase = (anchor.mantraText ?? anchor.intentionText).trim();
    if (!phrase) return;

    Speech.stop();
    Speech.speak(phrase, {
      language: 'en-US',
      rate: 0.43,
      pitch: 0.8,
    });
  }, [anchor]);

  useEffect(() => {
    if (!mantraAudioEnabled || !soundEffectsEnabled || !anchor || !state.isActive || state.isComplete) {
      if (mantraIntervalRef.current) {
        clearInterval(mantraIntervalRef.current);
        mantraIntervalRef.current = null;
      }
      Speech.stop();
      return;
    }

    speakMantra();
    mantraIntervalRef.current = setInterval(() => {
      speakMantra();
    }, 13000);

    return () => {
      if (mantraIntervalRef.current) {
        clearInterval(mantraIntervalRef.current);
        mantraIntervalRef.current = null;
      }
      Speech.stop();
    };
  }, [
    anchor,
    mantraAudioEnabled,
    soundEffectsEnabled,
    speakMantra,
    state.isActive,
    state.isComplete,
  ]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: state.progress,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [state.progress, progressAnim]);

  useEffect(() => {
    if (state.isSealPhase && !state.isSealComplete) {
      if (reduceMotionEnabled) {
        glowAnim.setValue(1);
        return;
      }

      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 950,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 950,
            useNativeDriver: true,
          }),
        ])
      );

      glowLoop.start();

      return () => glowLoop.stop();
    }

    glowAnim.setValue(0);
  }, [state.isSealPhase, state.isSealComplete, reduceMotionEnabled, glowAnim]);

  useEffect(() => {
    if (state.currentInstruction === displayedInstruction) return;

    if (reduceMotionEnabled) {
      setDisplayedInstruction(state.currentInstruction);
      return;
    }

    Animated.timing(instructionFadeAnim, {
      toValue: 0,
      duration: 230,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedInstruction(state.currentInstruction);

      Animated.timing(instructionFadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    });
  }, [
    state.currentInstruction,
    displayedInstruction,
    reduceMotionEnabled,
    instructionFadeAnim,
  ]);

  function handlePhaseChange(phase: any, index: number) {
    logger.info('Ritual phase change', { index: index + 1, title: phase.title });
  }

  function handleRitualComplete() {
    logger.info('Ritual time complete, waiting for seal...');
  }

  async function handleSealComplete() {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    try {
      let chargeType: 'initial_quick' | 'initial_deep' | 'recharge' = 'initial_quick';

      if (ritualType === 'quick' || ritualType === 'focus') {
        chargeType = 'initial_quick';
      } else if (ritualType === 'deep' || ritualType === 'ritual') {
        chargeType = 'initial_deep';
      }

      const token = await AuthService.getIdToken();
      const isMockToken = typeof token === 'string' && token.startsWith('mock-');
      let backendSyncFailed = false;

      if (!isMockToken) {
        try {
          await apiClient.post(`/api/anchors/${anchorId}/charge`, {
            chargeType,
            durationSeconds: config.totalDurationSeconds,
          });
        } catch (syncError) {
          backendSyncFailed = true;
          logger.warn('Charge sync failed, saving locally only', syncError);
        }
      }

      await updateAnchor(anchorId, {
        isCharged: true,
        chargedAt: new Date(),
      });

      if (backendSyncFailed && isMountedRef.current) {
        Alert.alert('Saved Locally', 'Anchor charge saved. Sync will retry later.');
      } else if (isMockToken && isMountedRef.current) {
        Alert.alert('Saved, Sync Pending', 'Running in mock auth mode. Charge is saved locally.');
      }

      if (isMountedRef.current) {
        navigation.replace('ChargeComplete', { anchorId, returnTo });
      }
    } catch (error) {
      isCompletingRef.current = false;
      logger.warn('Failed to update anchor locally', error);
      Alert.alert('Error', 'Failed to save charge. Please try again.');
    }
  }

  function handleBack() {
    Alert.alert('Exit Ritual?', 'Your progress will be lost if you exit now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: () => {
          if (returnTo === 'practice') {
            navigateToPractice();
          } else if (returnTo === 'detail') {
            navigation.navigate('AnchorDetail', { anchorId });
          } else {
            navigation.navigate('Vault');
          }
        },
      },
    ]);
  }

  const handleSealPressIn = () => {
    if (state.isSealPhase && !state.isSealComplete) {
      actions.startSeal();
      Animated.timing(pressScaleAnim, {
        toValue: 0.98,
        duration: 80,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleSealPressOut = () => {
    if (!state.isSealComplete) {
      actions.cancelSeal();
      Animated.timing(pressScaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }).start();
    }
  };

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const ringOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });

  const sealScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const ringScale = ringOpacityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  const sealStrokeDashoffset =
    RING_CIRCUMFERENCE - RING_CIRCUMFERENCE * state.sealProgress;

  const phaseLabel =
    config.phases.length > 1 && state.currentPhase
      ? `Phase ${state.currentPhaseIndex + 1} of ${state.totalPhases}`
      : undefined;

  if (!anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Anchor not found. Returning to vault...</Text>
        </View>
      </RitualScaffold>
    );
  }

  return (
    <RitualScaffold>
      <View style={styles.container}>
        <Animated.View style={{ opacity: phaseIndicatorOpacityAnim }}>
          <RitualTopBar onBack={handleBack} phaseLabel={phaseLabel} />
        </Animated.View>

        <View style={styles.centerContent}>
          <Animated.View
            style={[
              styles.symbolWrapper,
              { opacity: ringOpacityAnim, transform: [{ scale: ringScale }, { scale: pressScaleAnim }] },
            ]}
          >
            <Pressable
              onPressIn={handleSealPressIn}
              onPressOut={handleSealPressOut}
              disabled={!state.isSealPhase || state.isSealComplete}
              style={{ alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={styles.premiumGlowLayer}>
                <PremiumAnchorGlow
                  size={SYMBOL_SIZE}
                  state="active"
                  variant="ritual"
                  reduceMotionEnabled={reduceMotionEnabled}
                />
              </View>

              <ProgressHaloRing
                radius={RING_RADIUS}
                strokeWidth={RING_STROKE_WIDTH}
                circumference={RING_CIRCUMFERENCE}
                progressDashoffset={strokeDashoffset}
                progressOpacity={ringOpacity}
                showSeal={state.isSealPhase && !state.isSealComplete}
                sealDashoffset={sealStrokeDashoffset}
              />

              <View style={styles.symbolContainer}>
                {anchor.enhancedImageUrl ? (
                  <OptimizedImage
                    uri={anchor.enhancedImageUrl}
                    style={styles.symbolImage}
                    resizeMode="cover"
                  />
                ) : (
                  <SigilSvg xml={anchor.baseSigilSvg} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />
                )}
              </View>
            </Pressable>
          </Animated.View>

          {state.currentPhase ? (
            <Text style={styles.phaseTitle}>{state.currentPhase.title}</Text>
          ) : null}

          <Animated.View
            style={[
              styles.instructionContainer,
              {
                opacity: Animated.multiply(
                  instructionFadeAnim,
                  instructionContainerOpacityAnim
                ),
              },
            ]}
          >
            {state.isSealPhase ? (
              <Text style={styles.sealPhaseInstruction}>{displayedInstruction}</Text>
            ) : (
              <InstructionGlassCard text={displayedInstruction} />
            )}
          </Animated.View>
        </View>

        <Animated.View style={[styles.bottomSection, { opacity: bottomSectionOpacityAnim }]}>
          {!state.isSealPhase && (
            <View style={styles.timerPill}>
              <Text style={styles.timerText}>{state.formattedRemaining} remaining</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  symbolWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  premiumGlowLayer: {
    position: 'absolute',
    width: SYMBOL_SIZE * 1.72,
    height: SYMBOL_SIZE * 1.72,
  },
  symbolContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolImage: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
  },
  phaseTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 0.4,
  },
  instructionContainer: {
    width: '100%',
    maxWidth: 460,
    minHeight: 86,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  timerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  sealPhaseInstruction: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: typography.lineHeights.h3,
  },
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
