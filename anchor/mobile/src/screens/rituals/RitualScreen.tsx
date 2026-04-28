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
  Easing,
  Alert,
  Dimensions,
  AccessibilityInfo,
  Platform,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
} from 'react-native-svg';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
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
import { ConfirmModal } from './components/ConfirmModal';
import { CompletionModal } from './components/CompletionModal';
import { TIMING, EASING } from './utils/transitionConstants';
import * as Speech from 'expo-speech';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import { useNotificationController } from '@/hooks/useNotificationController';

const { width } = Dimensions.get('window');

const SYMBOL_SIZE = Math.min(width * 0.54, 220);
const RING_RADIUS = 124;
const RING_STROKE_WIDTH = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
type EmberParticle = {
  x: number;
  bottom: number;
  size: number;
  duration: number;
  drift: number;
  delay: number;
  isEmber: boolean;
};

const DEEP_PHASE_BREATHS: Record<string, { inhale: number; hold: number; exhale: number }> = {
  breathwork: { inhale: 4, hold: 2, exhale: 6 },
  'repeat intention': { inhale: 4, hold: 0, exhale: 6 },
  visualization: { inhale: 5, hold: 0, exhale: 5 },
  transfer: { inhale: 4, hold: 2, exhale: 4 },
  seal: { inhale: 4, hold: 0, exhale: 4 },
};
const DEEP_OUTER_ORB_DOTS = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 118,
    y: Math.sin(angle) * 118,
    opacity: 0.32 + (index % 6) * 0.08,
    size: 2.4,
  };
});
const DEEP_INNER_ORB_DOTS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 88,
    y: Math.sin(angle) * 88,
    opacity: 0.36 + (index % 5) * 0.1,
    size: 1.8,
  };
});

type RitualRouteProp = RouteProp<RootStackParamList, 'Ritual'>;
type RitualNavigationProp = StackNavigationProp<RootStackParamList, 'Ritual'>;

const formatMSS = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatLandingTime = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}M ${String(secs).padStart(2, '0')}S`;
};

const getDeepBreathCue = (phaseTitle: string | undefined, phaseElapsed: number) => {
  const key = phaseTitle?.toLowerCase().trim() ?? '';
  const pattern = DEEP_PHASE_BREATHS[key];
  if (!pattern) {
    return '';
  }

  const cycleLength = pattern.inhale + pattern.hold + pattern.exhale;
  if (cycleLength <= 0) {
    return '';
  }

  const cycleTime = Math.max(0, phaseElapsed % cycleLength);
  if (cycleTime < pattern.inhale) {
    return 'Breathe in';
  }
  if (cycleTime < pattern.inhale + pattern.hold) {
    return 'Hold';
  }
  return 'Breathe out';
};

const makeDeepEmbers = (count: number): EmberParticle[] =>
  Array.from({ length: count }, () => ({
    x: 4 + Math.random() * 92,
    bottom: Math.random() * 20,
    size: 1.5 + Math.random() * 2.5,
    duration: 5000 + Math.random() * 9000,
    drift: (Math.random() - 0.5) * 50,
    delay: -(Math.random() * 12000),
    isEmber: Math.random() > 0.38,
  }));

const DeepEmberDot: React.FC<{ particle: EmberParticle; reduceMotionEnabled: boolean }> = ({
  particle,
  reduceMotionEnabled,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      anim.setValue(0.45);
      return;
    }

    if (particle.delay < 0) {
      anim.setValue((Math.abs(particle.delay) / particle.duration) % 1);
    }

    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: particle.duration,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [anim, particle.delay, particle.duration, reduceMotionEnabled]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -300],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, particle.drift],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 0.7, 0.1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.deepEmberDot,
        {
          left: `${particle.x}%`,
          bottom: `${particle.bottom}%`,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.isEmber ? '#C8581A' : '#D4AF37',
          opacity,
          transform: [{ translateY }, { translateX }],
          ...(Platform.OS === 'ios'
            ? {
              shadowColor: particle.isEmber ? '#C8581A' : '#D4AF37',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 3,
            }
            : null),
        },
      ]}
    />
  );
};

export const RitualScreen: React.FC = () => {
  const navigation = useNavigation<RitualNavigationProp>();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<RitualRouteProp>();
  const { anchorId, ritualType, durationSeconds, mantraAudioEnabled, returnTo } = route.params;
  const isMountedRef = useRef(true);
  const isCompletingRef = useRef(false);
  const exitingRef = useRef(false);
  const mantraIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const enqueuePendingFirstAnchorMutation = useAuthStore(
    (state) => state.enqueuePendingFirstAnchorMutation
  );
  const recordSession = useSessionStore((state) => state.recordSession);
  const soundEffectsEnabled = useSettingsStore((state) => state.soundEffectsEnabled);
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const primeSessionDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const primeSessionAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'silent');
  const reduceIntentionVisibility = useSettingsStore((state) => state.reduceIntentionVisibility ?? false);
  const { handlePrimeComplete } = useNotificationController();
  const anchor = getAnchorById(anchorId);
  const sigilSvg = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const isFirstPrimeForAnchor =
    !anchor?.isCharged &&
    !anchor?.firstChargedAt &&
    (anchor?.chargeCount ?? 0) === 0;

  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  // Keep this config generation before hook initialization so initial UI text is stable.
  const resolvedDurationSeconds =
    durationSeconds ??
    ((ritualType === 'focus' || ritualType === 'quick')
      ? focusSessionDuration
      : primeSessionDuration);
  const config = getRitualConfig(ritualType, resolvedDurationSeconds);
  const isDeepRitual = ritualType === 'ritual' || ritualType === 'deep';
  const [isLanding, setIsLanding] = useState(isDeepRitual);

  // Animated values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const ringOpacityAnim = useRef(new Animated.Value(0)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const phaseIndicatorOpacityAnim = useRef(new Animated.Value(0)).current;
  const instructionContainerOpacityAnim = useRef(new Animated.Value(0)).current;
  const bottomSectionOpacityAnim = useRef(new Animated.Value(0)).current;
  const deepPhaseFlashAnim = useRef(new Animated.Value(0)).current;
  const deepOrbitSpinA = useRef(new Animated.Value(0)).current;
  const deepOrbitSpinB = useRef(new Animated.Value(0)).current;
  const deepPulseA = useRef(new Animated.Value(0)).current;
  const deepPulseB = useRef(new Animated.Value(0)).current;
  const deepHaloBreath = useRef(new Animated.Value(0)).current;
  const deepSigilFloat = useRef(new Animated.Value(0)).current;
  const sealEntranceAnim = useRef(new Animated.Value(0)).current;
  const sealPulseAnim = useRef(new Animated.Value(0)).current;
  const regularRingSpinA = useRef(new Animated.Value(0)).current;
  const regularRingSpinB = useRef(new Animated.Value(0)).current;

  const instructionFadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedInstruction, setDisplayedInstruction] = useState(
    config.phases[0]?.instructions[0] ?? ''
  );
  const deepEmbers = useRef<EmberParticle[]>(makeDeepEmbers(22)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotionEnabled(v));
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isEnabled: boolean) => setReduceMotionEnabled(isEnabled)
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
    if (!isDeepRitual) {
      actions.start();
    }

    return () => {
      isMountedRef.current = false;
      actions.reset();
    };
  }, [actions.start, actions.reset, isDeepRitual]);

  const handleBeginPriming = () => {
    setIsLanding(false);
    actions.start();
  };

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
            duration: 1200,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
        ])
      );

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sealPulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          Animated.timing(sealPulseAnim, {
            toValue: 0,
            duration: 2000,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
        ])
      );

      const spinLoopA = Animated.loop(
        Animated.timing(regularRingSpinA, {
          toValue: 1,
          duration: 35000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      const spinLoopB = Animated.loop(
        Animated.timing(regularRingSpinB, {
          toValue: 1,
          duration: 50000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      Animated.timing(sealEntranceAnim, {
        toValue: 1,
        duration: 800,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }).start();

      glowLoop.start();
      pulseLoop.start();
      spinLoopA.start();
      spinLoopB.start();

      return () => {
        glowLoop.stop();
        pulseLoop.stop();
        spinLoopA.stop();
        spinLoopB.stop();
      };
    }

    sealEntranceAnim.setValue(0);
    glowAnim.setValue(0);
  }, [state.isSealPhase, state.isSealComplete, reduceMotionEnabled, glowAnim, sealPulseAnim, regularRingSpinA, regularRingSpinB, sealEntranceAnim]);

  useEffect(() => {
    if (state.currentInstruction === displayedInstruction) return;

    if (reduceMotionEnabled) {
      setDisplayedInstruction(state.currentInstruction);
      return;
    }

    Animated.timing(instructionFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedInstruction(state.currentInstruction);

      Animated.timing(instructionFadeAnim, {
        toValue: 1,
        duration: 400,
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

      let backendSyncFailed = false;

      if (isPendingFirstAnchor) {
        enqueuePendingFirstAnchorMutation({
          type: 'charge_anchor',
          tempAnchorId: anchorId,
          chargeType,
          durationSeconds: config.totalDurationSeconds,
          queuedAt: new Date().toISOString(),
        });
      } else {
        const token = await AuthService.getIdToken();
        const isMockToken =
          typeof token === 'string' && (token === 'mock-jwt-token' || token.startsWith('mock-'));

        if (isMockToken) {
          backendSyncFailed = false;
        } else {
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
      }

      const chargedAt = new Date();
      await updateAnchor(anchorId, {
        isCharged: true,
        chargedAt,
        firstChargedAt: anchor?.firstChargedAt ?? chargedAt,
        chargeCount: (anchor?.chargeCount ?? 0) + 1,
      });

      if (backendSyncFailed && isMountedRef.current) {
        Alert.alert('Saved Locally', 'Anchor charge saved. Sync will retry later.');
      }

      if (isMountedRef.current) {
        if (isFirstPrimeForAnchor) {
          exitingRef.current = true;
          navigation.replace('FirstPrimeComplete', {
            anchorId,
            sessionCount: 1,
            threadStrength: 1,
            durationSeconds: config.totalDurationSeconds,
            returnTo,
          });
        } else if (isDeepRitual) {
          setShowCompletion(true);
        } else {
          exitingRef.current = true;
          navigation.replace('ChargeComplete', {
            anchorId,
            durationSeconds: config.totalDurationSeconds,
            returnTo,
          });
        }
      }
    } catch (error) {
      isCompletingRef.current = false;
      logger.warn('Failed to update anchor locally', error);
      Alert.alert('Error', 'Failed to save charge. Please try again.');
    }
  }

  function handleBack() {
    if (state.isComplete || state.isSealComplete) {
      exitRitual();
      return;
    }
    setShowExitWarning(true);
  }

  const exitRitual = useCallback(() => {
    exitingRef.current = true;
    setShowExitWarning(false);

    if (returnTo === 'practice') {
      const nav = navigation as any;
      if (typeof nav.popToTop === 'function') {
        nav.popToTop();
      } else {
        navigateToVaultDestination(navigation);
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail', { anchorId });
      return;
    }

    navigateToVaultDestination(navigation);
  }, [anchorId, navigateToPractice, navigation, returnTo]);

  const handleCompletionDone = useCallback(async (reflectionWord?: string) => {
    setShowCompletion(false);
    exitingRef.current = true;

    recordSession({
      anchorId,
      type: 'reinforce',
      durationSeconds: config.totalDurationSeconds,
      mode: primeSessionAudio,
      completedAt: new Date().toISOString(),
      reflectionWord,
    });

    await handlePrimeComplete();
    exitRitual();
  }, [anchorId, config.totalDurationSeconds, primeSessionAudio, recordSession, handlePrimeComplete, exitRitual]);

  useEffect(() => {
    const nav = navigation as any;
    if (typeof nav.addListener !== 'function') {
      return () => undefined;
    }

    const unsubscribe = nav.addListener('beforeRemove', (event: any) => {
      if (exitingRef.current || state.isComplete || state.isSealComplete) return;
      event.preventDefault();
      setShowExitWarning(true);
    });

    return unsubscribe;
  }, [navigation, state.isComplete, state.isSealComplete]);

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
  const activePhaseIndex = state.isComplete
    ? Math.max(0, state.totalPhases - 1)
    : Math.max(0, state.currentPhaseIndex);
  const phaseLabelForDeep = `Phase ${Math.min(activePhaseIndex + 1, state.totalPhases)} of ${state.totalPhases}`;
  const deepPhaseTitle =
    state.currentPhase?.title
    ?? config.phases[state.totalPhases - 1]?.title
    ?? 'Seal';
  const deepPhaseName = deepPhaseTitle.toUpperCase();
  const deepInstructionText = state.isSealPhase
    ? 'Hold your Anchor to seal it in.'
    : displayedInstruction;
  const deepBreathCue = state.isSealPhase
    ? (state.sealProgress > 0 ? 'Hold...' : 'Press and hold to seal')
    : getDeepBreathCue(state.currentPhase?.title, state.phaseElapsed);
  const currentPhaseDuration = state.currentPhase?.durationSeconds ?? 1;
  const phaseRemaining = state.isComplete
    ? 0
    : Math.max(0, currentPhaseDuration - state.phaseElapsed);
  const phaseProgress = state.isComplete
    ? 1
    : Math.min(Math.max(state.phaseElapsed / currentPhaseDuration, 0), 1);
  const deepPhaseTime = formatMSS(phaseRemaining);
  const deepTotalTime = formatMSS(state.remainingSeconds);
  const deepPauseLabel = state.isActive ? 'Pause' : 'Resume';
  const deepPhaseProgress = config.phases.map((phase, index) => {
    if (state.isComplete) {
      return 1;
    }
    if (index < activePhaseIndex) {
      return 1;
    }
    if (index > activePhaseIndex) {
      return 0;
    }
    if (phase.durationSeconds <= 0) {
      return 0;
    }
    return Math.min(Math.max(state.phaseElapsed / phase.durationSeconds, 0), 1);
  });
  const deepOrbitRotateA = deepOrbitSpinA.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const deepOrbitRotateB = deepOrbitSpinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const deepPulseAOpacity = deepPulseA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.08, 0.24, 0.08],
  });
  const deepPulseAScale = deepPulseA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.03, 1],
  });
  const deepPulseBOpacity = deepPulseB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.13, 0.39, 0.13],
  });
  const deepPulseBScale = deepPulseB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.03, 1],
  });
  const deepHaloScale = deepHaloBreath.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  });
  const deepHaloOpacity = deepHaloBreath.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.85, 1, 0.85],
  });
  const deepSigilTranslateY = deepSigilFloat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -4, 0],
  });
  const deepSigilScale = deepSigilFloat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.02, 1],
  });
  const deepAuraScale = deepPulseA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.9, 1.18, 0.9],
  });
  const deepAuraOpacity = deepPulseA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.75, 0.3],
  });
  const deepInnerAuraScale = deepPulseB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.94, 1.08, 0.94],
  });
  const deepInnerAuraOpacity = deepPulseB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.16, 0.36, 0.16],
  });
  const deepOuterOrbOpacity = deepPulseA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.65, 1, 0.65],
  });
  const deepInnerOrbOpacity = deepPulseB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.62, 1, 0.62],
  });

  useEffect(() => {
    if (!isDeepRitual || reduceMotionEnabled || !isReady) {
      deepOrbitSpinA.setValue(0);
      deepOrbitSpinB.setValue(0);
      deepPulseA.setValue(0);
      deepPulseB.setValue(0);
      deepHaloBreath.setValue(0);
      deepSigilFloat.setValue(0);
      return;
    }

    const orbitALoop = Animated.loop(
      Animated.timing(deepOrbitSpinA, {
        toValue: 1,
        duration: 60000,
        useNativeDriver: true,
      })
    );
    const orbitBLoop = Animated.loop(
      Animated.timing(deepOrbitSpinB, {
        toValue: 1,
        duration: 45000,
        useNativeDriver: true,
      })
    );
    const pulseALoop = Animated.loop(
      Animated.timing(deepPulseA, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    );
    const pulseBLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(deepPulseB, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    );
    const haloLoop = Animated.loop(
      Animated.timing(deepHaloBreath, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    );
    const sigilLoop = Animated.loop(
      Animated.timing(deepSigilFloat, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    );
    orbitALoop.start();
    orbitBLoop.start();
    pulseALoop.start();
    pulseBLoop.start();
    haloLoop.start();
    sigilLoop.start();

    return () => {
      orbitALoop.stop();
      orbitBLoop.stop();
      pulseALoop.stop();
      pulseBLoop.stop();
      haloLoop.stop();
      sigilLoop.stop();
    };
  }, [
    deepHaloBreath,
    deepOrbitSpinA,
    deepOrbitSpinB,
    deepPulseA,
    deepPulseB,
    deepSigilFloat,
    isDeepRitual,
    reduceMotionEnabled,
  ]);

  const previousPhaseIndexRef = useRef(activePhaseIndex);
  useEffect(() => {
    if (!isDeepRitual) {
      previousPhaseIndexRef.current = activePhaseIndex;
      return;
    }

    if (previousPhaseIndexRef.current !== activePhaseIndex && previousPhaseIndexRef.current >= 0) {
      deepPhaseFlashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(deepPhaseFlashAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(deepPhaseFlashAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }

    previousPhaseIndexRef.current = activePhaseIndex;
  }, [activePhaseIndex, deepPhaseFlashAnim, isDeepRitual]);

  const handleDeepPauseToggle = () => {
    if (state.isComplete || state.isSealComplete) {
      return;
    }
    if (state.isActive) {
      actions.pause();
    } else {
      actions.resume();
    }
  };

  const deepSealCircumference = 2 * Math.PI * 154;
  const deepSealDashoffset = deepSealCircumference * (1 - state.sealProgress);

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
    <RitualScaffold showOrbs={!isDeepRitual} overlayOpacity={isDeepRitual ? 0 : 0.45}>
      <View style={styles.container}>
        {isDeepRitual ? (
          <>
            <View pointerEvents="none" style={styles.deepBackgroundLayer}>
              <LinearGradient
                colors={['#2A1008', '#0E0A04', '#050309']}
                locations={[0, 0.42, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                style={[
                  styles.deepOrbOne,
                  { transform: [{ translateX: deepSigilTranslateY }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.deepOrbTwo,
                  { transform: [{ translateY: deepSigilTranslateY }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.deepOrbThree,
                  { transform: [{ translateY: deepSigilTranslateY }] },
                ]}
              />
            </View>

            <View pointerEvents="none" style={styles.deepEmbersLayer}>
              {isReady && deepEmbers.map((particle, index) => (
                <DeepEmberDot
                  key={`ember-dot-${index}`}
                  particle={particle}
                  reduceMotionEnabled={reduceMotionEnabled}
                />
              ))}
            </View>

            {isLanding ? (
              <View style={styles.landingContent}>
                <View style={styles.deepHeaderRow}>
                  <TouchableOpacity
                    onPress={handleBack}
                    activeOpacity={0.82}
                    style={styles.deepCloseButton}
                    accessibilityRole="button"
                    accessibilityLabel="Exit ritual"
                  >
                    <Text style={styles.deepCloseIcon}>×</Text>
                  </TouchableOpacity>
                  <Text style={styles.landingTopBarTitle}>A N C H O R</Text>
                  <View style={styles.deepHeaderSpacer} />
                </View>

                <View style={styles.landingCenterContent}>
                  <Text style={styles.landingTitle}>DEEP PRIMING</Text>
                  <Text style={styles.landingTimeText}>{formatLandingTime(config.totalDurationSeconds)}</Text>

                  <View style={styles.landingSigilWrapper}>
                    <Animated.View style={[styles.deepOrbitSolid, { transform: [{ rotate: deepOrbitRotateA }] }]} />
                    <Animated.View style={[styles.deepOrbitDashOuter, { transform: [{ rotate: deepOrbitRotateB }] }]} />
                    <Animated.View style={[styles.deepOrbitDotOuter, { transform: [{ rotate: deepOrbitRotateA }] }]} />
                    <Animated.View style={[styles.deepOrbitDashInner, { transform: [{ rotate: deepOrbitRotateB }] }]} />
                    
                    <Animated.View
                      style={[
                        styles.deepSigilContainer,
                        { transform: [{ translateY: deepSigilTranslateY }] },
                      ]}
                    >
                      <LinearGradient
                        colors={['#F6EFD8', '#E7D8AE', '#B99654']}
                        start={{ x: 0.28, y: 0.18 }}
                        end={{ x: 0.88, y: 0.96 }}
                        style={StyleSheet.absoluteFill}
                      />
                      {!anchor.enhancedImageUrl ? (
                        <View pointerEvents="none" style={styles.deepSigilEtchLayer}>
                          {[30, 48, 66, 84].map((ringSize) => (
                            <View
                              key={`etch-ring-${ringSize}`}
                              style={[
                                styles.deepSigilEtchRing,
                                {
                                  width: ringSize * 2,
                                  height: ringSize * 2,
                                  borderRadius: ringSize,
                                },
                              ]}
                            />
                          ))}
                        </View>
                      ) : null}
                      {anchor.enhancedImageUrl ? (
                        <OptimizedImage
                          uri={anchor.enhancedImageUrl}
                          style={[styles.symbolImage, styles.deepSigilImage]}
                          resizeMode="cover"
                        />
                      ) : (
                        <SigilSvg xml={sigilSvg} width={198} height={198} />
                      )}
                    </Animated.View>
                  </View>

                  <View style={styles.landingTimelineRow}>
                    {config.phases.map((p, i) => (
                      <View key={i} style={styles.landingTimelineBox}>
                        <Text style={styles.landingTimelineNum}>0{i + 1}</Text>
                        <Text style={styles.landingTimelineText}>{p.title}</Text>
                      </View>
                    ))}
                  </View>

                  {!reduceIntentionVisibility && anchor.intentionText ? (
                    <View style={styles.landingIntentionWrap}>
                      <Text style={styles.landingIntentionLabel}>INTENTION</Text>
                      <Text style={styles.landingIntentionText}>"{anchor.intentionText}"</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.landingBottomSection}>
                  <Pressable onPress={handleBeginPriming} style={styles.landingBeginBtn}>
                    <LinearGradient
                      colors={['#D4AF37', '#8a6f23']}
                      style={styles.landingBeginBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.landingBeginBtnText}>Begin priming  →</Text>
                    </LinearGradient>
                  </Pressable>
                  <Text style={styles.landingFooterText}>
                    {config.phases.length} phases. Close your eyes between guidance.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Animated.View pointerEvents="none" style={[styles.deepPhaseFlash, { opacity: deepPhaseFlashAnim }]} />

            <Animated.View style={[styles.deepPhaseTrackWrap, { opacity: phaseIndicatorOpacityAnim }]}>
              <View style={styles.deepPhaseTrackRow}>
                {deepPhaseProgress.map((progressValue, index) => (
                  <View key={`phase-segment-${index}`} style={styles.deepPhaseTrackSegment}>
                    {progressValue > 0 ? (
                      <LinearGradient
                        colors={index < activePhaseIndex ? ['#D4AF37', '#D4AF37'] : ['#C8581A', '#D4AF37']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={[styles.deepPhaseTrackFill, { width: `${Math.round(progressValue * 100)}%` }]}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            </Animated.View>

            <Animated.View style={[styles.deepHeaderRow, { opacity: phaseIndicatorOpacityAnim }]}>
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.82}
                style={styles.deepCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Exit ritual"
              >
                <Text style={styles.deepCloseIcon}>×</Text>
              </TouchableOpacity>
              <View style={styles.deepPhasePill}>
                <Text style={styles.deepPhasePillText}>{phaseLabelForDeep}</Text>
              </View>
              <View style={styles.deepHeaderSpacer} />
            </Animated.View>

            <View style={styles.deepPhaseLabelWrap}>
              <Text style={styles.deepPhaseLabelText}>{deepPhaseName}</Text>
              <LinearGradient
                colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.42)', 'rgba(212,175,55,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.deepPhaseDivider}
              />
            </View>

            <View style={styles.deepCenterContent}>
              <Animated.View
                style={[
                  styles.deepSymbolWrapper,
                  { opacity: ringOpacityAnim, transform: [{ scale: ringScale }, { scale: pressScaleAnim }] },
                ]}
              >
                <Pressable
                  onPressIn={handleSealPressIn}
                  onPressOut={handleSealPressOut}
                  disabled={!state.isSealPhase || state.isSealComplete}
                  style={styles.deepPressable}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.deepAuraOuter,
                      {
                        opacity: deepAuraOpacity,
                        transform: [{ scale: deepAuraScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.deepAuraInner,
                      {
                        opacity: deepInnerAuraOpacity,
                        transform: [{ scale: deepInnerAuraScale }],
                      },
                    ]}
                  />
                  <Animated.View style={[styles.deepOrbitSolid, { transform: [{ rotate: deepOrbitRotateA }] }]} />
                  <Animated.View style={[styles.deepOrbitDashOuter, { transform: [{ rotate: deepOrbitRotateB }] }]} />
                  <Animated.View style={[styles.deepOrbitDotOuter, { transform: [{ rotate: deepOrbitRotateA }] }]} />
                  <Animated.View style={[styles.deepOrbitDashInner, { transform: [{ rotate: deepOrbitRotateB }] }]} />
                  <Animated.View
                    style={[
                      styles.deepOrbRingOuter,
                      {
                        opacity: deepOuterOrbOpacity,
                        transform: [{ rotate: deepOrbitRotateA }],
                      },
                    ]}
                  >
                    {DEEP_OUTER_ORB_DOTS.map((dot, index) => (
                      <View
                        key={`outer-orb-dot-${index}`}
                        style={[
                          styles.deepOrbDotOuter,
                          {
                            top: 160 - dot.size / 2,
                            left: 160 - dot.size / 2,
                            width: dot.size,
                            height: dot.size,
                            borderRadius: dot.size / 2,
                            opacity: Math.min(1, dot.opacity),
                            transform: [{ translateX: dot.x }, { translateY: dot.y }],
                          },
                        ]}
                      />
                    ))}
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.deepOrbRingInner,
                      {
                        opacity: deepInnerOrbOpacity,
                        transform: [{ rotate: deepOrbitRotateB }],
                      },
                    ]}
                  >
                    {DEEP_INNER_ORB_DOTS.map((dot, index) => (
                      <View
                        key={`inner-orb-dot-${index}`}
                        style={[
                          styles.deepOrbDotInner,
                          {
                            top: 140 - dot.size / 2,
                            left: 140 - dot.size / 2,
                            width: dot.size,
                            height: dot.size,
                            borderRadius: dot.size / 2,
                            opacity: Math.min(1, dot.opacity),
                            transform: [{ translateX: dot.x }, { translateY: dot.y }],
                          },
                        ]}
                      />
                    ))}
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.deepPulseRingOuter,
                      {
                        opacity: deepPulseAOpacity,
                        transform: [{ scale: deepPulseAScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.deepPulseRingInner,
                      {
                        opacity: deepPulseBOpacity,
                        transform: [{ scale: deepPulseBScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.deepEmberHalo,
                      {
                        opacity: deepHaloOpacity,
                        transform: [{ scale: deepHaloScale }],
                      },
                    ]}
                  />

                  <View style={styles.premiumGlowLayer}>
                    <PremiumAnchorGlow
                      size={SYMBOL_SIZE}
                      state={state.isSealPhase ? 'charged' : 'active'}
                      variant="ritual"
                      reduceMotionEnabled={reduceMotionEnabled}
                    />
                  </View>

                  {state.isSealPhase ? (
                    <Svg width={340} height={340} style={styles.deepSealRingSvg}>
                      <Circle
                        cx={170}
                        cy={170}
                        r={154}
                        fill="none"
                        stroke="rgba(212,175,55,0.12)"
                        strokeWidth={2}
                      />
                      <Circle
                        cx={170}
                        cy={170}
                        r={154}
                        fill="none"
                        stroke="#D4AF37"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeDasharray={deepSealCircumference}
                        strokeDashoffset={deepSealDashoffset}
                        transform="rotate(-90 170 170)"
                      />
                    </Svg>
                  ) : null}

                  <Animated.View
                    style={[
                      styles.deepSigilContainer,
                      {
                        transform: [{ translateY: deepSigilTranslateY }, { scale: deepSigilScale }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#F6EFD8', '#E7D8AE', '#B99654']}
                      start={{ x: 0.28, y: 0.18 }}
                      end={{ x: 0.88, y: 0.96 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {!anchor.enhancedImageUrl ? (
                      <View pointerEvents="none" style={styles.deepSigilEtchLayer}>
                        {[30, 48, 66, 84].map((ringSize) => (
                          <View
                            key={`etch-ring-${ringSize}`}
                            style={[
                              styles.deepSigilEtchRing,
                              {
                                width: ringSize * 2,
                                height: ringSize * 2,
                                borderRadius: ringSize,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ) : null}
                    {anchor.enhancedImageUrl ? (
                      <OptimizedImage
                        uri={anchor.enhancedImageUrl}
                        style={[styles.symbolImage, styles.deepSigilImage]}
                        resizeMode="cover"
                      />
                    ) : (
                      <SigilSvg xml={sigilSvg} width={198} height={198} />
                    )}
                  </Animated.View>
                </Pressable>
              </Animated.View>

              {!reduceIntentionVisibility && anchor.intentionText ? (
                <View style={styles.deepIntentionWrap}>
                  <Text style={styles.deepIntentionLabel}>INTENTION</Text>
                  <Text style={styles.deepIntentionText}>{anchor.intentionText}</Text>
                </View>
              ) : null}

              <Animated.Text
                style={[
                  styles.deepBreathCue,
                  !state.isActive && !state.isSealPhase ? styles.deepBreathCuePaused : null,
                  { opacity: instructionContainerOpacityAnim },
                ]}
              >
                {deepBreathCue}
              </Animated.Text>

              <Animated.View
                style={[
                  styles.deepInstructionContainer,
                  {
                    opacity: Animated.multiply(
                      instructionFadeAnim,
                      instructionContainerOpacityAnim
                    ),
                  },
                ]}
              >
                <Text style={styles.deepInstructionText}>{deepInstructionText}</Text>
              </Animated.View>
            </View>

            <Animated.View style={[styles.deepBottomSection, { opacity: bottomSectionOpacityAnim }]}>
              {!state.isSealPhase && (
                <View style={styles.deepTimerRow}>
                  <View style={styles.deepPhaseTimerPill}>
                    <Text style={styles.deepTimerLabelEmber}>THIS PHASE</Text>
                    <Text style={styles.deepTimerDigitsEmber}>{deepPhaseTime}</Text>
                  </View>
                  <View style={styles.deepTotalTimerPill}>
                    <Text style={styles.deepTimerLabelGold}>TOTAL LEFT</Text>
                    <Text style={styles.deepTimerDigitsGold}>{deepTotalTime}</Text>
                  </View>
                </View>
              )}
              {!state.isSealPhase ? (
                <TouchableOpacity
                  onPress={handleDeepPauseToggle}
                  activeOpacity={0.8}
                  style={styles.deepPauseButton}
                  disabled={state.isSealComplete}
                >
                  <Text style={styles.deepPauseText}>{deepPauseLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
            </>
          )}
          </>
        ) : (
          <>
            <Animated.View style={{ opacity: phaseIndicatorOpacityAnim }}>
              <RitualTopBar onBack={handleBack} phaseLabel={phaseLabel} />
            </Animated.View>

            <View style={styles.centerContent}>
              <Animated.View
                style={[
                  styles.symbolWrapper,
                  {
                    opacity: ringOpacityAnim,
                    transform: [{ scale: ringScale }, { scale: pressScaleAnim }],
                  },
                ]}
              >
                <Pressable
                  onPressIn={handleSealPressIn}
                  onPressOut={handleSealPressOut}
                  disabled={!state.isSealPhase || state.isSealComplete}
                  style={{ alignItems: 'center', justifyContent: 'center' }}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.chargedDashedRing,
                      styles.chargedDashedRingInner,
                      {
                        opacity: sealEntranceAnim,
                        transform: [
                          { scale: Animated.add(1, Animated.multiply(sealPulseAnim, 0.05)) },
                          {
                            rotate: regularRingSpinA.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.chargedDashedRing,
                      styles.chargedDashedRingOuter,
                      {
                        opacity: Animated.multiply(sealEntranceAnim, 0.5),
                        transform: [
                          { scale: Animated.add(1, Animated.multiply(sealPulseAnim, 0.03)) },
                          {
                            rotate: regularRingSpinB.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-360deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  />

                  <View style={styles.premiumGlowLayer}>
                    <PremiumAnchorGlow
                      size={SYMBOL_SIZE}
                      state={state.isSealPhase ? 'charged' : 'active'}
                      variant="ritual"
                      reduceMotionEnabled={reduceMotionEnabled}
                    />
                  </View>

                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.chargedSealGlow,
                      {
                        opacity: Animated.multiply(sealEntranceAnim, Animated.add(0.4, Animated.multiply(glowAnim, 0.4))),
                        transform: [{ scale: Animated.add(1.1, Animated.multiply(glowAnim, 0.15)) }],
                      },
                    ]}
                  />

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
                      <SigilSvg xml={sigilSvg} width={SYMBOL_SIZE} height={SYMBOL_SIZE} />
                    )}
                  </View>
                </Pressable>
              </Animated.View>

              {state.currentPhase ? (
                <Text style={styles.phaseTitle}>{state.currentPhase.title}</Text>
              ) : null}

              {!reduceIntentionVisibility && anchor.intentionText ? (
                <View style={styles.intentionWrap}>
                  <View style={styles.intentionLabelChip}>
                    <Text style={styles.intentionLabelText}>INTENTION</Text>
                  </View>
                  <Text style={styles.intentionText}>{anchor.intentionText}</Text>
                </View>
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
                  <Animated.Text
                    style={[
                      styles.sealPhaseInstruction,
                      {
                        opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.3)),
                        transform: [{ translateY: Animated.multiply(glowAnim, -2) }],
                      },
                    ]}
                  >
                    {displayedInstruction}
                  </Animated.Text>
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
          </>
        )}
        <CompletionModal
          visible={showCompletion}
          sessionType="reinforce"
          anchor={anchor}
          onDone={handleCompletionDone}
        />
        <ConfirmModal
          visible={showExitWarning}
          title="Exit Ritual?"
          body="You will need to start over if you leave now."
          primaryCtaLabel="Exit"
          secondaryCtaLabel="Stay"
          onPrimary={exitRitual}
          onSecondary={() => setShowExitWarning(false)}
        />
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deepBackgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  deepOrbOne: {
    position: 'absolute',
    width: 340,
    height: 280,
    top: -56,
    left: -90,
    borderRadius: 170,
    backgroundColor: 'rgba(200,120,30,0.20)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 78,
  },
  deepOrbTwo: {
    position: 'absolute',
    width: 260,
    height: 260,
    right: -60,
    bottom: 76,
    borderRadius: 130,
    backgroundColor: 'rgba(180,60,20,0.18)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 70,
  },
  deepOrbThree: {
    position: 'absolute',
    width: 200,
    height: 200,
    left: '14%',
    top: '38%',
    borderRadius: 100,
    backgroundColor: 'rgba(80,30,100,0.12)',
    shadowColor: '#5C2A70',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 60,
  },
  deepEmbersLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  deepEmberDot: {
    position: 'absolute',
  },
  deepPhaseFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200,88,26,0.12)',
  },
  deepPhaseTrackWrap: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  deepPhaseTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deepPhaseTrackSegment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(245,240,232,0.08)',
    overflow: 'hidden',
  },
  deepPhaseTrackFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
  },
  deepHeaderRow: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deepCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,240,232,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
  },
  deepCloseIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: 'rgba(245,240,232,0.62)',
    fontWeight: '300',
    marginTop: -1,
  },
  deepPhasePill: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    backgroundColor: 'rgba(212,175,55,0.04)',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepPhasePillText: {
    fontSize: 10,
    fontFamily: typography.fonts.mono,
    color: 'rgba(245,240,232,0.7)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  deepHeaderSpacer: {
    width: 32,
    height: 32,
  },
  deepPhaseLabelWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  deepPhaseLabelText: {
    fontSize: 15,
    fontFamily: typography.fonts.heading,
    letterSpacing: 5,
    color: '#D4AF37',
    textTransform: 'uppercase',
  },
  deepPhaseDivider: {
    marginTop: 8,
    width: 120,
    height: 1,
  },
  deepCenterContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  deepSymbolWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 340,
    height: 340,
    marginBottom: 14,
  },
  deepPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepAuraOuter: {
    position: 'absolute',
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(212,175,55,0.14)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
  },
  deepAuraInner: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  deepOrbitSolid: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  deepOrbitDashOuter: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(212,175,55,0.22)',
  },
  deepOrbitDotOuter: {
    position: 'absolute',
    width: 308,
    height: 308,
    borderRadius: 154,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: 'rgba(212,175,55,0.15)',
  },
  deepOrbitDashInner: {
    position: 'absolute',
    width: 346,
    height: 346,
    borderRadius: 173,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,88,26,0.12)',
  },
  deepOrbRingOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
  },
  deepOrbRingInner: {
    position: 'absolute',
    width: 280,
    height: 280,
  },
  deepOrbDotOuter: {
    position: 'absolute',
    backgroundColor: '#FFD94D',
    shadowColor: '#F0D060',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  deepOrbDotInner: {
    position: 'absolute',
    backgroundColor: '#FFF08A',
    shadowColor: '#FFF08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 5,
  },
  deepPulseRingOuter: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  deepPulseRingInner: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
  },
  deepEmberHalo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,0,0,0)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 38,
    elevation: 12,
  },
  deepSealRingSvg: {
    position: 'absolute',
  },
  deepSigilContainer: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: '#E7D8AE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 10,
  },
  deepSigilEtchLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepSigilEtchRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(58,40,24,0.12)',
  },
  deepInstructionContainer: {
    width: '100%',
    maxWidth: 360,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deepBreathCue: {
    minHeight: 20,
    marginBottom: 18,
    fontSize: 16,
    fontFamily: typography.fonts.bodySerifItalic,
    color: 'rgba(245,240,232,0.72)',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  deepBreathCuePaused: {
    opacity: 0.35,
  },
  deepInstructionText: {
    color: 'rgba(245,240,232,0.92)',
    fontSize: 20,
    fontFamily: typography.fonts.bodySerifItalic,
    lineHeight: 29,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 20,
  },
  deepBottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    minHeight: 148,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  deepTimerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deepPhaseTimerPill: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,88,26,0.28)',
    backgroundColor: 'rgba(200,88,26,0.12)',
    alignItems: 'center',
  },
  deepTotalTimerPill: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(212,175,55,0.07)',
    alignItems: 'center',
  },
  deepTimerLabelEmber: {
    fontSize: 8,
    fontFamily: typography.fonts.mono,
    color: 'rgba(245,240,232,0.36)',
    letterSpacing: 2.6,
  },
  deepTimerLabelGold: {
    fontSize: 8,
    fontFamily: typography.fonts.mono,
    color: 'rgba(245,240,232,0.36)',
    letterSpacing: 2.6,
  },
  deepTimerDigitsEmber: {
    marginTop: 4,
    fontSize: 22,
    fontFamily: typography.fonts.mono,
    color: '#E8722A',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(200,88,26,0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  deepTimerDigitsGold: {
    marginTop: 4,
    fontSize: 22,
    fontFamily: typography.fonts.mono,
    color: '#F0D060',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(212,175,55,0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  deepPauseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.12)',
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: 'rgba(245,240,232,0.04)',
  },
  deepPauseText: {
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: 'rgba(245,240,232,0.72)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  deepSigilImage: {
    width: 198,
    height: 198,
    borderRadius: 99,
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
    fontSize: 22,
    fontFamily: typography.fonts.heading,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 1.2,
    lineHeight: 32,
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  chargedDashedRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    pointerEvents: 'none',
  },
  chargedDashedRingInner: {
    width: RING_RADIUS * 2 + 40,
    height: RING_RADIUS * 2 + 40,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  chargedDashedRingOuter: {
    width: RING_RADIUS * 2 + 80,
    height: RING_RADIUS * 2 + 80,
    borderColor: 'rgba(212,175,55,0.12)',
  },
  chargedSealGlow: {
    position: 'absolute',
    width: SYMBOL_SIZE * 1.5,
    height: SYMBOL_SIZE * 1.5,
    borderRadius: (SYMBOL_SIZE * 1.5) / 2,
    backgroundColor: 'rgba(212,175,55,0.06)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 20,
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
  intentionWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  intentionLabelChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    marginBottom: spacing.xs,
  },
  intentionLabelText: {
    fontSize: 9,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 2.5,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.bone,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 22,
  },
  deepIntentionWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  deepIntentionLabel: {
    fontSize: 8,
    fontFamily: typography.fonts.heading,
    color: 'rgba(212,175,55,0.5)',
    letterSpacing: 3,
    marginBottom: 4,
  },
  deepIntentionText: {
    fontSize: 15,
    fontFamily: 'CormorantGaramond_400Italic',
    color: 'rgba(245,240,232,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  landingContent: {
    flex: 1,
  },
  landingTopBarTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    letterSpacing: 6,
    color: 'rgba(245,240,232,0.8)',
    textAlign: 'center',
  },
  landingCenterContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
  },
  landingTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    color: '#D4AF37',
    letterSpacing: 4,
  },
  landingTimeText: {
    fontFamily: typography.fonts.mono,
    fontSize: 32,
    color: '#F6EFD8',
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  landingSigilWrapper: {
    width: 340,
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  landingTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
    paddingHorizontal: 16,
    width: '100%',
  },
  landingTimelineBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  landingTimelineNum: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    color: '#D4AF37',
    marginBottom: 4,
  },
  landingTimelineText: {
    fontFamily: typography.fonts.mono,
    fontSize: 7,
    color: 'rgba(245,240,232,0.6)',
    letterSpacing: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  landingIntentionWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  landingIntentionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: '#D4AF37',
    letterSpacing: 2,
    marginBottom: 8,
  },
  landingIntentionText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 18,
    color: '#F6EFD8',
    textAlign: 'center',
    lineHeight: 26,
  },
  landingBottomSection: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  landingBeginBtn: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 100,
    overflow: 'hidden',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    marginBottom: 16,
  },
  landingBeginBtnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingBeginBtnText: {
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1.5,
    color: '#080C10',
    textTransform: 'uppercase',
  },
  landingFooterText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    color: 'rgba(245,240,232,0.5)',
  },
});
