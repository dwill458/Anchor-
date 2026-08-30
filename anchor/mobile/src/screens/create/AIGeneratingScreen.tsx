import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { Clock3 } from 'lucide-react-native';

import { SigilSvg } from '@/components/common/SigilSvg';
import { API_URL } from '@/config';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';
import { AuthService } from '@/services/AuthService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { useAuthStore } from '@/stores/authStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { colors, typography } from '@/theme';
import type { RootStackParamList } from '@/types';
import { isCompactPhoneViewport } from '@/utils/layout';
import { logger } from '@/utils/logger';

type AIGeneratingRouteProp = RouteProp<RootStackParamList, 'AIGenerating'>;
type AIGeneratingNavigationProp = StackNavigationProp<RootStackParamList, 'AIGenerating'>;
type GenerationFailure = 'connection' | 'generic' | null;

const GENERATION_TIMEOUT_MS = 180_000;
const ESTIMATED_PROGRESS_CAP = 94;

const humanize = (value: string | null | undefined): string =>
  (value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /network|fetch|connection|internet|offline|socket|timed?\s*out/i.test(error.message);
};

const resolveStatus = ({
  progress,
  isComplete,
  isOriginalExpression,
}: {
  progress: number;
  isComplete: boolean;
  isOriginalExpression: boolean;
}): string => {
  if (isComplete) return 'EXPRESSIONS READY';
  if (progress >= 84) return 'FINALIZING';
  if (progress >= 48) {
    return isOriginalExpression ? 'CREATING ORIGINAL EXPRESSIONS' : 'CREATING EXPRESSIONS';
  }
  if (progress >= 22) return 'APPLYING STYLE';
  return 'PREPARING STRUCTURE';
};

export default function AIGeneratingScreen() {
  const route = useRoute<AIGeneratingRouteProp>();
  const navigation = useNavigation<AIGeneratingNavigationProp>();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const anchorCount = useAuthStore((state) => state.anchorCount);
  const { hasActiveEntitlement } = useTrialStatus();
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

  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const [failure, setFailure] = useState<GenerationFailure>(null);
  const [isComplete, setIsComplete] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const haloOpacity = useRef(new Animated.Value(0.32)).current;
  const haloScale = useRef(new Animated.Value(1)).current;
  const lineTravel = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const isGeneratingRef = useRef(false);
  const estimatedProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ambientLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const generationAttemptRef = useRef<number>(initialGenerationAttempt ?? 1);

  const actualStructure = reinforcedSigilSvg || baseSigilSvg;
  const structureLabel = useMemo(
    () => (reinforcedSigilSvg ? 'Drawn structure' : humanize(structureVariant) || 'Selected structure'),
    [reinforcedSigilSvg, structureVariant],
  );
  const styleLabel = useMemo(() => humanize(styleChoice), [styleChoice]);
  const isOriginalExpression = generationAttemptRef.current > 1 || Boolean(reinforcedSigilSvg);
  const status = resolveStatus({
    progress: estimatedProgress,
    isComplete,
    isOriginalExpression,
  });

  const clearGenerationResources = useCallback((keepNavigationTimeout = false) => {
    if (estimatedProgressIntervalRef.current) {
      clearInterval(estimatedProgressIntervalRef.current);
      estimatedProgressIntervalRef.current = null;
    }
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    if (!keepNavigationTimeout && navigationTimeoutRef.current) {
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

    useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'generating' });
    const isFirstAnchor = anchorCount === 0;
    if (!isFirstAnchor && !isAuthenticated) {
      Alert.alert('Account Required', 'Sign in before generating AI artwork.', [
        { text: 'Sign In', onPress: () => navigation.replace('Login', {}) },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    if (!isFirstAnchor && !hasActiveEntitlement) {
      Alert.alert('Subscription Required', 'Your trial has ended. Renew access to generate AI artwork.', [
        { text: 'View Paywall', onPress: () => navigation.navigate('Paywall') },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    isGeneratingRef.current = true;
    clearGenerationResources();
    setFailure(null);
    setIsComplete(false);
    setEstimatedProgress(0);

    const userId = user?.id || `dev-user-${Date.now()}`;
    const trace = PerformanceMonitoring.startTrace('ai_enhance', {
      style_choice: styleChoice,
      user_id: userId,
      has_reinforced_svg: Boolean(reinforcedSigilSvg),
    });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    requestTimeoutRef.current = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    FrictionAnalytics.stepCompleted('anchor_creation', 'ai_generation_started', {
      style_id: styleChoice,
      category,
      attempt: generationAttemptRef.current,
      has_reinforced_svg: Boolean(reinforcedSigilSvg),
    });
    ErrorTrackingService.addBreadcrumb('AI enhancement started', 'ai.enhance', {
      style_choice: styleChoice,
      user_id: userId,
    });

    estimatedProgressIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      setEstimatedProgress((previous) => {
        if (previous >= ESTIMATED_PROGRESS_CAP) return previous;
        return Math.min(
          ESTIMATED_PROGRESS_CAP,
          previous + Math.max(0.15, (ESTIMATED_PROGRESS_CAP - previous) * 0.035),
        );
      });
    }, 800);

    try {
      const token = await AuthService.getIdToken();
      const response = await fetch(`${API_URL}/api/ai/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sigilSvg: actualStructure,
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
        generation_time_ms: typeof result.generationTime === 'number' ? result.generationTime * 1000 : undefined,
      });
      ErrorTrackingService.addBreadcrumb('AI enhancement completed', 'ai.enhance', {
        style_choice: styleChoice,
        variation_count: Array.isArray(result.variations) ? result.variations.length : 0,
      });

      if (!isMountedRef.current) return;
      setEstimatedProgress(100);
      setIsComplete(true);
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
          generationTimeMs: typeof result.generationTime === 'number' ? result.generationTime * 1000 : 0,
          reuseRequestId: result.reuseRequestId || '',
        });
      }, reduceMotion ? 0 : 500);
    } catch (error) {
      trace.stop({ success: false });
      if (!isMountedRef.current) return;

      const connectionFailure = isConnectionError(error) && !(error instanceof Error && error.name === 'AbortError');
      const errorCode = connectionFailure
        ? 'network_error'
        : error instanceof Error && error.name === 'AbortError'
          ? 'ai_generation_timeout'
          : 'ai_generation_failed';
      setEstimatedProgress(0);
      setFailure(connectionFailure ? 'connection' : 'generic');
      useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'error' });
      FrictionAnalytics.flowError('anchor_creation', 'ai_generating', errorCode, {
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
      clearGenerationResources(true);
      isGeneratingRef.current = false;
    }
  }, [
    actualStructure,
    anchorCount,
    baseSigilSvg,
    category,
    clearGenerationResources,
    distilledLetters,
    hasActiveEntitlement,
    intentionText,
    isAuthenticated,
    navigation,
    reduceMotion,
    reinforcedSigilSvg,
    reinforcementMetadata,
    structureVariant,
    styleChoice,
    user?.id,
  ]);

  const retryGeneration = useCallback(() => {
    generationAttemptRef.current += 1;
    FrictionAnalytics.flowRetry('anchor_creation', 'ai_generating', {
      style_id: styleChoice,
      category,
    });
    void generateAIVariations();
  }, [category, generateAIVariations, styleChoice]);

  useEffect(() => {
    isMountedRef.current = true;
    const intro = Animated.timing(contentOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 420,
      useNativeDriver: true,
    });
    intro.start();

    if (!reduceMotion) {
      const halo = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(haloOpacity, { toValue: 0.55, duration: 2600, useNativeDriver: true }),
            Animated.timing(haloScale, { toValue: 1.035, duration: 2600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(haloOpacity, { toValue: 0.24, duration: 2600, useNativeDriver: true }),
            Animated.timing(haloScale, { toValue: 1, duration: 2600, useNativeDriver: true }),
          ]),
        ]),
      );
      const progressLine = Animated.loop(
        Animated.timing(lineTravel, { toValue: 1, duration: 1500, useNativeDriver: true }),
      );
      ambientLoopsRef.current = [halo, progressLine];
      ambientLoopsRef.current.forEach((loop) => loop.start());
    } else {
      haloOpacity.setValue(0.3);
      haloScale.setValue(1);
      lineTravel.setValue(0.48);
    }

    void generateAIVariations();
    return () => {
      isMountedRef.current = false;
      isGeneratingRef.current = false;
      intro.stop();
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      clearGenerationResources();
    };
  }, [clearGenerationResources, contentOpacity, generateAIVariations, haloOpacity, haloScale, lineTravel, reduceMotion]);

  const progressTranslateX = lineTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 280],
  });
  const heroSize = isCompactLayout ? 142 : 164;
  const haloSize = heroSize + 46;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.goldAmbient} />
      <View pointerEvents="none" style={styles.arcTop} />
      <View pointerEvents="none" style={styles.arcBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, isCompactLayout && styles.contentCompact, { opacity: contentOpacity }]}>
          {failure ? (
            <View style={styles.errorState} accessibilityLiveRegion="polite">
              <Text style={styles.eyebrow}>{failure === 'connection' ? 'Connection Lost' : 'Generation paused'}</Text>
              <Text style={styles.errorTitle}>
                {failure === 'connection' ? 'Connection Lost' : 'We couldn’t finish this generation.'}
              </Text>
              <Text style={styles.errorBody}>
                {failure === 'connection' ? 'Your choices are saved.' : 'Your structure and style are still here.'}
              </Text>
              <View style={styles.errorActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={failure === 'connection' ? 'Retry generation' : 'Try generating again'}
                  onPress={retryGeneration}
                  style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryActionLabel}>{failure === 'connection' ? 'Retry' : 'Try Again'}</Text>
                </Pressable>
                {failure === 'generic' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to style"
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryActionLabel}>Back to Style</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <Text style={styles.eyebrow}>Generating</Text>
                <Text style={styles.title}>Generating Your Anchor</Text>
                <Text style={styles.subtitle}>Creating expressions from your structure and selected style.</Text>
              </View>

              <View style={[styles.heroStage, { width: haloSize, height: haloSize }]} accessible={false}>
                <Animated.View
                  style={[
                    styles.heroHalo,
                    { width: haloSize, height: haloSize, borderRadius: haloSize / 2, opacity: haloOpacity, transform: [{ scale: haloScale }] },
                  ]}
                />
                <Svg width={haloSize} height={haloSize} viewBox="0 0 220 220" style={styles.ringField}>
                  <Circle cx="110" cy="110" r="93" fill="none" stroke={colors.anchor15.gilt} strokeWidth="1" strokeDasharray="2 5" opacity="0.18" />
                  <Circle cx="110" cy="110" r="78" fill="none" stroke={colors.anchor15.gilt} strokeWidth="1" strokeDasharray="3 4" opacity="0.14" />
                  <Circle cx="110" cy="110" r="62" fill="none" stroke={colors.anchor15.gilt} strokeWidth="1" opacity="0.55" />
                  <Circle cx="110" cy="110" r="35" fill="none" stroke={colors.anchor15.gilt} strokeWidth="1" opacity="0.17" />
                </Svg>
                <View style={[styles.sigilFrame, { width: heroSize, height: heroSize, borderRadius: heroSize / 2 }]}>
                  <SigilSvg xml={actualStructure} width={heroSize * 0.56} height={heroSize * 0.56} color={colors.anchor15.giltBright} />
                </View>
              </View>

              <View style={styles.statusBlock}>
                <Text accessibilityLiveRegion="polite" style={styles.statusLabel}>{status}</Text>
                <View style={styles.progressTrack} accessibilityElementsHidden>
                  <Animated.View
                    style={[
                      styles.progressLine,
                      { transform: [{ translateX: progressTranslateX }] },
                      reduceMotion && styles.progressLineStatic,
                    ]}
                  />
                </View>
              </View>

              <View style={styles.metadata}>
                <Text style={styles.metadataLabel}>Structure · Style</Text>
                <Text style={styles.metadataValue} numberOfLines={2}>{`${structureLabel} · ${styleLabel}`}</Text>
                <View style={styles.estimateRow}>
                  <Clock3 color={colors.anchor15.gilt} size={13} strokeWidth={1.4} />
                  <Text style={styles.estimate}>Usually ready in about 30 seconds.</Text>
                </View>
              </View>
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.anchor15.ink },
  safeArea: { flex: 1 },
  goldAmbient: {
    position: 'absolute', width: 390, height: 390, borderRadius: 195, top: -205, left: -42,
    backgroundColor: 'rgba(217, 179, 108, 0.055)',
  },
  arcTop: {
    position: 'absolute', width: 620, height: 620, borderRadius: 310, top: -440, left: -250,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217, 179, 108, 0.09)',
  },
  arcBottom: {
    position: 'absolute', width: 480, height: 480, borderRadius: 240, bottom: -336, right: -204,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217, 179, 108, 0.07)',
  },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 26,
  },
  contentCompact: { paddingHorizontal: 22, paddingVertical: 16 },
  heading: { alignItems: 'center', maxWidth: 326, marginBottom: 32 },
  eyebrow: {
    color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 10,
    letterSpacing: 2.3, textTransform: 'uppercase',
  },
  title: {
    color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 22,
    lineHeight: 27, letterSpacing: 0.2, textAlign: 'center', marginTop: 10,
  },
  subtitle: {
    color: 'rgba(244, 239, 230, 0.72)', fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic', fontSize: 15, lineHeight: 20, textAlign: 'center', marginTop: 12,
  },
  heroStage: { alignItems: 'center', justifyContent: 'center', marginBottom: 31 },
  heroHalo: {
    position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217, 179, 108, 0.24)',
  },
  ringField: { position: 'absolute' },
  sigilFrame: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 20, 25, 0.60)',
  },
  statusBlock: { width: '100%', maxWidth: 320, alignItems: 'center' },
  statusLabel: {
    color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 10,
    letterSpacing: 1.8, textAlign: 'center', marginBottom: 18,
  },
  progressTrack: {
    width: '100%', height: 1, overflow: 'hidden', backgroundColor: 'rgba(217, 179, 108, 0.18)',
  },
  progressLine: { width: 108, height: 1, backgroundColor: colors.anchor15.giltBright },
  progressLineStatic: { transform: [{ translateX: 106 }] },
  metadata: { alignItems: 'center', marginTop: 17, maxWidth: 330 },
  metadataLabel: {
    color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 10,
    letterSpacing: 1.35, textTransform: 'uppercase',
  },
  metadataValue: {
    color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12,
    lineHeight: 18, letterSpacing: 0.35, textAlign: 'center', marginTop: 8, textTransform: 'uppercase',
  },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 },
  estimate: {
    color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontStyle: 'italic',
    fontSize: 13, lineHeight: 18,
  },
  errorState: { width: '100%', maxWidth: 320, alignItems: 'center' },
  errorTitle: {
    color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 22,
    lineHeight: 29, textAlign: 'center', marginTop: 12,
  },
  errorBody: {
    color: 'rgba(244, 239, 230, 0.72)', fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic', fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 12,
  },
  errorActions: { width: '100%', gap: 10, marginTop: 29 },
  primaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.gilt },
  primaryActionLabel: {
    color: colors.anchor15.ink, fontFamily: typography.fontFamily.instrumentSemiBold, fontSize: 12,
    letterSpacing: 1.15, textTransform: 'uppercase',
  },
  secondaryAction: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
  },
  secondaryActionLabel: {
    color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.instrumentSemiBold, fontSize: 12,
    letterSpacing: 1.05, textTransform: 'uppercase',
  },
  pressed: { opacity: 0.72 },
});
