// Anchor – Focus Session
// Redesigned per Practice Session.html:
// breath aura rings · top-bar layout · linear progress bar · seal press-and-hold

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pause, Play } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useAudio } from '@/hooks/useAudio';
import { safeHaptics } from '@/utils/haptics';
import { RitualScaffold } from './RitualScaffold';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEAL_HOLD_MS = 2500;
const BREATH_INHALE = 4;   // seconds
const BREATH_HOLD_S = 2;   // seconds
const BREATH_EXHALE = 6;   // seconds
const BREATH_TOTAL = BREATH_INHALE + BREATH_HOLD_S + BREATH_EXHALE; // 12s
const RING_STROKE = 5;

const GUIDANCE = [
  'See it as already done.',
  'Breathe with intention.',
  'Feel it in your body.',
  'This moment is yours.',
  'Stand in your power.',
  'Steady breath, steady mind.',
  'Trust the process.',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionStatus = 'arrive' | 'running' | 'paused' | 'completed';

export type FocusSessionProps = {
  intentionText: string;
  anchorImageUri: string;
  durationSeconds?: number;
  onComplete: () => void;
  onSessionCompleted?: () => void;
  onDismiss: () => void;
  groundNoteText?: string;
  groundNoteSecondary?: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// Orbital rings that spin around the sigil during the running phase
type OrbitRingsProps = { radius: number; pausedDim: SharedValue<number>; reduceMotion: boolean };
const OrbitRings: React.FC<OrbitRingsProps> = ({ radius, pausedDim, reduceMotion }) => {
  const sz = radius * 2 + 60;
  const cx = sz / 2;
  const rot1 = useSharedValue(0);
  const rot2 = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    rot1.value = withRepeat(withTiming(360, { duration: 45000, easing: Easing.linear }), -1, false);
    rot2.value = withRepeat(withTiming(-360, { duration: 60000, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(rot1); cancelAnimation(rot2); };
  }, [reduceMotion, rot1, rot2]);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot1.value}deg` }],
    opacity: pausedDim.value,
  }));
  const style2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot2.value}deg` }],
    opacity: pausedDim.value,
  }));

  return (
    <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -sz / 2, marginLeft: -sz / 2, width: sz, height: sz }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, style1]}>
        <Svg width={sz} height={sz}>
          <Circle cx={cx} cy={cx} r={radius + 12} stroke="rgba(212,175,55,0.22)" strokeWidth={1} fill="none" strokeDasharray="4 8" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, style2]}>
        <Svg width={sz} height={sz}>
          <Circle cx={cx} cy={cx} r={radius + 24} stroke="rgba(212,175,55,0.15)" strokeWidth={1} fill="none" strokeDasharray="2 6" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Three concentric aura rings that pulse with the breath cycle
type BreathAuraProps = { breathAnim: SharedValue<number>; anchorSize: number };
const BreathAura: React.FC<BreathAuraProps> = ({ breathAnim, anchorSize }) => {
  const farSz = anchorSize * 1.55;
  const midSz = anchorSize * 1.25;
  const nearSz = anchorSize * 1.1;

  const farStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathAnim.value, [0, 1], [0.07, 0.18]),
    transform: [{ scale: interpolate(breathAnim.value, [0, 1], [0.9, 1.12]) }],
  }));
  const midStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathAnim.value, [0, 1], [0.12, 0.26]),
    transform: [{ scale: interpolate(breathAnim.value, [0, 1], [0.92, 1.08]) }],
  }));
  const nearStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathAnim.value, [0, 1], [0.18, 0.45]),
    transform: [{ scale: interpolate(breathAnim.value, [0, 1], [0.94, 1.05]) }],
  }));

  const base = { position: 'absolute' as const, borderRadius: 9999, alignSelf: 'center' as const };
  return (
    <View style={{ position: 'absolute', width: farSz, height: farSz, top: '50%', left: '50%', marginTop: -farSz / 2, marginLeft: -farSz / 2 }} pointerEvents="none">
      <Animated.View style={[base, { width: farSz, height: farSz, backgroundColor: `${colors.gold}1A` }, farStyle]} />
      <Animated.View style={[base, { width: midSz, height: midSz, top: (farSz - midSz) / 2, left: (farSz - midSz) / 2, backgroundColor: `${colors.gold}28` }, midStyle]} />
      <Animated.View style={[base, { width: nearSz, height: nearSz, top: (farSz - nearSz) / 2, left: (farSz - nearSz) / 2, borderWidth: 1, borderColor: `${colors.gold}48`, backgroundColor: `${colors.gold}10` }, nearStyle]} />
    </View>
  );
};

// Session countdown ring
type ProgressRingProps = {
  radius: number;
  progress: SharedValue<number>;
  pausedDim: SharedValue<number>;
  flare: SharedValue<number>;
};
const ProgressRing: React.FC<ProgressRingProps> = ({ radius, progress, pausedDim, flare }) => {
  const sz = radius * 2 + RING_STROKE * 4;
  const cx = sz / 2;
  const circ = 2 * Math.PI * radius;

  const trackProps = useAnimatedProps(() => ({
    opacity: (0.45 + progress.value * 0.1) * pausedDim.value,
    strokeWidth: RING_STROKE,
  }));
  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
    opacity: (0.35 + 0.55 * progress.value + flare.value * 0.25) * pausedDim.value,
    strokeWidth: RING_STROKE + flare.value * 1.5,
  }));

  return (
    <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -sz / 2, marginLeft: -sz / 2, width: sz, height: sz }} pointerEvents="none">
      <Svg width={sz} height={sz}>
        <AnimatedCircle cx={cx} cy={cx} r={radius} stroke={`${colors.gold}26`} fill="none" animatedProps={trackProps} />
        <AnimatedCircle cx={cx} cy={cx} r={radius} stroke={colors.gold} fill="none"
          strokeDasharray={circ} strokeLinecap="round"
          rotation="-90" origin={`${cx}, ${cx}`}
          animatedProps={fillProps} />
      </Svg>
    </View>
  );
};

// Seal hold ring — fills as user presses
type SealRingProps = { radius: number; sealProgress: SharedValue<number> };
const SealRing: React.FC<SealRingProps> = ({ radius, sealProgress }) => {
  const sz = radius * 2 + RING_STROKE * 4;
  const cx = sz / 2;
  const circ = 2 * Math.PI * radius;

  const trackProps = useAnimatedProps(() => ({ strokeWidth: 2, opacity: 0.18 }));
  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - sealProgress.value),
    opacity: 0.55 + sealProgress.value * 0.45,
    strokeWidth: 2.5,
  }));

  return (
    <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -sz / 2, marginLeft: -sz / 2, width: sz, height: sz }} pointerEvents="none">
      <Svg width={sz} height={sz}>
        <AnimatedCircle cx={cx} cy={cx} r={radius} stroke={colors.gold} fill="none" animatedProps={trackProps} />
        <AnimatedCircle cx={cx} cy={cx} r={radius} stroke={colors.gold} fill="none"
          strokeDasharray={circ} strokeLinecap="round"
          rotation="-90" origin={`${cx}, ${cx}`}
          animatedProps={fillProps} />
      </Svg>
    </View>
  );
};

// Anchor image (svg xml or remote url)
type AnchorHeroProps = { anchorImageUri: string; size: number };
const AnchorHero: React.FC<AnchorHeroProps> = ({ anchorImageUri, size }) => {
  const isSvg = anchorImageUri.trim().startsWith('<svg');
  return (
    <View style={[styles.anchorHero, { width: size, height: size, borderRadius: size / 2 }]}>
      {anchorImageUri ? (
        isSvg
          ? <SvgXml xml={anchorImageUri} width={size} height={size} />
          : <OptimizedImage uri={anchorImageUri} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <View style={styles.anchorFallback}>
          <Text style={[styles.anchorFallbackText, { fontSize: size * 0.22 }]}>✦</Text>
        </View>
      )}
    </View>
  );
};

// Close button — matches prototype's circular glass pill
const CloseButton: React.FC<{ onPress: () => void; testID?: string }> = ({ onPress, testID }) => (
  <Pressable onPress={onPress} style={styles.closeBtn} testID={testID}
    accessibilityRole="button" accessibilityLabel="Dismiss focus session">
    <Text style={styles.closeBtnIcon}>✕</Text>
  </Pressable>
);

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FocusSession: React.FC<FocusSessionProps> = ({
  intentionText,
  anchorImageUri,
  durationSeconds,
  onComplete,
  onSessionCompleted,
  onDismiss,
  groundNoteText,
  groundNoteSecondary,
}) => {
  const { width } = useWindowDimensions();
  const ANCHOR_SIZE = Math.min(Math.round(width * 0.5), 210);
  const RING_RADIUS = ANCHOR_SIZE / 2 + 22;

  const defaultDurationSeconds = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const arrivePhaseEnabled = useSettingsStore((state) => state.arrivePhaseEnabled ?? true);
  const reduceIntentionVisibility = useSettingsStore((state) => state.reduceIntentionVisibility ?? false);
  const resolvedDurationSeconds = durationSeconds ?? defaultDurationSeconds;
  const reduceMotionEnabled = useReduceMotionEnabled();
  const shouldUseArrivePhase =
    arrivePhaseEnabled && !reduceMotionEnabled && resolvedDurationSeconds > 0;
  const totalMs = Math.max(1000, Math.round(resolvedDurationSeconds * 1000));
  const { playSound } = useAudio();
  const { setActiveSession } = useNotificationController();

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<SessionStatus>(
    shouldUseArrivePhase ? 'arrive' : 'running'
  );
  const [arriveCueIndex, setArriveCueIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(totalMs / 1000));
  const [guidanceIdx, setGuidanceIdx] = useState(0);
  const [groundNoteVisible, setGroundNoteVisible] = useState(!!groundNoteText);
  const groundNoteOpacity = useRef(new RNAnimated.Value(0)).current;

  // ── Refs ───────────────────────────────────────────────────────────────────
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arriveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arriveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endAtMsRef = useRef<number>(Date.now() + totalMs);
  const remainingMsRef = useRef<number>(totalMs);
  const renderedSecondsRef = useRef<number>(Math.ceil(totalMs / 1000));
  const completionTriggeredRef = useRef(false);
  const continuePressedRef = useRef(false);
  const bgSoundRef = useRef<{ stop: () => void } | null>(null);

  // ── Shared values ──────────────────────────────────────────────────────────
  const progress = useSharedValue(0);
  const breathScale = useSharedValue(1);
  const breathAnim = useSharedValue(0);    // 0=exhale, 1=inhale peak
  const glowBoost = useSharedValue(0);
  const pausedDim = useSharedValue(1);
  const flare = useSharedValue(0);
  const sealProgress = useSharedValue(0);
  const haloScale = useSharedValue(1);

  // ── Derived display values ─────────────────────────────────────────────────
  const isSeal = status === 'completed';
  const timerDisplay = formatTime(secondsRemaining);
  // Breath cue from elapsed time in the session
  const elapsedSeconds = resolvedDurationSeconds - secondsRemaining;
  const breathPhase = elapsedSeconds % BREATH_TOTAL;
  const breathCueText = breathPhase < BREATH_INHALE
    ? 'Breathe in'
    : breathPhase < BREATH_INHALE + BREATH_HOLD_S
      ? 'Hold'
      : 'Breathe out';

  // ── Ground note (teaching) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!groundNoteText) return;
    setGroundNoteVisible(true);
    RNAnimated.sequence([
      RNAnimated.timing(groundNoteOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      RNAnimated.delay(6000),
      RNAnimated.timing(groundNoteOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
    ]).start(({ finished }) => {
      if (finished) setGroundNoteVisible(false);
    });
  }, [groundNoteText]);

  // ── Timer utilities ────────────────────────────────────────────────────────
  const clearTickInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const clearArriveTimers = useCallback(() => {
    if (arriveIntervalRef.current) { clearInterval(arriveIntervalRef.current); arriveIntervalRef.current = null; }
    if (arriveTimeoutRef.current) { clearTimeout(arriveTimeoutRef.current); arriveTimeoutRef.current = null; }
  }, []);

  const animateProgressToEnd = useCallback((remainingMs: number) => {
    cancelAnimation(progress);
    if (remainingMs <= 0) { progress.value = 1; return; }
    progress.value = withTiming(1, { duration: remainingMs, easing: Easing.linear });
  }, [progress]);

  // ── Completion ─────────────────────────────────────────────────────────────
  const completeSession = useCallback(() => {
    if (completionTriggeredRef.current) return;
    completionTriggeredRef.current = true;
    clearTickInterval();
    clearArriveTimers();
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;

    remainingMsRef.current = 0;
    renderedSecondsRef.current = 0;
    setSecondsRemaining(0);
    setStatus('completed');

    pausedDim.value = withTiming(1, { duration: 180 });
    animateProgressToEnd(220);

    if (reduceMotionEnabled) {
      flare.value = 0;
      glowBoost.value = withTiming(0.2, { duration: 260 });
    } else {
      flare.value = withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })
      );
      glowBoost.value = withSequence(
        withTiming(0.3, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0.12, { duration: 360, easing: Easing.inOut(Easing.quad) })
      );
    }

    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
    if (focusSessionAudio === 'ambient') void playSound('prime-complete');
    onSessionCompleted?.();
  }, [
    animateProgressToEnd, clearArriveTimers, clearTickInterval,
    flare, focusSessionAudio, glowBoost, onSessionCompleted,
    pausedDim, playSound, reduceMotionEnabled,
  ]);

  // ── Tick countdown ─────────────────────────────────────────────────────────
  const tickCountdown = useCallback(() => {
    const remainingMs = Math.max(0, endAtMsRef.current - Date.now());
    remainingMsRef.current = remainingMs;
    const nextSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    if (nextSeconds !== renderedSecondsRef.current) {
      renderedSecondsRef.current = nextSeconds;
      setSecondsRemaining(nextSeconds);
    }
    if (remainingMs <= 0) completeSession();
  }, [completeSession]);

  const startTickInterval = useCallback(() => {
    clearTickInterval();
    intervalRef.current = setInterval(tickCountdown, 250);
  }, [clearTickInterval, tickCountdown]);

  const startRunningPhase = useCallback((runningMs: number) => {
    clearArriveTimers();
    renderedSecondsRef.current = Math.ceil(runningMs / 1000);
    remainingMsRef.current = runningMs;
    endAtMsRef.current = Date.now() + runningMs;
    setSecondsRemaining(renderedSecondsRef.current);
    setStatus('running');

    bgSoundRef.current?.stop();
    bgSoundRef.current =
      focusSessionAudio === 'ambient' ? playSound('prime-begin', 1, true) : null;
    animateProgressToEnd(runningMs);
    startTickInterval();
  }, [animateProgressToEnd, clearArriveTimers, focusSessionAudio, playSound, startTickInterval]);

  // ── Pause / Resume ─────────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    if (status !== 'running') return;
    const remainingMs = Math.max(0, endAtMsRef.current - Date.now());
    remainingMsRef.current = remainingMs;
    clearTickInterval();
    cancelAnimation(progress);
    pausedDim.value = withTiming(0.45, { duration: 180 });
    setStatus('paused');
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
  }, [clearTickInterval, pausedDim, progress, status]);

  const handleResume = useCallback(() => {
    if (status !== 'paused') return;
    if (remainingMsRef.current <= 0) { completeSession(); return; }
    endAtMsRef.current = Date.now() + remainingMsRef.current;
    pausedDim.value = withTiming(1, { duration: 200 });
    setStatus('running');
    bgSoundRef.current =
      focusSessionAudio === 'ambient' ? playSound('prime-begin', 1, true) : null;
    animateProgressToEnd(remainingMsRef.current);
    startTickInterval();
  }, [animateProgressToEnd, completeSession, focusSessionAudio, pausedDim, playSound, startTickInterval, status]);

  // ── Seal mechanic ──────────────────────────────────────────────────────────
  const triggerComplete = useCallback(() => {
    if (continuePressedRef.current) return;
    continuePressedRef.current = true;
    onComplete();
  }, [onComplete]);

  const handleSealPressIn = useCallback(() => {
    if (!isSeal) return;
    sealProgress.value = withTiming(1, { duration: SEAL_HOLD_MS, easing: Easing.linear },
      (finished) => { if (finished) runOnJS(triggerComplete)(); }
    );
  }, [isSeal, sealProgress, triggerComplete]);

  const handleSealPressOut = useCallback(() => {
    cancelAnimation(sealProgress);
    sealProgress.value = withTiming(0, { duration: 200 });
  }, [sealProgress]);

  // Tap also completes (for accessibility and tests)
  const handleSealTap = useCallback(() => {
    if (status !== 'completed' || continuePressedRef.current) return;
    continuePressedRef.current = true;
    onComplete();
  }, [onComplete, status]);

  // ── Session lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    void setActiveSession(true);
    return () => { void setActiveSession(false); };
  }, [setActiveSession]);

  useEffect(() => {
    continuePressedRef.current = false;
    completionTriggeredRef.current = false;
    setArriveCueIndex(0);
    setGuidanceIdx(0);

    renderedSecondsRef.current = Math.ceil(totalMs / 1000);
    remainingMsRef.current = totalMs;
    endAtMsRef.current = Date.now() + totalMs;
    setStatus(shouldUseArrivePhase ? 'arrive' : 'running');
    setSecondsRemaining(renderedSecondsRef.current);

    progress.value = 0;
    pausedDim.value = 1;
    flare.value = 0;
    glowBoost.value = 0.05;
    breathAnim.value = 0;
    sealProgress.value = 0;
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;

    if (!shouldUseArrivePhase) {
      startRunningPhase(totalMs);
    }

    return () => {
      clearTickInterval();
      clearArriveTimers();
      cancelAnimation(progress);
      cancelAnimation(breathScale);
      cancelAnimation(breathAnim);
      cancelAnimation(flare);
      cancelAnimation(glowBoost);
      cancelAnimation(pausedDim);
      cancelAnimation(sealProgress);
      cancelAnimation(haloScale);
      bgSoundRef.current?.stop();
      bgSoundRef.current = null;
    };
  }, [clearArriveTimers, shouldUseArrivePhase, startRunningPhase, totalMs]);

  // ── Breath aura animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running' || reduceMotionEnabled) {
      cancelAnimation(breathAnim);
      breathAnim.value = withTiming(0.35, { duration: 400 });
      return;
    }
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATH_INHALE * 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: BREATH_HOLD_S * 1000 }),
        withTiming(0, { duration: BREATH_EXHALE * 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
    return () => { cancelAnimation(breathAnim); };
  }, [status, reduceMotionEnabled, breathAnim]);

  // ── Sigil float animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotionEnabled || status !== 'running') {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1, { duration: 200 });
      return;
    }
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    return () => { cancelAnimation(breathScale); };
  }, [breathScale, reduceMotionEnabled, status]);

  // ── Halo pulse animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'arrive' || reduceMotionEnabled) {
      cancelAnimation(haloScale);
      haloScale.value = withTiming(1, { duration: 400 });
      return;
    }
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    return () => { cancelAnimation(haloScale); };
  }, [haloScale, reduceMotionEnabled, status]);

  const handleBegin = useCallback(() => {
    clearArriveTimers();
    startRunningPhase(totalMs);
  }, [clearArriveTimers, startRunningPhase, totalMs]);

  // ── Guidance rotation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setGuidanceIdx((i) => (i + 1) % GUIDANCE.length), 12000);
    return () => clearInterval(id);
  }, [status]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const anchorBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
  }));

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const bloomStyle = useAnimatedStyle(() => {
    const base = interpolate(progress.value, [0, 1], [0.1, 0.22]);
    return {
      opacity: (base + glowBoost.value + flare.value * 0.3) * pausedDim.value,
    };
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  if (status === 'arrive') {
    return (
      <RitualScaffold>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <CloseButton onPress={onDismiss} testID="focus-session-dismiss" />
          </View>
          <View style={[styles.center, { justifyContent: 'center' }]}>
            <Animated.View style={[styles.haloRing, haloAnimatedStyle]}>
              <View style={styles.haloInner}>
                <AnchorHero anchorImageUri={anchorImageUri} size={ANCHOR_SIZE * 0.85} />
              </View>
            </Animated.View>
            <View style={styles.landingTextWrap}>
              <Text style={styles.landingTitle}>PREPARE</Text>
              <Text style={styles.landingSub}>
                Settle your mind.{'\n'}When you're centered, begin.
              </Text>
            </View>
            {!reduceIntentionVisibility && intentionText ? (
              <View style={styles.landingIntentionWrap}>
                <Text style={styles.landingIntentionLabel}>INTENTION</Text>
                <Text style={styles.landingIntentionText}>"{intentionText}"</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bottom}>
            <Pressable onPress={handleBegin} style={styles.beginBtn}>
              <LinearGradient
                colors={[colors.gold, '#8a6f23']}
                style={styles.beginBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.beginBtnText}>Begin Session  →</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </RitualScaffold>
    );
  }

  const showProgressBar = !isSeal;

  return (
    <RitualScaffold>
      <View style={styles.container}>

        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <CloseButton onPress={onDismiss} testID="focus-session-dismiss" />
          <Text style={[styles.sessionLabel, isSeal && styles.sessionLabelSeal]}>
            {isSeal ? 'SEAL YOUR ANCHOR' : 'FOCUS'}
          </Text>
          {!isSeal ? (
            <Text style={styles.timerTop} testID="focus-session-timer">{timerDisplay}</Text>
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        {/* ── LINEAR PROGRESS BAR ── */}
        {showProgressBar && (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
          </View>
        )}

        {/* ── CENTER STAGE ── */}
        <View style={styles.center}>
          <Pressable
            style={[styles.sigilStage, { width: ANCHOR_SIZE, height: ANCHOR_SIZE }]}
            onPressIn={isSeal ? handleSealPressIn : undefined}
            onPressOut={isSeal ? handleSealPressOut : undefined}
            onPress={isSeal ? handleSealTap : undefined}
            disabled={!isSeal}
            testID={isSeal ? 'focus-session-continue' : undefined}
            accessibilityRole={isSeal ? 'button' : undefined}
            accessibilityLabel={isSeal ? 'Seal your anchor — press and hold' : undefined}
          >
            {/* Bloom glow (behind aura) */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bloom,
                {
                  width: ANCHOR_SIZE * 1.7,
                  height: ANCHOR_SIZE * 1.7,
                  borderRadius: (ANCHOR_SIZE * 1.7) / 2,
                  top: -(ANCHOR_SIZE * 0.35),
                  left: -(ANCHOR_SIZE * 0.35),
                },
                bloomStyle,
              ]}
            />

            {/* Breath aura rings */}
            <BreathAura breathAnim={breathAnim} anchorSize={ANCHOR_SIZE} />

            {/* Session or seal ring */}
            {isSeal
              ? <SealRing radius={RING_RADIUS} sealProgress={sealProgress} />
              : <ProgressRing radius={RING_RADIUS} progress={progress} pausedDim={pausedDim} flare={flare} />
            }

            {/* Orbital Rings */}
            {!isSeal && status === 'running' && (
              <OrbitRings radius={RING_RADIUS} pausedDim={pausedDim} reduceMotion={reduceMotionEnabled} />
            )}

            {/* Sigil */}
            <Animated.View style={anchorBreathStyle}>
              <AnchorHero anchorImageUri={anchorImageUri} size={ANCHOR_SIZE} />
            </Animated.View>
          </Pressable>

          {/* ── BELOW-SIGIL CUE ── */}
          {isSeal ? (
            <Text style={styles.sealHint}>Press and hold to seal</Text>
          ) : (
            <Text style={[styles.breathCue, status === 'paused' && styles.breathCuePaused]}>
              {breathCueText}
            </Text>
          )}
        </View>

        {/* ── BOTTOM ── */}
        <View style={styles.bottom}>
          {isSeal ? (
            <Text style={styles.sealSub}>When ready, press and hold the symbol above.</Text>
          ) : (
            <>
              {!reduceIntentionVisibility && intentionText ? (
                <View style={styles.focusIntentionWrap}>
                  <View style={styles.intentionLabelChip}>
                    <Text style={styles.intentionLabelText}>INTENTION</Text>
                  </View>
                  <Text style={styles.focusIntentionText}>{intentionText}</Text>
                </View>
              ) : null}

              <Text style={styles.guidanceText} key={guidanceIdx}>
                {GUIDANCE[guidanceIdx]}
              </Text>

              {groundNoteVisible && groundNoteText ? (
                <RNAnimated.View style={[styles.groundNoteWrap, { opacity: groundNoteOpacity }]}>
                  <Text style={styles.groundNoteText}>{groundNoteText}</Text>
                  {groundNoteSecondary ? (
                    <Text style={styles.groundNoteSecondary}>{groundNoteSecondary}</Text>
                  ) : null}
                </RNAnimated.View>
              ) : null}

              {status === 'running' && (
                <Pressable onPress={handlePause} style={styles.pauseBtn}
                  testID="focus-session-pause" accessibilityRole="button" accessibilityLabel="Pause">
                  <Pause color="#FFFFFF" size={14} strokeWidth={2.5} />
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </Pressable>
              )}
              {status === 'paused' && (
                <Pressable onPress={handleResume} style={styles.pauseBtn}
                  testID="focus-session-resume" accessibilityRole="button" accessibilityLabel="Resume">
                  <Play color="#FFFFFF" size={14} strokeWidth={2.5} />
                  <Text style={styles.pauseBtnText}>Resume</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

      </View>
    </RitualScaffold>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD_LINE = `${colors.gold}48`;
const BONE_SOFT = 'rgba(245,240,232,0.62)';
const BONE_FAINT = 'rgba(245,240,232,0.34)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // ── Top bar ──
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    backgroundColor: 'rgba(245,240,232,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnIcon: {
    color: BONE_SOFT,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: typography.fontFamily.sans,
  },
  sessionLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 13,
    letterSpacing: 3,
    color: BONE_SOFT,
    textAlign: 'center',
    flex: 1,
  },
  sessionLabelSeal: {
    color: colors.gold,
  },
  timerTop: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: BONE_FAINT,
    letterSpacing: 0.5,
    minWidth: 32,
    textAlign: 'right',
  },
  topBarSpacer: {
    width: 32,
  },

  // ── Progress bar ──
  progressTrack: {
    height: 2,
    marginHorizontal: 0,
    marginBottom: 2,
    backgroundColor: 'rgba(245,240,232,0.07)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 1,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Center stage ──
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  sigilStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bloom: {
    position: 'absolute',
    backgroundColor: `${colors.gold}22`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 16,
  },

  // ── Anchor sigil ──
  anchorHero: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.gold}2A`,
    backgroundColor: colors.background.secondary,
  },
  anchorFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorFallbackText: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serif,
  },

  // ── Cues ──
  breathCue: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 16,
    color: BONE_SOFT,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  breathCuePaused: {
    opacity: 0.35,
  },
  sealHint: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // ── Bottom ──
  bottom: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  guidanceText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 22,
    color: colors.gold,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(212,175,55,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // ── Landing Screen ──
  haloRing: {
    padding: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(212,175,55,0.03)',
  },
  haloInner: {
    padding: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(12,16,24,0.6)',
  },
  landingTextWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  landingTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 20,
    letterSpacing: 6,
    color: colors.gold,
  },
  landingSub: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 18,
    color: BONE_SOFT,
    textAlign: 'center',
    lineHeight: 26,
  },
  beginBtn: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 100,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  beginBtnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginBtnText: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1.5,
    color: '#080C10',
    textTransform: 'uppercase',
  },
  pauseBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    backgroundColor: 'rgba(212,175,55,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pauseBtnText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: BONE_SOFT,
    letterSpacing: 0.5,
  },
  sealSub: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    color: BONE_SOFT,
    textAlign: 'center',
    lineHeight: 22,
  },
  groundNoteWrap: {
    alignItems: 'center',
  },
  groundNoteText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.sans,
    color: BONE_SOFT,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  groundNoteSecondary: {
    fontSize: 12,
    fontFamily: typography.fontFamily.sans,
    color: BONE_FAINT,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  landingIntentionWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  landingIntentionLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 2,
    marginBottom: 4,
    opacity: 0.8,
  },
  landingIntentionText: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 18,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.9,
  },
  focusIntentionWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    fontFamily: typography.fontFamily.serif,
    color: colors.gold,
    letterSpacing: 2.5,
  },
  focusIntentionText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bodySerifItalic,
    color: colors.bone,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 22,
  },
});
