import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { Pause } from 'lucide-react-native';
import { AnchorMotion, colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { V2FocusAnchorArtwork } from './V2FocusAnchorArtwork';

export interface V2FocusActiveScreenProps {
  anchor: Anchor;
  durationSeconds: number;
  voice: GuidanceVoice;
  ambient: boolean;
  onExit: () => void;
  onComplete: (sessionData: {
    plannedDurationSeconds: number;
    actualDurationSeconds: number;
    completedAt: string;
  }) => void;
  /** Test instrumentation overrides */
  initialElapsedMs?: number;
  initialPaused?: boolean;
  initialResolving?: boolean;
  initialStage?: 'prepare' | 'focus';
  autoAdvancePrepare?: boolean;
}

function fmtRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function V2FocusActiveScreen({
  anchor,
  durationSeconds,
  voice,
  ambient,
  onExit,
  onComplete,
  initialElapsedMs = 0,
  initialPaused = false,
  initialResolving = false,
  initialStage,
  autoAdvancePrepare = true,
}: V2FocusActiveScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const totalMs = durationSeconds * 1000;
  // The field is calculated from usable height, so short screens close gaps
  // before the Anchor needs to shrink.
  const usableHeight = Math.max(320, height - insets.top - insets.bottom);
  const bottomControlGap = Math.round(Math.min(16, Math.max(8, usableHeight * 0.018)));
  const anchorSize = Math.round(
    Math.min(width * 0.84, usableHeight * 0.48, 380),
  );
  const atmosphereId = `focus-atmosphere-${anchor.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const categoryColor = getCategoryColor(anchor.category);

  // Use keep-awake while the practice is active
  useKeepAwake('focus-session');

  // Stage state: 'prepare' -> 'focus' -> 'resolving'
  const defaultStage =
    initialStage ?? (initialElapsedMs > 0 || initialResolving ? 'focus' : 'prepare');
  const [stage, setStage] = useState<'prepare' | 'focus' | 'resolving'>(defaultStage);

  // Clock references
  const startedAtMonotonicRef = useRef<number | null>(null);
  const pausedAtMonotonicRef = useRef<number | null>(null);
  const accumulatedPausedMsRef = useRef<number>(0);
  const doneRef = useRef<boolean>(initialResolving);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Session State
  const [elapsedMs, setElapsedMs] = useState<number>(initialElapsedMs);
  const [isPaused, setIsPaused] = useState<boolean>(initialPaused);
  const [isResolving, setIsResolving] = useState<boolean>(initialResolving);
  const elapsedMsRef = useRef(initialElapsedMs);
  const displayedRemainingSecondsRef = useRef(Math.ceil(Math.max(0, totalMs - initialElapsedMs) / 1000));

  // Transient transitions below remain native-driver animations. Continuous
  // Focus motion is owned by Reanimated shared values, never React state.
  const prepareFadeAnim = useRef(new Animated.Value(1)).current;
  const anchorScaleAnim = useRef(new Animated.Value(defaultStage === 'prepare' ? 0.94 : 1)).current;
  const breatheScale = useSharedValue(1);
  const anchorDrift = useSharedValue(0);
  const anchorLuminance = useSharedValue(1);
  const washMotion = useSharedValue(0);
  const sessionProgress = useSharedValue(Math.min(1, initialElapsedMs / totalMs));
  const fieldTransition = useSharedValue(defaultStage === 'prepare' ? 0 : 1);
  const resolvingContentOpacity = useSharedValue(1);
  const breathingStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breatheScale.value },
      { translateY: anchorDrift.value },
    ],
    opacity: anchorLuminance.value,
  }));
  const anchorEntranceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fieldTransition.value, [0, 1], [0.76, 1]),
    transform: [{ scale: interpolate(fieldTransition.value, [0, 1], [0.95, 1]) }],
  }));
  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washMotion.value, [0, 1], [0.12, 0.19]),
    transform: [{ scale: interpolate(washMotion.value, [0, 1], [0.98, 1.025]) }],
  }));
  const outerAtmosphereStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washMotion.value, [0, 1], [0.14, 0.09]),
    transform: [{ scale: interpolate(washMotion.value, [0, 1], [1.025, 0.985]) }],
  }));
  const sessionProgressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: sessionProgress.value }],
  }));
  const resolvingContentStyle = useAnimatedStyle(() => ({
    opacity: resolvingContentOpacity.value,
  }));

  useEffect(() => {
    const nextProgress = Math.min(1, Math.max(0, elapsedMs / totalMs));
    sessionProgress.value = reduceMotion
      ? nextProgress
      : withTiming(nextProgress, { duration: 850, easing: AnchorMotion.easing.gentle });
  }, [elapsedMs, reduceMotion, sessionProgress, totalMs]);

  // Audio setup
  const { createSessionAudioPlayer } = useSessionAudio();
  const ambientPlayerRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const voicePlayerRef = useRef<ManagedSessionAudioPlayer | null>(null);
  const playedCuePhasesRef = useRef<Set<string>>(new Set());

  const audioPlan = useMemo(() => {
    return resolveSessionAudioPlan({
      sessionType: 'focus',
      durationSeconds,
      configuration: {
        guidanceVoice: voice,
        backgroundAudio: ambient ? 'ambient' : 'off',
        source: 'default',
      },
    });
  }, [ambient, durationSeconds, voice]);

  // Read monotonic clock
  const readClock = useCallback(() => {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }, []);

  const calculateElapsed = useCallback(
    (now = readClock()): number => {
      if (startedAtMonotonicRef.current == null) return initialElapsedMs;
      if (pausedAtMonotonicRef.current != null) {
        return Math.max(
          0,
          pausedAtMonotonicRef.current -
            startedAtMonotonicRef.current -
            accumulatedPausedMsRef.current +
            initialElapsedMs
        );
      }
      return Math.max(
        0,
        now -
          startedAtMonotonicRef.current -
          accumulatedPausedMsRef.current +
          initialElapsedMs
      );
    },
    [initialElapsedMs, readClock]
  );

  // Start the active focus timer & audio
  const startFocusSession = useCallback(() => {
    if (stage !== 'prepare') return;
    void safeHaptics.selection();

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Fade out prepare content and settle anchor size
    fieldTransition.value = withTiming(1, {
      duration: 520,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
    Animated.parallel([
      Animated.timing(prepareFadeAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(anchorScaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStage('focus');
      startedAtMonotonicRef.current = readClock();

      // Start ambient audio
      if (audioPlan.shouldPlayAmbient && audioPlan.ambientTrack) {
        const player = createSessionAudioPlayer(audioPlan.ambientTrack.asset, {
          loop: true,
          volume: 0.14,
        });
        if (player) {
          ambientPlayerRef.current = player;
          player.play();
        }
      }

      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
        practice_mode: 'focus',
        duration_seconds: durationSeconds,
        voice,
        ambient,
      });
    });
  }, [
    anchorScaleAnim,
    audioPlan,
    createSessionAudioPlayer,
    durationSeconds,
    fieldTransition,
    prepareFadeAnim,
    readClock,
    stage,
    voice,
    ambient,
  ]);

  // If initialStage was focus, immediately initialize clock & audio
  useEffect(() => {
    if (defaultStage === 'focus' && startedAtMonotonicRef.current == null) {
      startedAtMonotonicRef.current = readClock();
      if (audioPlan.shouldPlayAmbient && audioPlan.ambientTrack) {
        const player = createSessionAudioPlayer(audioPlan.ambientTrack.asset, {
          loop: true,
          volume: 0.14,
        });
        if (player) {
          ambientPlayerRef.current = player;
          player.play();
        }
      }
    }
  }, [audioPlan, createSessionAudioPlayer, defaultStage, readClock]);

  // Auto-advance prepare state after ~3.5s
  useEffect(() => {
    if (stage === 'prepare' && autoAdvancePrepare) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        startFocusSession();
      }, 3500);
      return () => {
        if (autoAdvanceTimerRef.current) {
          clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = null;
        }
      };
    }
  }, [autoAdvancePrepare, stage, startFocusSession]);

  // Micro-motion breathing is a UI-thread-only environmental treatment.
  useEffect(() => {
    cancelAnimation(breatheScale);
    cancelAnimation(anchorDrift);
    cancelAnimation(anchorLuminance);
    cancelAnimation(washMotion);
    if (reduceMotion || isPaused || isResolving || stage !== 'focus') {
      return;
    }

    breatheScale.value = withRepeat(
      withTiming(1.012, {
        duration: AnchorMotion.duration.ambient,
        easing: AnchorMotion.easing.gentle,
      }),
      -1,
      true,
    );
    anchorDrift.value = withRepeat(
      withTiming(1.5, {
        duration: 4700,
        easing: AnchorMotion.easing.gentle,
      }),
      -1,
      true,
    );
    anchorLuminance.value = withRepeat(
      withTiming(0.965, {
        duration: 6100,
        easing: AnchorMotion.easing.gentle,
      }),
      -1,
      true,
    );
    washMotion.value = withRepeat(
      withTiming(1, {
        duration: 11000,
        easing: AnchorMotion.easing.gentle,
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breatheScale);
      cancelAnimation(anchorDrift);
      cancelAnimation(anchorLuminance);
      cancelAnimation(washMotion);
    };
  }, [anchorDrift, anchorLuminance, breatheScale, isPaused, isResolving, reduceMotion, stage, washMotion]);

  // Trigger voice cues based on remaining time
  const checkVoiceCues = useCallback(
    (remainingMs: number) => {
      if (!audioPlan.shouldPlayVoice) return;

      for (const cue of audioPlan.voiceCues) {
        if (playedCuePhasesRef.current.has(cue.phaseId)) continue;
        if (remainingMs <= cue.triggerAtRemainingMs + 200) {
          playedCuePhasesRef.current.add(cue.phaseId);
          voicePlayerRef.current?.stop();
          const player = createSessionAudioPlayer(cue.track.asset, {
            loop: false,
            volume: cue.track.playbackGain,
          });
          if (player) {
            voicePlayerRef.current = player;
            player.play();
          }
          break;
        }
      }
    },
    [audioPlan, createSessionAudioPlayer]
  );

  /**
   * The only route into completion. The ref is flipped before any state update
   * or persistence work, so a timer tick and rapid manual taps cannot create
   * two completed practice records.
   */
  const beginEnding = useCallback(
    (trigger: 'automatic' | 'manual') => {
      if (doneRef.current) return;
      doneRef.current = true;

      const finalElapsedMs =
        trigger === 'automatic'
          ? totalMs
          : Math.min(totalMs, Math.max(0, calculateElapsed()));
      const actualDurationSeconds = Math.max(1, Math.ceil(finalElapsedMs / 1000));
      elapsedMsRef.current = finalElapsedMs;
      setElapsedMs(finalElapsedMs);
      setIsResolving(true);
      setStage('resolving');

      // Phase 1: return the visual motion to rest over a perceptible settle.
      cancelAnimation(breatheScale);
      cancelAnimation(anchorDrift);
      cancelAnimation(anchorLuminance);
      cancelAnimation(washMotion);
      breatheScale.value = withTiming(1, { duration: 300, easing: AnchorMotion.easing.gentle });
      anchorDrift.value = withTiming(0, { duration: 300, easing: AnchorMotion.easing.gentle });
      anchorLuminance.value = withTiming(1, { duration: 300, easing: AnchorMotion.easing.gentle });
      washMotion.value = withTiming(0, { duration: 300, easing: AnchorMotion.easing.gentle });
      fieldTransition.value = withTiming(0.92, {
        duration: 300,
        easing: ReanimatedEasing.out(ReanimatedEasing.ease),
      });

      // Phase 2 (1,050ms): the whole active composition fades into the ink
      // base. Phase 3 is the remaining 400ms black hold before completion.
      resolvingContentOpacity.value = reduceMotion
        ? 0
        : withDelay(300, withTiming(0, {
            duration: 1050,
            easing: ReanimatedEasing.inOut(ReanimatedEasing.ease),
          }));

      ambientPlayerRef.current?.setVolume(0.04);
      setTimeout(() => ambientPlayerRef.current?.stop(), 300);
      voicePlayerRef.current?.stop();

      if (trigger === 'manual') {
        AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
          practice_mode: 'focus',
          planned_duration_seconds: durationSeconds,
          elapsed_seconds: actualDurationSeconds,
        });
      }
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

      completionTimerRef.current = setTimeout(() => {
        onComplete({
          plannedDurationSeconds: durationSeconds,
          actualDurationSeconds,
          completedAt: new Date().toISOString(),
        });
      }, reduceMotion ? 0 : 1750);
    },
    [
      anchorDrift,
      anchorLuminance,
      breatheScale,
      calculateElapsed,
      durationSeconds,
      fieldTransition,
      onComplete,
      reduceMotion,
      resolvingContentOpacity,
      totalMs,
      washMotion,
    ]
  );

  useEffect(
    () => () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    },
    []
  );

  // Logical cadence only: audio cues and completion use the monotonic clock.
  // React state changes at most once a second for the visible time label; the
  // ring itself never waits for this interval and runs on the UI thread.
  useEffect(() => {
    if (stage !== 'focus' || isPaused || isResolving) return;

    const interval = setInterval(() => {
      const currentElapsed = Math.min(totalMs, calculateElapsed());
      elapsedMsRef.current = currentElapsed;

      const remaining = totalMs - currentElapsed;
      const remainingSeconds = Math.ceil(Math.max(0, remaining) / 1000);
      if (remainingSeconds !== displayedRemainingSecondsRef.current) {
        displayedRemainingSecondsRef.current = remainingSeconds;
        setElapsedMs(currentElapsed);
      }
      checkVoiceCues(remaining);

      if (currentElapsed >= totalMs && !doneRef.current) {
        clearInterval(interval);
        beginEnding('automatic');
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    calculateElapsed,
    checkVoiceCues,
    beginEnding,
    isPaused,
    isResolving,
    stage,
    totalMs,
  ]);

  // The artwork is the only tappable surface during preparation; active
  // controls remain together in the persistent bottom-control region.
  const revealControls = useCallback(() => {
    if (stage === 'prepare') {
      startFocusSession();
    }
  }, [stage, startFocusSession]);

  // Pause session
  const pauseSession = useCallback(
    (reason: string = 'user') => {
      if (stage !== 'focus' || isPaused || isResolving || doneRef.current) return;
      const now = readClock();
      pausedAtMonotonicRef.current = now;
      const pausedElapsed = Math.min(totalMs, calculateElapsed(now));
      elapsedMsRef.current = pausedElapsed;
      displayedRemainingSecondsRef.current = Math.ceil(Math.max(0, totalMs - pausedElapsed) / 1000);
      setElapsedMs(pausedElapsed);
      setIsPaused(true);

      ambientPlayerRef.current?.pause();
      voicePlayerRef.current?.pause();

      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, {
        practice_mode: 'focus',
        reason,
      });
    },
    [calculateElapsed, isPaused, isResolving, readClock, stage, totalMs]
  );

  // Resume session
  const resumeSession = useCallback(() => {
    if (!isPaused) return;
    const now = readClock();
    if (pausedAtMonotonicRef.current != null) {
      accumulatedPausedMsRef.current += now - pausedAtMonotonicRef.current;
      pausedAtMonotonicRef.current = null;
    }
    setIsPaused(false);
    ambientPlayerRef.current?.play();
    voicePlayerRef.current?.play();

    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_RESUMED, {
      practice_mode: 'focus',
    });
  }, [isPaused, readClock]);

  // AppState background handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && !doneRef.current && stage === 'focus') {
        pauseSession(`app_${nextState}`);
      }
    });
    return () => subscription.remove();
  }, [pauseSession, stage]);

  // Android hardware back handler
  useEffect(() => {
    const onBackPress = () => {
      if (isResolving || doneRef.current) return true;
      if (stage === 'prepare') {
        onExit();
        return true;
      }
      pauseSession('hardware_back');
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [isResolving, onExit, pauseSession, stage]);

  const voiceLabel =
    voice === 'female'
      ? 'Female Voice'
      : voice === 'male'
      ? 'Male Voice'
      : 'No Voice';
  const ambientLabel = ambient ? 'Ambient' : 'Silence';
  const audioSummary = `${voiceLabel} · ${ambientLabel}`;

  return (
    <Pressable
      testID="v2-focus-active-screen"
      onPress={revealControls}
      style={styles.screen}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      {/* Two diffuse fields start at the Anchor and fall away without a visible frame. */}
      <Reanimated.View pointerEvents="none" style={[styles.outerAtmosphere, outerAtmosphereStyle, resolvingContentStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id={`${atmosphereId}-outer`} cx="50%" cy="46%" rx="58%" ry="54%">
              <Stop offset="0%" stopColor={categoryColor} stopOpacity={0.44} />
              <Stop offset="42%" stopColor={categoryColor} stopOpacity={0.14} />
              <Stop offset="100%" stopColor={categoryColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${atmosphereId}-outer)`} />
        </Svg>
      </Reanimated.View>
      <Reanimated.View pointerEvents="none" style={[styles.atmosphere, atmosphereStyle, resolvingContentStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id={atmosphereId} cx="50%" cy="46%" rx="32%" ry="32%">
              <Stop offset="0%" stopColor={categoryColor} stopOpacity={0.7} />
              <Stop offset="48%" stopColor={categoryColor} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={colors.ink.base} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${atmosphereId})`} />
        </Svg>
      </Reanimated.View>
      <Reanimated.View style={[styles.centerStage, resolvingContentStyle]} pointerEvents="box-none">
        <View style={[styles.intentionRegion, { paddingTop: Math.max(insets.top + 42, 66) }]}>
          <Text style={styles.sessionIntention}>{anchor.intentionText}</Text>
        </View>

        <Reanimated.View style={[styles.anchorRegion, anchorEntranceStyle]}>
          <Animated.View
            style={[
              styles.artworkShell,
              {
                transform: [{ scale: stage === 'prepare' ? anchorScaleAnim : 1 }],
                opacity: isPaused ? 0.5 : 1,
              },
            ]}
          >
            <Reanimated.View style={breathingStyle}>
              <V2FocusAnchorArtwork
                svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
                category={anchor.category}
                size={anchorSize}
                surface={colors.ink.base}
                accessibilityLabel={`${anchor.category} Anchor artwork`}
                testID="focus-anchor-artwork"
              />
            </Reanimated.View>
          </Animated.View>
        </Reanimated.View>

        {stage === 'prepare' ? (
          <Animated.View style={[styles.prepareContent, { opacity: prepareFadeAnim }]}>
            <Text style={styles.prepareSupportCopy}>Let the Anchor hold your attention.</Text>
          </Animated.View>
        ) : isResolving ? (
          <View style={styles.focusQuietContainer}>
            <Text style={styles.acknowledgementTitle}>Well done.</Text>
            <Text style={styles.focusQuietHint}>Let it settle.</Text>
          </View>
        ) : null}
      </Reanimated.View>

      {/* Top Header Label */}
      <Reanimated.View
        style={[
          styles.topHeader,
          resolvingContentStyle,
          { paddingTop: Math.max(48, insets.top + 14) },
        ]}
      >
        <Text style={styles.topLabel}>
          FOCUS
        </Text>
      </Reanimated.View>

      {/* Prepare State Bottom Action (Begin Session CTA) */}
      {stage === 'prepare' && (
        <Animated.View
          style={[
            styles.prepareFooter,
            {
              paddingBottom: Math.max(28, insets.bottom + 14),
              opacity: prepareFadeAnim,
            },
          ]}
        >
          <View style={styles.sessionProgressTrack} accessibilityElementsHidden>
            <Reanimated.View
              style={[
                styles.sessionProgressFill,
                { backgroundColor: categoryColor },
                sessionProgressStyle,
              ]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Begin Session"
            testID="focus-prepare-begin-button"
            onPress={startFocusSession}
            style={styles.prepareBeginBtn}
          >
            <Text style={styles.prepareBeginText}>BEGIN</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Timer, progress and actions are one bounded safe-area control group. */}
      {stage === 'focus' && !isPaused && !isResolving && (
        <Reanimated.View
          style={[
            styles.bottomControlRegion,
            resolvingContentStyle,
            { paddingBottom: insets.bottom + 12, gap: bottomControlGap },
          ]}
        >
          <Text testID="focus-remaining-time" style={styles.bottomTimer}>
            {fmtRemaining(totalMs - elapsedMs)}
          </Text>
          <View style={styles.sessionProgressTrack} accessibilityElementsHidden>
            <Reanimated.View
              style={[
                styles.sessionProgressFill,
                { backgroundColor: categoryColor },
                sessionProgressStyle,
              ]}
            />
          </View>
          <View style={styles.bottomControlActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pause Focus"
              testID="focus-pause-button"
              onPress={(event) => {
                event?.stopPropagation?.();
                pauseSession('user_button');
              }}
              style={styles.controlButton}
            >
              <Pause size={14} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.pauseButtonText}>Pause</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End session"
              testID="focus-end-button"
              onPress={(event) => {
                event?.stopPropagation?.();
                beginEnding('manual');
              }}
              style={styles.controlButton}
            >
              <Text style={styles.endButtonText}>End Session</Text>
            </Pressable>
          </View>
        </Reanimated.View>
      )}

      {/* Paused Overlay */}
      {isPaused && !isResolving && (
        <View testID="focus-paused-overlay" style={styles.pausedOverlay}>
          <Text style={styles.pausedTitle}>Paused</Text>
          <View style={styles.pausedActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resume Focus"
              testID="focus-resume-button"
              onPress={resumeSession}
              style={styles.resumeButton}
            >
              <Text style={styles.resumeButtonText}>Resume</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End session"
              testID="focus-paused-end-button"
              onPress={() => beginEnding('manual')}
              style={styles.endFocusLink}
            >
              <Text style={styles.endFocusLinkText}>End Focus</Text>
            </Pressable>
          </View>
        </View>
      )}

    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink.base,
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  topLabel: {
    ...typography.labelSM,
    letterSpacing: 2.2,
    fontWeight: '600',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  centerStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
  },
  outerAtmosphere: {
    ...StyleSheet.absoluteFillObject,
  },
  intentionRegion: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  sessionIntention: {
    ...typography.headingMD,
    fontFamily: typography.display,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.1,
    maxWidth: 320,
    textAlign: 'center',
  },
  anchorRegion: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
  },
  artworkShell: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
    elevation: 10,
  },
  prepareContent: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    marginBottom: spacing[8],
    maxWidth: 340,
  },
  prepareSupportCopy: {
    ...typography.bodyMD,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: 20,
  },
  prepareFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  prepareBeginBtn: {
    backgroundColor: '#FBF9F4',
    paddingVertical: 14,
    paddingHorizontal: 44,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  prepareBeginText: {
    ...typography.labelLG,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#171717',
  },
  focusQuietContainer: {
    minHeight: 54,
    marginBottom: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusQuietHint: {
    ...typography.bodyMD,
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.38)',
    letterSpacing: 0.2,
  },
  sessionTimer: {
    ...typography.numericLarge,
    fontFamily: typography.displayBold,
    fontSize: 31,
    letterSpacing: -1,
    color: 'rgba(255, 255, 255, 0.84)',
  },
  bottomControlRegion: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  bottomTimer: {
    ...typography.numericLarge,
    fontFamily: typography.displayBold,
    fontSize: 28,
    letterSpacing: -0.8,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  bottomControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  acknowledgementTitle: {
    ...typography.headingLG,
    fontFamily: typography.displayBold,
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: 24,
    marginBottom: 6,
  },
  bottomMinimalBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalPauseBtn: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: radii.round,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  minimalPauseText: {
    ...typography.labelSM,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  sessionProgressTrack: {
    width: 154,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
  sessionProgressFill: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
    transformOrigin: 'left center',
  },
  chromeContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  remainingText: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingHorizontal: 22,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controlButton: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonText: {
    ...typography.bodyMD,
    fontFamily: typography.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  endButtonText: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14.5,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 14, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
  },
  pausedTitle: {
    ...typography.headingLG,
    fontFamily: typography.displayBold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  pausedActions: {
    width: '100%',
    maxWidth: 260,
    gap: 12,
  },
  resumeButton: {
    backgroundColor: '#FBF9F4',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButtonText: {
    ...typography.labelLG,
    fontFamily: typography.bodyBold,
    fontSize: 15.5,
    color: '#171717',
  },
  endFocusLink: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endFocusLinkText: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 14, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 290,
    backgroundColor: colors.ink.raised,
    borderRadius: radii.lg,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmTitle: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 19,
    color: '#FFFFFF',
  },
  confirmActions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  keepGoingButton: {
    backgroundColor: '#FBF9F4',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepGoingButtonText: {
    ...typography.labelMD,
    fontFamily: typography.bodyBold,
    fontSize: 14.5,
    color: '#171717',
  },
  confirmEndButton: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmEndButtonText: {
    ...typography.bodyMD,
    fontFamily: typography.bodySemiBold,
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
});
