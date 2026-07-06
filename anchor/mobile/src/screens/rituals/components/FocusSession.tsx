// Anchor – Focus Session
// Redesigned per Practice Session.html:
// breath aura rings · top-bar layout · linear progress bar · seal press-and-hold

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ReduceMotion,
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
import { type ManagedAudioPlayer, useAudio } from '@/hooks/useAudio';
import { safeHaptics } from '@/utils/haptics';
import { RitualScaffold } from './RitualScaffold';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEAL_HOLD_MS = 2500;
const BREATH_INHALE = 4;   // seconds
const BREATH_HOLD_S = 1;   // seconds
const BREATH_EXHALE = 5;   // seconds
const BREATH_TOTAL = BREATH_INHALE + BREATH_HOLD_S + BREATH_EXHALE; // 10s
const RING_STROKE = 5;
const ARRIVE_BEGIN_FADE_MS = 260;
const ARRIVE_BEGIN_DELAY_MS = 360;
const FOCUS_AMBIENT_KEY = 'focus-session-ambient' as const;
const FOCUS_AMBIENT_BASE_VOLUME = 0.14;
const FOCUS_AMBIENT_DUCKED_VOLUME = 0.09;
const FOCUS_AMBIENT_FADE_IN_MS = 900;
const FOCUS_AMBIENT_FADE_OUT_MS = 650;
const FOCUS_AMBIENT_DUCK_MS = 180;
const FOCUS_AMBIENT_UNDUCK_MS = 260;
const FOCUS_AMBIENT_FADE_STEP_MS = 50;

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
type GuidanceCueKey =
  | 'focus-session-10s'
  | 'focus-session-120s-closing'
  | 'focus-session-120s-deepening'
  | 'focus-session-120s-grounding'
  | 'focus-session-120s-opening'
  | 'focus-session-30s-start'
  | 'focus-session-30s-end'
  | 'focus-session-60s-start'
  | 'focus-session-60s-middle'
  | 'focus-session-60s-end';
type GuidanceCueName = 'start' | 'middle' | 'grounding' | 'deepening' | 'end';
type FocusGuidanceProfile = {
  cues: Array<{
    key: GuidanceCueKey;
    name: GuidanceCueName;
    triggerAtRemainingMs: number;
  }>;
};

export type FocusSessionProps = {
  intentionText: string;
  anchorImageUri: string;
  durationSeconds?: number;
  audioModeOverride?: 'silent' | 'ambient';
  onComplete: () => void;
  onSessionCompleted?: () => void;
  onDismiss: () => void;
  registerExitAudioHandler?: (handler: (() => Promise<void>) | null) => void;
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
    rot1.value = withRepeat(withTiming(360, { duration: 45000, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false, undefined, ReduceMotion.Never);
    rot2.value = withRepeat(withTiming(-360, { duration: 60000, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false, undefined, ReduceMotion.Never);
    return () => { cancelAnimation(rot1); cancelAnimation(rot2); };
  }, [rot1, rot2]);

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

// ─── Main Component ───────────────────────────────────────────────────────────

export const FocusSession: React.FC<FocusSessionProps> = ({
  intentionText,
  anchorImageUri,
  durationSeconds,
  audioModeOverride,
  onComplete,
  onSessionCompleted,
  onDismiss,
  registerExitAudioHandler,
  groundNoteText,
  groundNoteSecondary,
}) => {
  const { width, height } = useWindowDimensions();
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const isShortLayout = isShortPhoneViewport(height);
  const ANCHOR_SIZE = Math.min(
    Math.round(width * (isCompactLayout ? 0.56 : 0.68)),
    isCompactLayout ? 220 : 280
  );
  const RING_RADIUS = ANCHOR_SIZE / 2 + 22;

  const defaultDurationSeconds = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const storedFocusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'ambient');
  const focusSessionAudio = audioModeOverride ?? storedFocusSessionAudio;
  const arrivePhaseEnabled = useSettingsStore((state) => state.arrivePhaseEnabled ?? true);
  const reduceIntentionVisibility = useSettingsStore((state) => state.reduceIntentionVisibility ?? false);
  const resolvedDurationSeconds = durationSeconds ?? defaultDurationSeconds;
  const reduceMotionEnabled = useReduceMotionEnabled();
  const shouldUseArrivePhase =
    arrivePhaseEnabled && resolvedDurationSeconds > 0;
  const totalMs = Math.max(1000, Math.round(resolvedDurationSeconds * 1000));
  const focusGuidanceProfile = useMemo<FocusGuidanceProfile | null>(() => {
    if (focusSessionAudio !== 'ambient') {
      return null;
    }

    if (resolvedDurationSeconds === 10) {
      return {
        cues: [
          { key: 'focus-session-10s', name: 'start', triggerAtRemainingMs: totalMs },
        ],
      };
    }

    if (resolvedDurationSeconds === 30) {
      return {
        cues: [
          { key: 'focus-session-30s-start', name: 'start', triggerAtRemainingMs: totalMs },
          { key: 'focus-session-30s-end', name: 'end', triggerAtRemainingMs: 6300 },
        ],
      };
    }

    if (resolvedDurationSeconds === 60) {
      return {
        cues: [
          { key: 'focus-session-60s-start', name: 'start', triggerAtRemainingMs: totalMs },
          { key: 'focus-session-60s-middle', name: 'middle', triggerAtRemainingMs: 32415 },
          { key: 'focus-session-60s-end', name: 'end', triggerAtRemainingMs: 5980 },
        ],
      };
    }

    if (resolvedDurationSeconds === 90) {
      return {
        cues: [
          { key: 'focus-session-60s-start', name: 'start', triggerAtRemainingMs: totalMs },
          { key: 'focus-session-60s-middle', name: 'middle', triggerAtRemainingMs: 45000 },
          { key: 'focus-session-60s-end', name: 'end', triggerAtRemainingMs: 5000 },
        ],
      };
    }

    if (resolvedDurationSeconds === 120) {
      return {
        cues: [
          { key: 'focus-session-120s-opening', name: 'start', triggerAtRemainingMs: totalMs },
          { key: 'focus-session-120s-grounding', name: 'grounding', triggerAtRemainingMs: 80000 },
          { key: 'focus-session-120s-deepening', name: 'deepening', triggerAtRemainingMs: 40000 },
          { key: 'focus-session-120s-closing', name: 'end', triggerAtRemainingMs: 5000 },
        ],
      };
    }

    return null;
  }, [focusSessionAudio, resolvedDurationSeconds, totalMs]);
  const { createManagedPlayer, playSound } = useAudio();
  const { setActiveSession } = useNotificationController();

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<SessionStatus>(
    shouldUseArrivePhase ? 'arrive' : 'running'
  );
  const [arriveCueIndex, setArriveCueIndex] = useState(0);
  const [isBeginningSession, setIsBeginningSession] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(totalMs / 1000));
  const [guidanceIdx, setGuidanceIdx] = useState(0);
  const [groundNoteVisible, setGroundNoteVisible] = useState(!!groundNoteText);
  const arrivePhaseOpacity = useRef(new RNAnimated.Value(1)).current;
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
  const ambientAudioRef = useRef<ManagedAudioPlayer | null>(null);
  const ambientFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientVolumeRef = useRef(0);
  const guidanceAudioRef = useRef<ManagedAudioPlayer | null>(null);
  const guidanceCueRef = useRef<GuidanceCueName | null>(null);
  const guidanceCuePlayedRef = useRef<Record<GuidanceCueName, boolean>>({
    start: false,
    middle: false,
    grounding: false,
    deepening: false,
    end: false,
  });
  const voiceCueActiveRef = useRef(false);

  // ── Shared values ──────────────────────────────────────────────────────────
  const progress = useSharedValue(0);
  const breathScale = useSharedValue(1);
  const breathAnim = useSharedValue(0);    // 0=exhale, 1=inhale peak
  const glowBoost = useSharedValue(0);
  const pausedDim = useSharedValue(1);
  const flare = useSharedValue(0);
  const sealProgress = useSharedValue(0);
  const haloScale = useSharedValue(1);

  const isSeal = status === 'completed';

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
    progress.value = withTiming(1, { duration: remainingMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [progress]);

  const clearAmbientFade = useCallback(() => {
    if (ambientFadeIntervalRef.current) {
      clearInterval(ambientFadeIntervalRef.current);
      ambientFadeIntervalRef.current = null;
    }
  }, []);

  const setAmbientVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    ambientVolumeRef.current = clamped;
    ambientAudioRef.current?.setVolume(clamped);
  }, []);

  const fadeAmbientTo = useCallback((
    targetVolume: number,
    durationMs: number,
    onComplete?: () => void
  ) => {
    if (!ambientAudioRef.current) {
      onComplete?.();
      return;
    }

    clearAmbientFade();
    const fromVolume = ambientVolumeRef.current;
    const toVolume = Math.max(0, Math.min(1, targetVolume));

    if (durationMs <= 0 || Math.abs(fromVolume - toVolume) < 0.001) {
      setAmbientVolume(toVolume);
      onComplete?.();
      return;
    }

    const stepCount = Math.max(1, Math.round(durationMs / FOCUS_AMBIENT_FADE_STEP_MS));
    let step = 0;
    ambientFadeIntervalRef.current = setInterval(() => {
      step += 1;
      const progressRatio = step / stepCount;
      setAmbientVolume(fromVolume + (toVolume - fromVolume) * progressRatio);
      if (step >= stepCount) {
        clearAmbientFade();
        onComplete?.();
      }
    }, FOCUS_AMBIENT_FADE_STEP_MS);
  }, [clearAmbientFade, setAmbientVolume]);

  const restoreAmbientBed = useCallback(() => {
    if (!ambientAudioRef.current) {
      return;
    }
    fadeAmbientTo(FOCUS_AMBIENT_BASE_VOLUME, FOCUS_AMBIENT_UNDUCK_MS);
  }, [fadeAmbientTo]);

  const duckAmbientBed = useCallback(() => {
    if (!ambientAudioRef.current) {
      return;
    }
    fadeAmbientTo(FOCUS_AMBIENT_DUCKED_VOLUME, FOCUS_AMBIENT_DUCK_MS);
  }, [fadeAmbientTo]);

  const startAmbientBed = useCallback(() => {
    if (focusSessionAudio !== 'ambient') {
      return;
    }

    if (!ambientAudioRef.current) {
      ambientAudioRef.current = createManagedPlayer(FOCUS_AMBIENT_KEY, {
        loop: true,
        volume: 0,
      });
      ambientVolumeRef.current = 0;
    }

    ambientAudioRef.current?.play();
    fadeAmbientTo(
      voiceCueActiveRef.current ? FOCUS_AMBIENT_DUCKED_VOLUME : FOCUS_AMBIENT_BASE_VOLUME,
      FOCUS_AMBIENT_FADE_IN_MS
    );
  }, [createManagedPlayer, fadeAmbientTo, focusSessionAudio]);

  const pauseAmbientBed = useCallback(() => {
    clearAmbientFade();
    ambientAudioRef.current?.pause();
  }, [clearAmbientFade]);

  const stopAmbientBed = useCallback((fadeOut: boolean) => {
    if (!ambientAudioRef.current) {
      return;
    }

    const player = ambientAudioRef.current;
    const finishStop = () => {
      if (ambientAudioRef.current === player) {
        player.stop();
        ambientAudioRef.current = null;
        ambientVolumeRef.current = 0;
      }
    };

    if (!fadeOut) {
      clearAmbientFade();
      finishStop();
      return;
    }

    fadeAmbientTo(0, FOCUS_AMBIENT_FADE_OUT_MS, finishStop);
  }, [clearAmbientFade, fadeAmbientTo]);

  const stopGuidanceAudio = useCallback(() => {
    guidanceAudioRef.current?.stop();
    guidanceAudioRef.current = null;
    guidanceCueRef.current = null;
    voiceCueActiveRef.current = false;
  }, []);

  const fadeOutSessionAudio = useCallback(() => {
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
    stopGuidanceAudio();

    return new Promise<void>((resolve) => {
      if (!ambientAudioRef.current) {
        resolve();
        return;
      }

      const player = ambientAudioRef.current;
      fadeAmbientTo(0, FOCUS_AMBIENT_FADE_OUT_MS, () => {
        if (ambientAudioRef.current === player) {
          player.stop();
          ambientAudioRef.current = null;
          ambientVolumeRef.current = 0;
        }
        resolve();
      });
    });
  }, [fadeAmbientTo, stopGuidanceAudio]);

  const resetGuidanceAudio = useCallback(() => {
    stopGuidanceAudio();
    guidanceCuePlayedRef.current = {
      start: false,
      middle: false,
      grounding: false,
      deepening: false,
      end: false,
    };
  }, [stopGuidanceAudio]);

  const playGuidanceCue = useCallback((cue: GuidanceCueName) => {
    if (!focusGuidanceProfile || guidanceCuePlayedRef.current[cue]) {
      return;
    }

    const cueConfig = focusGuidanceProfile.cues.find((entry) => entry.name === cue);
    if (!cueConfig) {
      return;
    }

    stopGuidanceAudio();
    guidanceCueRef.current = cue;
    guidanceCuePlayedRef.current[cue] = true;
    voiceCueActiveRef.current = true;
    duckAmbientBed();
    guidanceAudioRef.current = createManagedPlayer(cueConfig.key, {
      onFinish: () => {
        guidanceAudioRef.current = null;
        guidanceCueRef.current = null;
        voiceCueActiveRef.current = false;
        restoreAmbientBed();
      },
    });
    guidanceAudioRef.current?.play();
  }, [createManagedPlayer, duckAmbientBed, focusGuidanceProfile, restoreAmbientBed, stopGuidanceAudio]);

  const pauseGuidanceAudio = useCallback(() => {
    guidanceAudioRef.current?.pause();
  }, []);

  const maybePlayScheduledGuidanceCue = useCallback((remainingMs: number) => {
    if (!focusGuidanceProfile) {
      return;
    }

    const nextCue = focusGuidanceProfile.cues.find(
      (cue) => !guidanceCuePlayedRef.current[cue.name] && remainingMs <= cue.triggerAtRemainingMs
    );

    if (nextCue) {
      playGuidanceCue(nextCue.name);
    }
  }, [focusGuidanceProfile, playGuidanceCue]);

  // ── Completion ─────────────────────────────────────────────────────────────
  const completeSession = useCallback(() => {
    if (completionTriggeredRef.current) return;
    completionTriggeredRef.current = true;
    clearTickInterval();
    clearArriveTimers();
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
    stopAmbientBed(true);
    stopGuidanceAudio();

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
    if (focusSessionAudio === 'ambient' && !focusGuidanceProfile) {
      void playSound('prime-complete');
    }
    onSessionCompleted?.();
  }, [
    animateProgressToEnd, clearArriveTimers, clearTickInterval,
    flare, focusSessionAudio, focusGuidanceProfile, glowBoost, onSessionCompleted,
    pausedDim, playSound, reduceMotionEnabled, stopAmbientBed, stopGuidanceAudio,
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
    if (remainingMs > 0) {
      maybePlayScheduledGuidanceCue(remainingMs);
    }
    if (remainingMs <= 0) completeSession();
  }, [completeSession, maybePlayScheduledGuidanceCue]);

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
    bgSoundRef.current = null;
    startAmbientBed();
    resetGuidanceAudio();
    if (focusGuidanceProfile) {
      maybePlayScheduledGuidanceCue(runningMs);
    } else if (focusSessionAudio === 'ambient') {
      bgSoundRef.current = playSound('prime-begin', 1, true);
    }
    animateProgressToEnd(runningMs);
    startTickInterval();
  }, [
    animateProgressToEnd,
    clearArriveTimers,
    focusGuidanceProfile,
    focusSessionAudio,
    maybePlayScheduledGuidanceCue,
    playSound,
    resetGuidanceAudio,
    startAmbientBed,
    startTickInterval,
  ]);

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
    pauseAmbientBed();
    if (focusGuidanceProfile) {
      pauseGuidanceAudio();
    }
  }, [clearTickInterval, focusGuidanceProfile, pauseAmbientBed, pauseGuidanceAudio, pausedDim, progress, status]);

  const handleResume = useCallback(() => {
    if (status !== 'paused') return;
    if (remainingMsRef.current <= 0) { completeSession(); return; }
    endAtMsRef.current = Date.now() + remainingMsRef.current;
    pausedDim.value = withTiming(1, { duration: 200 });
    setStatus('running');
    startAmbientBed();
    if (focusGuidanceProfile) {
      if (guidanceAudioRef.current) {
        guidanceAudioRef.current.play();
      } else {
        maybePlayScheduledGuidanceCue(remainingMsRef.current);
      }
    } else {
      bgSoundRef.current =
        focusSessionAudio === 'ambient' ? playSound('prime-begin', 1, true) : null;
    }
    animateProgressToEnd(remainingMsRef.current);
    startTickInterval();
  }, [
    animateProgressToEnd,
    completeSession,
    focusGuidanceProfile,
    focusSessionAudio,
    maybePlayScheduledGuidanceCue,
    pausedDim,
    playSound,
    startAmbientBed,
    startTickInterval,
    status,
  ]);

  // ── Seal mechanic ──────────────────────────────────────────────────────────
  const triggerComplete = useCallback(() => {
    if (continuePressedRef.current) return;
    continuePressedRef.current = true;
    // Delay so user sees the fully-sealed ring before the modal overlays
    setTimeout(onComplete, 400);
  }, [onComplete]);

  const handleSealPressIn = useCallback(() => {
    if (!isSeal) return;
    sealProgress.value = withTiming(1, { duration: SEAL_HOLD_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      (finished) => { if (finished) runOnJS(triggerComplete)(); }
    );
  }, [isSeal, sealProgress, triggerComplete]);

  const handleSealPressOut = useCallback(() => {
    // If completion is already in progress, don't reset the ring
    if (continuePressedRef.current) return;
    cancelAnimation(sealProgress);
    sealProgress.value = withTiming(0, { duration: 200, reduceMotion: ReduceMotion.Never });
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
    if (!registerExitAudioHandler) {
      return;
    }

    registerExitAudioHandler(fadeOutSessionAudio);
    return () => {
      registerExitAudioHandler(null);
    };
  }, [fadeOutSessionAudio, registerExitAudioHandler]);

  useEffect(() => {
    continuePressedRef.current = false;
    completionTriggeredRef.current = false;
    setIsBeginningSession(false);
    setArriveCueIndex(0);
    setGuidanceIdx(0);

    renderedSecondsRef.current = Math.ceil(totalMs / 1000);
    remainingMsRef.current = totalMs;
    endAtMsRef.current = Date.now() + totalMs;
    setStatus(shouldUseArrivePhase ? 'arrive' : 'running');
    setSecondsRemaining(renderedSecondsRef.current);
    arrivePhaseOpacity.setValue(1);

    progress.value = 0;
    pausedDim.value = 1;
    flare.value = 0;
    glowBoost.value = 0.05;
    breathAnim.value = 0;
    sealProgress.value = 0;
    bgSoundRef.current?.stop();
    bgSoundRef.current = null;
    stopAmbientBed(false);
    resetGuidanceAudio();

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
      stopAmbientBed(false);
      stopGuidanceAudio();
    };
  }, [clearArriveTimers, resetGuidanceAudio, shouldUseArrivePhase, startRunningPhase, stopAmbientBed, stopGuidanceAudio, totalMs]);

  // ── Breath aura animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') {
      cancelAnimation(breathAnim);
      breathAnim.value = withTiming(0.35, { duration: 400 });
      return;
    }
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATH_INHALE * 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: BREATH_HOLD_S * 1000, reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: BREATH_EXHALE * 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never
    );
    return () => { cancelAnimation(breathAnim); };
  }, [status, breathAnim]);

  // ── Sigil float animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1, { duration: 200 });
      return;
    }
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: BREATH_INHALE * 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
        withTiming(1.035, { duration: BREATH_HOLD_S * 1000, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: BREATH_EXHALE * 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never
    );
    return () => { cancelAnimation(breathScale); };
  }, [breathScale, status]);

  // ── Halo pulse animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'arrive' || reduceMotionEnabled) {
      cancelAnimation(haloScale);
      haloScale.value = withTiming(1, { duration: 400 });
      return;
    }
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never })
      ),
      -1,
      true,
      undefined,
      ReduceMotion.Never
    );
    return () => { cancelAnimation(haloScale); };
  }, [haloScale, reduceMotionEnabled, status]);

  const handleBegin = useCallback(() => {
    if (isBeginningSession) {
      return;
    }
    clearArriveTimers();
    setIsBeginningSession(true);
    RNAnimated.timing(arrivePhaseOpacity, {
      toValue: 0,
      duration: ARRIVE_BEGIN_FADE_MS,
      useNativeDriver: true,
    }).start();
    arriveTimeoutRef.current = setTimeout(() => {
      arrivePhaseOpacity.setValue(1);
      setIsBeginningSession(false);
      startRunningPhase(totalMs);
    }, ARRIVE_BEGIN_DELAY_MS);
  }, [arrivePhaseOpacity, clearArriveTimers, isBeginningSession, startRunningPhase, totalMs]);

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
        <RNAnimated.View style={[styles.container, isCompactLayout && styles.containerCompact, { opacity: arrivePhaseOpacity }]}>
          <View style={styles.topBar}>
            <CloseButton onPress={onDismiss} testID="focus-session-dismiss" />
          </View>
          <View style={[styles.center, isCompactLayout && styles.centerCompact, { justifyContent: 'center' }]}>
            <Animated.View style={[styles.haloRing, isCompactLayout && styles.haloRingCompact, haloAnimatedStyle]}>
              <View style={[styles.haloInner, isCompactLayout && styles.haloInnerCompact]}>
                <AnchorHero anchorImageUri={anchorImageUri} size={ANCHOR_SIZE * 0.85} />
              </View>
            </Animated.View>
            <View style={[styles.landingTextWrap, isCompactLayout && styles.landingTextWrapCompact]}>
              <Text style={[styles.landingTitle, isCompactLayout && styles.landingTitleCompact]}>PREPARE</Text>
              <Text style={[styles.landingSub, isCompactLayout && styles.landingSubCompact]}>
                Settle your mind.{'\n'}When you're centered, begin.
              </Text>
            </View>
            {!reduceIntentionVisibility && intentionText ? (
              <View style={[styles.landingIntentionWrap, isCompactLayout && styles.landingIntentionWrapCompact]}>
                <Text style={styles.landingIntentionLabel}>INTENTION</Text>
                <Text style={[styles.landingIntentionText, isCompactLayout && styles.landingIntentionTextCompact]}>"{intentionText}"</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.bottom, isCompactLayout && styles.bottomCompact]}>
            <Pressable onPress={handleBegin} style={[styles.beginBtn, isCompactLayout && styles.beginBtnCompact]} disabled={isBeginningSession}>
              <LinearGradient
                colors={[colors.gold, '#8a6f23']}
                style={[
                  styles.beginBtnGradient,
                  isCompactLayout && styles.beginBtnGradientCompact,
                  isBeginningSession && styles.beginBtnGradientDisabled,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.beginBtnText, isCompactLayout && styles.beginBtnTextCompact]}>Begin Session  →</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </RNAnimated.View>
      </RitualScaffold>
    );
  }

  return (
    <RitualScaffold>
      <View style={[styles.container, isCompactLayout && styles.containerCompact]}>

        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <CloseButton onPress={onDismiss} testID="focus-session-dismiss" />
          <Text style={[styles.sessionLabel, isSeal && styles.sessionLabelSeal]}>
            {isSeal ? 'SEAL YOUR ANCHOR' : 'FOCUS'}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

        {/* ── CENTER STAGE ── */}
        <View style={[styles.center, isCompactLayout && styles.centerCompact]}>
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

          {isSeal ? (
            <Text style={[styles.sealHint, isCompactLayout && styles.sealHintCompact]}>Press and hold to seal</Text>
          ) : null}
        </View>

        {/* ── BOTTOM ── */}
        <View style={[styles.bottom, isCompactLayout && styles.bottomCompact]}>
          {isSeal ? (
            <Text style={[styles.sealSub, isCompactLayout && styles.sealSubCompact]}>When ready, press and hold the symbol above.</Text>
          ) : (
            <>
              {!reduceIntentionVisibility && intentionText ? (
                <View style={[styles.focusIntentionWrap, isCompactLayout && styles.focusIntentionWrapCompact]}>
                  <View style={styles.intentionLabelChip}>
                    <Text style={styles.intentionLabelText}>INTENTION</Text>
                  </View>
                  <Text style={[styles.focusIntentionText, isCompactLayout && styles.focusIntentionTextCompact]}>{intentionText}</Text>
                </View>
              ) : null}

              <Text style={[styles.guidanceText, isCompactLayout && styles.guidanceTextCompact]} key={guidanceIdx}>
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
                <Pressable onPress={handlePause} style={[styles.pauseBtn, isShortLayout && styles.pauseBtnCompact]}
                  testID="focus-session-pause" accessibilityRole="button" accessibilityLabel="Pause">
                  <Pause color="#FFFFFF" size={14} strokeWidth={2.5} />
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </Pressable>
              )}
              {status === 'paused' && (
                <Pressable onPress={handleResume} style={[styles.pauseBtn, isShortLayout && styles.pauseBtnCompact]}
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
  containerCompact: {
    paddingHorizontal: spacing.md + 2,
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
  topBarSpacer: {
    width: 32,
  },

  // ── Center stage ──
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  centerCompact: {
    gap: spacing.md,
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
  sealHint: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sealHintCompact: {
    fontSize: 11,
    letterSpacing: 2.4,
  },

  // ── Bottom ──
  bottom: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 120,
    justifyContent: 'flex-end',
    width: '100%',
  },
  bottomCompact: {
    paddingBottom: spacing.lg,
    gap: spacing.sm + 2,
    minHeight: 88,
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
  guidanceTextCompact: {
    fontSize: 18,
    lineHeight: 26,
  },

  // ── Landing Screen ──
  haloRing: {
    padding: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(212,175,55,0.03)',
  },
  haloRingCompact: {
    padding: 18,
  },
  haloInner: {
    padding: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(12,16,24,0.6)',
  },
  haloInnerCompact: {
    padding: 12,
  },
  landingTextWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  landingTextWrapCompact: {
    marginTop: spacing.lg,
    gap: spacing.xs + 2,
  },
  landingTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 20,
    letterSpacing: 6,
    color: colors.gold,
  },
  landingTitleCompact: {
    fontSize: 18,
    letterSpacing: 4.5,
  },
  landingSub: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 18,
    color: BONE_SOFT,
    textAlign: 'center',
    lineHeight: 26,
  },
  landingSubCompact: {
    fontSize: 16,
    lineHeight: 22,
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
  beginBtnCompact: {
    maxWidth: 248,
  },
  beginBtnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginBtnGradientCompact: {
    paddingVertical: 16,
  },
  beginBtnGradientDisabled: {
    opacity: 0.86,
  },
  beginBtnText: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1.5,
    color: '#080C10',
    textTransform: 'uppercase',
  },
  beginBtnTextCompact: {
    fontSize: 14,
    letterSpacing: 1.2,
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
  sealSubCompact: {
    fontSize: 14,
    lineHeight: 20,
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
  landingIntentionWrapCompact: {
    marginTop: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
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
  landingIntentionTextCompact: {
    fontSize: 16,
    lineHeight: 22,
  },
  focusIntentionWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  focusIntentionWrapCompact: {
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
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
    width: '100%',
  },
  focusIntentionTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  pauseBtnCompact: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 4,
  },
});
