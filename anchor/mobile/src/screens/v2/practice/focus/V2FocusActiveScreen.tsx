import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { practiceColors } from '@/theme/v2/practiceColors';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import { useSessionAudio, type ManagedSessionAudioPlayer } from '@/hooks/useSessionAudio';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';

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
}

const CLOSING_CUES: Record<number, string> = {
  30: 'Come back to what matters.',
  60: 'Hold your attention here.',
};

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
}: V2FocusActiveScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();
  const totalMs = durationSeconds * 1000;

  // Use keep-awake while the session is active
  useKeepAwake('focus-session');

  // Clock references
  const startedAtMonotonicRef = useRef<number | null>(null);
  const pausedAtMonotonicRef = useRef<number | null>(null);
  const accumulatedPausedMsRef = useRef<number>(0);
  const doneRef = useRef<boolean>(initialResolving);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [elapsedMs, setElapsedMs] = useState<number>(initialElapsedMs);
  const [isPaused, setIsPaused] = useState<boolean>(initialPaused);
  const [controlsVisible, setControlsVisible] = useState<boolean>(initialControlsVisible);
  const [endConfirmVisible, setEndConfirmVisible] = useState<boolean>(initialEndConfirm);
  const [isResolving, setIsResolving] = useState<boolean>(initialResolving);

  // Animations
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.65)).current;
  const controlsOpacity = useRef(new Animated.Value(initialControlsVisible ? 1 : 0)).current;

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

  // Breathing animation
  useEffect(() => {
    if (reduceMotion || isPaused || isResolving || endConfirmVisible) {
      breatheAnim.setValue(1);
      return;
    }

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.015,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    breatheLoop.start();
    return () => breatheLoop.stop();
  }, [breatheAnim, endConfirmVisible, isPaused, isResolving, reduceMotion]);

  // Controls fade animation
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible && !isPaused && !endConfirmVisible && !isResolving ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible, endConfirmVisible, isPaused, isResolving]);

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

  // Audio start & ambient loop
  useEffect(() => {
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

    startedAtMonotonicRef.current = readClock();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: 'focus',
      duration_seconds: durationSeconds,
      voice,
      ambient,
    });

    return () => {
      ambientPlayerRef.current?.stop();
      ambientPlayerRef.current = null;
      voicePlayerRef.current?.stop();
      voicePlayerRef.current = null;
    };
  }, [audioPlan, createSessionAudioPlayer, durationSeconds, readClock, voice, ambient]);

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
    setControlsVisible(false);

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
          toValue: 1.32,
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

    // Deliver completion after brief resolving pause
    const completeTimeout = setTimeout(() => {
      onComplete({
        plannedDurationSeconds: durationSeconds,
        actualDurationSeconds: durationSeconds,
        completedAt: new Date().toISOString(),
      });
    }, 850);

    return () => clearTimeout(completeTimeout);
  }, [durationSeconds, onComplete, pulseAnim, pulseOpacity, reduceMotion]);

  // Main timer tick
  useEffect(() => {
    if (isPaused || endConfirmVisible || isResolving) return;

    const interval = setInterval(() => {
      const currentElapsed = Math.min(totalMs, calculateElapsed());
      setElapsedMs(currentElapsed);

      const remaining = totalMs - currentElapsed;
      checkVoiceCues(remaining);

      if (currentElapsed >= totalMs && !doneRef.current) {
        clearInterval(interval);
        handleNaturalCompletion();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [
    calculateElapsed,
    checkVoiceCues,
    endConfirmVisible,
    handleNaturalCompletion,
    isPaused,
    isResolving,
    totalMs,
  ]);

  // Reveal controls with 3-second auto-dismiss
  const revealControls = useCallback(() => {
    if (isPaused || endConfirmVisible || isResolving) return;
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [endConfirmVisible, isPaused, isResolving]);

  // Pause session
  const pauseSession = useCallback(
    (reason: string = 'user') => {
      if (isPaused || isResolving) return;
      const now = readClock();
      pausedAtMonotonicRef.current = now;
      setIsPaused(true);
      setControlsVisible(false);

      ambientPlayerRef.current?.pause();
      voicePlayerRef.current?.pause();

      AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_PAUSED, {
        practice_mode: 'focus',
        reason,
      });
    },
    [isPaused, isResolving, readClock]
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
      if (nextState !== 'active' && !doneRef.current) {
        pauseSession(`app_${nextState}`);
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  // Android hardware back handler
  useEffect(() => {
    const onBackPress = () => {
      if (isResolving || doneRef.current) return true;
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
  }, [endConfirmVisible, isResolving, pauseSession]);

  // Early end confirmed
  const handleConfirmEnd = useCallback(() => {
    ambientPlayerRef.current?.stop();
    voicePlayerRef.current?.stop();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_ENDED_EARLY, {
      practice_mode: 'focus',
      planned_duration_seconds: durationSeconds,
      elapsed_seconds: Math.floor(elapsedMs / 1000),
    });
    onExit();
  }, [durationSeconds, elapsedMs, onExit]);

  // Proportions from reference
  const size = 232;
  const ringSize = size + 30; // 262px
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsedMs / totalMs);
  const strokeDashoffset = circumference * (1 - progress);

  // Language cues visibility windows
  const introVisible = elapsedMs >= 150 && elapsedMs < 1500;
  const cueWindow = durationSeconds >= 30 && voice !== 'none';
  const cueVisible =
    cueWindow && elapsedMs >= totalMs - 4500 && elapsedMs < totalMs - 1200;
  const cueText = CLOSING_CUES[durationSeconds] || CLOSING_CUES[60];

  return (
    <Pressable
      testID="v2-focus-active-screen"
      onPress={revealControls}
      style={styles.screen}
    >
      {/* Center artwork and progress ring */}
      <View style={styles.centerStage} pointerEvents="box-none">
        <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
          {/* Functional Progress Ring */}
          <Svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            style={styles.progressSvg}
          >
            {/* Background Track */}
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Animated Fill */}
            <Circle
              testID="focus-progress-fill"
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={practiceColors.focus}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              fill="none"
            />
          </Svg>

          {/* Anchor Artwork Medallion */}
          <Animated.View
            style={[
              styles.medallionWrapper,
              {
                transform: [{ scale: breatheAnim }],
                opacity: isPaused ? 0.6 : 1,
              },
            ]}
          >
            <CircularAnchorRenderer
              svg={anchorArtworkSvg(anchor)}
              category={anchor.category}
              size={size}
              accessibilityLabel={`${anchor.category} Anchor`}
            />
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

        {/* Temporary Intention / Cue container */}
        <View style={styles.languageContainer}>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.intentionText,
              { opacity: introVisible ? 1 : 0 },
            ]}
          >
            {`“${anchor.intentionText}”`}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.cueText,
              { opacity: cueVisible ? 1 : 0 },
            ]}
          >
            {cueText}
          </Text>
        </View>
      </View>

      {/* Hidden Controls Chrome (Top remaining + Bottom Pause/End) */}
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
                onPress={() => {
                  setEndConfirmVisible(false);
                }}
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
    backgroundColor: '#121013',
  },
  centerStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  medallionWrapper: {
    borderRadius: 116,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 16,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  languageContainer: {
    height: 36,
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    position: 'relative',
  },
  intentionText: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 19,
    color: 'rgba(255, 255, 255, 0.94)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  cueText: {
    position: 'absolute',
    ...typography.bodyMD,
    fontFamily: typography.displaySemiBold,
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  chromeContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    backgroundColor: 'rgba(10, 9, 7, 0.62)',
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
    backgroundColor: 'rgba(10, 9, 7, 0.66)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 290,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  confirmTitle: {
    ...typography.headingMD,
    fontFamily: typography.displayBold,
    fontSize: 19,
    color: colors.text.primary,
  },
  confirmActions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  keepGoingButton: {
    backgroundColor: '#5C3A82',
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
    color: colors.text.secondary,
  },
});
