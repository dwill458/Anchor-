import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Clock, ArrowRight } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { RootStackParamList, AIStyle, SigilVariant } from '@/types';
import { API_URL } from '@/config';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { logger } from '@/utils/logger';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';
import { AuthService } from '@/services/AuthService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { isCompactPhoneViewport } from '@/utils/layout';
import { StructureHeroGlyph } from './components/RefineStyleCard';
import { REFINE_STYLES } from './constants/refineStyles';

type AIGeneratingRouteProp = RouteProp<RootStackParamList, 'AIGenerating'>;
type AIGeneratingNavigationProp = StackNavigationProp<RootStackParamList, 'AIGenerating'>;

type GenerationStage = 'preparing' | 'applying' | 'creating' | 'finalizing' | 'ready';

const STYLE_NAME_LOOKUP: Record<string, string> = {
  architectural_trace: 'Architectural Trace',
  lunar_etch: 'Lunar Etch',
  resonance_rings: 'Resonance Rings',
  minimal_line: 'Minimal Line',
  ink_brush: 'Ink Brush',
  sacred_geometry: 'Sacred Geometry',
  watercolor: 'Watercolor',
  gold_leaf: 'Gold Leaf',
  cosmic: 'Cosmic',
  obsidian_mono: 'Obsidian Mono',
  aurora_glow: 'Aurora Glow',
  ember_trace: 'Ember Trace',
  echo_chamber: 'Echo Chamber',
  monolith_ink: 'Monolith Ink',
  celestial_grid: 'Celestial Grid',
  prism_veil: 'Prism Veil',
  verdigris_relic: 'Verdigris Relic',
  solar_halo: 'Solar Halo',
  tideglass: 'Tideglass',
  velvet_ember: 'Velvet Ember',
};

const STRUCTURE_NAME_LOOKUP: Record<string, string> = {
  focused: 'Focused',
  contained: 'Contained',
  raw: 'Raw',
  drawn: 'Drawn',
  dense: 'Contained',
  minimal: 'Raw',
  balanced: 'Focused',
};

export default function AIGeneratingScreen() {
  const route = useRoute<AIGeneratingRouteProp>();
  const navigation = useNavigation<AIGeneratingNavigationProp>();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const compact = isCompactPhoneViewport(width, height);

  // Responsive hero sizing — enlarged for prominent focal presence.
  const maxHeroWidth = Math.min(width - 32, 344);
  const heroScale = compact ? 0.85 : 1;
  const heroSize = Math.round(maxHeroWidth * heroScale);
  const heroCenter = heroSize / 2;
  const heroOuterHaloSize = Math.round(heroSize * 0.98);
  const heroInnerHaloSize = Math.round(heroSize * 0.82);
  const heroPulseWaveSize = Math.round(heroSize * 0.76);
  const heroCircleSize = Math.round(heroSize * 0.68);
  const sigilSize = Math.round(heroCircleSize * 0.65);

  const heroSpinnerRadius = Math.round(heroCircleSize / 2 + 13);
  const spinnerCircumference = 2 * Math.PI * heroSpinnerRadius;
  const spinnerArcLength = spinnerCircumference / 3.4;
  const spinnerDashArray = `${spinnerArcLength.toFixed(1)},${(spinnerCircumference - spinnerArcLength).toFixed(1)}`;

  const heroOrbitalRadius = Math.round(heroCircleSize / 2 + 28);
  const heroRingARadius = Math.round(heroCircleSize / 2 + 18);
  const heroRingBRadius = Math.round(heroCircleSize / 2 + 38);
  const heroRingCRadius = Math.round(heroSize / 2 - 4);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const anchorCount = useAuthStore((state) => state.anchorCount);
  const { hasActiveEntitlement } = useTrialStatus();
  const flowDraft = useFirstAnchorFlowStore((state) => state.draft);

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    styleChoice,
    reinforcementMetadata,
    generationAttempt: initialGenerationAttempt,
  } = route.params;

  // Resolve canonical Structure and Style labels
  const structureId = flowDraft?.structure === 'drawn'
    ? 'drawn'
    : structureVariant === 'dense'
      ? 'contained'
      : structureVariant === 'minimal'
        ? 'raw'
        : 'focused';

  const structureLabel = STRUCTURE_NAME_LOOKUP[structureId] ?? 'Focused';

  const matchedStyle = useMemo(
    () => REFINE_STYLES.find((s) => s.generationStyle === styleChoice || s.id === flowDraft?.selectedStyleId),
    [styleChoice, flowDraft?.selectedStyleId]
  );

  const isOriginal = flowDraft?.selectedStyleId === 'original' || (styleChoice === 'minimal_line' && !matchedStyle);
  const styleLabel = isOriginal ? 'Original' : (matchedStyle?.displayName ?? STYLE_NAME_LOOKUP[styleChoice] ?? 'Selected Style');

  // UI & Flow State
  const [stage, setStage] = useState<GenerationStage>('preparing');
  const [isStillWorking, setIsStillWorking] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnectionError, setIsConnectionError] = useState(false);

  const isMountedRef = useRef(true);
  const isGeneratingRef = useRef(false);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stillWorkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationAttemptRef = useRef<number>(initialGenerationAttempt ?? 1);

  // Animations
  const haloProgress = useSharedValue(0);
  const pulseWaveProgress = useSharedValue(0);
  const heroCoreProgress = useSharedValue(0);
  const spinnerProgress = useSharedValue(0);
  const counterSpinnerProgress = useSharedValue(0);
  const ringAProgress = useSharedValue(0);
  const ringBProgress = useSharedValue(0);
  const ringCProgress = useSharedValue(0);
  const bgArcRotA = useSharedValue(0);
  const bgArcRotB = useSharedValue(0);
  const progressPercent = useSharedValue(10);
  const statusOpacity = useSharedValue(1);

  // Start continuous loops once on mount
  useEffect(() => {
    // 1. Radiant Halo Breathing Pulse
    haloProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // 2. Expanding Energy Ripple Wave
    pulseWaveProgress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );

    // 3. Hero Core Breathing Pulse & Glow
    heroCoreProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // 4. Primary Fast Spinning Radiant Glow Arc (1800ms)
    spinnerProgress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );

    // 5. Counter-Spinning Orbital Nodes (-7000ms)
    counterSpinnerProgress.value = withRepeat(
      withTiming(-1, { duration: 7000, easing: Easing.linear }),
      -1,
      false
    );

    // 6. Concentric Celestial Rings
    ringAProgress.value = withRepeat(
      withTiming(-1, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );
    ringBProgress.value = withRepeat(
      withTiming(1, { duration: 34000, easing: Easing.linear }),
      -1,
      false
    );
    ringCProgress.value = withRepeat(
      withTiming(-1, { duration: 46000, easing: Easing.linear }),
      -1,
      false
    );

    // 7. Ambient background arcs
    bgArcRotA.value = withRepeat(
      withTiming(1, { duration: 220000, easing: Easing.linear }),
      -1,
      false
    );
    bgArcRotB.value = withRepeat(
      withTiming(-1, { duration: 260000, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(haloProgress);
      cancelAnimation(pulseWaveProgress);
      cancelAnimation(heroCoreProgress);
      cancelAnimation(spinnerProgress);
      cancelAnimation(counterSpinnerProgress);
      cancelAnimation(ringAProgress);
      cancelAnimation(ringBProgress);
      cancelAnimation(ringCProgress);
      cancelAnimation(bgArcRotA);
      cancelAnimation(bgArcRotB);
    };
  }, []);

  const animatedHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.0 + haloProgress.value * 0.16 }],
    opacity: 0.65 + haloProgress.value * 0.35,
  }));

  const animatedPulseWaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.88 + pulseWaveProgress.value * 0.54 }],
    opacity: (1 - pulseWaveProgress.value) * 0.6,
  }));

  const animatedHeroCoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.0 + heroCoreProgress.value * 0.035 }],
    shadowOpacity: 0.30 + heroCoreProgress.value * 0.50,
    shadowRadius: 24 + heroCoreProgress.value * 18,
  }));

  const animatedSigilStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.0 + heroCoreProgress.value * 0.04 }],
    opacity: 0.88 + heroCoreProgress.value * 0.12,
  }));

  const animatedRingAStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringAProgress.value * 360}deg` }],
  }));

  const animatedRingBStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringBProgress.value * 360}deg` }],
  }));

  const animatedRingCStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringCProgress.value * 360}deg` }],
  }));

  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerProgress.value * 360}deg` }],
  }));

  const animatedSpinnerGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + heroCoreProgress.value * 0.35,
  }));

  const animatedCounterSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${counterSpinnerProgress.value * 360}deg` }],
  }));

  const animatedBgArcAStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bgArcRotA.value * 360}deg` }],
  }));

  const animatedBgArcBStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bgArcRotB.value * 360}deg` }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressPercent.value}%`,
  }));

  const animatedStatusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const setStageWithAnim = useCallback((newStage: GenerationStage) => {
    if (!reduceMotion) {
      statusOpacity.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 200 })
      );
    }
    setStage(newStage);
  }, [reduceMotion, statusOpacity]);

  const stage1TimerRef = useRef<NodeJS.Timeout | null>(null);
  const stage2TimerRef = useRef<NodeJS.Timeout | null>(null);
  const readyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback((keepNavigation: boolean = false) => {
    if (stage1TimerRef.current) {
      clearTimeout(stage1TimerRef.current);
      stage1TimerRef.current = null;
    }
    if (stage2TimerRef.current) {
      clearTimeout(stage2TimerRef.current);
      stage2TimerRef.current = null;
    }
    if (!keepNavigation && readyTimerRef.current) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
    if (stillWorkingTimerRef.current) {
      clearTimeout(stillWorkingTimerRef.current);
      stillWorkingTimerRef.current = null;
    }
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    if (!keepNavigation && navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const generateAIVariations = useCallback(async () => {
    if (isGeneratingRef.current) {
      logger.warn('[AIGenerating] Generation already in progress, skipping duplicate call');
      return;
    }

    setErrorMessage(null);
    setIsConnectionError(false);
    setIsStillWorking(false);
    setIsSettled(false);
    setStage('preparing');
    progressPercent.value = withTiming(15, { duration: 900 });

    useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'generating' });

    // First anchor is part of onboarding — bypass auth and entitlement checks.
    const isFirstAnchor = anchorCount === 0;

    if (!isFirstAnchor) {
      if (!isAuthenticated) {
        Alert.alert('Account Required', 'Sign in before generating AI artwork.', [
          { text: 'Sign In', onPress: () => navigation.replace('Login', {}) },
          { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      if (!hasActiveEntitlement) {
        Alert.alert('Subscription Required', 'Your trial has ended. Renew access to generate AI artwork.', [
          { text: 'View Paywall', onPress: () => navigation.navigate('Paywall') },
          { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    }

    const userId = user?.id || `dev-user-${Date.now()}`;
    const trace = PerformanceMonitoring.startTrace('ai_enhance', {
      style_choice: styleChoice,
      user_id: userId,
      has_reinforced_svg: Boolean(reinforcedSigilSvg),
    });

    isGeneratingRef.current = true;
    clearTimers();

    FrictionAnalytics.stepCompleted('anchor_creation', 'ai_generation_started', {
      style_id: styleChoice,
      category,
      attempt: generationAttemptRef.current,
      has_reinforced_svg: Boolean(reinforcedSigilSvg),
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    requestTimeoutRef.current = setTimeout(() => {
      controller.abort();
    }, 180000);

    // Progressive stage transitions
    stage1TimerRef.current = setTimeout(() => {
      if (isMountedRef.current && isGeneratingRef.current) {
        setStageWithAnim('applying');
        progressPercent.value = withTiming(38, { duration: 1200 });
      }
    }, 1100);

    stage2TimerRef.current = setTimeout(() => {
      if (isMountedRef.current && isGeneratingRef.current) {
        setStageWithAnim('creating');
        progressPercent.value = withTiming(75, { duration: 3500 });
      }
    }, 2400);

    // "Still working" notice after 11 seconds
    stillWorkingTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && isGeneratingRef.current) {
        setIsStillWorking(true);
      }
    }, 11000);

    ErrorTrackingService.addBreadcrumb('AI enhancement started', 'ai.enhance', {
      style_choice: styleChoice,
      user_id: userId,
    });

    try {
      logger.info('[AIGenerating] Starting AI generation', {
        style: styleChoice,
        userId,
        apiUrl: API_URL,
      });

      const sigilToEnhance = reinforcedSigilSvg || baseSigilSvg;
      const token = await AuthService.getIdToken();

      const response = await fetch(`${API_URL}/api/ai/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sigilSvg: sigilToEnhance,
          styleChoice,
          intentionText,
          anchorId: `temp-${Date.now()}`,
          provider: 'gemini',
          tier: 'premium',
          generationAttempt: generationAttemptRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'AI enhancement failed');
      }

      const result = await response.json();

      trace.putAttribute('variation_count', Array.isArray(result.variations) ? result.variations.length : 0);
      trace.stop({ success: true });

      FrictionAnalytics.stepCompleted('anchor_creation', 'ai_generating', {
        style_id: styleChoice,
        category,
        variation_count: Array.isArray(result.variations) ? result.variations.length : 0,
        generation_time_ms:
          typeof result.generationTime === 'number' ? result.generationTime * 1000 : undefined,
      });

      if (!isMountedRef.current) return;

      setStageWithAnim('finalizing');
      progressPercent.value = withTiming(95, { duration: 400 });

      readyTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setStageWithAnim('ready');
        progressPercent.value = withTiming(100, { duration: 300 });
        setIsSettled(true);
        void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
        useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'complete' });

        navigationTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;

          navigation.replace('EnhancedVersionPicker', {
            intentionText,
            category,
            distilledLetters,
            baseSigilSvg,
            reinforcedSigilSvg,
            structureVariant,
            styleChoice,
            variations: result.variations,
            reinforcementMetadata,
            prompt: result.prompt || '',
            negativePrompt: result.negativePrompt || '',
            modelUsed: result.model || '',
            provider: result.provider || '',
            controlMethod: result.controlMethod || '',
            generationTimeMs:
              typeof result.generationTime === 'number' ? result.generationTime * 1000 : 0,
            reuseRequestId: result.reuseRequestId || '',
          });
        }, 700);
      }, 500);
    } catch (error) {
      trace.stop({ success: false });

      if (!isMountedRef.current) return;

      useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'error' });
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Error);

      let isOfflineOrTimeout = false;
      let errText = "We couldn't finish this generation.";

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          isOfflineOrTimeout = true;
          errText = 'Generation timed out. The connection took too long.';
        } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
          isOfflineOrTimeout = true;
          errText = 'Connection lost. Please check your connection.';
        } else {
          errText = error.message;
        }
      }

      setIsConnectionError(isOfflineOrTimeout);
      setErrorMessage(errText);

      FrictionAnalytics.flowError('anchor_creation', 'ai_generating', isOfflineOrTimeout ? 'connection_error' : 'generation_failed', {
        style_id: styleChoice,
        category,
        attempt: generationAttemptRef.current,
      });

      ErrorTrackingService.captureException(error, {
        screen: 'AIGeneratingScreen',
        action: 'generate_ai_variations',
        style_choice: styleChoice,
      });
      logger.error('[AIGenerating] AI generation error', error);
    } finally {
      clearTimers(true);
      isGeneratingRef.current = false;
    }
  }, [
    API_URL,
    anchorCount,
    baseSigilSvg,
    category,
    clearTimers,
    distilledLetters,
    hasActiveEntitlement,
    isAuthenticated,
    intentionText,
    navigation,
    progressPercent,
    reinforcementMetadata,
    reinforcedSigilSvg,
    setStageWithAnim,
    structureVariant,
    styleChoice,
    user?.id,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    void generateAIVariations();

    return () => {
      isMountedRef.current = false;
      isGeneratingRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    generationAttemptRef.current += 1;
    FrictionAnalytics.flowRetry('anchor_creation', 'ai_generating', {
      style_id: styleChoice,
      category,
    });
    void generateAIVariations();
  }, [category, generateAIVariations, styleChoice]);

  const handleBackToStyle = useCallback(() => {
    FrictionAnalytics.stepAbandoned('anchor_creation', 'ai_generating', 'back_to_style', {
      style_id: styleChoice,
      category,
    });
    navigation.goBack();
  }, [category, navigation, styleChoice]);

  const STAGE_LABELS: Record<GenerationStage, string> = {
    preparing: 'PREPARING STRUCTURE',
    applying: 'APPLYING STYLE',
    creating: isOriginal ? 'CREATING ORIGINAL EXPRESSIONS' : 'CREATING EXPRESSIONS',
    finalizing: 'FINALIZING',
    ready: 'EXPRESSIONS READY',
  };

  const statusText = STAGE_LABELS[stage];
  const isError = Boolean(errorMessage);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Ambient Background Field ── */}
      <View style={styles.ambientField} pointerEvents="none">
        <LinearGradient
          colors={['#161F28', '#0F1419', '#0A0E12']}
          locations={[0, 0.46, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Top Gold Aura */}
        <View style={styles.goldAura} />
        {/* Bottom Amethyst Aura */}
        <View style={styles.amethystAura} />

        {/* Animated Background Arcs */}
        <Animated.View style={[styles.bgArc, styles.bgArcA, animatedBgArcAStyle]} />
        <Animated.View style={[styles.bgArc, styles.bgArcB, animatedBgArcBStyle]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, compact && styles.contentCompact]}>
          {/* ── Header ── */}
          <View style={styles.head}>
            <Text style={styles.eyebrow}>GENERATING</Text>
            <Text style={styles.title}>Generating Your Anchor</Text>
            <Text style={styles.body}>
              Creating expressions from your structure and selected style.
            </Text>
          </View>

          {/* ── Structure Hero ── */}
          <View style={[styles.hero, { width: heroSize, height: heroSize }]}>
            {/* Outer Ambient Breathing Halo */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroHaloOuter,
                  {
                    width: heroOuterHaloSize,
                    height: heroOuterHaloSize,
                    borderRadius: heroOuterHaloSize / 2,
                  },
                  animatedHaloStyle,
                ]}
              />
            ) : null}

            {/* Inner Vibrant Glowing Halo */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroHaloInner,
                  {
                    width: heroInnerHaloSize,
                    height: heroInnerHaloSize,
                    borderRadius: heroInnerHaloSize / 2,
                  },
                  animatedHaloStyle,
                ]}
              />
            ) : null}

            {/* Expanding Pulsing Energy Wave */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroPulseWave,
                  {
                    width: heroPulseWaveSize,
                    height: heroPulseWaveSize,
                    borderRadius: heroPulseWaveSize / 2,
                  },
                  animatedPulseWaveStyle,
                ]}
              />
            ) : null}

            {/* Outer Celestial Ring (Slow Counter-Clockwise) */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingCStyle,
              ]}
            >
              <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                <Circle
                  cx={heroCenter}
                  cy={heroCenter}
                  r={heroRingCRadius}
                  stroke={colors.anchor15.gilt}
                  strokeWidth="1"
                  strokeDasharray="4,12"
                  fill="none"
                  opacity={0.16}
                />
              </Svg>
            </Animated.View>

            {/* Concentric Rotating Dashed Ring B */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingBStyle,
              ]}
            >
              <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                <Circle
                  cx={heroCenter}
                  cy={heroCenter}
                  r={heroRingBRadius}
                  stroke={colors.anchor15.gilt}
                  strokeWidth="1"
                  strokeDasharray="6,8"
                  fill="none"
                  opacity={0.22}
                />
              </Svg>
            </Animated.View>

            {/* Concentric Rotating Dashed Ring A */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingAStyle,
              ]}
            >
              <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                <Circle
                  cx={heroCenter}
                  cy={heroCenter}
                  r={heroRingARadius}
                  stroke={colors.anchor15.gilt}
                  strokeWidth="1"
                  strokeDasharray="8,8"
                  fill="none"
                  opacity={0.28}
                />
              </Svg>
            </Animated.View>

            {/* Counter-Spinning Orbital Nodes */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroLayer,
                  { width: heroSize, height: heroSize },
                  animatedCounterSpinnerStyle,
                ]}
              >
                <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                  <Circle
                    cx={heroCenter}
                    cy={heroCenter - heroOrbitalRadius}
                    r={3.5}
                    fill={colors.anchor15.giltBright}
                    opacity={0.85}
                  />
                  <Circle
                    cx={heroCenter + heroOrbitalRadius}
                    cy={heroCenter}
                    r={2.5}
                    fill={colors.anchor15.gilt}
                    opacity={0.65}
                  />
                  <Circle
                    cx={heroCenter}
                    cy={heroCenter + heroOrbitalRadius}
                    r={3.5}
                    fill={colors.anchor15.giltBright}
                    opacity={0.85}
                  />
                  <Circle
                    cx={heroCenter - heroOrbitalRadius}
                    cy={heroCenter}
                    r={2.5}
                    fill={colors.anchor15.gilt}
                    opacity={0.65}
                  />
                </Svg>
              </Animated.View>
            ) : null}

            {/* Fast Spinning Radiant Glow Arc */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroLayer,
                  styles.heroSpinnerShadow,
                  { width: heroSize, height: heroSize },
                  animatedSpinnerGlowStyle,
                  animatedSpinnerStyle,
                ]}
              >
                <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                  <Defs>
                    <SvgLinearGradient id="heroSpinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={colors.anchor15.giltBright} stopOpacity="0" />
                      <Stop offset="50%" stopColor={colors.anchor15.gilt} stopOpacity="0.7" />
                      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                    </SvgLinearGradient>
                  </Defs>
                  <Circle
                    cx={heroCenter}
                    cy={heroCenter}
                    r={heroSpinnerRadius}
                    stroke="url(#heroSpinnerGradient)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={spinnerDashArray}
                    fill="none"
                  />
                  {/* Glowing Leading Head Pip */}
                  <Circle
                    cx={heroCenter + heroSpinnerRadius}
                    cy={heroCenter}
                    r={4}
                    fill="#FFFFFF"
                  />
                  <Circle
                    cx={heroCenter + heroSpinnerRadius}
                    cy={heroCenter}
                    r={7}
                    fill={colors.anchor15.giltBright}
                    opacity={0.4}
                  />
                </Svg>
              </Animated.View>
            ) : null}

            {/* Hero Center Pulsing & Glowing Orb */}
            <Animated.View
              style={[
                styles.heroCircle,
                {
                  width: heroCircleSize,
                  height: heroCircleSize,
                  borderRadius: heroCircleSize / 2,
                },
                !isError && animatedHeroCoreStyle,
                stage === 'ready' && styles.heroCircleReady,
                isError && styles.heroCircleError,
              ]}
            >
              {/* Inner ambient glow layer */}
              <View style={[styles.heroCircleInnerGlow, { borderRadius: heroCircleSize / 2 }]} />

              <Animated.View style={animatedSigilStyle}>
                {baseSigilSvg || reinforcedSigilSvg ? (
                  <SigilSvg
                    xml={reinforcedSigilSvg || baseSigilSvg}
                    width={sigilSize}
                    height={sigilSize}
                    color={colors.anchor15.gilt}
                  />
                ) : (
                  <StructureHeroGlyph
                    id={structureId}
                    size={sigilSize}
                    color={colors.anchor15.gilt}
                    accent={colors.anchor15.giltBright}
                    strokes={flowDraft?.drawingStrokes}
                  />
                )}
              </Animated.View>
            </Animated.View>
          </View>

          {/* ── Status & Progress Section (Normal / Progressing) ── */}
          {!isError ? (
            <View style={styles.statusWrap}>
              <Animated.Text style={[styles.statusText, animatedStatusStyle]}>
                {statusText}
              </Animated.Text>

              {/* Still working reassurance */}
              {isStillWorking ? (
                <Text style={styles.stillWorkingText}>
                  Still working — this is taking a little longer than usual.
                </Text>
              ) : null}

              {/* Progress Line */}
              <View style={[styles.progressTrack, isSettled && styles.progressTrackSettled]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    stage === 'ready' ? styles.progressFillReady : null,
                    animatedProgressStyle,
                  ]}
                />
              </View>

              {/* Continuity Caption & Value */}
              <View style={styles.summaryWrap}>
                <Text style={styles.summaryCaption}>STRUCTURE · STYLE</Text>
                <Text style={styles.summaryValue}>
                  {structureLabel} · {styleLabel}
                </Text>
              </View>

              {/* Time Note */}
              <View style={styles.timeWrap}>
                <Clock size={13} color="rgba(217,179,108,0.6)" strokeWidth={1.6} />
                <Text style={styles.timeText}>Usually ready in about 30 seconds.</Text>
              </View>
            </View>
          ) : null}

          {/* ── Error & Retry Section ── */}
          {isError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>
                {isConnectionError ? 'Connection Lost' : "We couldn't finish this generation."}
              </Text>
              <Text style={styles.errorSub}>
                {isConnectionError
                  ? 'Your choices are saved.'
                  : 'Your structure and style are still here.'}
              </Text>

              <View style={styles.summaryWrap}>
                <Text style={styles.summaryCaption}>STRUCTURE · STYLE</Text>
                <Text style={styles.summaryValue}>
                  {structureLabel} · {styleLabel}
                </Text>
              </View>

              <View style={styles.errorActions}>
                <Pressable
                  onPress={handleRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Try Again"
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>
                    {isConnectionError ? 'Retry' : 'Try Again'}
                  </Text>
                  <ArrowRight size={14} color={colors.anchor15.giltBright} strokeWidth={2.2} />
                </Pressable>

                <Pressable
                  onPress={handleBackToStyle}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Style"
                  style={styles.backToStyleButton}
                >
                  <Text style={styles.backToStyleText}>Back to Style</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  safeArea: {
    flex: 1,
  },
  ambientField: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  goldAura: {
    position: 'absolute',
    top: -50,
    alignSelf: 'center',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(217, 179, 108, 0.06)',
  },
  amethystAura: {
    position: 'absolute',
    bottom: -80,
    right: -40,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(130, 105, 175, 0.05)',
  },
  bgArc: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  bgArcA: {
    width: 640,
    height: 640,
    top: -320,
    left: -200,
    borderColor: 'rgba(217, 179, 108, 0.05)',
  },
  bgArcB: {
    width: 520,
    height: 520,
    bottom: -360,
    right: -160,
    borderColor: 'rgba(217, 179, 108, 0.04)',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 22,
  },
  contentCompact: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 14,
  },

  // ── Header ──
  head: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 340,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.4,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 23,
    fontWeight: '600',
    color: colors.anchor15.bone,
    letterSpacing: 0.46,
    lineHeight: 28,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 15,
    color: 'rgba(244, 239, 230, 0.6)',
    lineHeight: 21,
    textAlign: 'center',
  },

  // ── Structure Hero ──
  hero: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHaloOuter: {
    position: 'absolute',
    backgroundColor: 'rgba(217, 179, 108, 0.08)',
  },
  heroHaloInner: {
    position: 'absolute',
    backgroundColor: 'rgba(217, 179, 108, 0.18)',
  },
  heroPulseWave: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 179, 108, 0.45)',
    backgroundColor: 'rgba(217, 179, 108, 0.06)',
  },
  heroLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingDim: {
    opacity: 0.4,
  },
  heroSpinnerShadow: {
    shadowColor: colors.anchor15.giltBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
  },
  heroCircle: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 179, 108, 0.38)',
    backgroundColor: '#161F28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.anchor15.giltBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 12,
    overflow: 'hidden',
  },
  heroCircleInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(246, 226, 148, 0.18)',
    backgroundColor: 'rgba(217, 179, 108, 0.04)',
  },
  heroCircleReady: {
    borderColor: colors.anchor15.giltBright,
    shadowColor: colors.anchor15.giltBright,
    shadowOpacity: 0.85,
    shadowRadius: 48,
  },
  heroCircleError: {
    opacity: 0.5,
    shadowOpacity: 0,
  },

  // ── Status Section ──
  statusWrap: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 290,
  },
  statusText: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 2.1,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  stillWorkingText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 12.5,
    color: colors.anchor15.ash,
    marginTop: -4,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(217, 179, 108, 0.12)',
    overflow: 'hidden',
  },
  progressTrackSettled: {
    opacity: 0,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: colors.anchor15.gilt,
  },
  progressFillReady: {
    backgroundColor: colors.anchor15.giltBright,
  },

  // ── Continuity Label ──
  summaryWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  summaryCaption: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 4,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: colors.anchor15.bone,
  },

  // ── Timing Note ──
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  timeText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 12.5,
    color: colors.anchor15.ash,
  },

  // ── Error State ──
  errorWrap: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 290,
    width: '100%',
  },
  errorTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.56,
    color: colors.anchor15.bone,
    lineHeight: 20,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  errorSub: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14.5,
    color: 'rgba(244, 239, 230, 0.58)',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: -4,
  },
  errorActions: {
    width: '100%',
    gap: 12,
    marginTop: 6,
  },
  retryButton: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.82,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
  },
  backToStyleButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  backToStyleText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    letterSpacing: 0.72,
    color: colors.anchor15.ash,
    textTransform: 'uppercase',
  },
});
