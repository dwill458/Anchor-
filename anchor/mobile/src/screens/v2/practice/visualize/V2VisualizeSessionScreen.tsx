import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, BackHandler, Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Pause, Play, X } from 'lucide-react-native';
import { CircularAnchorRenderer, V2Button } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { trackSessionStartedWithAudio } from '@/services/SessionAudioAnalytics';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { getVisualizeSessionAudioManifest } from '@/services/visualizeAudioManifest';
import { useVisualizeSessionEngine } from '@/screens/visualize/useVisualizeSessionEngine';
import { useVisualizeSessionAudio } from '@/screens/visualize/useVisualizeSessionAudio';
import { useVisualizeImmersiveMode } from '@/screens/visualize/useVisualizeImmersiveMode';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import type { V2VisionTile } from '@/adapters/v2/vision';
import {
  buildVisionSceneSchedule, buildVisionSceneSnapshot, preloadVisionImages, V2_VISUALIZE_TIMING as T, visionImageFit,
  visionSceneSlotAt, visualizePromptAt, visualizeReflectionPrompts, type V2VisualizeDuration,
} from './visualizeVisionPlan';
import { ChartMoveHandoff } from '@/components/v2/chart/ChartMoveHandoff';

type Props = {
  anchor: Anchor;
  accountId: string | null;
  /** The person's selected Vision images, in their chosen order. Nothing else is shown. */
  tiles: V2VisionTile[];
  statement: string;
  visionId?: string | null;
  durationSeconds: V2VisualizeDuration;
  voice: GuidanceVoice;
  ambient: boolean;
  haptics: boolean;
  source: 'practice_hub' | 'recommended_today';
  /** Leaving before the end. Nothing is recorded. */
  onExit: () => void;
  /** After a genuinely completed session and its ending. */
  onContinue: () => void;
};

const KeepAwake = () => { useKeepAwake('v2-visualize-session'); return null; };

type ImageSize = { width: number; height: number };

function useVisionImageSizes(uris: string[]): Record<string, ImageSize> {
  const [sizes, setSizes] = useState<Record<string, ImageSize>>({});
  useEffect(() => {
    preloadVisionImages(uris);
    let alive = true;
    for (const uri of uris) {
      if (typeof Image.getSize !== 'function') break;
      try {
        Image.getSize(uri, (w, h) => {
          if (alive && w > 0 && h > 0) setSizes(prev => (prev[uri] ? prev : { ...prev, [uri]: { width: w, height: h } }));
        }, () => undefined);
      } catch { /* sizing is an enhancement; cover framing remains */ }
    }
    return () => { alive = false; };
  }, [uris]);
  return sizes;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type LayerRole = 'active' | 'outgoing' | 'idle';

/**
 * One Vision image. The incoming scene fades in above the outgoing one, which
 * holds until the crossfade completes, so the change never dips to black.
 * Slow Ken Burns (1.02 -> 1.06) runs for the length of its slot and freezes
 * while paused; it is skipped entirely under Reduce Motion.
 */
const SceneLayer = memo(function SceneLayer({
  uri, imageSize, role, activationKey, slotMs, paused, settling, reduceMotion, width, height,
}: {
  uri: string; imageSize?: { width: number; height: number }; role: LayerRole; activationKey: number; slotMs: number;
  paused: boolean; settling: boolean; reduceMotion: boolean; width: number; height: number;
}) {
  const fit = visionImageFit(imageSize, { width, height });
  // The opening scene is revealed by the stage expanding, so it starts opaque.
  const opacity = useSharedValue(0);
  const scale = useSharedValue<number>(T.kenBurnsFrom);
  const crossfade = reduceMotion ? T.reducedCrossfadeMs : T.crossfadeMs;
  const kenBurnsMs = slotMs + crossfade;

  useEffect(() => {
    if (role === 'active') {
      if (!reduceMotion) scale.value = T.kenBurnsFrom;
      opacity.value = activationKey === 0 ? 1 : withTiming(1, { duration: crossfade, easing: Easing.inOut(Easing.quad) });
    } else if (role === 'outgoing') {
      opacity.value = withDelay(crossfade, withTiming(0, { duration: 0 }));
    } else {
      opacity.value = 0;
    }
  }, [activationKey, crossfade, opacity, reduceMotion, role, scale]);

  useEffect(() => {
    if (reduceMotion) return;
    if (settling) {
      // The movement comes to rest rather than stopping dead.
      cancelAnimation(scale);
      scale.value = withTiming(Math.min(T.kenBurnsTo + 0.01, scale.value + 0.006), { duration: T.ending.settleMs, easing: Easing.out(Easing.cubic) });
      return;
    }
    if (role !== 'active') return;
    if (paused) { cancelAnimation(scale); return; }
    const remaining = Math.max(0, (T.kenBurnsTo - scale.value) / (T.kenBurnsTo - T.kenBurnsFrom)) * kenBurnsMs;
    scale.value = withTiming(T.kenBurnsTo, { duration: remaining, easing: Easing.linear });
  }, [activationKey, kenBurnsMs, paused, reduceMotion, role, scale, settling]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { zIndex: role === 'active' ? 2 : role === 'outgoing' ? 1 : 0 }, style]}>
      {fit.extended ? (
        // A wide image is not cut to a strip: the same photograph, softened
        // and dimmed, carries the frame beyond its edges.
        <>
          <Image source={{ uri }} blurRadius={28} resizeMode="cover" style={{ width, height }} />
          <View style={[StyleSheet.absoluteFill, styles.extensionShade]} />
        </>
      ) : null}
      <Image source={{ uri }} resizeMode="cover" accessibilityIgnoresInvertColors
        style={{ position: 'absolute', left: fit.left, top: fit.top, width: fit.width, height: fit.height }} />
    </Animated.View>
  );
});

export function V2VisualizeSessionScreen({
  anchor, accountId, tiles, statement, visionId, durationSeconds, voice, ambient, haptics, source, onExit, onContinue,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const images = useMemo(() => tiles.filter(tile => Boolean(tile.imageUrl)).map(tile => tile.imageUrl as string), [tiles]);
  // Every scene is decoded before its turn, and sized so it can be framed without brutal cropping.
  const imageSizes = useVisionImageSizes(images);
  const schedule = useMemo(() => buildVisionSceneSchedule(durationSeconds, images.length), [durationSeconds, images.length]);
  const prompts = useMemo(() => visualizeReflectionPrompts(durationSeconds), [durationSeconds]);
  const sceneSnapshot = useMemo(() => buildVisionSceneSnapshot(statement, anchor), [anchor, statement]);
  const backgroundAudio = ambient ? 'ambient' as const : 'off' as const;
  const sessionIdRef = useRef(`visualize:${accountId ?? 'guest'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`);
  const commitStartedRef = useRef(false);
  const exitingRef = useRef(false);
  const continuedRef = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [endingStarted, setEndingStarted] = useState(false);
  const [lineVisible, setLineVisible] = useState(false);
  const [continueReady, setContinueReady] = useState(false);
  const [settled, setSettled] = useState(false);

  const complete = useCallback(async ({ startedAt, completedAt }: { startedAt: string; completedAt: string }) => {
    // The engine reaches this once, and only when the full duration has run.
    if (commitStartedRef.current) return;
    commitStartedRef.current = true;
    let outcome: 'queued' | 'failed' | 'not_recorded' = 'not_recorded';
    if (accountId) {
      try {
        await PracticeCompletionService.commitVisualizeCompletion({
          id: sessionIdRef.current,
          accountId,
          anchor,
          durationSeconds,
          startedAt,
          completedAt,
          guidanceVoice: voice,
          backgroundAudio,
          sceneSnapshot,
          source: 'practice_screen',
          metadata: { v2_entry_source: source, ...(visionId ? { vision_id: visionId } : {}) },
        });
        outcome = 'queued';
      } catch {
        outcome = 'failed';
      }
    }
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
      practice_mode: 'visualize', session_id: sessionIdRef.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, sync_outcome: outcome, completed_at: completedAt, v2: true,
    });
  }, [accountId, anchor, backgroundAudio, durationSeconds, sceneSnapshot, source, visionId, voice]);

  const engine = useVisualizeSessionEngine({ durationSeconds, hapticsEnabled: haptics, onComplete: complete });
  const audioPlan = useMemo(() => resolveSessionAudioPlan({
    sessionType: 'visualize', durationSeconds,
    configuration: { guidanceVoice: voice, backgroundAudio, source: 'session_override' },
  }), [backgroundAudio, durationSeconds, voice]);
  const audioManifest = useMemo(() => getVisualizeSessionAudioManifest(durationSeconds), [durationSeconds]);
  const handleInterruption = useCallback(() => engine.pause('audio_interruption'), [engine.pause]);
  const sessionAudio = useVisualizeSessionAudio({
    plan: audioPlan, manifest: audioManifest, elapsedMs: engine.elapsedMs,
    isActive: engine.state === 'running', isCompleting: engine.state === 'completing',
    isComplete: engine.state === 'completed', onInterruption: handleInterruption,
  });
  const immersive = engine.state === 'running' || engine.state === 'paused' || engine.state === 'completing';
  useVisualizeImmersiveMode(immersive);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    engine.start();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: 'visualize', session_id: sessionIdRef.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, started_at: new Date().toISOString(), v2: true,
    });
    trackSessionStartedWithAudio(audioPlan);
    // One-shot per session instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Opening: setup has faded to darkness; the first image rises out of it.
  const intro = useSharedValue(0);
  const openingText = useSharedValue(0);
  useEffect(() => {
    intro.value = withTiming(1, { duration: reduceMotion ? 700 : T.openingRevealMs, easing: Easing.out(Easing.quad) });
    openingText.value = withDelay(T.openingDelayMs, withSequence(
      withTiming(1, { duration: T.textFadeMs }),
      withDelay(T.openingHoldMs, withTiming(0, { duration: T.textFadeMs })),
    ));
  }, [intro, openingText, reduceMotion]);
  // ── Ending: the Vision is drawn in toward its centre (see `T.ending`).
  const compress = useSharedValue(0);
  const introStyle = useAnimatedStyle(() => {
    const scale = reduceMotion ? 1 : (1.035 - intro.value * 0.035) * (1 - compress.value * (1 - T.ending.compressTo));
    return {
      opacity: intro.value,
      borderRadius: compress.value * width * 0.5,
      transform: [{ scale }],
    };
  });
  const openingStyle = useAnimatedStyle(() => ({ opacity: openingText.value }));

  // ── Sparse reflection prompts.
  const prompt = engine.state === 'running' || engine.state === 'paused' ? visualizePromptAt(prompts, engine.elapsedMs) : null;
  const promptOpacity = useSharedValue(0);
  const [promptText, setPromptText] = useState<string | null>(null);
  useEffect(() => {
    if (prompt) {
      setPromptText(prompt.text);
      promptOpacity.value = withTiming(1, { duration: T.textFadeMs });
    } else {
      promptOpacity.value = withTiming(0, { duration: T.textFadeMs });
    }
  }, [prompt?.id, promptOpacity]);
  const promptStyle = useAnimatedStyle(() => ({ opacity: promptOpacity.value }));

  // ── Chrome: peripheral, and gone when idle so only the Vision remains.
  const chrome = useSharedValue(1);
  useEffect(() => {
    if (endingStarted) return;
    chrome.value = withTiming(controlsVisible ? 1 : 0, { duration: reduceMotion ? 0 : 320 });
  }, [chrome, controlsVisible, endingStarted, reduceMotion]);
  useEffect(() => {
    if (engine.state !== 'running' || !controlsVisible) return;
    const timer = setTimeout(() => setControlsVisible(false), T.controlsIdleMs);
    return () => clearTimeout(timer);
  }, [controlsVisible, engine.state]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  // The timer stays faintly present while chrome is idle, and leaves with everything else at the end.
  const timerPresence = useSharedValue(1);
  const timerStyle = useAnimatedStyle(() => ({ opacity: timerPresence.value * (chrome.value * 0.55 + (1 - chrome.value) * 0.32) }));

  // ── Ending: Vision resolves into the Anchor.
  const photoGroup = useSharedValue(1);
  const blurred = useSharedValue(0);
  const quiet = useSharedValue(0);
  const vignette = useSharedValue(0);
  const anchorOpacity = useSharedValue(0);
  const anchorScale = useSharedValue<number>(reduceMotion ? 1 : T.ending.anchorFromScale);
  // A soft, slightly larger echo of the Anchor that dissolves as the Anchor sharpens.
  const anchorEcho = useSharedValue(0);
  const line = useSharedValue(0);
  const continueOpacity = useSharedValue(0);

  useEffect(() => {
    if (engine.state !== 'completing' || endingStarted) return;
    setEndingStarted(true);
    AccessibilityInfo.announceForAccessibility?.('Visualize complete.');
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduceMotion) {
      const R = T.reducedEnding;
      chrome.value = withTiming(0, { duration: R.chromeOutMs });
      timerPresence.value = withTiming(0, { duration: R.chromeOutMs });
      photoGroup.value = withDelay(R.crossAtMs, withTiming(0, { duration: R.crossMs }));
      anchorOpacity.value = withDelay(R.crossAtMs, withTiming(1, { duration: R.crossMs }));
      line.value = withDelay(R.lineAtMs, withTiming(1, { duration: R.fadeInMs }));
      continueOpacity.value = withDelay(R.continueAtMs, withTiming(1, { duration: R.fadeInMs }));
      timers.push(setTimeout(() => setLineVisible(true), R.lineAtMs));
      timers.push(setTimeout(() => setContinueReady(true), R.continueAtMs));
      timers.push(setTimeout(() => { if (haptics) void v2Haptics.completion(); }, R.crossAtMs + R.crossMs));
    } else {
      const E = T.ending;
      const [a, b, c] = E.anchorStepsMs;
      const inOut = Easing.bezier(0.45, 0, 0.2, 1);
      chrome.value = withTiming(0, { duration: E.chromeOutMs });
      timerPresence.value = withTiming(0, { duration: E.chromeOutMs });
      // Quiet: the detail softens, colour drains, light lowers.
      blurred.value = withDelay(E.transformAtMs, withTiming(1, { duration: E.quietMs, easing: inOut }));
      quiet.value = withDelay(E.transformAtMs, withTiming(1, { duration: E.quietMs, easing: inOut }));
      vignette.value = withDelay(E.transformAtMs, withTiming(1, { duration: E.quietMs }));
      // Compress: the whole Vision is drawn in toward the centre the Anchor emerges from.
      compress.value = withDelay(E.compressAtMs, withTiming(1, { duration: E.compressMs, easing: inOut }));
      photoGroup.value = withDelay(E.photoOutAtMs, withTiming(0, { duration: E.photoOutMs, easing: Easing.in(Easing.quad) }));
      // Sharpen: the Anchor arrives from soft and slightly large to present and exact.
      anchorOpacity.value = withDelay(E.anchorAtMs, withSequence(
        withTiming(0.25, { duration: a, easing: Easing.in(Easing.quad) }),
        withTiming(0.6, { duration: b }),
        withTiming(1, { duration: c, easing: Easing.out(Easing.cubic) }),
      ));
      anchorScale.value = withDelay(E.anchorAtMs, withTiming(1, { duration: a + b + c, easing: Easing.out(Easing.cubic) }));
      anchorEcho.value = withDelay(E.anchorAtMs, withSequence(
        withTiming(0.4, { duration: a, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: b + c, easing: Easing.in(Easing.quad) }),
      ));
      line.value = withDelay(E.lineAtMs, withTiming(1, { duration: E.fadeInMs }));
      continueOpacity.value = withDelay(E.continueAtMs, withTiming(1, { duration: E.fadeInMs }));
      timers.push(setTimeout(() => setLineVisible(true), E.lineAtMs));
      timers.push(setTimeout(() => setContinueReady(true), E.continueAtMs));
      timers.push(setTimeout(() => { if (haptics) void v2Haptics.completion(); }, E.anchorAtMs + a + b + c));
    }
    let cancelled = false;
    void Promise.allSettled([engine.completionPromise ?? Promise.resolve(), sessionAudio.finishCompletion()])
      .then(() => { if (!cancelled) setSettled(true); });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // Runs once, at the moment the timer reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state]);

  const photoGroupStyle = useAnimatedStyle(() => ({ opacity: photoGroup.value }));
  const blurredStyle = useAnimatedStyle(() => ({ opacity: blurred.value }));
  const desaturateStyle = useAnimatedStyle(() => ({ opacity: quiet.value * 0.7 }));
  const darkenStyle = useAnimatedStyle(() => ({ opacity: quiet.value * 0.5 }));
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: vignette.value }));
  const anchorStyle = useAnimatedStyle(() => ({ opacity: anchorOpacity.value, transform: [{ scale: anchorScale.value }] }));
  const anchorEchoStyle = useAnimatedStyle(() => ({
    opacity: anchorEcho.value,
    transform: [{ scale: anchorScale.value * 1.08 }],
  }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: timerPresence.value }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: line.value }));
  const continueStyle = useAnimatedStyle(() => ({ opacity: continueOpacity.value }));

  // ── Leaving early never records anything.
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const stopAudioRef = useRef(sessionAudio.fadeOutAndStop);
  stopAudioRef.current = sessionAudio.fadeOutAndStop;
  const requestExit = useCallback(() => {
    const current = engineRef.current;
    if (exitingRef.current || current.state === 'completing' || current.state === 'completed') return;
    const wasRunning = current.state === 'running';
    current.pause('exit_prompt');
    Alert.alert('End Visualize?', 'This session only counts when it reaches the end.', [
      { text: 'Keep going', style: 'cancel', onPress: () => { if (wasRunning) engineRef.current.resume(); } },
      { text: 'End session', style: 'destructive', onPress: () => {
        exitingRef.current = true;
        engineRef.current.endEarly();
        void stopAudioRef.current().finally(onExit);
      } },
    ], { cancelable: true, onDismiss: () => { if (wasRunning && !exitingRef.current) engineRef.current.resume(); } });
  }, [onExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (endingStarted) return true; // the ending finishes with Continue
      requestExit();
      return true;
    });
    return () => subscription.remove();
  }, [endingStarted, requestExit]);

  const togglePlayback = () => {
    if (engine.state === 'paused') engine.resume();
    else if (engine.state === 'running') engine.pause();
    else return;
    if (haptics) void v2Haptics.selection();
    setControlsVisible(true);
  };

  const handleContinue = () => {
    if (continuedRef.current || !settled) return;
    continuedRef.current = true;
    engine.markCompleted();
    onContinue();
  };

  const slot = visionSceneSlotAt(schedule, engine.elapsedMs);
  const previous = slot.index > 0 ? schedule[slot.index - 1] : null;
  const crossfade = reduceMotion ? T.reducedCrossfadeMs : T.crossfadeMs;
  const outgoingImage = previous && previous.imageIndex !== slot.imageIndex && engine.elapsedMs - slot.startMs < crossfade + 400
    ? previous.imageIndex : null;
  const lastSlot = schedule[schedule.length - 1];
  const finalImage = images[lastSlot.imageIndex] ?? null;
  const onFinalSlot = slot.index === lastSlot.index;
  const paused = engine.state === 'paused';
  const anchorSize = Math.round(Math.min(width * 0.52, 228));
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);

  return (
    <View testID="v2-visualize-session" style={styles.root}>
      <StatusBar hidden={immersive} barStyle="light-content" backgroundColor={colors.ink.deep} animated />
      {immersive ? <KeepAwake /> : null}

      <Animated.View style={[styles.fill, photoGroupStyle]} pointerEvents="none">
        <Animated.View style={[styles.fill, styles.stage, introStyle]}>
          {images.map((uri, index) => (
            <SceneLayer key={`${index}-${uri}`} uri={uri} imageSize={imageSizes[uri]} width={width} height={height}
              role={index === slot.imageIndex ? 'active' : index === outgoingImage ? 'outgoing' : 'idle'}
              activationKey={index === slot.imageIndex ? slot.index : -1}
              slotMs={slot.endMs - slot.startMs} paused={paused} settling={endingStarted}
              reduceMotion={reduceMotion} />
          ))}
          {finalImage && onFinalSlot && !reduceMotion ? (
            <Animated.View style={[styles.fill, styles.overlay, blurredStyle]}>
              <Image source={{ uri: finalImage }} blurRadius={18} resizeMode="cover" style={[{ width, height }, styles.blurScale]} />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.fill, styles.overlay, styles.desaturate, desaturateStyle]} />
          <Animated.View style={[styles.fill, styles.overlay, styles.darken, darkenStyle]} />
          <Animated.View style={[styles.fill, styles.overlay, vignetteStyle]}>
            <Svg width={width} height={height}>
              <Defs>
                <RadialGradient id="visualize-vignette" cx="50%" cy="48%" r="70%" rx="70%" ry="62%" fx="50%" fy="48%">
                  <Stop offset="0.35" stopColor={colors.ink.deep} stopOpacity="0" />
                  <Stop offset="1" stopColor={colors.ink.deep} stopOpacity="0.92" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={width} height={height} fill="url(#visualize-vignette)" />
            </Svg>
          </Animated.View>
        </Animated.View>
        {/* Text protection only - never a card. It leaves with the chrome so the ending is the image alone. */}
        <Animated.View pointerEvents="none" style={[styles.fill, shadeStyle]}>
          <LinearGradient pointerEvents="none" colors={['rgba(14,21,28,0.55)', 'rgba(14,21,28,0)']} style={[styles.topShade, { height: insets.top + 110 }]} />
          <LinearGradient pointerEvents="none" colors={['rgba(14,21,28,0)', 'rgba(14,21,28,0.72)']} style={styles.bottomShade} />
        </Animated.View>
      </Animated.View>

      {!endingStarted ? (
        <Pressable accessibilityLabel="Show session controls" style={styles.fill} onPress={() => setControlsVisible(value => !value)} />
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.opening, { paddingBottom: insets.bottom + 132 }, openingStyle]}>
        <Text style={styles.openingLine}>See it. Feel it. Live it.</Text>
        <Text style={styles.openingStatement} numberOfLines={4}>{statement}</Text>
      </Animated.View>

      <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.prompt, { paddingBottom: insets.bottom + 140 }, promptStyle]}>
        {promptText ? <Text style={styles.promptText}>{promptText}</Text> : null}
      </Animated.View>

      {/* Peripheral chrome */}
      <Animated.View pointerEvents={endingStarted ? 'none' : 'box-none'} style={[styles.topBar, { top: insets.top + spacing[2] }]}>
        <Animated.View style={chromeStyle} pointerEvents={controlsVisible ? 'auto' : 'none'}>
          <Pressable accessibilityRole="button" accessibilityLabel="End Visualize" onPress={requestExit} hitSlop={10} style={styles.iconButton}>
            <X size={20} color={colors.ink.text.primary} />
          </Pressable>
        </Animated.View>
        <Animated.Text testID="v2-visualize-timer" accessibilityLabel={`${engine.remainingSeconds} seconds remaining`} style={[styles.timer, timerStyle]}>
          {formatTime(engine.remainingSeconds)}
        </Animated.Text>
      </Animated.View>
      <Animated.View pointerEvents={controlsVisible && !endingStarted ? 'box-none' : 'none'} style={[styles.bottomBar, { bottom: insets.bottom + spacing[5] }, chromeStyle]}>
        {images.length > 1 ? (
          <View style={styles.dots} accessibilityLabel={`Scene ${slot.imageIndex + 1} of ${images.length}`}>
            {images.map((_, index) => <View key={index} style={[styles.dot, index === slot.imageIndex && styles.dotActive]} />)}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Resume Visualize' : 'Pause Visualize'} onPress={togglePlayback} style={styles.playButton}>
          {paused ? <Play size={20} color={colors.ink.text.primary} /> : <Pause size={20} color={colors.ink.text.primary} />}
        </Pressable>
        {paused ? <Text style={styles.pausedText}>Paused</Text> : null}
      </Animated.View>

      {endingStarted ? (
        <View style={styles.ending} pointerEvents="box-none">
          <View style={{ width: anchorSize, height: anchorSize }}>
            {!reduceMotion ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, anchorEchoStyle]}
                accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <CircularAnchorRenderer {...art} size={anchorSize} appearance="dark" />
              </Animated.View>
            ) : null}
            <Animated.View style={anchorStyle}>
              <CircularAnchorRenderer
                {...art}
                testID="v2-visualize-anchor"
                size={anchorSize}
                appearance="dark"
                accessibilityLabel={`${categoryLabel(anchor.category)} Anchor`}
              />
            </Animated.View>
          </View>
          <Animated.View style={[styles.lineWrap, lineStyle]} accessibilityElementsHidden={!lineVisible}
            importantForAccessibility={lineVisible ? 'auto' : 'no-hide-descendants'}>
            <Text style={styles.line}>Hold onto what you saw.</Text>
          </Animated.View>
          <Animated.View style={[styles.continueWrap, { bottom: insets.bottom + spacing[6] }, continueStyle]}
            pointerEvents={continueReady && settled ? 'auto' : 'none'}>
            {/* SEE → MOVE: the Anchor's real One Move, once the ending has settled. */}
            <ChartMoveHandoff anchorId={anchor.id} surface="visualize" tone="ink" visible={continueReady && settled} />
            {/* The Anchor 2.0 primary: an ink pill with cream text, lifted from the dark ground by a hairline. */}
            <V2Button size="large" accessibilityLabel="Continue" disabled={!continueReady || !settled} onPress={handleContinue}
              style={styles.continueButton} textColor={colors.paper}>
              Continue
            </V2Button>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink.deep },
  fill: { ...StyleSheet.absoluteFillObject },
  stage: { overflow: 'hidden', backgroundColor: colors.ink.deep },
  layer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  overlay: { zIndex: 3 },
  blurScale: { transform: [{ scale: T.kenBurnsTo }] },
  // Blends to grey luminance where the platform supports blend modes; elsewhere a soft grey veil.
  desaturate: { backgroundColor: '#7B8087', mixBlendMode: 'saturation' },
  darken: { backgroundColor: colors.ink.deep },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  opening: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing[7], gap: spacing[3] },
  openingLine: { ...typography.headingLG, color: colors.ink.text.primary, textAlign: 'center' },
  openingStatement: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  prompt: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing[7] },
  promptText: { ...typography.headingLG, color: colors.ink.text.primary, textAlign: 'center' },
  topBar: { position: 'absolute', left: spacing[4], right: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timer: { ...typography.labelMD, color: colors.ink.text.primary, fontVariant: ['tabular-nums'] },
  bottomBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing[3] },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink.text.tertiary },
  dotActive: { backgroundColor: colors.ink.text.primary },
  playButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.ink.text.secondary, alignItems: 'center', justifyContent: 'center' },
  pausedText: { ...typography.caption, color: colors.ink.text.secondary },
  // Anchor and line share one centred column; the line is always laid out (transparent) so nothing shifts when it appears.
  ending: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing[8] },
  lineWrap: { marginTop: spacing[8], paddingHorizontal: spacing[6], alignItems: 'center' },
  line: { ...typography.headingMD, color: colors.ink.text.primary, textAlign: 'center' },
  continueWrap: { position: 'absolute', left: spacing[5], right: spacing[5], alignItems: 'center', gap: spacing[4] },
  continueButton: { alignSelf: 'stretch', maxWidth: 360, backgroundColor: '#0A0F14', borderColor: colors.ink.hairlineStrong },
  extensionShade: { backgroundColor: colors.ink.deep, opacity: 0.38 },
});
