import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { AnchorMotion, getCategoryFieldColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { V2FocusField } from './V2FocusField';

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
  initialControlsVisible?: boolean;
  initialEndConfirm?: boolean;
  initialResolving?: boolean;
  initialStage?: 'prepare' | 'focus';
  autoAdvancePrepare?: boolean;
}

const CLOSING_CUES: Record<number, string> = {
  30: 'Come back to what matters.',
  60: 'Hold your attention here.',
};

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

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
  initialControlsVisible = false,
  initialEndConfirm = false,
  initialResolving = false,
  initialStage,
  autoAdvancePrepare = true,
}: V2FocusActiveScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();
  const totalMs = durationSeconds * 1000;
  const anchorSize = Math.min(214, Math.max(176, Math.round(width * 0.48)));
  const fieldSize = Math.min(330, Math.max(224, Math.round(width * 0.7)));
  const ringPadding = 22;
  const ringSize = anchorSize + ringPadding * 2;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

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
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Session State
  const [elapsedMs, setElapsedMs] = useState<number>(initialElapsedMs);
  const [isPaused, setIsPaused] = useState<boolean>(initialPaused);
  const [controlsVisible, setControlsVisible] = useState<boolean>(initialControlsVisible);
  const [endConfirmVisible, setEndConfirmVisible] = useState<boolean>(initialEndConfirm);
  const [isResolving, setIsResolving] = useState<boolean>(initialResolving);
  const elapsedMsRef = useRef(initialElapsedMs);
  const displayedRemainingSecondsRef = useRef(Math.ceil(Math.max(0, totalMs - initialElapsedMs) / 1000));

  // Transient transitions below remain native-driver animations. Continuous
  // Focus motion is owned by Reanimated shared values, never React state.
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.65)).current;
  const controlsOpacity = useRef(new Animated.Value(initialControlsVisible ? 1 : 0)).current;
  const prepareFadeAnim = useRef(new Animated.Value(1)).current;
  const anchorScaleAnim = useRef(new Animated.Value(defaultStage === 'prepare' ? 0.94 : 1)).current;
  const visualProgress = useSharedValue(Math.min(1, Math.max(0, initialElapsedMs / totalMs)));
  const breatheScale = useSharedValue(1);
  const anchorDrift = useSharedValue(0);
  const anchorLuminance = useSharedValue(1);
  const washMotion = useSharedValue(0);
  const fieldTransition = useSharedValue(defaultStage === 'prepare' ? 0 : 1);
  const completionWash = useSharedValue(0);
  const progressAnimatedProps = useAnimatedProps(
    () => ({ strokeDashoffset: circumference * (1 - visualProgress.value) }),
    [circumference],
  );
  const breathingStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breatheScale.value },
      { translateY: anchorDrift.value },
    ],
    opacity: anchorLuminance.value,
  }));
  const fieldTransitionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fieldTransition.value, [0, 1], [0.72, 1]),
    transform: [{ scale: interpolate(fieldTransition.value, [0, 1], [0.94, 1.02]) }],
  }));
  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washMotion.value, [0, 1], [0.34, 0.48]),
    transform: [{ scale: interpolate(washMotion.value, [0, 1], [0.97, 1.04]) }],
  }));
  const completionWashStyle = useAnimatedStyle(() => ({
    opacity: completionWash.value,
  }));

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

  const syncVisualProgress = useCallback(
    (elapsed: number) => {
      const normalized = Math.min(1, Math.max(0, elapsed / totalMs));
      cancelAnimation(visualProgress);
      visualProgress.value = normalized;
      if (!reduceMotion && normalized < 1) {
        visualProgress.value = withTiming(1, {
          duration: Math.max(0, totalMs - elapsed),
          easing: ReanimatedEasing.linear,
        });
      }
    },
    [reduceMotion, totalMs, visualProgress],
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

  // The progress ring is visual-only. It is always re-synchronised from the
  // monotonic logical clock after a start or resume, so it can never become the
  // authority for completion, audio, or persisted session time.
  useEffect(() => {
    if (stage !== 'focus' || isPaused || endConfirmVisible || isResolving) {
      cancelAnimation(visualProgress);
      return;
    }
    syncVisualProgress(calculateElapsed());
  }, [calculateElapsed, cancelAnimation, endConfirmVisible, isPaused, isResolving, stage, syncVisualProgress, visualProgress]);

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
    if (reduceMotion || isPaused || isResolving || endConfirmVisible || stage !== 'focus') {
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
  }, [anchorDrift, anchorLuminance, breatheScale, endConfirmVisible, isPaused, isResolving, reduceMotion, stage, washMotion]);

  // Controls fade animation
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible && !isPaused && !endConfirmVisible && !isResolving ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible, endConfirmVisible, isPaused, isResolving]);

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

  // Natural completion sequence
  const handleNaturalCompletion = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    setIsResolving(true);
    setStage('resolving');
    setControlsVisible(false);
    fieldTransition.value = withTiming(1.08, {
      duration: 480,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
    completionWash.value = reduceMotion
      ? 0.24
      : withTiming(0.24, {
          duration: 720,
          easing: ReanimatedEasing.out(ReanimatedEasing.ease),
        });

    // Subtle tactile success haptic
    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

    // Fade ambient audio
    if (ambientPlayerRef.current) {
      ambientPlayerRef.current.setVolume(0.04);
      setTimeout(() => {
        ambientPlayerRef.current?.stop();
      }, 700);
    }

    // Resolving pulse animation
    if (!reduceMotion) {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.65);
      Animated.parallel([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Deliver completion after brief resolving hold
    const completeTimeout = setTimeout(() => {
      onComplete({
        plannedDurationSeconds: durationSeconds,
        actualDurationSeconds: durationSeconds,
        completedAt: new Date().toISOString(),
      });
    }, 850);

    return () => clearTimeout(completeTimeout);
  }, [completionWash, durationSeconds, fieldTransition, onComplete, pulseAnim, pulseOpacity, reduceMotion]);

  // Logical cadence only: audio cues and completion use the monotonic clock.
  // React state changes at most once a second for the visible time label; the
  // ring itself never waits for this interval and runs on the UI thread.
  useEffect(() => {
    if (stage !== 'focus' || isPaused || endConfirmVisible || isResolving) return;

    const interval = setInterval(() => {
      const currentElapsed = Math.min(totalMs, calculateElapsed());
      elapsedMsRef.current = currentElapsed;

      const remaining = totalMs - currentElapsed;
      const remainingSeconds = Math.ceil(Math.max(0, remaining) / 1000);
      if (remainingSeconds !== displayedRemainingSecondsRef.current) {
        displayedRemainingSecondsRef.current = remainingSeconds;
        setElapsedMs(currentElapsed);
      }
      if (reduceMotion) {
        syncVisualProgress(currentElapsed);
      }
      checkVoiceCues(remaining);

      if (currentElapsed >= totalMs && !doneRef.current) {
        clearInterval(interval);
        handleNaturalCompletion();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [
    calculateElapsed,
    checkVoiceCues,
    endConfirmVisible,
    handleNaturalCompletion,
    isPaused,
    isResolving,
    stage,
    reduceMotion,
    syncVisualProgress,
    totalMs,
  ]);

  // Reveal controls with 3-second auto-dismiss
  const revealControls = useCallback(() => {
    if (stage === 'prepare') {
      startFocusSession();
      return;
    }
    if (isPaused || endConfirmVisible || isResolving) return;
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [endConfirmVisible, isPaused, isResolving, stage, startFocusSession]);

  // Pause session
  const pauseSession = useCallback(
    (reason: string = 'user') => {
      if (stage !== 'focus' || isPaused || isResolving) return;
      const now = readClock();
      pausedAtMonotonicRef.current = now;
      const pausedElapsed = Math.min(totalMs, calculateElapsed(now));
      elapsedMsRef.current = pausedElapsed;
      displayedRemainingSecondsRef.current = Math.ceil(Math.max(0, totalMs - pausedElapsed) / 1000);
      setElapsedMs(pausedElapsed);
      setIsPaused(true);
      setControlsVisible(false);

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
    setEndConfirmVisible(false);

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
      if (endConfirmVisible) {
        setEndConfirmVisible(false);
        return true;
      }
      pauseSession('hardware_back');
      setEndConfirmVisible(true);
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [endConfirmVisible, isResolving, onExit, pauseSession, stage]);

  // Early end confirmed
  const handleConfirmEnd = useCallback(() => {
    ambientPlayerRef.current?.stop();
    voicePlayerRef.current?.stop();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: 'focus',
      planned_duration_seconds: durationSeconds,
      elapsed_seconds: Math.floor(elapsedMsRef.current / 1000),
    });
    onExit();
  }, [durationSeconds, elapsedMs, onExit]);

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
      <Reanimated.View pointerEvents="none" style={[styles.completionWash, completionWashStyle]} />
      {/* Center Stage: Anchor + Progress trace + Atmospheric pigment wash */}
      <View style={styles.centerStage} pointerEvents="box-none">
        {/* A low-contrast category wash keeps the dark surface from feeling flat. */}
        <Reanimated.View
          style={[
            styles.atmosphereWash,
            {
              width: fieldSize * 0.82,
              height: fieldSize * 0.82,
              borderRadius: (fieldSize * 0.82) / 2,
              backgroundColor: getCategoryFieldColor(anchor.category),
            },
            atmosphereStyle,
          ]}
        />

        <Reanimated.View
          pointerEvents="none"
          style={[styles.fieldLayer, { width: fieldSize, height: fieldSize }, fieldTransitionStyle]}
        >
          <V2FocusField
            size={fieldSize}
            progress={visualProgress}
            category={anchor.category}
            reduceMotion={reduceMotion}
            motionActive={!isPaused && !endConfirmVisible && !isResolving}
          />
        </Reanimated.View>

        <View
          style={{
            width: ringSize,
            height: ringSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Circular Progress Trace - visible during active focus */}
          {stage !== 'prepare' && (
            <Svg
              width={ringSize}
              height={ringSize}
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              style={styles.progressSvg}
            >
              {/* Subtle background track */}
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Active animated fill */}
              <AnimatedCircle
                testID="focus-progress-fill"
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke={practiceColors.focus}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                animatedProps={progressAnimatedProps}
                fill="none"
              />
            </Svg>
          )}

          {/* Anchor Artwork Medallion */}
          <Animated.View
            style={[
              styles.medallionWrapper,
              {
                transform: [
                  { scale: stage === 'prepare' ? anchorScaleAnim : 1 },
                ],
                opacity: isPaused ? 0.5 : 1,
              },
            ]}
          >
            <Reanimated.View style={breathingStyle}>
              <CircularAnchorRenderer
                svg={anchorArtworkSvg(anchor)}
                category={anchor.category}
                size={anchorSize}
                appearance="dark"
                accessibilityLabel={`${anchor.category} Anchor artwork`}
              />
            </Reanimated.View>
          </Animated.View>

          {/* Completion Visual Pulse */}
          {isResolving && !reduceMotion ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderColor: practiceColors.focus,
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity,
                },
              ]}
            />
          ) : null}
        </View>

        {/* State 2: Prepare Transition Content */}
        {stage === 'prepare' ? (
          <Animated.View
            style={[
              styles.prepareContent,
              { opacity: prepareFadeAnim },
            ]}
          >
            <Text style={styles.prepareIntention}>
              “{anchor.intentionText}”
            </Text>
            <Text style={styles.prepareSupportCopy}>
              Return to it once. Then let the Anchor hold it.
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.focusQuietContainer}>
            <Text style={styles.focusQuietHint}>
              Return to the Anchor.
            </Text>
          </View>
        )}
      </View>

      {/* Top Header Label */}
      <View
        style={[
          styles.topHeader,
          { paddingTop: Math.max(48, insets.top + 14) },
        ]}
      >
        <Text style={styles.topLabel}>
          {stage === 'prepare' ? 'PREPARE' : 'FOCUS'}
        </Text>
      </View>

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

      {/* Active Focus Bottom Minimal Pause Control */}
      {stage === 'focus' && !controlsVisible && !isPaused && !endConfirmVisible && (
        <View
          style={[
            styles.bottomMinimalBar,
            { paddingBottom: Math.max(26, insets.bottom + 12) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause Focus"
            testID="focus-pause-button"
            onPress={() => pauseSession('user_button')}
            style={styles.minimalPauseBtn}
          >
            <Text style={styles.minimalPauseText}>Pause</Text>
          </Pressable>
        </View>
      )}

      {/* Tapped Chrome Controls Container (Remaining time + Pause/End buttons) */}
      <Animated.View
        pointerEvents={controlsVisible && !isPaused && !endConfirmVisible ? 'auto' : 'none'}
        style={[
          styles.chromeContainer,
          { opacity: controlsOpacity },
        ]}
      >
        <View style={[styles.topBar, { paddingTop: Math.max(50, insets.top + 16) }]}>
          <Text testID="focus-remaining-time" style={styles.remainingText}>
            {fmtRemaining(totalMs - elapsedMs)} remaining
          </Text>
        </View>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(28, insets.bottom + 16) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause Focus"
            testID="focus-pause-button"
            onPress={(e) => {
              e?.stopPropagation?.();
              pauseSession('user_button');
            }}
            style={styles.controlButton}
          >
            <Text style={styles.pauseButtonText}>Pause</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End Focus"
            testID="focus-end-button"
            onPress={(e) => {
              e?.stopPropagation?.();
              pauseSession('user_button');
              setEndConfirmVisible(true);
            }}
            style={styles.controlButton}
          >
            <Text style={styles.endButtonText}>End</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Paused Overlay */}
      {isPaused && !endConfirmVisible && (
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
              accessibilityLabel="End Focus"
              onPress={() => setEndConfirmVisible(true)}
              style={styles.endFocusLink}
            >
              <Text style={styles.endFocusLinkText}>End Focus</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* End Confirmation Modal */}
      {endConfirmVisible && (
        <View testID="focus-end-confirm-modal" style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>End Focus?</Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep going"
                testID="focus-keep-going-button"
                onPress={() => setEndConfirmVisible(false)}
                style={styles.keepGoingButton}
              >
                <Text style={styles.keepGoingButtonText}>Keep going</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="End session"
                testID="focus-confirm-end-session"
                onPress={handleConfirmEnd}
                style={styles.confirmEndButton}
              >
                <Text style={styles.confirmEndButtonText}>End session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E0F14',
  },
  completionWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FBF9F4',
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
    letterSpacing: 2,
    fontWeight: '700',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  centerStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atmosphereWash: {
    position: 'absolute',
  },
  fieldLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  medallionWrapper: {
    borderRadius: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 16,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  prepareContent: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    marginTop: spacing[5],
    maxWidth: 340,
  },
  prepareIntention: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    letterSpacing: -0.2,
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
    backgroundColor: practiceColors.focus,
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
    color: '#FFFFFF',
  },
  focusQuietContainer: {
    marginTop: spacing[6],
    alignItems: 'center',
  },
  focusQuietHint: {
    ...typography.bodyMD,
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.38)',
    letterSpacing: 0.2,
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
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radii.round,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  minimalPauseText: {
    ...typography.labelSM,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: practiceColors.focus,
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
    color: '#FFFFFF',
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
    backgroundColor: '#1C1D24',
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
    backgroundColor: practiceColors.focus,
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
    color: '#FFFFFF',
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
