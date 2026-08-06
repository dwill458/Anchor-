import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import { Pause, Play, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useRecordOnShow } from '@/components/teaching/useRecordOnShow';
import type { TeachingContent } from '@/constants/teaching';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { trackSessionStartedWithAudio } from '@/services/SessionAudioAnalytics';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { getVisualizeSessionAudioManifest } from '@/services/visualizeAudioManifest';
import { colors as themeColors, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import { ConfirmModal } from '@/screens/rituals/components/ConfirmModal';
import { useChartPracticeReturn } from '@/hooks/useChartPracticeReturn';
import { resolvePracticeCompletionSource } from '@/navigation/practiceReturn';

const colors = {
  ...themeColors,
  gold: themeColors.practiceMode.visualize.primary,
};
import { VisualizeAnchorField } from './VisualizeAnchorField';
import {
  VISUALIZE_PHASE_PRESENTATION,
  getVisualizationLensSize,
  getVisualizePresentationPhase,
  getVisualizeSegmentState,
} from './visualizePresentation';
import {
  VisualizationAnchorLens,
  VisualizationPhaseProgress,
} from './VisualizationPrimitives';
import { PromptPresenter } from './PromptPresenter';
import { useVisualizeImmersiveMode } from './useVisualizeImmersiveMode';
import { useVisualizeSessionAudio } from './useVisualizeSessionAudio';
import { useVisualizeSessionEngine } from './useVisualizeSessionEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'VisualizeSession'>;

const KeepAwake: React.FC = () => {
  useKeepAwake('visualize-session');
  return null;
};

const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const VisualizeControlsHint: React.FC<{
  teaching: TeachingContent | null;
  reduceMotion: boolean;
}> = ({ teaching, reduceMotion }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useRecordOnShow(teaching, 'visualize_session');

  useEffect(() => {
    if (!teaching) return;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    opacity.stopAnimation();
    opacity.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {
      fadeTimer = setTimeout(() => opacity.setValue(0), 2_600);
    } else {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      fadeTimer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, 2_600);
    }
    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      opacity.stopAnimation();
    };
  }, [opacity, reduceMotion, teaching]);

  if (!teaching) return null;

  return (
    <Animated.View
      accessible
      accessibilityLabel={teaching.copy}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.controlsHint, { opacity }]}
    >
      <View style={styles.controlsHintDot} />
      <Text style={styles.controlsHintText}>{teaching.copy}</Text>
    </Animated.View>
  );
};

export const VisualizeSessionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const window = useWindowDimensions();
  const returnToChart = useChartPracticeReturn(navigation);
  const {
    anchorId,
    durationSeconds,
    sceneText,
    guidanceVoice,
    backgroundAudio,
    returnTo,
    chartContext,
    practiceMode,
    practiceEntrySource,
  } = route.params;
  const anchor = useAnchorStore((state) => state.getAnchorById(anchorId));
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const reduceMotion = useReduceMotionEnabled();
  const performanceTier = usePerformanceTier();
  const controlsHint = useTeachingGate({
    screenId: 'visualize_session',
    candidateIds: ['visualize_controls_hint'],
  });

  const sessionIdRef = useRef(
    `visualize:${accountId ?? 'guest'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
  );
  const canonicalSessionIdRef = useRef<string | null>(null);
  const completionRef = useRef(false);
  const completionCueRef = useRef(false);
  const completionTransitionStartedRef = useRef(false);
  const startedAnalyticsRef = useRef(false);
  const exitingRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const pendingNavigateRef = useRef<(() => void) | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [feedback, setFeedback] = useState<'Paused' | 'Resumed' | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const activeCopyOpacity = useRef(new Animated.Value(1)).current;
  const completionOpacity = useRef(new Animated.Value(0)).current;
  const completionScale = useRef(new Animated.Value(0.94)).current;
  const completionAnchorScale = useRef(new Animated.Value(0.86)).current;
  const completionAnchorTranslateY = useRef(new Animated.Value(16)).current;

  const complete = useCallback(
    async ({ startedAt, completedAt }: { startedAt: string; completedAt: string }) => {
      if (completionRef.current) return;
      completionRef.current = true;
      let syncOutcome: 'queued' | 'failed' | 'not_recorded' = 'not_recorded';
      if (anchor && accountId) {
        try {
          const canonicalRecord = await PracticeCompletionService.commitVisualizeCompletion({
            id: sessionIdRef.current,
            accountId,
            anchor,
            durationSeconds,
            startedAt,
            completedAt,
            guidanceVoice,
            backgroundAudio,
            sceneSnapshot: sceneText,
            source: returnTo === 'chart'
              ? resolvePracticeCompletionSource(returnTo)
              : route.params.source,
            chartContext,
            practiceEntrySource,
          });
          canonicalSessionIdRef.current = canonicalRecord.id;
          syncOutcome = 'queued';
        } catch {
          // The local queue is the source of truth for the completion screen;
          // analytics still records a failed sync without blocking the ritual.
          syncOutcome = 'failed';
        }
      }

      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
        practice_mode: 'visualize',
        session_id: sessionIdRef.current,
        anchor_id: anchor?.id ?? anchorId,
        duration_seconds: durationSeconds,
        guidance_voice: guidanceVoice,
        background_audio: backgroundAudio,
        sync_outcome: syncOutcome,
        completed_at: completedAt,
      });
    }, [
      accountId,
      anchor,
      anchorId,
      backgroundAudio,
      durationSeconds,
      guidanceVoice,
      sceneText,
      chartContext,
      practiceEntrySource,
      returnTo,
    ],
  );

  const engine = useVisualizeSessionEngine({
    durationSeconds,
    hapticsEnabled: hapticIntensity > 0,
    onComplete: complete,
  });

  const audioPlan = useMemo(
    () =>
      resolveSessionAudioPlan({
        sessionType: 'visualize',
        durationSeconds,
        configuration: {
          guidanceVoice,
          backgroundAudio,
          source: 'session_override',
        },
      }),
    [backgroundAudio, durationSeconds, guidanceVoice],
  );
  const audioManifest = useMemo(
    () => getVisualizeSessionAudioManifest(durationSeconds),
    [durationSeconds],
  );
  const handleAudioInterruption = useCallback(
    () => engine.pause('audio_interruption'),
    [engine.pause],
  );
  const sessionAudio = useVisualizeSessionAudio({
    plan: audioPlan,
    manifest: audioManifest,
    elapsedMs: engine.elapsedMs,
    isActive: engine.state === 'running',
    isCompleting: engine.state === 'completing',
    isComplete: engine.state === 'completed',
    onInterruption: handleAudioInterruption,
  });

  const immersive =
    engine.state === 'running' ||
    engine.state === 'paused' ||
    engine.state === 'completing';
  useVisualizeImmersiveMode(immersive);

  useEffect(() => {
    if (startedAnalyticsRef.current) return;
    startedAnalyticsRef.current = true;
    engine.start();
    const startedAt = new Date().toISOString();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: 'visualize',
      session_id: sessionIdRef.current,
      anchor_id: anchorId,
      duration_seconds: durationSeconds,
      guidance_voice: guidanceVoice,
      background_audio: backgroundAudio,
      started_at: startedAt,
    });
    trackSessionStartedWithAudio(audioPlan);
    // Engine start is deliberately one-shot for this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    anchorId,
    audioPlan,
    backgroundAudio,
    durationSeconds,
    engine.start,
    guidanceVoice,
  ]);

  useEffect(() => {
    if (engine.state !== 'completed') return;
    navigation.replace('VisualizeCompletion', {
      anchorId,
      sessionId: canonicalSessionIdRef.current ?? sessionIdRef.current,
      durationSeconds,
      source: route.params.source,
      sceneText,
      practiceEntrySource,
      returnTo,
      chartContext,
      practiceMode,
    });
  }, [anchorId, chartContext, durationSeconds, engine.state, navigation, practiceEntrySource, practiceMode, returnTo, route.params.source, sceneText]);

  useEffect(() => {
    if (engine.state !== 'running') {
      setControlsVisible(true);
      return;
    }
    if (!controlsVisible) return;
    const timer = setTimeout(() => setControlsVisible(false), 4_500);
    return () => clearTimeout(timer);
  }, [controlsVisible, engine.state]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: reduceMotion ? 0 : 280,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible, reduceMotion]);

  useEffect(() => {
    if (engine.state !== 'completing' || completionTransitionStartedRef.current) {
      return;
    }
    completionTransitionStartedRef.current = true;
    if (hapticIntensity > 0 && !completionCueRef.current) {
      completionCueRef.current = true;
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
    }

    const animation = Animated.parallel([
      Animated.timing(activeCopyOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(completionOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(completionScale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(completionAnchorScale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(completionAnchorTranslateY, {
        toValue: 0,
        duration: reduceMotion ? 0 : 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();

    let cancelled = false;
    const settleCompletion = async () => {
      await Promise.allSettled([
        engine.completionPromise ?? Promise.resolve(),
        sessionAudio.finishCompletion(),
      ]);
      await new Promise<void>((resolve) => setTimeout(resolve, reduceMotion ? 120 : 820));
      if (!cancelled) engine.markCompleted();
    };
    void settleCompletion();

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [
    completionOpacity,
    completionScale,
    activeCopyOpacity,
    completionAnchorScale,
    completionAnchorTranslateY,
    engine.completionPromise,
    engine.markCompleted,
    engine.state,
    hapticIntensity,
    reduceMotion,
    sessionAudio.finishCompletion,
  ]);

  const continueAfterExitPrompt = useCallback(() => {
    exitPromptOpenRef.current = false;
    setShowExitModal(false);
    pendingNavigateRef.current = null;
    engine.resume();
  }, [engine.resume]);

  const confirmEarlyEnd = useCallback(
    (navigateAfterStop: () => void) => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      exitPromptOpenRef.current = false;
      setShowExitModal(false);
      engine.endEarly();
      void sessionAudio.fadeOutAndStop().finally(navigateAfterStop);
    },
    [engine.endEarly, sessionAudio.fadeOutAndStop],
  );

  const showEarlyExitPrompt = useCallback(
    (navigateAfterStop?: () => void) => {
      if (exitingRef.current || exitPromptOpenRef.current) return;
      exitPromptOpenRef.current = true;
      if (navigateAfterStop) {
        pendingNavigateRef.current = navigateAfterStop;
      }
      engine.pause('exit_prompt');
      setShowExitModal(true);
    },
    [engine.pause],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (
        exitingRef.current ||
        engine.state === 'completed' ||
        engine.state === 'completing'
      ) {
        return;
      }
      event.preventDefault();
      showEarlyExitPrompt(() => {
        if (!returnToChart({ returnTo, anchorId, chartContext })) {
          navigation.dispatch(event.data.action);
        }
      });
    });
    return unsubscribe;
  }, [anchorId, chartContext, engine.state, navigation, returnTo, returnToChart, showEarlyExitPrompt]);

  const togglePlayback = useCallback(() => {
    if (engine.state === 'completing' || engine.state === 'completed') return;
    const willResume = engine.state === 'paused';
    if (hapticIntensity > 0) void safeHaptics.selection();
    if (willResume) engine.resume();
    else engine.pause();
    setControlsVisible(true);
    setFeedback(willResume ? 'Resumed' : 'Paused');
    feedbackOpacity.stopAnimation();
    feedbackOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 130,
        useNativeDriver: true,
      }),
      Animated.delay(620),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setFeedback(null);
    });
  }, [
    engine.pause,
    engine.resume,
    engine.state,
    feedbackOpacity,
    hapticIntensity,
    reduceMotion,
  ]);

  const requestEarlyEnd = useCallback(() => {
    showEarlyExitPrompt(() => {
      if (!returnToChart({ returnTo, anchorId, chartContext })) navigation.goBack();
    });
  }, [anchorId, chartContext, navigation, returnTo, returnToChart, showEarlyExitPrompt]);

  if (!anchor || !accountId) return <View style={styles.container} />;

  const currentPresentationPhase = getVisualizePresentationPhase(engine.phase.id);
  const presentation = VISUALIZE_PHASE_PRESENTATION[currentPresentationPhase];
  const currentPhaseIndex = Math.max(
    0,
    engine.schedule.findIndex((phase) => phase.id === engine.phase.id),
  );
  const sigilSvg = anchor.reinforcedSigilSvg || anchor.baseSigilSvg || '';
  const heroSize = getVisualizationLensSize('practice', window.width);
  const phaseLabel = `PHASE ${currentPhaseIndex + 1} OF ${engine.schedule.length} · ${presentation.title}`;

  return (
    <View style={styles.container}>
      <StatusBar hidden={immersive} style="light" />
      {immersive ? <KeepAwake /> : null}
      <LinearGradient
        colors={presentation.gradient}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        accessibilityLabel="Toggle controls"
        style={StyleSheet.absoluteFill}
        onPress={() => setControlsVisible((value) => !value)}
      />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe} pointerEvents="box-none">
        <Animated.View
          pointerEvents={controlsVisible ? 'auto' : 'none'}
          style={[styles.topControls, { opacity: controlsOpacity }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End visualization"
            onPress={(event) => {
              event.stopPropagation();
              requestEarlyEnd();
            }}
            style={styles.circleButton}
          >
            <X color="#E7F1F8" size={19} strokeWidth={2.2} />
          </Pressable>
          <Text
            accessibilityLabel={`${engine.remainingSeconds} seconds remaining`}
            style={styles.time}
          >
            {formatTime(engine.remainingSeconds)}
          </Text>
          <View style={styles.circleButton} />
        </Animated.View>

        <View style={styles.progressWrap}>
          <VisualizationPhaseProgress
            label={phaseLabel}
            segmentStates={engine.schedule.map((_, index) =>
              getVisualizeSegmentState(index, currentPhaseIndex),
            )}
          />
        </View>

        <View style={styles.stage}>
          <VisualizeAnchorField
            phase={currentPresentationPhase}
            phaseProgress={engine.phaseProgress}
            totalProgress={engine.totalProgress}
            active={engine.state === 'running'}
            reduceMotion={reduceMotion}
            performanceTier={performanceTier}
            heroSize={heroSize}
            compact={window.height < 720}
          >
            <VisualizationAnchorLens
              size={heroSize}
              imageUrl={anchor.enhancedImageUrl}
              svg={sigilSvg}
            />
          </VisualizeAnchorField>
        </View>

        <Animated.View style={[styles.copy, { opacity: activeCopyOpacity }]}>
          <View style={styles.directiveCard}>
            <Text style={styles.phaseTitle}>{presentation.title}</Text>
            <PromptPresenter
              prompt={engine.currentPrompt}
              fallbackText={presentation.supportingInstruction}
              fallbackId={`phase:${engine.phase.id}`}
            />
          </View>
          <View style={styles.sceneCue}>
            <Text style={styles.sceneLabel}>SCENE</Text>
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={4}
              ellipsizeMode="tail"
              style={styles.sceneFull}
            >
              {sceneText}
            </Text>
          </View>
        </Animated.View>

        {engine.state !== 'completing' && engine.state !== 'completed' ? (
          <Animated.View
            pointerEvents={controlsVisible ? 'auto' : 'none'}
            style={[styles.bottomControls, { opacity: controlsOpacity }]}
          >
            <View style={styles.audioControlField}>
              {feedback ? (
                <Animated.Text
                  accessibilityLiveRegion="polite"
                  style={[styles.audioFeedback, { opacity: feedbackOpacity }]}
                >
                  {feedback}
                </Animated.Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  engine.state === 'paused'
                    ? 'Resume visualization'
                    : 'Pause visualization'
                }
                accessibilityState={{ disabled: engine.state === 'preparing' }}
                disabled={engine.state === 'preparing'}
                onPress={(event) => {
                  event.stopPropagation();
                  togglePlayback();
                }}
                style={({ pressed }) => [
                  styles.pauseButton,
                  pressed && styles.pauseButtonPressed,
                ]}
              >
                {engine.state === 'paused' ? (
                  <Play color="#071321" size={22} strokeWidth={2.7} />
                ) : (
                  <Pause color="#071321" size={22} strokeWidth={2.7} />
                )}
              </Pressable>
            </View>
            <View
              accessibilityLabel={`${Math.round(engine.totalProgress * 100)} percent complete`}
              style={styles.totalTrack}
            >
              <View
                style={[
                  styles.totalFill,
                  { width: `${engine.totalProgress * 100}%` },
                ]}
              />
            </View>
          </Animated.View>
        ) : null}

        <VisualizeControlsHint
          teaching={controlsHint}
          reduceMotion={reduceMotion}
        />
      </SafeAreaView>

      {engine.state === 'completing' ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.completionLayer, { opacity: completionOpacity }]}
        >
          <LinearGradient
            colors={['rgba(3,13,28,.06)', 'rgba(5,28,58,.82)', 'rgba(4,13,28,.98)']}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.completionAnchor,
              {
                transform: [
                  { translateY: completionAnchorTranslateY },
                  { scale: completionAnchorScale },
                ],
              },
            ]}
          >
            <VisualizationAnchorLens
              size={Math.round(heroSize * 0.7)}
              imageUrl={anchor.enhancedImageUrl}
              svg={sigilSvg}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.completionCopy,
              { transform: [{ scale: completionScale }] },
            ]}
          >
            <Text style={styles.completionEyebrow}>VISUALIZATION COMPLETE</Text>
            <Text style={styles.completionTitle}>SCENE REHEARSED</Text>
            <Text style={styles.completionSubtitle}>
              The response is yours to return to.
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}

      <ConfirmModal
        visible={showExitModal}
        title="End visualization?"
        body="Your progress in this session will not be recorded."
        primaryCtaLabel="Continue Session"
        secondaryCtaLabel="End Session"
        onPrimary={continueAfterExitPrompt}
        onSecondary={() => {
          const navAction = pendingNavigateRef.current || (() => navigation.goBack());
          confirmEarlyEnd(navAction);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06101F',
  },
  safe: {
    flex: 1,
  },
  topControls: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,10,20,.4)',
    borderWidth: 1,
    borderColor: 'rgba(204,231,249,.1)',
  },
  time: {
    color: '#DCECF8',
    fontFamily: typography.fonts.body,
    fontVariant: ['tabular-nums'],
    fontSize: 14,
    letterSpacing: 0.8,
  },
  progressWrap: {
    paddingHorizontal: 24,
    marginTop: 3,
  },
  stage: {
    flex: 1,
    minHeight: 218,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minHeight: 190,
    paddingHorizontal: 26,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  directiveCard: {
    width: '100%',
    minHeight: 98,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,17,31,.54)',
    borderWidth: 1,
    borderColor: 'rgba(170,220,248,.16)',
  },
  phaseTitle: {
    color: '#74C7F5',
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 2.7,
    marginBottom: 7,
  },
  sceneCue: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  sceneLabel: {
    color: 'rgba(162,211,240,.68)',
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 2,
  },
  sceneFull: {
    color: 'rgba(226,241,249,.78)',
    fontFamily: typography.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  bottomControls: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  audioControlField: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,21,37,.5)',
    borderWidth: 1,
    borderColor: 'rgba(159,213,244,.18)',
    shadowColor: '#51B7ED',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  audioFeedback: {
    position: 'absolute',
    top: -24,
    color: 'rgba(219,237,247,.76)',
    fontFamily: typography.fonts.body,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  pauseButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#70C9F4',
  },
  pauseButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  totalTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(191,225,244,.2)',
    overflow: 'hidden',
  },
  totalFill: {
    height: '100%',
    backgroundColor: '#65C1F0',
  },
  controlsHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsHintDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 7,
    backgroundColor: '#78C9F1',
  },
  controlsHintText: {
    color: 'rgba(218,237,247,.66)',
    fontFamily: typography.fonts.body,
    fontSize: 11,
    letterSpacing: 0.35,
  },
  completionLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCopy: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginTop: 210,
  },
  completionAnchor: {
    position: 'absolute',
    top: '16%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  completionEyebrow: {
    color: '#77C8F1',
    fontFamily: typography.fonts.body,
    fontSize: 10,
    letterSpacing: 2.7,
  },
  completionTitle: {
    color: '#F4EDD8',
    fontFamily: typography.fonts.heading,
    fontSize: 29,
    letterSpacing: 1.4,
    marginTop: 10,
  },
  completionSubtitle: {
    color: 'rgba(225,239,247,.68)',
    fontFamily: typography.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
});
