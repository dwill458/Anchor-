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
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type WithTimingConfig,
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
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
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
  solar_veil: 'Solar Veil',
  ink_bloom: 'Ink Bloom',
  prism_fold: 'Prism Fold',
  ocean_current: 'Ocean Current',
  halo_drift: 'Halo Drift',
  harvest_gild: 'Harvest Gild',
  midnight_bloom: 'Midnight Bloom',
  winter_halo: 'Winter Halo',
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * -- Motion tokens: "Orbital Assembly" --
 *
 * The Anchor is the protagonist. Everything else makes small, deliberate
 * adjustments and then settles. No infinite linear rotation, no expanding
 * blooms -- the choreography is movement -> settle -> transformation -> settle.
 */
const EASE_SETTLE = Easing.bezier(0.16, 1, 0.3, 1);   // long ease-out: locking into place
const EASE_ADJUST = Easing.bezier(0.65, 0, 0.35, 1);  // soft ease-in-out: deliberate correction
const EASE_SWEEP = Easing.bezier(0.42, 0, 0.22, 1);   // light pass across the glyph

const DUR_MICRO = 700;    // micro motions
const DUR_STAGE = 600;    // stage transitions
const DUR_ALIGN = 1400;   // ring alignment adjustments
const DUR_SWEEP = 1650;   // light sweeps
const DUR_RESOLVE = 1900; // stroke-by-stroke illumination of the Anchor

const NEVER = ReduceMotion.Never;
type MotionEasing = NonNullable<WithTimingConfig['easing']>;

const timing = (duration: number, easing: MotionEasing): WithTimingConfig => ({
  duration,
  easing,
  reduceMotion: NEVER,
});

export default function AIGeneratingScreen() {
  const route = useRoute<AIGeneratingRouteProp>();
  const navigation = useNavigation<AIGeneratingNavigationProp>();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const compact = isCompactPhoneViewport(width, height);

  // Responsive hero sizing — enlarged for prominent focal presence.
  const maxHeroWidth = Math.min(width - 32, 344);
  const heroScale = compact ? 0.85 : 1;
  const heroSize = Math.round(maxHeroWidth * heroScale);
  const heroCenter = heroSize / 2;
  const heroHaloSize = Math.round(heroSize * 0.80);
  const heroCircleSize = Math.round(heroSize * 0.68);
  const sigilSize = Math.round(heroCircleSize * 0.65);

  // Phase 1 trace arc -- a single thin gold line drawn around the circumference.
  const traceRadius = Math.round(heroCircleSize / 2 + 13);
  const traceCircumference = 2 * Math.PI * traceRadius;

  const heroRingARadius = Math.round(heroCircleSize / 2 + 18);
  const heroRingBRadius = Math.round(heroCircleSize / 2 + 38);
  const heroRingCRadius = Math.round(heroSize / 2 - 4);

  // Phase 3 expression fragments -- two points leaving the Anchor.
  const fragmentTargetX = Math.round(heroRingBRadius * 0.92);
  const fragmentTargetY = -Math.round(heroRingBRadius * 0.30);
  const fragmentLift = Math.round(heroRingBRadius * 0.26);

  // Light pass geometry (clipped to the glyph stage).
  const sweepBandWidth = Math.max(18, Math.round(sigilSize * 0.34));
  const sweepTravel = Math.round(sigilSize * 0.95);

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

  // ── Motion state (Orbital Assembly) ──────────────────────────────────────
  // One continuous loop only: the Anchor's breath. Everything else is either
  // stage-triggered or a slow alignment cycle that spends most of its time still.
  const anchorBreath = useSharedValue(0);      // 1.00 -> 1.025 scale on the glyph
  const anchorResolve = useSharedValue(0);     // 0 -> 1 stroke-by-stroke illumination
  const anchorLuma = useSharedValue(0);        // gold intensity, steps up per stage
  const traceProgress = useSharedValue(0);     // circumference arc draw
  const sweepProgress = useSharedValue(0);     // light pass across the glyph
  const ringOuter = useSharedValue(0);         // degrees of alignment offset
  const ringMid = useSharedValue(0);
  const ringInner = useSharedValue(0);
  const fragmentProgress = useSharedValue(0);  // two expressions leaving the Anchor
  const finalPulse = useSharedValue(0);        // single soft halo on ready
  const progressPercent = useSharedValue(10);
  const statusOpacity = useSharedValue(1);

  const hasError = Boolean(errorMessage);

  // ── Ambient loops: the Anchor breathes; the rings make periodic corrections ──
  useEffect(() => {
    const rest = () => {
      cancelAnimation(anchorBreath);
      cancelAnimation(ringOuter);
      cancelAnimation(ringMid);
      cancelAnimation(ringInner);
      anchorBreath.value = 0;
      ringOuter.value = 0;
      ringMid.value = 0;
      ringInner.value = 0;
    };

    if (reduceMotion || hasError) {
      rest();
      return;
    }

    // Anchor breath — the only perpetual motion on the screen.
    anchorBreath.value = withRepeat(
      withSequence(
        withTiming(1, timing(3200, Easing.inOut(Easing.sin))),
        withTiming(0, timing(3200, Easing.inOut(Easing.sin)))
      ),
      -1,
      false,
      undefined,
      NEVER
    );

    // Ring alignment: drift a few degrees, dwell, then ease back into true.
    // Long dwells keep the composition still far more often than it moves.
    const alignmentCycle = (degrees: number, delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(degrees, timing(DUR_ALIGN, EASE_ADJUST)),
            withDelay(900, withTiming(0, timing(1600, EASE_SETTLE))),
            withDelay(2400, withTiming(0, timing(0, EASE_SETTLE)))
          ),
          -1,
          false,
          undefined,
          NEVER
        )
      );

    ringOuter.value = alignmentCycle(10, 0);
    ringMid.value = alignmentCycle(-6, 420);
    ringInner.value = alignmentCycle(3, 840);

    return rest;
  }, [reduceMotion, hasError]);

  // ── Stage choreography ──────────────────────────────────────────────────
  useEffect(() => {
    if (hasError) {
      cancelAnimation(sweepProgress);
      cancelAnimation(finalPulse);
      sweepProgress.value = 0;
      finalPulse.value = 0;
      return;
    }

    // Under reduce motion every stage lands instantly in its resolved pose.
    const instant = (value: number) => withTiming(value, timing(0, EASE_SETTLE));

    const lightPass = (duration: number) => {
      if (reduceMotion) return;
      sweepProgress.value = 0;
      sweepProgress.value = withTiming(1, timing(duration, EASE_SWEEP));
    };

    switch (stage) {
      // Phase 1 — Preparing Structure: a single thin arc traces the rim while
      // the Anchor illuminates from the top down. Almost nothing else moves.
      case 'preparing': {
        cancelAnimation(sweepProgress);
        sweepProgress.value = 0;
        finalPulse.value = 0;
        if (reduceMotion) {
          traceProgress.value = 0.62;
          anchorResolve.value = 1;
          anchorLuma.value = 0.5;
          fragmentProgress.value = 0;
          break;
        }
        traceProgress.value = 0;
        anchorResolve.value = 0;
        anchorLuma.value = 0;
        fragmentProgress.value = 0;
        traceProgress.value = withTiming(0.62, timing(1700, EASE_SETTLE));
        anchorResolve.value = withDelay(220, withTiming(1, timing(DUR_RESOLVE, EASE_ADJUST)));
        anchorLuma.value = withDelay(220, withTiming(0.5, timing(1500, EASE_ADJUST)));
        break;
      }

      // Phase 2 — Applying Style: the rings correct themselves (ambient loop)
      // and one soft light pass crosses the Anchor. Refinement, not spinning.
      case 'applying': {
        anchorLuma.value = reduceMotion ? instant(0.72) : withTiming(0.72, timing(DUR_MICRO, EASE_ADJUST));
        traceProgress.value = reduceMotion ? instant(0.82) : withTiming(0.82, timing(DUR_ALIGN, EASE_SETTLE));
        lightPass(DUR_SWEEP);
        break;
      }

      // Phase 3 — Creating Expressions: two fragments leave the Anchor and
      // travel outward, hinting at the two expressions about to arrive.
      case 'creating': {
        anchorLuma.value = reduceMotion ? instant(0.85) : withTiming(0.85, timing(DUR_MICRO, EASE_ADJUST));
        fragmentProgress.value = reduceMotion
          ? instant(1)
          : withDelay(260, withTiming(1, timing(1500, EASE_SETTLE)));
        break;
      }

      case 'finalizing': {
        anchorLuma.value = reduceMotion ? instant(0.93) : withTiming(0.93, timing(DUR_STAGE, EASE_ADJUST));
        traceProgress.value = reduceMotion ? instant(0.94) : withTiming(0.94, timing(900, EASE_SETTLE));
        break;
      }

      // Final state — Ready: rings lock into alignment, the arc closes, the
      // Anchor reaches full luminance, and one small halo expands just once.
      case 'ready': {
        anchorLuma.value = reduceMotion ? instant(1) : withTiming(1, timing(520, EASE_SETTLE));
        traceProgress.value = reduceMotion ? instant(1) : withTiming(1, timing(620, EASE_SETTLE));
        if (reduceMotion) break;
        cancelAnimation(ringOuter);
        cancelAnimation(ringMid);
        cancelAnimation(ringInner);
        ringOuter.value = withTiming(0, timing(900, EASE_SETTLE));
        ringMid.value = withTiming(0, timing(900, EASE_SETTLE));
        ringInner.value = withTiming(0, timing(900, EASE_SETTLE));
        finalPulse.value = 0;
        finalPulse.value = withTiming(1, timing(900, EASE_SETTLE));
        lightPass(1400);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, hasError, reduceMotion]);

  // ── Derived styles ──────────────────────────────────────────────────────

  // Quiet ambient halo. No scale pulse — it only tracks the Anchor's intensity.
  const animatedHaloStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0.7 };
    }
    return { opacity: 0.3 + anchorLuma.value * 0.45 + anchorBreath.value * 0.06 };
  });

  // The one halo of the whole sequence — a single small expansion on ready.
  const animatedFinalPulseStyle = useAnimatedStyle(() => {
    const progress = finalPulse.value;
    if (progress <= 0) {
      return { opacity: 0, transform: [{ scale: 1 }] };
    }
    return {
      opacity: interpolate(progress, [0, 0.18, 1], [0, 0.3, 0], 'clamp'),
      transform: [{ scale: 1 + progress * 0.055 }],
    };
  });

  const animatedRingOuterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringOuter.value}deg` }],
  }));

  const animatedRingMidStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringMid.value}deg` }],
  }));

  const animatedRingInnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringInner.value}deg` }],
  }));

  // The trace arc is bright while it draws, then recedes so the Anchor leads.
  const animatedTraceStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0.45 };
    }
    return { opacity: 0.85 - anchorLuma.value * 0.4 };
  });

  const traceAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: traceCircumference * (1 - (reduceMotion ? 0.62 : traceProgress.value)),
  }));

  // Anchor: subtle breath only — 1.00 to 1.025.
  const animatedAnchorStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { transform: [{ scale: 1 }] };
    }
    return { transform: [{ scale: 1 + anchorBreath.value * 0.025 }] };
  });

  // Illuminated copy of the glyph, revealed top-down so strokes light in sequence.
  const animatedAnchorRevealStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { height: sigilSize, opacity: 1 };
    }
    return {
      height: sigilSize * anchorResolve.value,
      opacity: 0.5 + anchorLuma.value * 0.5,
    };
  });

  // A hairline of light riding the illumination edge as it descends.
  const animatedRevealEdgeStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0, transform: [{ translateY: sigilSize }] };
    }
    const progress = anchorResolve.value;
    return {
      opacity: Math.min(progress * 6, 1) * (1 - progress) * 0.9,
      transform: [{ translateY: sigilSize * progress }],
    };
  });

  const animatedSweepStyle = useAnimatedStyle(() => {
    const progress = sweepProgress.value;
    if (reduceMotion || progress <= 0 || progress >= 1) {
      return { opacity: 0, transform: [{ translateX: -sweepTravel }, { rotate: '18deg' }] };
    }
    return {
      opacity: interpolate(progress, [0, 0.22, 0.78, 1], [0, 1, 1, 0], 'clamp'),
      transform: [
        { translateX: interpolate(progress, [0, 1], [-sweepTravel, sweepTravel]) },
        { rotate: '18deg' },
      ],
    };
  });

  // Glow is reserved for the Anchor and rises only as it resolves.
  const animatedHeroCircleStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { shadowOpacity: 0.28, shadowRadius: 24 };
    }
    return {
      shadowOpacity: 0.08 + anchorLuma.value * 0.3,
      shadowRadius: 12 + anchorLuma.value * 18,
    };
  });

  const animatedHeroRimStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.5 : 0.14 + anchorLuma.value * 0.5,
  }));

  // Phase 3 fragments: x eases outward while y bows upward, giving a curved path.
  const animatedFragmentLeftStyle = useAnimatedStyle(() => {
    const progress = fragmentProgress.value;
    if (progress <= 0) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.4 }] };
    }
    return {
      opacity: interpolate(progress, [0, 0.16, 0.7, 1], [0, 0.9, 0.72, 0.5], 'clamp'),
      transform: [
        { translateX: -fragmentTargetX * progress },
        { translateY: fragmentTargetY * progress - Math.sin(progress * Math.PI) * fragmentLift },
        { scale: interpolate(progress, [0, 0.25, 1], [0.4, 1, 0.78], 'clamp') },
      ],
    };
  });

  const animatedFragmentRightStyle = useAnimatedStyle(() => {
    const progress = fragmentProgress.value;
    if (progress <= 0) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.4 }] };
    }
    return {
      opacity: interpolate(progress, [0, 0.16, 0.7, 1], [0, 0.9, 0.72, 0.5], 'clamp'),
      transform: [
        { translateX: fragmentTargetX * progress },
        { translateY: fragmentTargetY * progress - Math.sin(progress * Math.PI) * fragmentLift },
        { scale: interpolate(progress, [0, 0.25, 1], [0.4, 1, 0.78], 'clamp') },
      ],
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressPercent.value}%`,
  }));

  const animatedStatusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const setStageWithAnim = useCallback((newStage: GenerationStage) => {
    if (!reduceMotion) {
      statusOpacity.value = withSequence(
        withTiming(0, { duration: 150, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 200, reduceMotion: ReduceMotion.Never })
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
          // Hold on the resolved Anchor long enough for the closing halo and
          // final light pass to finish before handing off to the picker.
        }, reduceMotion ? 500 : 1300);
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
    reduceMotion,
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
  const isError = hasError;

  // The Anchor is rendered twice: a faint blueprint copy and an illuminated
  // copy that is revealed progressively, so strokes appear to light in sequence.
  const renderGlyph = (glyphColor: string) =>
    baseSigilSvg || reinforcedSigilSvg ? (
      <SigilSvg
        xml={reinforcedSigilSvg || baseSigilSvg}
        width={sigilSize}
        height={sigilSize}
        color={glyphColor}
      />
    ) : (
      <StructureHeroGlyph
        id={structureId}
        size={sigilSize}
        color={glyphColor}
        accent={colors.anchor15.giltBright}
        strokes={flowDraft?.drawingStrokes}
      />
    );

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

        {/* Static background arcs -- structure, not motion. */}
        <View style={[styles.bgArc, styles.bgArcA]} />
        <View style={[styles.bgArc, styles.bgArcB]} />
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
            {/* Quiet ambient halo — no bloom, no pulse. It only tracks intensity. */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroHaloQuiet,
                  {
                    width: heroHaloSize,
                    height: heroHaloSize,
                    borderRadius: heroHaloSize / 2,
                  },
                  animatedHaloStyle,
                ]}
              />
            ) : null}

            {/* Single closing halo — expands slightly, once, when ready. */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroFinalPulse,
                  {
                    width: heroHaloSize,
                    height: heroHaloSize,
                    borderRadius: heroHaloSize / 2,
                  },
                  animatedFinalPulseStyle,
                ]}
                pointerEvents="none"
              />
            ) : null}

            {/* Outer alignment ring — drifts ~10°, then eases back into true. */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingOuterStyle,
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
                  opacity={0.14}
                />
              </Svg>
            </Animated.View>

            {/* Middle alignment ring — counter-drifts ~6°. */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingMidStyle,
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
                  opacity={0.18}
                />
              </Svg>
            </Animated.View>

            {/* Inner alignment ring — the smallest correction, ~3°. */}
            <Animated.View
              style={[
                styles.heroLayer,
                { width: heroSize, height: heroSize },
                isError && styles.heroRingDim,
                animatedRingInnerStyle,
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
                  opacity={0.22}
                />
              </Svg>
            </Animated.View>

            {/* Phase 1 — a single thin gold arc drawn around the rim. It never
                rotates; it is drawn once and then recedes behind the Anchor. */}
            {!isError ? (
              <Animated.View
                style={[
                  styles.heroLayer,
                  { width: heroSize, height: heroSize },
                  animatedTraceStyle,
                ]}
              >
                <Svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`}>
                  <AnimatedCircle
                    cx={heroCenter}
                    cy={heroCenter}
                    r={traceRadius}
                    stroke={colors.anchor15.gilt}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeDasharray={traceCircumference}
                    fill="none"
                    rotation="-90"
                    origin={`${heroCenter}, ${heroCenter}`}
                    animatedProps={traceAnimatedProps}
                  />
                </Svg>
              </Animated.View>
            ) : null}

            {/* Phase 3 — two fragments leave the Anchor on curved paths, hinting
                at the two expressions about to be revealed. */}
            {!isError ? (
              <View
                style={[styles.heroLayer, { width: heroSize, height: heroSize }]}
                pointerEvents="none"
              >
                <Animated.View style={[styles.fragmentDot, animatedFragmentLeftStyle]} />
                <Animated.View style={[styles.fragmentDot, animatedFragmentRightStyle]} />
              </View>
            ) : null}

            {/* Hero core — the Anchor and its containing disc. */}
            <Animated.View
              style={[
                styles.heroCircle,
                {
                  width: heroCircleSize,
                  height: heroCircleSize,
                  borderRadius: heroCircleSize / 2,
                },
                !isError && animatedHeroCircleStyle,
                stage === 'ready' && styles.heroCircleReady,
                isError && styles.heroCircleError,
              ]}
            >
              {/* Rim brightens with the Anchor rather than glowing constantly. */}
              <Animated.View
                style={[
                  styles.heroRim,
                  { borderRadius: heroCircleSize / 2 },
                  !isError && animatedHeroRimStyle,
                ]}
                pointerEvents="none"
              />

              <Animated.View
                style={[styles.anchorStage, { width: sigilSize, height: sigilSize }, animatedAnchorStyle]}
              >
                {/* Blueprint layer: the unresolved structure, always faintly present. */}
                <View style={styles.anchorGhost} pointerEvents="none">
                  {renderGlyph(colors.anchor15.gilt)}
                </View>

                {/* Illuminated layer, revealed top-down as the Anchor resolves. */}
                <Animated.View
                  style={[styles.anchorReveal, { width: sigilSize }, animatedAnchorRevealStyle]}
                  pointerEvents="none"
                >
                  <View style={[styles.anchorRevealInner, { width: sigilSize, height: sigilSize }]}>
                    {renderGlyph(colors.anchor15.giltBright)}
                  </View>
                </Animated.View>

                {/* Hairline of light riding the illumination edge. */}
                {!isError ? (
                  <Animated.View
                    style={[styles.anchorRevealEdge, { width: sigilSize }, animatedRevealEdgeStyle]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={[
                        'rgba(242, 223, 168, 0)',
                        'rgba(242, 223, 168, 0.75)',
                        'rgba(242, 223, 168, 0)',
                      ]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                ) : null}

                {/* Light pass — a single refined sweep, used sparingly. */}
                {!isError ? (
                  <Animated.View
                    style={[
                      styles.anchorSweep,
                      {
                        width: sweepBandWidth,
                        height: sigilSize * 2,
                        top: -sigilSize * 0.5,
                        left: (sigilSize - sweepBandWidth) / 2,
                      },
                      animatedSweepStyle,
                    ]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={[
                        'rgba(246, 226, 148, 0)',
                        'rgba(246, 226, 148, 0.22)',
                        'rgba(255, 255, 255, 0.30)',
                        'rgba(246, 226, 148, 0.22)',
                        'rgba(246, 226, 148, 0)',
                      ]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                ) : null}
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
  heroHaloQuiet: {
    position: 'absolute',
    backgroundColor: 'rgba(217, 179, 108, 0.05)',
  },
  heroFinalPulse: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(242, 223, 168, 0.55)',
  },
  fragmentDot: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: colors.anchor15.giltBright,
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
  heroCircle: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 179, 108, 0.38)',
    backgroundColor: '#161F28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.anchor15.giltBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  heroRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(246, 226, 148, 0.5)',
  },
  heroCircleReady: {
    borderColor: colors.anchor15.giltBright,
    shadowColor: colors.anchor15.giltBright,
    shadowOpacity: 0.5,
    shadowRadius: 34,
  },

  // -- Anchor glyph stage --
  anchorStage: {
    position: 'relative',
    overflow: 'hidden',
  },
  anchorGhost: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.22,
  },
  anchorReveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  anchorRevealInner: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  anchorRevealEdge: {
    position: 'absolute',
    top: -1,
    left: 0,
    height: 1.5,
  },
  anchorSweep: {
    position: 'absolute',
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
