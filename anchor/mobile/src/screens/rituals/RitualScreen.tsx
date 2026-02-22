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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';
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
const DEEP_ARC_SIZE = 226;
const DEEP_TOTAL_ARC_R = 110;
const DEEP_PHASE_ARC_R = 104;
const DEEP_TOTAL_ARC_CIRC = 2 * Math.PI * DEEP_TOTAL_ARC_R;
const DEEP_PHASE_ARC_CIRC = 2 * Math.PI * DEEP_PHASE_ARC_R;

type EmberParticle = {
  x: number;
  bottom: number;
  size: number;
  duration: number;
  drift: number;
  delay: number;
  isEmber: boolean;
};

const DEEP_PHASE_SCRIPT = [
  { name: 'Breathwork', instruction: 'Slow inhale. Longer exhale.' },
  { name: 'Repeat Intention', instruction: 'Speak your intention with conviction.' },
  { name: 'Visualize', instruction: 'See yourself living this reality. Vividly.' },
  { name: 'Connect', instruction: 'Touch the symbol. Feel it become yours.' },
  { name: 'Hold & Seal', instruction: 'Still your mind. Let the anchor settle.' },
] as const;
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
  const mantraIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const { soundEffectsEnabled } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  // Keep this config generation before hook initialization so initial UI text is stable.
  const config = getRitualConfig(ritualType, durationSeconds);
  const isDeepRitual = ritualType === 'ritual' || ritualType === 'deep';

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
  const deepAccentGlow = useRef(new Animated.Value(0)).current;

  const instructionFadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedInstruction, setDisplayedInstruction] = useState(
    config.phases[0]?.instructions[0] ?? ''
  );
  const deepEmbers = useRef<EmberParticle[]>(makeDeepEmbers(22)).current;

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
  const deepScriptedPhase = DEEP_PHASE_SCRIPT[activePhaseIndex];
  const phaseLabelForDeep = `Phase ${Math.min(activePhaseIndex + 1, state.totalPhases)} of ${state.totalPhases}`;
  const deepPhaseTitle =
    deepScriptedPhase?.name
    ?? state.currentPhase?.title
    ?? config.phases[state.totalPhases - 1]?.title
    ?? 'Hold & Seal';
  const deepPhaseName = deepPhaseTitle.toUpperCase();
  const deepInstructionText = state.isSealPhase
    ? 'Touch and hold to seal.'
    : (deepScriptedPhase?.instruction ?? displayedInstruction);
  const currentPhaseDuration = state.currentPhase?.durationSeconds ?? 1;
  const phaseRemaining = state.isComplete
    ? 0
    : Math.max(0, currentPhaseDuration - state.phaseElapsed);
  const totalProgress = state.progress;
  const phaseProgress = state.isComplete
    ? 1
    : Math.min(Math.max(state.phaseElapsed / currentPhaseDuration, 0), 1);
  const totalDashOffset = DEEP_TOTAL_ARC_CIRC * (1 - totalProgress);
  const phaseDashOffset = DEEP_PHASE_ARC_CIRC * (1 - phaseProgress);
  const deepPhaseTime = formatMSS(phaseRemaining);
  const deepTotalTime = formatMSS(state.remainingSeconds);
  const deepPauseLabel = state.isActive ? '⏸  Pause' : '▶  Resume';
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
  const deepAccentOpacity = deepAccentGlow.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
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
    if (!isDeepRitual || reduceMotionEnabled) {
      deepOrbitSpinA.setValue(0);
      deepOrbitSpinB.setValue(0);
      deepPulseA.setValue(0);
      deepPulseB.setValue(0);
      deepHaloBreath.setValue(0);
      deepSigilFloat.setValue(0);
      deepAccentGlow.setValue(0.5);
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
    const accentLoop = Animated.loop(
      Animated.timing(deepAccentGlow, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    orbitALoop.start();
    orbitBLoop.start();
    pulseALoop.start();
    pulseBLoop.start();
    haloLoop.start();
    sigilLoop.start();
    accentLoop.start();

    return () => {
      orbitALoop.stop();
      orbitBLoop.stop();
      pulseALoop.stop();
      pulseBLoop.stop();
      haloLoop.stop();
      sigilLoop.stop();
      accentLoop.stop();
    };
  }, [
    deepAccentGlow,
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
                colors={['#1A0E04', '#0C1018', '#080B10']}
                locations={[0, 0.45, 1]}
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
              {deepEmbers.map((particle, index) => (
                <DeepEmberDot
                  key={`ember-dot-${index}`}
                  particle={particle}
                  reduceMotionEnabled={reduceMotionEnabled}
                />
              ))}
            </View>

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
                  <Animated.View style={[styles.deepOrbitDashOuter, { transform: [{ rotate: deepOrbitRotateA }] }]} />
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
                      state="active"
                      variant="ritual"
                      reduceMotionEnabled={reduceMotionEnabled}
                    />
                  </View>

                  <Svg width={DEEP_ARC_SIZE} height={DEEP_ARC_SIZE} style={styles.deepDualArcSvg}>
                    <Defs>
                      <SvgLinearGradient id="deepArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#C8581A" stopOpacity={0.4} />
                        <Stop offset="50%" stopColor="#D4AF37" stopOpacity={1} />
                        <Stop offset="100%" stopColor="#F0D060" stopOpacity={0.7} />
                      </SvgLinearGradient>
                    </Defs>
                    <Circle
                      cx={DEEP_ARC_SIZE / 2}
                      cy={DEEP_ARC_SIZE / 2}
                      r={DEEP_TOTAL_ARC_R}
                      fill="none"
                      stroke="rgba(212,175,55,0.08)"
                      strokeWidth={2}
                    />
                    <Circle
                      cx={DEEP_ARC_SIZE / 2}
                      cy={DEEP_ARC_SIZE / 2}
                      r={DEEP_TOTAL_ARC_R}
                      fill="none"
                      stroke="rgba(212,175,55,0.28)"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeDasharray={DEEP_TOTAL_ARC_CIRC}
                      strokeDashoffset={totalDashOffset}
                    />
                    <Circle
                      cx={DEEP_ARC_SIZE / 2}
                      cy={DEEP_ARC_SIZE / 2}
                      r={DEEP_PHASE_ARC_R}
                      fill="none"
                      stroke="rgba(212,175,55,0.06)"
                      strokeWidth={2}
                    />
                    <Circle
                      cx={DEEP_ARC_SIZE / 2}
                      cy={DEEP_ARC_SIZE / 2}
                      r={DEEP_PHASE_ARC_R}
                      fill="none"
                      stroke="url(#deepArcGradient)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeDasharray={DEEP_PHASE_ARC_CIRC}
                      strokeDashoffset={phaseDashOffset}
                    />
                  </Svg>

                  <Animated.View
                    style={[
                      styles.deepSigilContainer,
                      {
                        transform: [{ translateY: deepSigilTranslateY }, { scale: deepSigilScale }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#1C1000', '#0D0800']}
                      start={{ x: 0.4, y: 0.35 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {anchor.enhancedImageUrl ? (
                      <OptimizedImage
                        uri={anchor.enhancedImageUrl}
                        style={[styles.symbolImage, styles.deepSigilImage]}
                        resizeMode="cover"
                      />
                    ) : (
                      <SigilSvg xml={anchor.baseSigilSvg} width={198} height={198} />
                    )}
                  </Animated.View>
                </Pressable>
              </Animated.View>

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
                <View style={styles.deepInstructionCardWrap}>
                  <Animated.View style={[styles.deepInstructionAccent, { opacity: deepAccentOpacity }]} />
                  <InstructionGlassCard
                    text={deepInstructionText}
                    containerStyle={styles.deepInstructionCard}
                    textStyle={styles.deepInstructionText}
                  />
                </View>
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
        ) : (
          <>
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
          </>
        )}
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
    width: 320,
    height: 320,
    top: -60,
    left: -80,
    borderRadius: 160,
    backgroundColor: 'rgba(200,88,26,0.10)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 70,
  },
  deepOrbTwo: {
    position: 'absolute',
    width: 240,
    height: 240,
    right: -60,
    bottom: 100,
    borderRadius: 120,
    backgroundColor: 'rgba(212,175,55,0.12)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 65,
  },
  deepOrbThree: {
    position: 'absolute',
    width: 180,
    height: 180,
    left: -20,
    top: '40%',
    borderRadius: 90,
    backgroundColor: 'rgba(200,88,26,0.07)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 55,
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
    backgroundColor: 'rgba(200,88,26,0.18)',
  },
  deepPhaseTrackWrap: {
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  deepPhaseTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deepPhaseTrackSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.16)',
    overflow: 'hidden',
  },
  deepPhaseTrackFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
  },
  deepHeaderRow: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 24,
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  deepCloseIcon: {
    fontSize: 24,
    lineHeight: 24,
    color: 'rgba(245,240,232,0.5)',
    fontWeight: '300',
    marginTop: -1,
  },
  deepPhasePill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    backgroundColor: 'rgba(12,17,24,0.8)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepPhasePillText: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: '#D4AF37',
    opacity: 0.6,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
  },
  deepHeaderSpacer: {
    width: 32,
    height: 32,
  },
  deepPhaseLabelWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  deepPhaseLabelText: {
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    letterSpacing: 4.5,
    color: '#D4AF37',
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  deepPhaseDivider: {
    marginTop: 4,
    width: 40,
    height: 1,
  },
  deepCenterContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  deepSymbolWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 340,
    height: 340,
    marginBottom: spacing.lg,
  },
  deepPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepOrbitDashOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(212,175,55,0.12)',
  },
  deepOrbitDashInner: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,88,26,0.10)',
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
    width: 246,
    height: 246,
    borderRadius: 123,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  deepPulseRingInner: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  deepEmberHalo: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(0,0,0,0)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 38,
    elevation: 12,
  },
  deepDualArcSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  deepSigilContainer: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: '#0D0800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepInstructionContainer: {
    width: '100%',
    maxWidth: 500,
    minHeight: 68,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deepInstructionCardWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  deepInstructionCard: {
    borderRadius: 14,
    borderColor: 'rgba(212,175,55,0.10)',
    backgroundColor: 'rgba(212,175,55,0.04)',
    borderLeftWidth: 0,
    minHeight: 68,
  },
  deepInstructionAccent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    backgroundColor: '#C8581A',
    zIndex: 2,
  },
  deepInstructionText: {
    color: 'rgba(245,240,232,0.85)',
    fontSize: 17,
    fontFamily: 'CormorantGaramond_400Italic',
    lineHeight: 24,
  },
  deepBottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    minHeight: 150,
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
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,88,26,0.20)',
    backgroundColor: 'rgba(200,88,26,0.08)',
    alignItems: 'center',
  },
  deepTotalTimerPill: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(212,175,55,0.06)',
    alignItems: 'center',
  },
  deepTimerLabelEmber: {
    fontSize: 8,
    fontFamily: typography.fonts.heading,
    color: 'rgba(200,88,26,0.7)',
    letterSpacing: 3,
  },
  deepTimerLabelGold: {
    fontSize: 8,
    fontFamily: typography.fonts.heading,
    color: 'rgba(212,175,55,0.5)',
    letterSpacing: 3,
  },
  deepTimerDigitsEmber: {
    marginTop: 2,
    fontSize: 20,
    fontFamily: typography.fonts.headingBold,
    color: '#E8722A',
    textShadowColor: 'rgba(200,88,26,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  deepTimerDigitsGold: {
    marginTop: 2,
    fontSize: 20,
    fontFamily: typography.fonts.headingBold,
    color: '#F0D060',
    textShadowColor: 'rgba(212,175,55,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  deepPauseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  deepPauseText: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: 'rgba(245,240,232,0.5)',
    letterSpacing: 3,
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
