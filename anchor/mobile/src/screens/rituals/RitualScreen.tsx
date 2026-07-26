/**
 * Anchor App - Ritual Screen
 *
 * Reusable immersive ritual screen for both quick and deep charge.
 * Keeps existing ritual behavior while upgrading the surface language.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  useWindowDimensions,
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
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRitualController } from '@/hooks/useRitualController';
import { getRitualConfig } from '@/config/ritualConfigs';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import BackendAnchorService, { isBackendAnchorId } from '@/services/BackendAnchorService';
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
import { isFirstPrimeForAnchor as isAnchorFirstPrime } from '@/utils/anchorPriming';
import { useNotificationController } from '@/hooks/useNotificationController';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { PostPrimeTraceModal } from './components/PostPrimeTraceModal';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import {
  isPostPrimeTraceEligible,
  markPostPrimeTraceAttemptStarted,
} from '@/utils/postPrimeTraceEligibility';
import { useMissingAnchorRedirect } from './utils/useMissingAnchorRedirect';
import { useDeepPrimeSessionAudio } from './hooks/useDeepPrimeSessionAudio';
import { queueProgressionMilestonesFromStores } from '@/utils/progressionMilestones';
import { usePrimeSessionAccess } from '@/hooks/usePrimeSessionAccess';
import { createPracticeEventId } from '@/utils/primingAnalytics';
import {
  SessionAudioOverrideSheet,
  VoiceAndSoundSummaryRow,
} from '@/components/settings/SessionAudioOverrideSheet';
import {
  legacyAudioModeToSessionAudioDefaults,
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  resolveSessionAudioConfiguration,
  type SessionAudioConfiguration,
  type SessionAudioDefaults,
} from '@/types/sessionAudio';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { trackSessionStartedWithAudio } from '@/services/SessionAudioAnalytics';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { persistSessionAudioDefaults } from '@/services/SessionAudioPreferencesService';

// Single source of truth: derive each segment's width from the global progressAnim,
// which is already wall-clock-driven by useRitualController + the progressAnim effect.
// This avoids the previous mount-on-nonzero "pop in" and the per-segment Animated.timing
// race that produced juddery, stalled timer animation on the deep prime screen.
const DeepPhaseSegment = ({
  progressAnim,
  startProgress,
  endProgress,
  fillWidth,
  isPast,
}: {
  progressAnim: Animated.Value;
  startProgress: number;
  endProgress: number;
  fillWidth: number;
  isPast: boolean;
}) => {
  const widthAnim = progressAnim.interpolate({
    inputRange: [startProgress, endProgress],
    outputRange: [0, fillWidth],
    extrapolate: 'clamp',
  });

  const gradientColors = isPast
    ? (['#D4AF37', '#D4AF37'] as const)
    : (['#C8581A', '#D4AF37'] as const);

  return (
    <Animated.View style={[styles.deepPhaseTrackFill, { width: widthAnim }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const SYMBOL_SIZE = Math.min(width * 0.54, 220);
const RING_RADIUS = 124;
const RING_STROKE_WIDTH = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ARRIVE_PHASE_SECONDS = 8;
const ARRIVE_CHROME_FADE_MS = 500;
const ARRIVE_BREATH_PHASE_MS = 4000;
const DEEP_PRIME_BREATH_INHALE_S = 4;
const DEEP_PRIME_BREATH_HOLD_S = 1;
const DEEP_PRIME_BREATH_EXHALE_S = 5;
const DEEP_PRIME_BREATH_TOTAL_S =
  DEEP_PRIME_BREATH_INHALE_S + DEEP_PRIME_BREATH_HOLD_S + DEEP_PRIME_BREATH_EXHALE_S;
const SEAL_HEADLINE = 'Seal Your Intention';
const SEAL_SUPPORT_LINE =
  'Breathe with the rhythm. Let each exhale settle your intention into the symbol.';
const SEAL_INTENTION_LABEL = 'Your intention';
const SEAL_COMPLETE_HEADLINE = 'It is sealed.';
const SEAL_COMPLETE_SUPPORT = 'Your anchor now carries the intention forward.';
const SEAL_CONTINUE_LABEL = 'Continue';
const SEAL_HOLD_PROMPT = 'Hold gently to seal';
const SEAL_INHALE_DURATION_MS = 4000;
const SEAL_EXHALE_DURATION_MS = 6000;
type EmberParticle = {
  x: number;
  bottom: number;
  size: number;
  duration: number;
  drift: number;
  delay: number;
  isEmber: boolean;
};

type SealCopyMode = 'active' | 'complete';
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<RitualNavigationProp>();
  const { navigateToPractice, navigateToPaywall } = useTabNavigation();
  const route = useRoute<RitualRouteProp>();
  const {
    anchorId,
    ritualType,
    durationSeconds,
    mantraAudioEnabled,
    audioConfiguration,
    audioModeOverride,
    returnTo,
  } = route.params;
  const isMountedRef = useRef(true);
  const isCompletingRef = useRef(false);
  const hasFinalizedRef = useRef(false);
  const completionEventIdRef = useRef(createPracticeEventId());
  const sessionStartedWithAudioRef = useRef(false);
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
  const sessionAudioDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS
  );
  const reduceIntentionVisibility = useSettingsStore((state) => state.reduceIntentionVisibility ?? false);
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const { handlePrimeComplete } = useNotificationController();
  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const activeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const bumpThreadStrength = useSessionStore((state) => state.bumpThreadStrength);
  const primeSessionAccess = usePrimeSessionAccess();
  const anchor = getAnchorById(anchorId);
  const sigilSvg = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const isAnchorMissing = !anchor;
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const isFirstPrimeForAnchor = isAnchorFirstPrime(anchor);

  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showPostPrimeTrace, setShowPostPrimeTrace] = useState(false);
  const [pendingPostPrimeFlowId, setPendingPostPrimeFlowId] = useState<string | null>(null);
  const [sealCopyMode, setSealCopyMode] = useState<SealCopyMode>('active');
  const [sealBreathLabel, setSealBreathLabel] = useState<'Inhale' | 'Exhale'>('Inhale');
  const [showSealContinue, setShowSealContinue] = useState(false);
  const isCompactHeight = screenHeight <= 880;
  const deepHeroSize = Math.min(Math.round(screenWidth * 0.68), 280);
  const deepLandingHeroSize = Math.round(deepHeroSize * (isCompactHeight ? 0.74 : 0.78));
  const deepLandingOrbitSolidSize = deepLandingHeroSize * 1.02;
  const deepLandingOrbitDashOuterSize = deepLandingHeroSize * 1.16;
  const deepLandingOrbitDotOuterSize = deepLandingHeroSize * 1.28;
  const deepLandingOrbitDashInnerSize = deepLandingHeroSize * 1.34;
  const deepLandingStageSize = deepLandingOrbitDashInnerSize;
  const deepRingRadius = deepHeroSize / 2 + 22;
  const deepSealSvgSize = deepRingRadius * 2 + RING_STROKE_WIDTH * 4;
  const deepSealCenter = deepSealSvgSize / 2;
  const deepSealCircumference = 2 * Math.PI * deepRingRadius;
  const deepStageSize = deepHeroSize;
  const deepAuraOuterSize = deepHeroSize * 1.55;
  const deepAuraInnerSize = deepHeroSize * 1.25;
  const deepOrbitSolidSize = deepHeroSize * 1.02;
  const deepOrbitDashOuterSize = deepHeroSize * 1.16;
  const deepOrbitDotOuterSize = deepHeroSize * 1.26;
  const deepOrbitDashInnerSize = deepHeroSize * 1.34;
  const deepOrbRingOuterSize = deepHeroSize * 1.3;
  const deepOrbRingInnerSize = deepHeroSize * 1.14;
  const deepOrbScale = deepHeroSize / 240;
  const deepPulseOuterSize = deepHeroSize * 1.1;
  const deepPulseInnerSize = deepHeroSize * 0.96;
  const deepEmberHaloSize = deepHeroSize * 0.94;

  useMissingAnchorRedirect(!isAnchorMissing, navigation);

  useEffect(() => {
    if (isAnchorMissing || primeSessionAccess.deep.isAllowed) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      navigation.goBack();
      requestAnimationFrame(() => {
        AnalyticsService.track('free_weekly_sessions_used', {
          source: 'ritual_screen_backstop',
          remaining_weekly_free_sessions: primeSessionAccess.deep.remaining,
          tier: primeSessionAccess.tier,
        });

        navigateToPaywall({
          source: 'free_weekly_sessions_used',
          preferredPlanId: 'annual',
        });
      });
    });

    return () => task.cancel();
  }, [isAnchorMissing, navigateToPaywall, navigation, primeSessionAccess.deep.isAllowed]);

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
  const sessionAudioType = isDeepRitual ? 'deep_prime' : 'focus';
  const [resolvedSessionAudio, setResolvedSessionAudio] =
    useState<SessionAudioConfiguration>(() =>
      audioConfiguration ??
      resolveSessionAudioConfiguration(
        sessionAudioDefaults[sessionAudioType],
        audioModeOverride
          ? legacyAudioModeToSessionAudioDefaults(audioModeOverride)
          : undefined
      )
    );
  const [showAudioOverride, setShowAudioOverride] = useState(false);
  const sessionAudioPlan = useMemo(
    () =>
      resolveSessionAudioPlan({
        sessionType: sessionAudioType,
        durationSeconds: config.totalDurationSeconds,
        configuration: resolvedSessionAudio,
      }),
    [config.totalDurationSeconds, resolvedSessionAudio, sessionAudioType]
  );
  const deepPhaseTrackHorizontalPadding = 20;
  const deepPhaseTrackGap = 4;
  const deepPhaseSegmentWidth = Math.max(
    0,
    (screenWidth -
      deepPhaseTrackHorizontalPadding * 2 -
      deepPhaseTrackGap * Math.max(0, config.phases.length - 1)) /
      Math.max(1, config.phases.length)
  );
  const [isLanding, setIsLanding] = useState(isDeepRitual);

  const arrivePhaseEnabled =
    (ritualType === 'focus' || ritualType === 'quick') &&
    config.totalDurationSeconds > 5;

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
  const deepBreathAnim = useRef(new Animated.Value(0)).current;
  const sealEntranceAnim = useRef(new Animated.Value(0)).current;
  const sealPulseAnim = useRef(new Animated.Value(0)).current;
  const sealTitleOpacityAnim = useRef(new Animated.Value(0)).current;
  const sealIntentionOpacityAnim = useRef(new Animated.Value(0)).current;
  const sealSupportOpacityAnim = useRef(new Animated.Value(0)).current;
  const sealBreathOpacityAnim = useRef(new Animated.Value(0)).current;
  const sealCopySwapAnim = useRef(new Animated.Value(1)).current;
  const sealContinueOpacityAnim = useRef(new Animated.Value(0)).current;
  const sealIntentionGlowAnim = useRef(new Animated.Value(0)).current;
  const regularRingSpinA = useRef(new Animated.Value(0)).current;
  const regularRingSpinB = useRef(new Animated.Value(0)).current;
  const sessionChromeOpacity = useRef(
    new Animated.Value(arrivePhaseEnabled ? 0 : 1),
  ).current;
  const arriveBreathScaleAnim = useRef(new Animated.Value(1)).current;
  const arriveBreathOpacityAnim = useRef(new Animated.Value(0.55)).current;

  const instructionFadeAnim = useRef(new Animated.Value(1)).current;
  const [displayedInstruction, setDisplayedInstruction] = useState(
    config.phases[0]?.instructions[0] ?? ''
  );
  const deepEmbers = useRef<EmberParticle[]>(makeDeepEmbers(22)).current;
  const sealBreathTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepTotalMs = Math.max(1000, Math.round(config.totalDurationSeconds * 1000));
  const deepTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deepEndAtMsRef = useRef<number>(Date.now() + deepTotalMs);
  const deepRemainingMsRef = useRef<number>(deepTotalMs);
  const [deepRemainingMs, setDeepRemainingMs] = useState(deepTotalMs);
  const deepSealAutoCompleteStartedRef = useRef(false);

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
    manageSessionAudioExternally: isDeepRitual,
    audioConfiguration: resolvedSessionAudio,
  });
  const {
    fadeOutAndStop: fadeOutDeepPrimeAudio,
    hasVoiceGuidance: shouldHideDeepPrimeGuidanceText,
  } = useDeepPrimeSessionAudio({
    plan: sessionAudioPlan,
    remainingMs: deepRemainingMs,
    isActive: state.isActive,
    isComplete: state.isComplete,
  });

  const clearDeepTimerInterval = useCallback(() => {
    if (deepTimerIntervalRef.current) {
      clearInterval(deepTimerIntervalRef.current);
      deepTimerIntervalRef.current = null;
    }
  }, []);

  const syncDeepRemainingMs = useCallback((remainingMs: number) => {
    const nextRemainingMs = Math.max(0, remainingMs);
    deepRemainingMsRef.current = nextRemainingMs;
    setDeepRemainingMs(nextRemainingMs);
  }, []);

  const animateDeepProgressToEnd = useCallback((remainingMs: number) => {
    progressAnim.stopAnimation();
    if (remainingMs <= 0) {
      progressAnim.setValue(1);
      return;
    }

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  const tickDeepTimer = useCallback(() => {
    const remainingMs = Math.max(0, deepEndAtMsRef.current - Date.now());
    syncDeepRemainingMs(remainingMs);

    if (remainingMs <= 0) {
      clearDeepTimerInterval();
    }
  }, [clearDeepTimerInterval, syncDeepRemainingMs]);

  const startDeepTimer = useCallback((runningMs: number) => {
    const nextRunningMs = Math.max(0, runningMs);
    clearDeepTimerInterval();
    deepEndAtMsRef.current = Date.now() + nextRunningMs;
    syncDeepRemainingMs(nextRunningMs);
    animateDeepProgressToEnd(nextRunningMs);
    deepTimerIntervalRef.current = setInterval(tickDeepTimer, 250);
  }, [animateDeepProgressToEnd, clearDeepTimerInterval, syncDeepRemainingMs, tickDeepTimer]);

  const pauseDeepTimer = useCallback(() => {
    const remainingMs = Math.max(0, deepEndAtMsRef.current - Date.now());
    clearDeepTimerInterval();
    progressAnim.stopAnimation();
    syncDeepRemainingMs(remainingMs);
  }, [clearDeepTimerInterval, progressAnim, syncDeepRemainingMs]);

  const resumeDeepTimer = useCallback(() => {
    if (deepRemainingMsRef.current <= 0) {
      syncDeepRemainingMs(0);
      progressAnim.setValue(1);
      return;
    }
    startDeepTimer(deepRemainingMsRef.current);
  }, [progressAnim, startDeepTimer, syncDeepRemainingMs]);

  useEffect(() => {
    clearDeepTimerInterval();
    deepEndAtMsRef.current = Date.now() + deepTotalMs;
    deepRemainingMsRef.current = deepTotalMs;
    setDeepRemainingMs(deepTotalMs);
    deepSealAutoCompleteStartedRef.current = false;
    progressAnim.setValue(0);

    return () => {
      clearDeepTimerInterval();
    };
  }, [clearDeepTimerInterval, deepTotalMs, progressAnim]);

  const isArrivePhase =
    arrivePhaseEnabled &&
    state.elapsedSeconds < ARRIVE_PHASE_SECONDS &&
    !state.isComplete &&
    !state.isSealPhase;

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

  const handleBeginPriming = () => {
    stopVoicePreview();
    if (!sessionStartedWithAudioRef.current) {
      sessionStartedWithAudioRef.current = true;
      trackSessionStartedWithAudio(sessionAudioPlan);
    }
    setIsLanding(false);
    if (isDeepRitual) {
      deepSealAutoCompleteStartedRef.current = false;
      progressAnim.setValue(0);
      startDeepTimer(deepTotalMs);
    }
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

  // Wall-clock-driven progress for the entire timer animation. Used both for the focus
  // ProgressHaloRing strokeDashoffset and for the deep prime phase segment widths.
  // Fires on lifecycle transitions only (start / pause / resume / complete). The
  // ongoing Animated.timing handles smooth interpolation between integer-second ticks.
  useEffect(() => {
    if (isDeepRitual) {
      return;
    }

    const totalDuration = Math.max(1, config.totalDurationSeconds);

    if (state.isComplete) {
      progressAnim.stopAnimation(() => {
        progressAnim.setValue(1);
      });
      return;
    }

    if (!state.isActive) {
      // Paused or idle: freeze at current value (do not snap, preserves sub-second precision).
      progressAnim.stopAnimation();
      return;
    }

    // Active: align to where we should be (handles fresh start after reset where the
    // held value can be stale), then linearly animate to 1 over the remaining time.
    const expectedProgress = Math.min(
      1,
      Math.max(0, state.elapsedSeconds / totalDuration)
    );
    const remainingSeconds = totalDuration - state.elapsedSeconds;

    progressAnim.stopAnimation((currentVal) => {
      // Snap if held value is far from expected (e.g., after reset); otherwise preserve
      // currentVal so pause→resume continues smoothly with sub-second precision.
      const startVal =
        Math.abs(currentVal - expectedProgress) > 0.01 ? expectedProgress : currentVal;
      progressAnim.setValue(startVal);

      if (remainingSeconds <= 0) {
        progressAnim.setValue(1);
        return;
      }

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    });
    // Effect intentionally only fires on lifecycle transitions (isActive / isComplete).
    // state.elapsedSeconds + config.totalDurationSeconds are read inside the effect but
    // captured fresh at the transition moment, which is exactly the snapshot we want.
    // Including them in deps would restart the timing animation every second tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeepRitual, state.isActive, state.isComplete, progressAnim]);


  useEffect(() => {
    if (state.isSealPhase && !state.isSealComplete) {
      setSealCopyMode('active');
      setShowSealContinue(false);
      setSealBreathLabel('Inhale');

      if (sealBreathTimeoutRef.current) {
        clearTimeout(sealBreathTimeoutRef.current);
      }

      const loopBreathLabel = () => {
        setSealBreathLabel('Inhale');
        sealBreathTimeoutRef.current = setTimeout(() => {
          setSealBreathLabel('Exhale');
          sealBreathTimeoutRef.current = setTimeout(loopBreathLabel, SEAL_EXHALE_DURATION_MS);
        }, SEAL_INHALE_DURATION_MS);
      };

      loopBreathLabel();

      if (reduceMotionEnabled) {
        sealTitleOpacityAnim.setValue(1);
        sealIntentionOpacityAnim.setValue(1);
        sealSupportOpacityAnim.setValue(1);
        sealBreathOpacityAnim.setValue(1);
        sealCopySwapAnim.setValue(1);
        sealContinueOpacityAnim.setValue(0);
      } else {
        sealTitleOpacityAnim.setValue(0);
        sealIntentionOpacityAnim.setValue(0);
        sealSupportOpacityAnim.setValue(0);
        sealBreathOpacityAnim.setValue(0);
        sealCopySwapAnim.setValue(1);
        sealContinueOpacityAnim.setValue(0);
        sealIntentionGlowAnim.setValue(0);

        Animated.stagger(180, [
          Animated.timing(sealTitleOpacityAnim, {
            toValue: 1,
            duration: 850,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }),
          Animated.timing(sealIntentionOpacityAnim, {
            toValue: 1,
            duration: 850,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }),
          Animated.timing(sealSupportOpacityAnim, {
            toValue: 1,
            duration: 900,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }),
          Animated.timing(sealBreathOpacityAnim, {
            toValue: 1,
            duration: 900,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }),
        ]).start();

        Animated.sequence([
          Animated.delay(2200),
          Animated.timing(sealIntentionGlowAnim, {
            toValue: 1,
            duration: 1400,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          Animated.timing(sealIntentionGlowAnim, {
            toValue: 0,
            duration: 1800,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
        ]).start();
      }

      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: SEAL_INHALE_DURATION_MS,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: SEAL_EXHALE_DURATION_MS,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
        ])
      );

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(sealPulseAnim, {
            toValue: 1,
            duration: SEAL_INHALE_DURATION_MS,
            easing: EASING.TRANSITION,
            useNativeDriver: true,
          }),
          Animated.timing(sealPulseAnim, {
            toValue: 0,
            duration: SEAL_EXHALE_DURATION_MS,
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
        if (sealBreathTimeoutRef.current) {
          clearTimeout(sealBreathTimeoutRef.current);
          sealBreathTimeoutRef.current = null;
        }
        glowLoop.stop();
        pulseLoop.stop();
        spinLoopA.stop();
        spinLoopB.stop();
      };
    }

    if (sealBreathTimeoutRef.current) {
      clearTimeout(sealBreathTimeoutRef.current);
      sealBreathTimeoutRef.current = null;
    }
    sealEntranceAnim.setValue(0);
    glowAnim.setValue(0);
  }, [
    glowAnim,
    reduceMotionEnabled,
    sealBreathOpacityAnim,
    sealContinueOpacityAnim,
    sealCopySwapAnim,
    sealEntranceAnim,
    sealIntentionGlowAnim,
    sealIntentionOpacityAnim,
    sealPulseAnim,
    sealSupportOpacityAnim,
    sealTitleOpacityAnim,
    regularRingSpinA,
    regularRingSpinB,
    state.isSealComplete,
    state.isSealPhase,
  ]);

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
      if (isDeepRitual) {
        setSealCopyMode('complete');
        setShowSealContinue(false);
        sealBreathOpacityAnim.setValue(0);
        sealCopySwapAnim.setValue(1);
        sealContinueOpacityAnim.setValue(0);
        return;
      }

      if (reduceMotionEnabled) {
        setSealCopyMode('complete');
        setShowSealContinue(true);
        sealBreathOpacityAnim.setValue(0);
        sealCopySwapAnim.setValue(1);
        sealContinueOpacityAnim.setValue(1);
      } else {
        Animated.timing(sealBreathOpacityAnim, {
          toValue: 0,
          duration: 500,
          easing: EASING.TRANSITION,
          useNativeDriver: true,
        }).start();

        Animated.timing(sealCopySwapAnim, {
          toValue: 0,
          duration: 260,
          easing: EASING.TRANSITION,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          setSealCopyMode('complete');
          Animated.timing(sealCopySwapAnim, {
            toValue: 1,
            duration: 760,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }).start();
        });

        Animated.sequence([
          Animated.delay(760),
          Animated.timing(sealContinueOpacityAnim, {
            toValue: 1,
            duration: 720,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            setShowSealContinue(true);
          }
        });
      }
    } catch (error) {
      isCompletingRef.current = false;
      logger.warn('Failed to update anchor locally', error);
      Alert.alert('Save failed', 'Your charge could not be saved. Please try again.');
    }
  }

  const handleSkipPostPrimeTrace = useCallback(() => {
    setShowPostPrimeTrace(false);
    InteractionManager.runAfterInteractions(() => {
      setShowCompletion(true);
    });
  }, []);

  const handleBeginPostPrimeTrace = useCallback(async () => {
    await markPostPrimeTraceAttemptStarted();

    const flowId = beginPostPrimeTraceFlow(anchorId);
    setPendingPostPrimeFlowId(flowId);
    setShowPostPrimeTrace(false);
    setShowCompletion(false);

    navigation.navigate('ManualReinforcement', {
      source: 'post_prime_trace',
      anchorId,
    });
  }, [anchorId, beginPostPrimeTraceFlow, navigation]);

  useEffect(() => {
    if (!pendingPostPrimeFlowId) {
      return;
    }

    if (
      !activeFlow ||
      activeFlow.flowId !== pendingPostPrimeFlowId ||
      activeFlow.result === 'pending'
    ) {
      return;
    }

    const completedPostPrimeTrace = activeFlow.result === 'completed';

    usePostPrimeTraceStore.getState().clearFlow(pendingPostPrimeFlowId);
    setPendingPostPrimeFlowId(null);

    if (completedPostPrimeTrace) {
      bumpThreadStrength(2);
      AnalyticsService.track('post_prime_trace_completed', {
        anchor_id: anchorId,
        session_duration_seconds: config.totalDurationSeconds,
      });
    }

    InteractionManager.runAfterInteractions(() => {
      setShowCompletion(true);
    });
  }, [
    activeFlow,
    anchorId,
    bumpThreadStrength,
    config.totalDurationSeconds,
    pendingPostPrimeFlowId,
  ]);

  const exitRitual = useCallback(async () => {
    exitingRef.current = true;
    setShowExitWarning(false);
    clearDeepTimerInterval();
    await fadeOutDeepPrimeAudio();

    if (returnTo === 'practice') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail', { anchorId });
      return;
    }

    if (returnTo === 'vault' && isPendingFirstAnchor && anchor) {
      // Guest's first anchor: even when the prime session is abandoned early,
      // the account gate must run before the Vault becomes reachable.
      navigation.replace('SaveProgress', { anchor });
      return;
    }

    navigateToVaultDestination(navigation, 'reset');
  }, [anchor, anchorId, clearDeepTimerInterval, fadeOutDeepPrimeAudio, isPendingFirstAnchor, navigateToPractice, navigation, returnTo]);

  const continueFromSeal = useCallback(async () => {
    if (hasFinalizedRef.current) {
      return;
    }
    hasFinalizedRef.current = true;

    let chargeType: 'initial_quick' | 'initial_deep' | 'recharge' = 'initial_quick';

    if (ritualType === 'quick' || ritualType === 'focus') {
      chargeType = 'initial_quick';
    } else if (ritualType === 'deep' || ritualType === 'ritual') {
      chargeType = 'initial_deep';
    }

    let backendSyncFailed = false;
    let effectiveAnchorId = anchorId;

    if (isPendingFirstAnchor) {
      enqueuePendingFirstAnchorMutation({
        type: 'charge_anchor',
        tempAnchorId: anchorId,
        chargeType,
        durationSeconds: config.totalDurationSeconds,
        idempotencyKey: completionEventIdRef.current,
        queuedAt: new Date().toISOString(),
      });
    } else {
      try {
        const persistedAnchor = await BackendAnchorService.ensureServerAnchor(anchorId);
        effectiveAnchorId = persistedAnchor?.id ?? anchorId;
      } catch (syncError) {
        backendSyncFailed = true;
        logger.warn('Anchor create sync failed before charge, saving locally only', syncError);
      }

      const token = await AuthService.getIdToken();
      const isMockToken =
        typeof token === 'string' && (token === 'mock-jwt-token' || token.startsWith('mock-'));

      if (!backendSyncFailed && isBackendAnchorId(effectiveAnchorId) && !isMockToken) {
        try {
          await apiClient.post(`/api/anchors/${effectiveAnchorId}/charge`, {
            chargeType,
            durationSeconds: config.totalDurationSeconds,
            idempotencyKey: completionEventIdRef.current,
          });
        } catch (syncError) {
          backendSyncFailed = true;
          logger.warn('Charge sync failed, saving locally only', syncError);
        }
      } else if (!isBackendAnchorId(effectiveAnchorId)) {
        backendSyncFailed = true;
      }
    }

    const chargedAt = new Date();
    await updateAnchor(anchorId, {
      isCharged: true,
      chargedAt,
      firstChargedAt: anchor?.firstChargedAt ?? chargedAt,
      chargeCount: (anchor?.chargeCount ?? 0) + 1,
    });

    const chargeMode = isDeepRitual ? 'deep' : 'quick';
    AnalyticsService.track(AnalyticsEvents.ANCHOR_CHARGED, {
      anchor_id: effectiveAnchorId,
      source: 'ritual',
      charge_type: chargeType,
      charge_mode: chargeMode,
      duration_seconds: config.totalDurationSeconds,
      backend_synced: !backendSyncFailed,
      is_first_prime: isFirstPrimeForAnchor,
      guidance_voice: sessionAudioPlan.configuration.guidanceVoice,
      requested_guidance_voice: sessionAudioPlan.requestedConfiguration.guidanceVoice,
      background_audio: sessionAudioPlan.configuration.backgroundAudio,
      audio_source: sessionAudioPlan.configuration.source,
    });
    AnalyticsService.track(
      isDeepRitual
        ? AnalyticsEvents.DEEP_CHARGE_COMPLETED
        : AnalyticsEvents.QUICK_CHARGE_COMPLETED,
      {
        anchor_id: effectiveAnchorId,
        source: 'ritual',
        duration_seconds: config.totalDurationSeconds,
        backend_synced: !backendSyncFailed,
        is_first_prime: isFirstPrimeForAnchor,
        guidance_voice: sessionAudioPlan.configuration.guidanceVoice,
        requested_guidance_voice: sessionAudioPlan.requestedConfiguration.guidanceVoice,
        background_audio: sessionAudioPlan.configuration.backgroundAudio,
        audio_source: sessionAudioPlan.configuration.source,
      }
    );

    if (backendSyncFailed && isMountedRef.current) {
      Alert.alert('Saved Locally', 'Anchor charge saved. Sync will retry later.');
    }

    if (!isMountedRef.current) {
      return;
    }

    if (isFirstPrimeForAnchor) {
      exitingRef.current = true;
      navigation.replace('FirstPrimeComplete', {
        anchorId: effectiveAnchorId,
        sessionCount: 1,
        threadStrength: 1,
        durationSeconds: config.totalDurationSeconds,
        completionEventId: completionEventIdRef.current,
        audioConfiguration: sessionAudioPlan.configuration,
        returnTo,
      });
      return;
    }

    if (isDeepRitual) {
      const completedAt = new Date().toISOString();
      const completionEventId = recordSession({
        idempotencyKey: completionEventIdRef.current,
        anchorId,
        type: 'reinforce',
        durationSeconds: config.totalDurationSeconds,
        mode:
          sessionAudioPlan.configuration.backgroundAudio === 'ambient' ||
          sessionAudioPlan.configuration.guidanceVoice !== 'none'
            ? 'ambient'
            : 'silent',
        audioConfiguration: sessionAudioPlan.configuration,
        completedAt,
      });
      await PracticeCompletionService.queueLegacyCompletion({
        id: completionEventId,
        anchorId,
        anchorLocalId: anchor?.localId,
        practiceMode: 'deep_prime',
        durationSeconds: config.totalDurationSeconds,
        completedAt,
        guidanceVoice: sessionAudioPlan.configuration.guidanceVoice,
        backgroundAudio: sessionAudioPlan.configuration.backgroundAudio,
        source: returnTo === 'practice' ? 'practice_screen' : 'anchor_detail',
      });
      await queueProgressionMilestonesFromStores({ sourceEventId: completionEventId });
      await handlePrimeComplete();
      await exitRitual();
      return;
    }

    exitingRef.current = true;
    navigation.replace('ChargeComplete', {
      anchorId: effectiveAnchorId,
      durationSeconds: config.totalDurationSeconds,
      completionEventId: completionEventIdRef.current,
      audioConfiguration: sessionAudioPlan.configuration,
      returnTo,
    });
  }, [
    anchor?.chargeCount,
    anchor?.firstChargedAt,
    anchorId,
    config.totalDurationSeconds,
    enqueuePendingFirstAnchorMutation,
    exitRitual,
    handlePrimeComplete,
    isDeepRitual,
    isFirstPrimeForAnchor,
    isPendingFirstAnchor,
    navigation,
    resolvedSessionAudio,
    recordSession,
    returnTo,
    ritualType,
    sessionAudioPlan,
    updateAnchor,
  ]);

  useEffect(() => {
    if (!isDeepRitual || !state.isSealComplete || deepSealAutoCompleteStartedRef.current) {
      return;
    }

    deepSealAutoCompleteStartedRef.current = true;
    const autoCompleteTimeout = setTimeout(() => {
      void continueFromSeal();
    }, reduceMotionEnabled ? 0 : 350);

    return () => clearTimeout(autoCompleteTimeout);
  }, [continueFromSeal, isDeepRitual, reduceMotionEnabled, state.isSealComplete]);

  function handleBack() {
    if (state.isSealComplete && !showSealContinue) {
      return;
    }
    if (state.isComplete || state.isSealComplete) {
      exitRitual();
      return;
    }
    setShowExitWarning(true);
  }

  const handleCompletionDone = useCallback(async (reflectionWord?: string) => {
    if (hasFinalizedRef.current) {
      return;
    }
    hasFinalizedRef.current = true;

    setShowCompletion(false);
    exitingRef.current = true;

    const completedAt = new Date().toISOString();
    const completionEventId = recordSession({
      idempotencyKey: completionEventIdRef.current,
      anchorId,
      type: 'reinforce',
      durationSeconds: config.totalDurationSeconds,
      mode:
        sessionAudioPlan.configuration.backgroundAudio === 'ambient' ||
        sessionAudioPlan.configuration.guidanceVoice !== 'none'
          ? 'ambient'
          : 'silent',
      audioConfiguration: sessionAudioPlan.configuration,
      completedAt,
      reflectionWord,
    });
    await PracticeCompletionService.queueLegacyCompletion({
      id: completionEventId,
      anchorId,
      anchorLocalId: anchor?.localId,
      practiceMode: 'deep_prime',
      durationSeconds: config.totalDurationSeconds,
      completedAt,
      guidanceVoice: sessionAudioPlan.configuration.guidanceVoice,
      backgroundAudio: sessionAudioPlan.configuration.backgroundAudio,
      source: returnTo === 'practice' ? 'practice_screen' : 'anchor_detail',
    });

    await queueProgressionMilestonesFromStores({ sourceEventId: completionEventId });
    await handlePrimeComplete();
    exitRitual();
  }, [anchorId, config.totalDurationSeconds, sessionAudioPlan, recordSession, handlePrimeComplete, exitRitual]);

  useEffect(() => {
    if (typeof navigation.addListener !== 'function') return () => undefined;
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (
        exitingRef.current ||
        state.isComplete ||
        (state.isSealComplete && showSealContinue)
      ) {
        return;
      }
      event.preventDefault();
      setShowExitWarning(true);
    });

    return unsubscribe;
  }, [navigation, showSealContinue, state.isComplete, state.isSealComplete]);

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
  const sealHeadline = sealCopyMode === 'complete' ? SEAL_COMPLETE_HEADLINE : SEAL_HEADLINE;
  const sealSupportLine =
    sealCopyMode === 'complete' ? SEAL_COMPLETE_SUPPORT : SEAL_SUPPORT_LINE;
  const sealIntentText = anchor ? `"${anchor.intentionText}"` : '""';
  const deepInstructionText = state.isSealPhase ? sealSupportLine : displayedInstruction;
  const showSealHoldPrompt =
    state.isSealPhase && !state.isSealComplete && state.sealProgress === 0;
  const currentPhaseDuration = state.currentPhase?.durationSeconds ?? 1;
  const phaseRemaining = state.isComplete
    ? 0
    : Math.max(0, currentPhaseDuration - state.phaseElapsed);
  const deepPhaseTime = formatMSS(phaseRemaining);
  const deepTotalTime = formatMSS(Math.ceil(deepRemainingMs / 1000));
  const deepPauseLabel = state.isActive ? 'Pause' : 'Resume';
  // Pre-compute each phase's [start, end] position within the total progress (0..1).
  // The deep phase bars interpolate their width from progressAnim using these ranges,
  // so the bars share the same wall-clock-driven timeline as the rest of the timer.
  const phaseProgressRanges = useMemo(() => {
    const totalSeconds = Math.max(1, config.totalDurationSeconds);
    let accumSeconds = 0;
    return config.phases.map((phase) => {
      const startProgress = accumSeconds / totalSeconds;
      accumSeconds += Math.max(0, phase.durationSeconds);
      const endProgress = Math.min(1, accumSeconds / totalSeconds);
      return { startProgress, endProgress };
    });
  }, [config.phases, config.totalDurationSeconds]);
  const interpolateDeepBreath = (outputRange: number[]) =>
    deepBreathAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [outputRange[0], outputRange[1]],
    });
  const deepOrbitRotateA = deepOrbitSpinA.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const deepOrbitRotateB = deepOrbitSpinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const deepPulseAOpacity = interpolateDeepBreath([0.2, 0.55]);
  const deepPulseAScale = interpolateDeepBreath([0.88, 1.16]);
  const deepPulseBOpacity = interpolateDeepBreath([0.16, 0.38]);
  const deepPulseBScale = interpolateDeepBreath([0.92, 1.1]);
  const deepHaloScale = interpolateDeepBreath([0.96, 1.05]);
  const deepHaloOpacity = interpolateDeepBreath([0.82, 1]);
  const deepSigilTranslateY = interpolateDeepBreath([0, 0]);
  const deepSigilScale = interpolateDeepBreath([0.985, 1.07]);
  const deepAuraScale = interpolateDeepBreath([0.9, 1.12]);
  const deepAuraOpacity = interpolateDeepBreath([0.08, 0.24]);
  const deepInnerAuraScale = interpolateDeepBreath([0.92, 1.08]);
  const deepInnerAuraOpacity = interpolateDeepBreath([0.14, 0.34]);
  const deepOuterOrbOpacity = interpolateDeepBreath([0.68, 0.84]);
  const deepInnerOrbOpacity = interpolateDeepBreath([0.64, 0.8]);

  useEffect(() => {
    if (!isDeepRitual || !isReady) {
      deepOrbitSpinA.setValue(0);
      deepOrbitSpinB.setValue(0);
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

    orbitALoop.start();
    orbitBLoop.start();

    return () => {
      orbitALoop.stop();
      orbitBLoop.stop();
    };
  }, [
    deepOrbitSpinA,
    deepOrbitSpinB,
    isDeepRitual,
    isReady,
  ]);

  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;

    if (!isDeepRitual || !isReady) {
      deepBreathAnim.setValue(0);
      return () => undefined;
    }

    if (reduceMotionEnabled) {
      deepBreathAnim.setValue(state.isSealPhase ? 0.68 : 0.35);
      return () => undefined;
    }

    if (state.isSealPhase) {
      deepBreathAnim.setValue(0.45);
      loopAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(deepBreathAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(deepBreathAnim, {
            toValue: 0.45,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loopAnimation.start();
      return () => {
        loopAnimation?.stop();
      };
    }

    if (!state.isActive) {
      Animated.timing(deepBreathAnim, {
        toValue: 0.35,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
      return () => undefined;
    }

    deepBreathAnim.setValue(0);
    loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(deepBreathAnim, {
          toValue: 1,
          duration: DEEP_PRIME_BREATH_INHALE_S * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(DEEP_PRIME_BREATH_HOLD_S * 1000),
        Animated.timing(deepBreathAnim, {
          toValue: 0,
          duration: DEEP_PRIME_BREATH_EXHALE_S * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loopAnimation.start();

    return () => {
      loopAnimation?.stop();
    };
  }, [
    deepBreathAnim,
    isDeepRitual,
    isReady,
    reduceMotionEnabled,
    state.isActive,
    state.isSealPhase,
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
      pauseDeepTimer();
      actions.pause();
    } else {
      resumeDeepTimer();
      actions.resume();
    }
  };

  const deepSealDashoffset = deepSealCircumference * (1 - state.sealProgress);

  if (isAnchorMissing) {
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
                    accessibilityLabel="Exit practice"
                  >
                    <Text style={styles.deepCloseIcon}>×</Text>
                  </TouchableOpacity>
                  <Text style={styles.landingTopBarTitle}>A N C H O R</Text>
                  <View style={styles.deepHeaderSpacer} />
                </View>

                <View
                  style={[
                    styles.landingCenterContent,
                    isCompactHeight ? styles.landingCenterContentCompact : null,
                  ]}
                >
                  <Text style={styles.landingTitle}>DEEP PRIMING</Text>
                  <Text
                    style={[
                      styles.landingTimeText,
                      isCompactHeight ? styles.landingTimeTextCompact : null,
                    ]}
                  >
                    {formatLandingTime(config.totalDurationSeconds)}
                  </Text>

                  <View
                    style={[
                      styles.landingSigilWrapper,
                      isCompactHeight ? styles.landingSigilWrapperCompact : null,
                      { width: deepLandingStageSize, height: deepLandingStageSize },
                    ]}
                  >
                    <View
                      style={[
                        styles.deepArtworkCanvas,
                        { width: deepLandingStageSize, height: deepLandingStageSize },
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.deepOrbitSolid,
                          {
                            width: deepLandingOrbitSolidSize,
                            height: deepLandingOrbitSolidSize,
                            borderRadius: deepLandingOrbitSolidSize / 2,
                            transform: [{ rotate: deepOrbitRotateA }],
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.deepOrbitDashOuter,
                          {
                            width: deepLandingOrbitDashOuterSize,
                            height: deepLandingOrbitDashOuterSize,
                            borderRadius: deepLandingOrbitDashOuterSize / 2,
                            transform: [{ rotate: deepOrbitRotateB }],
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.deepOrbitDotOuter,
                          {
                            width: deepLandingOrbitDotOuterSize,
                            height: deepLandingOrbitDotOuterSize,
                            borderRadius: deepLandingOrbitDotOuterSize / 2,
                            transform: [{ rotate: deepOrbitRotateA }],
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.deepOrbitDashInner,
                          {
                            width: deepLandingOrbitDashInnerSize,
                            height: deepLandingOrbitDashInnerSize,
                            borderRadius: deepLandingOrbitDashInnerSize / 2,
                            transform: [{ rotate: deepOrbitRotateB }],
                          },
                        ]}
                      />

                      <Animated.View
                        style={[
                          styles.deepSigilContainer,
                          {
                            width: deepLandingHeroSize,
                            height: deepLandingHeroSize,
                            borderRadius: deepLandingHeroSize / 2,
                            transform: [{ translateY: deepSigilTranslateY }],
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
                            style={[
                              styles.symbolImage,
                              {
                                width: deepLandingHeroSize,
                                height: deepLandingHeroSize,
                                borderRadius: deepLandingHeroSize / 2,
                              },
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <SigilSvg xml={sigilSvg} width={deepLandingHeroSize} height={deepLandingHeroSize} />
                        )}
                      </Animated.View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.landingTimelineRow,
                      isCompactHeight ? styles.landingTimelineRowCompact : null,
                    ]}
                  >
                    {config.phases.map((p, i) => (
                      <View
                        key={i}
                        style={[
                          styles.landingTimelineBox,
                          isCompactHeight ? styles.landingTimelineBoxCompact : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.landingTimelineNum,
                            isCompactHeight ? styles.landingTimelineNumCompact : null,
                          ]}
                        >
                          0{i + 1}
                        </Text>
                        <Text
                          style={[
                            styles.landingTimelineText,
                            isCompactHeight ? styles.landingTimelineTextCompact : null,
                          ]}
                        >
                          {p.title}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {!reduceIntentionVisibility && anchor.intentionText ? (
                    <View
                      style={[
                        styles.landingIntentionWrap,
                        isCompactHeight ? styles.landingIntentionWrapCompact : null,
                      ]}
                    >
                      <Text style={styles.landingIntentionLabel}>INTENTION</Text>
                      <Text
                        style={[
                          styles.landingIntentionText,
                          isCompactHeight ? styles.landingIntentionTextCompact : null,
                        ]}
                      >
                        "{anchor.intentionText}"
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.landingBottomSection,
                    isCompactHeight ? styles.landingBottomSectionCompact : null,
                  ]}
                >
                  <VoiceAndSoundSummaryRow
                    value={resolvedSessionAudio}
                    onPress={() => setShowAudioOverride(true)}
                  />
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
                <SessionAudioOverrideSheet
                  visible={showAudioOverride}
                  sessionType="deep_prime"
                  durationSeconds={config.totalDurationSeconds}
                  initialValue={resolvedSessionAudio}
                  onCancel={() => setShowAudioOverride(false)}
                  onConfirm={(value: SessionAudioDefaults, makeDefault: boolean) => {
                    setResolvedSessionAudio({ ...value, source: 'session_override' });
                    setShowAudioOverride(false);
                    if (makeDefault) {
                      void persistSessionAudioDefaults('deep_prime', value).catch(() => undefined);
                    }
                  }}
                />
              </View>
            ) : (
              <>
                <Animated.View pointerEvents="none" style={[styles.deepPhaseFlash, { opacity: deepPhaseFlashAnim }]} />

            <Animated.View
              style={[
                styles.deepPhaseTrackWrap,
                isCompactHeight ? styles.deepPhaseTrackWrapCompact : null,
                { opacity: phaseIndicatorOpacityAnim },
              ]}
            >
              <View style={styles.deepPhaseTrackRow}>
                {config.phases.map((phase, index) => {
                  return (
                    <View key={`phase-segment-${index}`} style={styles.deepPhaseTrackSegment}>
                      <DeepPhaseSegment
                        progressAnim={progressAnim}
                        startProgress={phaseProgressRanges[index].startProgress}
                        endProgress={phaseProgressRanges[index].endProgress}
                        fillWidth={deepPhaseSegmentWidth}
                        isPast={index < activePhaseIndex}
                      />
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View style={[styles.deepHeaderRow, { opacity: phaseIndicatorOpacityAnim }]}>
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.82}
                style={styles.deepCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Exit practice"
              >
                <Text style={styles.deepCloseIcon}>×</Text>
              </TouchableOpacity>
              <View style={styles.deepPhasePill}>
                <Text style={styles.deepPhasePillText}>{phaseLabelForDeep}</Text>
              </View>
              <View style={styles.deepHeaderSpacer} />
            </Animated.View>

            {!state.isSealPhase ? (
              <View style={[styles.deepPhaseLabelWrap, isCompactHeight ? styles.deepPhaseLabelWrapCompact : null]}>
                <Text style={styles.deepPhaseLabelText}>{deepPhaseName}</Text>
                <LinearGradient
                  colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.42)', 'rgba(212,175,55,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.deepPhaseDivider}
                />
              </View>
            ) : null}

            <View style={[styles.deepCenterContent, isCompactHeight ? styles.deepCenterContentCompact : null]}>
              <Animated.View
                style={[
                  styles.deepSymbolWrapper,
                  isCompactHeight ? styles.deepSymbolWrapperCompact : null,
                  { width: deepStageSize, height: deepStageSize },
                  { opacity: ringOpacityAnim, transform: [{ scale: ringScale }, { scale: pressScaleAnim }] },
                ]}
              >
                <Pressable
                  onPressIn={handleSealPressIn}
                  onPressOut={handleSealPressOut}
                  disabled={!state.isSealPhase || state.isSealComplete}
                  style={styles.deepPressable}
                  testID={state.isSealPhase ? 'deep-prime-seal' : undefined}
                  accessibilityRole={state.isSealPhase ? 'button' : undefined}
                  accessibilityLabel={state.isSealPhase ? 'Seal your anchor' : undefined}
                >
                  <View
                    style={[
                      styles.deepArtworkCanvas,
                      { width: deepStageSize, height: deepStageSize },
                    ]}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.deepAuraOuter,
                        {
                          width: deepAuraOuterSize,
                          height: deepAuraOuterSize,
                          borderRadius: deepAuraOuterSize / 2,
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
                          width: deepAuraInnerSize,
                          height: deepAuraInnerSize,
                          borderRadius: deepAuraInnerSize / 2,
                          opacity: deepInnerAuraOpacity,
                          transform: [{ scale: deepInnerAuraScale }],
                        },
                      ]}
                    />
                    <Animated.View style={[styles.deepOrbitSolid, { width: deepOrbitSolidSize, height: deepOrbitSolidSize, borderRadius: deepOrbitSolidSize / 2, transform: [{ rotate: deepOrbitRotateA }] }]} />
                    <Animated.View style={[styles.deepOrbitDashOuter, { width: deepOrbitDashOuterSize, height: deepOrbitDashOuterSize, borderRadius: deepOrbitDashOuterSize / 2, transform: [{ rotate: deepOrbitRotateB }] }]} />
                    <Animated.View style={[styles.deepOrbitDotOuter, { width: deepOrbitDotOuterSize, height: deepOrbitDotOuterSize, borderRadius: deepOrbitDotOuterSize / 2, transform: [{ rotate: deepOrbitRotateA }] }]} />
                    <Animated.View style={[styles.deepOrbitDashInner, { width: deepOrbitDashInnerSize, height: deepOrbitDashInnerSize, borderRadius: deepOrbitDashInnerSize / 2, transform: [{ rotate: deepOrbitRotateB }] }]} />

                    <Animated.View
                      style={[
                        styles.deepOrbRingOuter,
                        {
                          width: deepOrbRingOuterSize,
                          height: deepOrbRingOuterSize,
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
                              left: deepOrbRingOuterSize / 2 - dot.size / 2,
                              top: deepOrbRingOuterSize / 2 - dot.size / 2,
                              width: dot.size,
                              height: dot.size,
                              borderRadius: dot.size / 2,
                              opacity: Math.min(1, dot.opacity),
                              transform: [{ translateX: dot.x * deepOrbScale }, { translateY: dot.y * deepOrbScale }],
                            },
                          ]}
                        />
                      ))}
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.deepOrbRingInner,
                        {
                          width: deepOrbRingInnerSize,
                          height: deepOrbRingInnerSize,
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
                              top: deepOrbRingInnerSize / 2 - dot.size / 2,
                              left: deepOrbRingInnerSize / 2 - dot.size / 2,
                              width: dot.size,
                              height: dot.size,
                              borderRadius: dot.size / 2,
                              opacity: Math.min(1, dot.opacity),
                              transform: [{ translateX: dot.x * deepOrbScale }, { translateY: dot.y * deepOrbScale }],
                            },
                          ]}
                        />
                      ))}
                    </Animated.View>

                    <Animated.View
                      style={[
                        styles.deepPulseRingOuter,
                        {
                          width: deepPulseOuterSize,
                          height: deepPulseOuterSize,
                          borderRadius: deepPulseOuterSize / 2,
                          opacity: deepPulseAOpacity,
                          transform: [{ scale: deepPulseAScale }],
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.deepPulseRingInner,
                        {
                          width: deepPulseInnerSize,
                          height: deepPulseInnerSize,
                          borderRadius: deepPulseInnerSize / 2,
                          opacity: deepPulseBOpacity,
                          transform: [{ scale: deepPulseBScale }],
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.deepEmberHalo,
                        {
                          width: deepEmberHaloSize,
                          height: deepEmberHaloSize,
                          borderRadius: deepEmberHaloSize / 2,
                          opacity: deepHaloOpacity,
                          transform: [{ scale: deepHaloScale }],
                        },
                      ]}
                    />

                    {state.isSealPhase ? (
                      <Svg width={deepSealSvgSize} height={deepSealSvgSize} style={styles.deepSealRingSvg}>
                        <Circle
                          cx={deepSealCenter}
                          cy={deepSealCenter}
                          r={deepRingRadius}
                          fill="none"
                          stroke="rgba(212,175,55,0.12)"
                          strokeWidth={2}
                        />
                        <Circle
                          cx={deepSealCenter}
                          cy={deepSealCenter}
                          r={deepRingRadius}
                          fill="none"
                          stroke="#D4AF37"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeDasharray={deepSealCircumference}
                          strokeDashoffset={deepSealDashoffset}
                          transform={`rotate(-90 ${deepSealCenter} ${deepSealCenter})`}
                        />
                      </Svg>
                    ) : null}

                    <Animated.View
                      style={[
                        styles.deepSigilContainer,
                        {
                          width: deepHeroSize,
                          height: deepHeroSize,
                          borderRadius: deepHeroSize / 2,
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
                          {[0.25, 0.4, 0.55, 0.7].map((ringScaleValue) => {
                            const ringSize = deepHeroSize * ringScaleValue;
                            return (
                              <View
                                key={`etch-ring-${ringScaleValue}`}
                                style={[
                                  styles.deepSigilEtchRing,
                                  {
                                    width: ringSize,
                                    height: ringSize,
                                    borderRadius: ringSize / 2,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      ) : null}
                      {anchor.enhancedImageUrl ? (
                        <OptimizedImage
                          uri={anchor.enhancedImageUrl}
                          style={[
                            styles.symbolImage,
                            {
                              width: deepHeroSize,
                              height: deepHeroSize,
                              borderRadius: deepHeroSize / 2,
                            },
                          ]}
                          resizeMode="cover"
                        />
                      ) : (
                        <SigilSvg xml={sigilSvg} width={deepHeroSize} height={deepHeroSize} />
                      )}
                    </Animated.View>
                  </View>
                </Pressable>
              </Animated.View>

              {state.isSealPhase ? (
                <View style={styles.sealTextStack}>
                  <Animated.Text
                    style={[
                      styles.sealHeadline,
                      {
                        opacity: Animated.multiply(
                          sealTitleOpacityAnim,
                          sealCopySwapAnim
                        ),
                      },
                    ]}
                  >
                    {sealHeadline}
                  </Animated.Text>

                  {!reduceIntentionVisibility && anchor.intentionText ? (
                    <Animated.View
                      style={[
                        styles.sealIntentionCard,
                        {
                          opacity: sealIntentionOpacityAnim,
                          borderColor:
                            sealCopyMode === 'complete'
                              ? 'rgba(212,175,55,0.34)'
                              : colors.ritual.border,
                          transform: [
                            {
                              scale: Animated.add(
                                1,
                                Animated.multiply(sealIntentionGlowAnim, 0.015)
                              ),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.sealIntentionLabel}>{SEAL_INTENTION_LABEL}</Text>
                      <Animated.Text
                        style={[
                          styles.sealIntentionText,
                          {
                            opacity: Animated.add(
                              0.92,
                              Animated.multiply(sealIntentionGlowAnim, 0.08)
                            ),
                          },
                        ]}
                      >
                        {sealIntentText}
                      </Animated.Text>
                    </Animated.View>
                  ) : null}

                  <Animated.Text
                    style={[
                      styles.sealSupportText,
                      {
                        opacity: Animated.multiply(
                          sealSupportOpacityAnim,
                          sealCopySwapAnim
                        ),
                      },
                    ]}
                  >
                    {sealSupportLine}
                  </Animated.Text>

                  <Animated.View
                    style={[
                      styles.sealBreathWrap,
                      { opacity: sealBreathOpacityAnim },
                    ]}
                  >
                    {showSealHoldPrompt ? (
                      <Text style={styles.sealHoldPrompt}>{SEAL_HOLD_PROMPT}</Text>
                    ) : null}
                  </Animated.View>

                  {showSealContinue ? (
                    <Animated.View style={{ opacity: sealContinueOpacityAnim }}>
                      <TouchableOpacity
                        onPress={continueFromSeal}
                        activeOpacity={0.86}
                        style={styles.sealContinueButton}
                        accessibilityRole="button"
                        accessibilityLabel={SEAL_CONTINUE_LABEL}
                      >
                        <Text style={styles.sealContinueButtonText}>
                          {SEAL_CONTINUE_LABEL}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ) : null}
                </View>
              ) : (
                <>
                  {!reduceIntentionVisibility && anchor.intentionText ? (
                    <View
                      style={[
                        styles.deepIntentionWrap,
                        isCompactHeight ? styles.deepIntentionWrapCompact : null,
                      ]}
                    >
                      <Text style={styles.deepIntentionLabel}>INTENTION</Text>
                      <Text
                        style={[
                          styles.deepIntentionText,
                          isCompactHeight ? styles.deepIntentionTextCompact : null,
                        ]}
                      >
                        {anchor.intentionText}
                      </Text>
                    </View>
                  ) : null}

                  {!shouldHideDeepPrimeGuidanceText ? (
                    <Animated.View
                      style={[
                        styles.deepInstructionContainer,
                        isCompactHeight ? styles.deepInstructionContainerCompact : null,
                        {
                          opacity: Animated.multiply(
                            instructionFadeAnim,
                            instructionContainerOpacityAnim
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deepInstructionText,
                          isCompactHeight ? styles.deepInstructionTextCompact : null,
                        ]}
                      >
                        {deepInstructionText}
                      </Text>
                    </Animated.View>
                  ) : null}
                </>
              )}
            </View>

            <Animated.View
              style={[
                styles.deepBottomSection,
                isCompactHeight ? styles.deepBottomSectionCompact : null,
                { opacity: bottomSectionOpacityAnim },
              ]}
            >
              {!state.isSealPhase && (
                <View style={[styles.deepTimerRow, isCompactHeight ? styles.deepTimerRowCompact : null]}>
                  <View
                    style={[
                      styles.deepPhaseTimerPill,
                      isCompactHeight ? styles.deepTimerPillCompact : null,
                    ]}
                  >
                    <Text style={styles.deepTimerLabelEmber}>THIS PHASE</Text>
                    <Text
                      style={[
                        styles.deepTimerDigitsEmber,
                        isCompactHeight ? styles.deepTimerDigitsCompact : null,
                      ]}
                    >
                      {deepPhaseTime}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.deepTotalTimerPill,
                      isCompactHeight ? styles.deepTimerPillCompact : null,
                    ]}
                  >
                    <Text style={styles.deepTimerLabelGold}>TOTAL LEFT</Text>
                    <Text
                      style={[
                        styles.deepTimerDigitsGold,
                        isCompactHeight ? styles.deepTimerDigitsCompact : null,
                      ]}
                    >
                      {deepTotalTime}
                    </Text>
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
                  "{anchor.intentionText}"
                </Text>
                <Text style={styles.arriveBreathCue}>Breathe into it</Text>
              </View>
            )}

            <Animated.View
              style={[styles.sessionChrome, { opacity: sessionChromeOpacity }]}
              pointerEvents={isArrivePhase ? 'none' : 'auto'}
            >
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

              {state.isSealPhase ? (
                <View style={styles.sealTextStack}>
                  <Animated.Text
                    style={[
                      styles.sealHeadline,
                      {
                        opacity: Animated.multiply(
                          sealTitleOpacityAnim,
                          sealCopySwapAnim
                        ),
                      },
                    ]}
                  >
                    {sealHeadline}
                  </Animated.Text>

                  {!reduceIntentionVisibility && anchor.intentionText ? (
                    <Animated.View
                      style={[
                        styles.sealIntentionCard,
                        {
                          opacity: sealIntentionOpacityAnim,
                          borderColor:
                            sealCopyMode === 'complete'
                              ? 'rgba(212,175,55,0.34)'
                              : colors.ritual.border,
                          transform: [
                            {
                              scale: Animated.add(
                                1,
                                Animated.multiply(sealIntentionGlowAnim, 0.015)
                              ),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.sealIntentionLabel}>{SEAL_INTENTION_LABEL}</Text>
                      <Animated.Text
                        style={[
                          styles.sealIntentionText,
                          {
                            opacity: Animated.add(
                              0.92,
                              Animated.multiply(sealIntentionGlowAnim, 0.08)
                            ),
                          },
                        ]}
                      >
                        {sealIntentText}
                      </Animated.Text>
                    </Animated.View>
                  ) : null}

                  <Animated.Text
                    style={[
                      styles.sealSupportText,
                      {
                        opacity: Animated.multiply(
                          sealSupportOpacityAnim,
                          sealCopySwapAnim
                        ),
                      },
                    ]}
                  >
                    {sealSupportLine}
                  </Animated.Text>

                  <Animated.View
                    style={[
                      styles.sealBreathWrap,
                      { opacity: sealBreathOpacityAnim },
                    ]}
                  >
                    <Text style={styles.sealBreathText}>{sealBreathLabel}</Text>
                    {showSealHoldPrompt ? (
                      <Text style={styles.sealHoldPrompt}>{SEAL_HOLD_PROMPT}</Text>
                    ) : null}
                  </Animated.View>

                  {showSealContinue ? (
                    <Animated.View style={{ opacity: sealContinueOpacityAnim }}>
                      <TouchableOpacity
                        onPress={continueFromSeal}
                        activeOpacity={0.86}
                        style={styles.sealContinueButton}
                        accessibilityRole="button"
                        accessibilityLabel={SEAL_CONTINUE_LABEL}
                      >
                        <Text style={styles.sealContinueButtonText}>
                          {SEAL_CONTINUE_LABEL}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ) : null}
                </View>
              ) : (
                <>
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
                    <InstructionGlassCard text={displayedInstruction} />
                  </Animated.View>
                </>
              )}
            </View>

            <Animated.View style={[styles.bottomSection, { opacity: bottomSectionOpacityAnim }]}>
              {!state.isSealPhase && (
                <View style={styles.timerPill}>
                  <Text style={styles.timerText}>{state.formattedRemaining} remaining</Text>
                </View>
              )}
            </Animated.View>
            </Animated.View>
          </>
        )}
        <PostPrimeTraceModal
          visible={showPostPrimeTrace}
          anchor={anchor}
          onTrace={handleBeginPostPrimeTrace}
          onSkip={handleSkipPostPrimeTrace}
          compact={!traceDefaultEnabled}
        />
        <CompletionModal
          visible={showCompletion}
          sessionType="reinforce"
          anchor={anchor}
          onDone={handleCompletionDone}
        />
        <ConfirmModal
          visible={showExitWarning}
          title="Exit Practice?"
          body="You will need to start over if you leave now."
          primaryCtaLabel="Keep Practicing"
          secondaryCtaLabel="Exit"
          onPrimary={() => setShowExitWarning(false)}
          onSecondary={exitRitual}
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
  deepPhaseTrackWrapCompact: {
    paddingTop: 40,
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
  deepPhaseLabelWrapCompact: {
    marginTop: 8,
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
  deepCenterContentCompact: {
    paddingTop: 0,
  },
  deepSymbolWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 340,
    height: 340,
    marginBottom: 14,
  },
  deepSymbolWrapperCompact: {
    marginBottom: 8,
  },
  deepPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepArtworkCanvas: {
    width: 340,
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepAuraOuter: {
    position: 'absolute',
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(212,175,55,0.1)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  deepAuraInner: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: 'rgba(212,175,55,0.06)',
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
    borderColor: 'rgba(212,175,55,0.36)',
  },
  deepPulseRingInner: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
  },
  deepEmberHalo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,0,0,0)',
    shadowColor: '#C8581A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 12,
  },
  deepSealRingSvg: {
    position: 'absolute',
  },
  deepSigilContainer: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
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
    marginTop: 24,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deepInstructionContainerCompact: {
    minHeight: 56,
    marginTop: 18,
    paddingHorizontal: 18,
  },
  sealTextStack: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sealHeadline: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  sealIntentionCard: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'rgba(15, 20, 25, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  sealIntentionLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  sealIntentionText: {
    fontSize: 18,
    lineHeight: 28,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
    textAlign: 'center',
  },
  sealSupportText: {
    fontSize: typography.sizes.body1,
    lineHeight: typography.lineHeights.body1 + 2,
    fontFamily: typography.fonts.body,
    color: 'rgba(245,240,232,0.82)',
    textAlign: 'center',
  },
  sealBreathWrap: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealBreathText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sealHoldPrompt: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontFamily: typography.fonts.body,
    color: 'rgba(245,240,232,0.58)',
    textAlign: 'center',
  },
  sealContinueButton: {
    minWidth: 180,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  sealContinueButtonText: {
    fontSize: typography.sizes.button,
    lineHeight: 22,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
    letterSpacing: 0.3,
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
  deepBreathCueCompact: {
    marginBottom: 12,
    fontSize: 15,
  },
  deepBreathCuePaused: {
    opacity: 0.35,
  },
  deepInstructionText: {
    color: '#FFF4DF',
    fontSize: 21,
    fontFamily: typography.fonts.bodySerifItalic,
    lineHeight: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 20,
  },
  deepInstructionTextCompact: {
    fontSize: 19,
    lineHeight: 27,
  },
  deepBottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    minHeight: 148,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  deepBottomSectionCompact: {
    paddingBottom: 20,
    minHeight: 112,
    gap: 12,
  },
  deepTimerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deepTimerRowCompact: {
    gap: 10,
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
  deepTimerPillCompact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  deepTimerDigitsCompact: {
    fontSize: 18,
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
    width: 240,
    height: 240,
    borderRadius: 120,
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
    marginTop: 28,
    marginBottom: 6,
    paddingHorizontal: spacing.xl,
    transform: [{ translateY: 24 }],
  },
  deepIntentionWrapCompact: {
    marginTop: 22,
    marginBottom: 4,
    paddingHorizontal: spacing.lg,
    transform: [{ translateY: 18 }],
  },
  deepIntentionLabel: {
    fontSize: 10,
    fontFamily: typography.fonts.heading,
    color: 'rgba(240,208,96,0.86)',
    letterSpacing: 3.4,
    marginBottom: 5,
  },
  deepIntentionText: {
    fontSize: 25,
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    color: '#F6EFD8',
    textAlign: 'center',
    lineHeight: 33,
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  deepIntentionTextCompact: {
    fontSize: 23,
    lineHeight: 31,
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
    paddingTop: 8,
  },
  landingCenterContentCompact: {
    paddingTop: 4,
  },
  landingTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    color: '#D4AF37',
    letterSpacing: 4,
  },
  landingTimeText: {
    fontFamily: typography.fonts.mono,
    fontSize: 31,
    color: '#F6EFD8',
    marginTop: 6,
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  landingTimeTextCompact: {
    fontSize: 27,
    marginBottom: 6,
  },
  landingSigilWrapper: {
    width: 340,
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  landingSigilWrapperCompact: {
    marginBottom: 8,
  },
  landingTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 14,
    paddingHorizontal: 16,
    width: '100%',
  },
  landingTimelineRowCompact: {
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  landingTimelineBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  landingTimelineBoxCompact: {
    paddingVertical: 8,
  },
  landingTimelineNum: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    color: '#D4AF37',
    marginBottom: 4,
  },
  landingTimelineNumCompact: {
    fontSize: 9,
    marginBottom: 3,
  },
  landingTimelineText: {
    fontFamily: typography.fonts.mono,
    fontSize: 7,
    color: 'rgba(245,240,232,0.6)',
    letterSpacing: 0,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  landingTimelineTextCompact: {
    fontSize: 6,
  },
  landingIntentionWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  landingIntentionWrapCompact: {
    paddingHorizontal: 20,
  },
  landingIntentionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: '#D4AF37',
    letterSpacing: 2,
    marginBottom: 6,
  },
  landingIntentionText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 18,
    color: '#F6EFD8',
    textAlign: 'center',
    lineHeight: 26,
  },
  landingIntentionTextCompact: {
    fontSize: 16,
    lineHeight: 22,
  },
  landingBottomSection: {
    paddingBottom: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  landingBottomSectionCompact: {
    paddingBottom: 20,
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
