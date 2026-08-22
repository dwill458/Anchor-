import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { Pause, Play, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { colors as themeColors, typography } from '@/theme';
import {
  VisualizeAnchorField,
  VisualizeFieldBackground,
} from './VisualizeAnchorField';
import {
  VisualizationPhaseTrack,
  VisualizationPrimaryButton,
} from './VisualizationPrimitives';
import {
  VISUALIZE_PHASE_DEFINITIONS,
  type VisualizePhaseId,
} from './visualizeSessionConfig';
import { useVisualizeSessionEngine } from './useVisualizeSessionEngine';
import { useVisualizeSessionAudio } from './useVisualizeSessionAudio';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { getVisualizeSessionAudioManifest } from '@/services/visualizeAudioManifest';
import { resolvePracticeCompletionSource } from '@/navigation/practiceReturn';

type Props = NativeStackScreenProps<RootStackParamList, 'VisualizeSession'>;

const colors = {
  ...themeColors,
  gold: '#D4AF37',
  goldBright: '#F0CB6A',
  goldDim: '#8a6f23',
  goldLine: 'rgba(212,175,55,0.28)',
  bone: '#F5F0E8',
  boneSoft: 'rgba(245,240,232,0.62)',
  boneFaint: 'rgba(245,240,232,0.34)',
  sheetBg: 'rgba(13,21,40,0.96)',
};

const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;

export const VisualizeSessionScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const {
    anchorId,
    durationSeconds,
    sceneText,
    guidanceVoice,
    backgroundAudio,
    returnTo,
    returnTarget,
    chartContext,
    practiceMode,
    practiceEntrySource,
  } = route.params;

  const anchor = useAnchorStore((state) => state.getAnchorById(anchorId));
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const hapticIntensity = useSettingsStore((state) => state.hapticIntensity);
  const reduceMotion = useReduceMotionEnabled();
  const performanceTier = usePerformanceTier();

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ctrlVisible, setCtrlVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef(false);

  const sessionIdRef = useRef(
    `visualize:${accountId ?? 'guest'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
  );
  const canonicalSessionIdRef = useRef<string | null>(null);

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

      navigation.replace('VisualizeCompletion', {
        anchorId,
        durationSeconds,
        sessionId: canonicalSessionIdRef.current ?? sessionIdRef.current,
        sceneText,
        returnTo,
        returnTarget,
        chartContext,
        practiceMode: practiceMode ?? 'visualize',
      });
    },
    [
      accountId,
      anchor,
      anchorId,
      backgroundAudio,
      chartContext,
      durationSeconds,
      guidanceVoice,
      navigation,
      practiceEntrySource,
      practiceMode,
      returnTarget,
      returnTo,
      route.params.source,
      sceneText,
    ],
  );

  const sessionDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults?.visualize,
  );
  const resolvedGuidanceVoice =
    guidanceVoice ?? sessionDefaults?.guidanceVoice ?? 'female';
  const resolvedBackgroundAudio =
    backgroundAudio ?? sessionDefaults?.backgroundAudio ?? 'ambient';

  const audioPlan = useMemo(
    () =>
      resolveSessionAudioPlan({
        sessionType: 'visualize',
        durationSeconds,
        configuration: {
          guidanceVoice: resolvedGuidanceVoice,
          backgroundAudio: resolvedBackgroundAudio,
          source: 'session_override',
        },
      }),
    [durationSeconds, resolvedBackgroundAudio, resolvedGuidanceVoice],
  );

  const audioManifest = useMemo(
    () => getVisualizeSessionAudioManifest(durationSeconds),
    [durationSeconds],
  );

  const engine = useVisualizeSessionEngine({
    durationSeconds,
    hapticsEnabled: hapticIntensity > 0,
    onComplete: complete,
  });

  const handleInterruption = useCallback(() => {
    engine.pause('audio_interrupted');
  }, [engine]);

  const { fadeOutAndStop } = useVisualizeSessionAudio({
    plan: audioPlan,
    manifest: audioManifest,
    elapsedMs: engine.elapsedMs,
    isActive: engine.state === 'running',
    isCompleting: engine.state === 'completing',
    isComplete: engine.state === 'completed',
    onInterruption: handleInterruption,
  });

  const isPaused = engine.state === 'paused';

  // Controls Auto-Fade Logic
  const resetHideTimer = useCallback(() => {
    setCtrlVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isPaused && !confirmEnd) {
      hideTimerRef.current = setTimeout(() => {
        setCtrlVisible(false);
      }, 3_000);
    }
  }, [confirmEnd, isPaused]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPaused, confirmEnd, resetHideTimer]);

  // Start engine on mount
  useEffect(() => {
    engine.start();
  }, [engine]);

  // Calculate current phase index & line
  const phaseKey = (engine.phase.id as VisualizePhaseId) || 'arrive';
  const phaseIndex = Math.max(
    0,
    VISUALIZE_PHASE_DEFINITIONS.findIndex((p) => p.key === phaseKey),
  );
  const phaseDef = VISUALIZE_PHASE_DEFINITIONS[phaseIndex] ?? VISUALIZE_PHASE_DEFINITIONS[0];
  const lines = phaseDef.lines;
  const lineIndex = Math.min(
    Math.floor(engine.phaseProgress * lines.length),
    lines.length - 1,
  );
  const currentLine = lines[lineIndex] ?? lines[0];

  // Scene text opacity during Build phase (fades as the scene establishes)
  const sceneOpacity =
    phaseKey === 'build'
      ? Math.max(0, 1 - Math.max(0, engine.phaseProgress - 0.5) / 0.35)
      : 0;

  const remaining = Math.max(0, durationSeconds - Math.floor(engine.elapsedSeconds));

  const handleEndEarly = () => {
    completionRef.current = true;
    void fadeOutAndStop();
    engine.endEarly();
    setConfirmEnd(false);
    navigation.popToTop();
  };

  // Intercept Android hardware back press and navigation transitions
  useEffect(() => {
    const onBackPress = () => {
      if (completionRef.current) {
        return false;
      }
      setConfirmEnd(true);
      return true;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      if (completionRef.current) {
        return;
      }
      e.preventDefault();
      setConfirmEnd(true);
    });

    return () => {
      backSubscription.remove();
      unsubscribeBeforeRemove();
    };
  }, [navigation]);

  const sigilSvg = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const imageUrl = anchor?.enhancedImageUrl;

  return (
    <Pressable style={styles.screenContainer} onPress={resetHideTimer}>
      <VisualizeFieldBackground phase={phaseKey} paused={isPaused} />

      {/* Top Controls Bar (fades out during immersive practice) */}
      <View
        pointerEvents={ctrlVisible || isPaused ? 'auto' : 'none'}
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top + 8, 20), opacity: ctrlVisible || isPaused ? 1 : 0.06 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End session"
          onPress={() => setConfirmEnd(true)}
          style={styles.iconBtn}
        >
          <X size={15} color={colors.boneSoft} />
        </Pressable>

        <Text style={styles.topBarTitle}>VISUALIZE</Text>

        <View style={styles.topSpacer} />
      </View>

      {/* Floating Paused Tag */}
      {isPaused && (
        <View style={styles.pausedTagWrap} pointerEvents="none">
          <View style={styles.pausedPill}>
            <Text style={styles.pausedText}>PAUSED</Text>
          </View>
        </View>
      )}

      {/* Center Anchor Stage Field */}
      <View style={styles.anchorFieldWrap}>
        <VisualizeAnchorField
          phase={phaseKey}
          phaseProgress={engine.phaseProgress}
          totalProgress={engine.totalProgress}
          active={engine.state === 'running'}
          paused={isPaused}
          reduceMotion={reduceMotion}
          performanceTier={performanceTier}
          heroSize={330}
          sigilSize={228}
          imageUrl={imageUrl}
          sigilSvg={sigilSvg}
        />
      </View>

      {/* Session Bottom Guidance & Controls */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {/* 5-Dot Progress Track */}
        <VisualizationPhaseTrack
          currentPhaseIndex={phaseIndex}
          totalPhases={5}
          phaseProgress={engine.phaseProgress}
          remainingText={`${formatTime(remaining)} remaining`}
        />

        {/* Phase Number & Name */}
        <Text style={styles.phaseLabel}>
          PHASE {phaseIndex + 1} OF 5 · {phaseDef.name}
        </Text>

        {/* Main Guidance Text */}
        <Text style={styles.mainGuidance} numberOfLines={3}>
          {currentLine.m}
        </Text>

        {/* Sub Guidance Text */}
        <Text style={styles.subGuidance}>
          {currentLine.s || ' '}
        </Text>

        {/* Build Phase Quoted Scene Text */}
        {phaseKey === 'build' && sceneOpacity > 0 ? (
          <Text style={[styles.sceneQuote, { opacity: sceneOpacity }]}>
            "{sceneText}"
          </Text>
        ) : null}

        {/* Bottom Play/Pause & End Controls */}
        <View
          pointerEvents={ctrlVisible || isPaused ? 'auto' : 'none'}
          style={[
            styles.controlsRow,
            { opacity: ctrlVisible || isPaused ? 1 : 0.06 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
            onPress={() => {
              if (isPaused) {
                engine.resume();
              } else {
                engine.pause();
              }
              resetHideTimer();
            }}
            style={styles.pauseBtn}
          >
            {isPaused ? (
              <Play size={18} color={colors.bone} fill={colors.bone} />
            ) : (
              <Pause size={17} color={colors.bone} fill={colors.bone} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End session"
            onPress={() => setConfirmEnd(true)}
            style={styles.endBtn}
          >
            <Text style={styles.endBtnText}>END</Text>
          </Pressable>
        </View>
      </View>

      {/* Confirmation Modal when Ending Early */}
      <Modal
        visible={confirmEnd}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmEnd(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => setConfirmEnd(false)}
          />
          <View style={[styles.confirmSheet, { paddingBottom: Math.max(insets.bottom + 10, 24) }]}>
            <View style={styles.sheetGrab} />
            <Text style={styles.confirmTitle}>End visualization?</Text>
            <Text style={styles.confirmBody}>
              Your progress in this session will not be recorded.
            </Text>
            <View style={styles.confirmBtnStack}>
              <VisualizationPrimaryButton
                label="CONTINUE SESSION"
                onPress={() => setConfirmEnd(false)}
              />
              <Pressable
                accessibilityRole="button"
                onPress={handleEndEarly}
                style={styles.endConfirmBtn}
              >
                <Text style={styles.endConfirmText}>End Session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#04060c',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    zIndex: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: 'rgba(245,240,232,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 3.2,
    color: colors.boneSoft,
    textTransform: 'uppercase',
  },
  topSpacer: {
    width: 34,
  },
  pausedTagWrap: {
    position: 'absolute',
    top: 96,
    left: 0,
    right: 0,
    zIndex: 9,
    alignItems: 'center',
  },
  pausedPill: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: 'rgba(10,16,32,0.85)',
  },
  pausedText: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  anchorFieldWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  bottomSection: {
    paddingHorizontal: 30,
    alignItems: 'center',
    gap: 12,
    zIndex: 8,
  },
  phaseLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  mainGuidance: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 24,
    fontWeight: '500',
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 32,
    maxWidth: 310,
    minHeight: 64,
  },
  subGuidance: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.boneFaint,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    minHeight: 20,
    marginTop: -4,
  },
  sceneQuote: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 14,
    color: 'rgba(245,240,232,0.55)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,240,232,0.08)',
    paddingTop: 8,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 6,
  },
  pauseBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  endBtnText: {
    fontFamily: typography.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.boneFaint,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,4,10,0.6)',
  },
  confirmSheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 8,
  },
  sheetGrab: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,232,0.16)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  confirmTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: colors.bone,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.boneSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: -4,
  },
  confirmBtnStack: {
    gap: 10,
    marginTop: 6,
  },
  endConfirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.16)',
    backgroundColor: 'rgba(245,240,232,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endConfirmText: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.boneSoft,
  },
});
