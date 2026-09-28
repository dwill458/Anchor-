import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, BackHandler, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
  type SharedValue, type WithTimingConfig,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Pause, Play, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
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
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import {
  boardSizeForWidth, selectBoardLayout, toSceneRect, VISION_BOARD_MAX_IMAGES,
} from '@/components/v2/vision/board/visionBoardLayouts';
import { focusCamera, type CameraState } from '@/components/v2/vision/board/visionBoardCamera';
import { boardCameraEasing } from '@/components/v2/vision/board/visionBoardMotion';
import {
  buildBoardVisitSchedule, buildVisionSceneSnapshot, preloadVisionImages, V2_VISUALIZE_TIMING as T,
  visionSceneSlotAt, visualizePromptAt, visualizeReflectionPrompts, type V2VisualizeDuration,
} from './visualizeVisionPlan';
import { planVisualizeCamera, visualizeCameraPhaseAt } from './visualizeBoardCamera';
import { ChartMoveHandoff } from '@/components/v2/chart/ChartMoveHandoff';
import { useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';

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

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Camera moves in Visualize are decided by the session itself; system animator scale must not skip them. */
const cameraTiming = (toValue: number, duration: number, easing: WithTimingConfig['easing'] = boardCameraEasing) => {
  'worklet';
  return withTiming(toValue, { duration: Math.max(0, duration), easing, reduceMotion: ReduceMotion.Never });
};
function cameraDelay<V>(delayMs: number, animation: V): V {
  'worklet';
  return withDelay(Math.max(0, delayMs), animation as never, ReduceMotion.Never) as V;
}

export function V2VisualizeSessionScreen({
  anchor, accountId, tiles, statement, visionId, durationSeconds, voice, ambient, haptics, source, onExit, onContinue,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  // Only the person's chosen photographs, in their chosen order, on the board they arranged.
  const boardTiles = useMemo(() => tiles.filter(tile => Boolean(tile.imageUrl)).slice(0, VISION_BOARD_MAX_IMAGES), [tiles]);
  const images = useMemo(() => boardTiles.map(tile => tile.imageUrl as string), [boardTiles]);
  useEffect(() => { preloadVisionImages(images); }, [images]);
  const schedule = useMemo(() => buildBoardVisitSchedule(durationSeconds, images.length), [durationSeconds, images.length]);
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
  // Entering with the shared Anchor transition, the Anchor comes first and the
  // Vision opens around it; the session's controls arrive last.
  const topChromeReveal = useAnchorTransitionReveal('visualizeSession', 3);
  const bottomChromeReveal = useAnchorTransitionReveal('visualizeSession', 3);

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

  // ── The board and its camera. The scene is laid out large so the deepest
  // zoom stays sharp; the camera is one transform on its parent.
  const viewport = useMemo(() => ({ width, height }), [height, width]);
  const scene = useMemo(() => boardSizeForWidth(width * T.board.renderScale), [width]);
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);
  const anchorIntention = anchor.intentionText || statement;
  const openingCamera = useMemo(() => {
    const card = toSceneRect(selectBoardLayout(boardTiles.length).card, scene);
    return focusCamera(card, scene, viewport, { fill: T.board.anchorFill, minZoom: T.board.minZoom, maxZoom: T.board.maxZoom, clamp: false });
  }, [boardTiles.length, scene, viewport]);
  const board = useVisionBoardScene(boardTiles, scene, openingCamera.scale);
  const plan = useMemo(() => planVisualizeCamera({
    schedule, photoRects: board.slotRects, cardRect: toSceneRect(board.layout.card, scene), scene, viewport,
  }), [board.layout.card, board.slotRects, scene, schedule, viewport]);
  const cameraX = useSharedValue(openingCamera.x);
  const cameraY = useSharedValue(openingCamera.y);
  const cameraScale = board.shared.cameraScale;
  const boardPresence = useSharedValue(1);
  const stopCamera = useCallback(() => {
    cancelAnimation(cameraX);
    cancelAnimation(cameraY);
    cancelAnimation(cameraScale);
  }, [cameraScale, cameraX, cameraY]);

  // ── Opening: setup has faded to darkness; the board rises out of it, on the Anchor.
  const intro = useSharedValue(0);
  const openingText = useSharedValue(0);
  useEffect(() => {
    intro.value = withTiming(1, { duration: reduceMotion ? 700 : T.openingRevealMs, easing: Easing.out(Easing.quad) });
    openingText.value = withDelay(T.openingDelayMs, withSequence(
      withTiming(1, { duration: T.textFadeMs }),
      withDelay(T.openingHoldMs, withTiming(0, { duration: T.textFadeMs })),
    ));
  }, [intro, openingText, reduceMotion]);
  const openingStyle = useAnimatedStyle(() => ({ opacity: openingText.value }));

  // ── The journey: one timed move per phase, planned up front. Pausing stops
  // the camera where it is; resuming continues towards where it belongs.
  const phase = visualizeCameraPhaseAt(plan, engine.elapsedMs);
  const elapsedRef = useRef(engine.elapsedMs);
  elapsedRef.current = engine.elapsedMs;
  const running = engine.state === 'running';
  const paused = engine.state === 'paused';
  useEffect(() => {
    if (endingStarted) return;
    if (!running) { stopCamera(); return; }
    const current = visualizeCameraPhaseAt(plan, elapsedRef.current);
    if (reduceMotion) {
      // No travel: a quiet dip, and the next photograph is simply there.
      const target = current.kind === 'opening' ? plan.anchor : current.visit.target;
      if (Math.abs(cameraX.value - target.x) < 1 && Math.abs(cameraY.value - target.y) < 1 && Math.abs(cameraScale.value - target.scale) < 0.001) return;
      boardPresence.value = withTiming(0, { duration: T.board.reducedDipOutMs, reduceMotion: ReduceMotion.Never }, finished => {
        'worklet';
        if (!finished) return;
        cameraX.value = target.x;
        cameraY.value = target.y;
        cameraScale.value = target.scale;
        boardPresence.value = withTiming(1, { duration: T.board.reducedDipInMs, reduceMotion: ReduceMotion.Never });
      });
      return;
    }
    const linear = Easing.linear;
    if (current.kind === 'opening') {
      const ease = Easing.out(Easing.quad);
      cameraX.value = cameraTiming(current.to.x, current.remainingMs, ease);
      cameraY.value = cameraTiming(current.to.y, current.remainingMs, ease);
      cameraScale.value = cameraTiming(current.to.scale, current.remainingMs, ease);
    } else if (current.kind === 'travel') {
      const { target, drift } = current.visit;
      const glide = (value: SharedValue<number>, to: number, then: number) => {
        value.value = withSequence(
          ReduceMotion.Never,
          cameraTiming(to, current.remainingTravelMs),
          cameraTiming(then, current.remainingHoldMs, linear),
        );
      };
      glide(cameraX, target.x, drift.x);
      glide(cameraY, target.y, drift.y);
      glide(cameraScale, target.scale, drift.scale);
    } else {
      const { drift } = current.visit;
      cameraX.value = cameraTiming(drift.x, current.remainingMs, linear);
      cameraY.value = cameraTiming(drift.y, current.remainingMs, linear);
      cameraScale.value = cameraTiming(drift.scale, current.remainingMs, linear);
    }
    // One move per phase, re-planned only when the phase, pause state or plan changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.key, running, endingStarted, plan, reduceMotion]);

  const cameraStyle = useAnimatedStyle(() => ({
    opacity: intro.value * boardPresence.value,
    transform: [
      { translateX: -cameraScale.value * cameraX.value },
      { translateY: -cameraScale.value * cameraY.value },
      { scale: cameraScale.value },
    ],
  }));

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

  // ── Ending: the camera pulls back to the whole board, then settles around the Anchor.
  const quiet = useSharedValue(0);
  const line = useSharedValue(0);
  const continueOpacity = useSharedValue(0);

  useEffect(() => {
    if (engine.state !== 'completing' || endingStarted) return;
    setEndingStarted(true);
    AccessibilityInfo.announceForAccessibility?.('Visualize complete.');
    const timers: ReturnType<typeof setTimeout>[] = [];
    stopCamera();
    if (reduceMotion) {
      const R = T.reducedEnding;
      chrome.value = withTiming(0, { duration: R.chromeOutMs });
      timerPresence.value = withTiming(0, { duration: R.chromeOutMs });
      const finale = plan.finale;
      boardPresence.value = cameraDelay(R.crossAtMs, withTiming(0.2, { duration: R.crossMs / 2, reduceMotion: ReduceMotion.Never }, finished => {
        'worklet';
        if (!finished) return;
        cameraX.value = finale.x;
        cameraY.value = finale.y;
        cameraScale.value = finale.scale;
        boardPresence.value = withTiming(1, { duration: R.crossMs / 2, reduceMotion: ReduceMotion.Never });
      }));
      quiet.value = cameraDelay(R.crossAtMs, withTiming(1, { duration: R.crossMs, reduceMotion: ReduceMotion.Never }));
      line.value = withDelay(R.lineAtMs, withTiming(1, { duration: R.fadeInMs }));
      continueOpacity.value = withDelay(R.continueAtMs, withTiming(1, { duration: R.fadeInMs }));
      timers.push(setTimeout(() => setLineVisible(true), R.lineAtMs));
      timers.push(setTimeout(() => setContinueReady(true), R.continueAtMs));
      timers.push(setTimeout(() => { if (haptics) void v2Haptics.completion(); }, R.crossAtMs + R.crossMs));
    } else {
      const E = T.ending;
      chrome.value = withTiming(0, { duration: E.chromeOutMs });
      timerPresence.value = withTiming(0, { duration: E.chromeOutMs });
      // Pull back: the whole board, every photograph at once, the Anchor at its heart.
      const toRestThenFinale = (value: SharedValue<number>, rest: number, finale: number) => {
        value.value = withSequence(
          ReduceMotion.Never,
          cameraTiming(rest, E.pullBackMs),
          cameraDelay(E.settleAtMs - E.pullBackMs, cameraTiming(finale, E.settleMs)),
        );
      };
      toRestThenFinale(cameraX, plan.rest.x, plan.finale.x);
      toRestThenFinale(cameraY, plan.rest.y, plan.finale.y);
      toRestThenFinale(cameraScale, plan.rest.scale, plan.finale.scale);
      quiet.value = cameraDelay(E.quietAtMs, withTiming(1, { duration: E.quietMs, reduceMotion: ReduceMotion.Never }));
      line.value = withDelay(E.lineAtMs, withTiming(1, { duration: E.fadeInMs }));
      continueOpacity.value = withDelay(E.continueAtMs, withTiming(1, { duration: E.fadeInMs }));
      timers.push(setTimeout(() => setLineVisible(true), E.lineAtMs));
      timers.push(setTimeout(() => setContinueReady(true), E.continueAtMs));
      timers.push(setTimeout(() => { if (haptics) void v2Haptics.completion(); }, E.settleAtMs + E.settleMs));
    }
    let cancelled = false;
    void Promise.allSettled([engine.completionPromise ?? Promise.resolve(), sessionAudio.finishCompletion()])
      .then(() => { if (!cancelled) setSettled(true); });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // Runs once, at the moment the timer reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state]);

  const quietStyle = useAnimatedStyle(() => ({ opacity: quiet.value }));
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

  const visit = schedule.length ? visionSceneSlotAt(schedule, engine.elapsedMs) : null;
  const onPhotograph = Boolean(visit && engine.elapsedMs >= visit.startMs);

  return (
    <View testID="v2-visualize-session" style={styles.root}>
      <StatusBar hidden={immersive} barStyle="light-content" backgroundColor={colors.ink.deep} animated />
      {immersive ? <KeepAwake /> : null}

      <View style={styles.fill} pointerEvents="none">
        <Animated.View style={[styles.scene, {
          width: scene.width, height: scene.height,
          left: (width - scene.width) / 2, top: (height - scene.height) / 2,
        }, cameraStyle]}>
          <VisionBoardScene
            scene={scene}
            roster={board.roster}
            entering={board.entering}
            layout={board.layout}
            shared={board.shared}
            initialRectFor={board.initialRectFor}
            intention={anchorIntention}
            category={anchor.category}
            art={art}
            reduceMotion={reduceMotion}
            anchorTestID="v2-visualize-anchor"
          />
        </Animated.View>
        {/* The ending quiets the edges so the Anchor at the centre holds the eye. */}
        <Animated.View style={[styles.fill, quietStyle]}>
          <Svg width={width} height={height}>
            <Defs>
              <RadialGradient id="visualize-vignette" cx="50%" cy="46%" r="70%" rx="62%" ry="52%" fx="50%" fy="46%">
                <Stop offset="0.42" stopColor={colors.ink.deep} stopOpacity="0" />
                <Stop offset="1" stopColor={colors.ink.deep} stopOpacity="0.9" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={height} fill="url(#visualize-vignette)" />
          </Svg>
        </Animated.View>
        {/* Text protection only - never a card. It leaves with the chrome so the ending is the board alone. */}
        <Animated.View pointerEvents="none" style={[styles.fill, shadeStyle]}>
          <LinearGradient pointerEvents="none" colors={['rgba(14,21,28,0.55)', 'rgba(14,21,28,0)']} style={[styles.topShade, { height: insets.top + 110 }]} />
          <LinearGradient pointerEvents="none" colors={['rgba(14,21,28,0)', 'rgba(14,21,28,0.72)']} style={styles.bottomShade} />
        </Animated.View>
      </View>

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
      <Animated.View pointerEvents={endingStarted ? 'none' : 'box-none'} style={[styles.topBar, { top: insets.top + spacing[2] }, topChromeReveal]}>
        <Animated.View style={chromeStyle} pointerEvents={controlsVisible ? 'auto' : 'none'}>
          <Pressable accessibilityRole="button" accessibilityLabel="End Visualize" onPress={requestExit} hitSlop={10} style={styles.iconButton}>
            <X size={20} color={colors.ink.text.primary} />
          </Pressable>
        </Animated.View>
        <Animated.Text testID="v2-visualize-timer" accessibilityLabel={`${engine.remainingSeconds} seconds remaining`} style={[styles.timer, timerStyle]}>
          {formatTime(engine.remainingSeconds)}
        </Animated.Text>
      </Animated.View>
      <Animated.View pointerEvents={controlsVisible && !endingStarted ? 'box-none' : 'none'} style={[styles.bottomBar, { bottom: insets.bottom + spacing[5] }, chromeStyle, bottomChromeReveal]}>
        {images.length > 1 ? (
          <View style={styles.dots} accessibilityLabel={onPhotograph && visit ? `Image ${visit.imageIndex + 1} of ${images.length}` : 'Your Anchor'}>
            {images.map((_, index) => <View key={index} style={[styles.dot, onPhotograph && index === visit?.imageIndex && styles.dotActive]} />)}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Resume Visualize' : 'Pause Visualize'} onPress={togglePlayback} style={styles.playButton}>
          {paused ? <Play size={20} color={colors.ink.text.primary} /> : <Pause size={20} color={colors.ink.text.primary} />}
        </Pressable>
        {paused ? <Text style={styles.pausedText}>Paused</Text> : null}
      </Animated.View>

      {endingStarted ? (
        <View style={styles.ending} pointerEvents="box-none">
          <Animated.View style={[styles.lineWrap, { bottom: insets.bottom + 168 }, lineStyle]} accessibilityElementsHidden={!lineVisible}
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
  scene: { position: 'absolute' },
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
  // The Anchor is on the board at the centre; the line and Continue sit beneath it.
  ending: { ...StyleSheet.absoluteFillObject },
  lineWrap: { position: 'absolute', left: spacing[6], right: spacing[6], alignItems: 'center' },
  line: { ...typography.headingMD, color: colors.ink.text.primary, textAlign: 'center' },
  continueWrap: { position: 'absolute', left: spacing[5], right: spacing[5], alignItems: 'center', gap: spacing[4] },
  continueButton: { alignSelf: 'stretch', maxWidth: 360, backgroundColor: '#0A0F14', borderColor: colors.ink.hairlineStrong },
});
