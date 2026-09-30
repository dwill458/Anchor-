import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, BackHandler, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useImage, Skia, type SkSVG } from '@shopify/react-native-skia';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pause, Play, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { trackSessionStartedWithAudio } from '@/services/SessionAudioAnalytics';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { getVisualizeSessionAudioManifest } from '@/services/visualizeAudioManifest';
import { getVisualizeMonotonicNow, useVisualizeSessionEngine } from '@/screens/visualize/useVisualizeSessionEngine';
import { useVisualizeSessionAudio } from '@/screens/visualize/useVisualizeSessionAudio';
import { useVisualizeImmersiveMode } from '@/screens/visualize/useVisualizeImmersiveMode';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import type { PracticeSessionRecord } from '@/types/practice';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { BOARD_ATTACHMENT_ART, BOARD_FRAME_IMAGES } from '@/components/v2/vision/board/visionBoardAssets';
import { boardAttachmentFor, boardSizeForWidth, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { buildVisionSceneSnapshot, type V2VisualizeDuration } from './visualizeVisionPlan';
import { useCinematicAssets, freezeCinematicTiles, type CinematicAssets } from './cinematicAssets';
import { buildCinematicTimeline, cinematicSegmentAt } from './prototype/cinematicTimeline';
import { buildCinematicGuidance, cinematicGuidanceAt } from './prototype/cinematicGuidance';
import { cinematicSessionGeometry } from './cinematicSessionMotion';
import { CinematicSessionStage } from './CinematicSessionStage';
import { ENHANCED_ANCHOR_MASK_SHADER } from './enhancedAnchorMask';
import { photoWindow, rotatedChild, type Rect } from './prototype/cinematicGeometry';

export type PreparedCinematicSession = {
  anchor: Anchor; statement: string; visionId?: string | null; assets: CinematicAssets;
  markLocal: Rect; viewport: { width: number; height: number }; beginAtMs?: number; frameImage: NonNullable<ReturnType<typeof useImage>>;
  attachmentImage: NonNullable<ReturnType<typeof useImage>>;
  svgText: string; svg: SkSVG | null; enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null;
};
export type CinematicCompletion = { record: PracticeSessionRecord | null; saved: boolean };
export type CinematicSessionProps = {
  anchor: Anchor; accountId: string | null; tiles: V2VisionTile[]; statement: string; visionId?: string | null;
  durationSeconds: V2VisualizeDuration; voice: GuidanceVoice; ambient: boolean; haptics: boolean;
  source: 'practice_hub' | 'recommended_today'; onExit: () => void; onContinue: (result: CinematicCompletion) => void;
  prepared?: PreparedCinematicSession;
  prepareOnly?: boolean;
  onPrepared?: (session: PreparedCinematicSession) => void;
  onPreparationIssue?: (message: string) => void;
  onAvailableImages?: (useAvailable: () => void) => void;
};
const KeepAwake = () => { useKeepAwake('v2-visualize-session'); return null; };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Asset failures resolve before the clock, preserving the same available board at both ends. */
export function V2CinematicSessionScreen(props: CinematicSessionProps) {
  // Preferences and content cannot be replaced by a store refresh during playback.
  const [frozen] = useState(() => ({ ...props, ...(props.prepared ? {
    anchor: props.prepared.anchor, statement: props.prepared.statement,
    visionId: props.prepared.visionId, tiles: props.prepared.assets.tiles,
  } : {}) }));
  return <CinematicLoader {...frozen} onContinue={props.onContinue} onExit={props.onExit}
    onPrepared={props.onPrepared} onPreparationIssue={props.onPreparationIssue} onAvailableImages={props.onAvailableImages} />;
}
function CinematicLoader(props: CinematicSessionProps) {
  if (props.prepared) return <PreparedRun {...props} prepared={props.prepared} />;
  return <LoadingRun {...props} />;
}
function PreparedRun(props: CinematicSessionProps & { prepared: PreparedCinematicSession }) {
  return <CinematicRun {...props} assets={props.prepared.assets} svgText={props.prepared.svgText} svg={props.prepared.svg}
    enhancedMaskEffect={props.prepared.enhancedMaskEffect} onRetry={props.onExit} />;
}

function LoadingRun(props: CinematicSessionProps) {
  const [snapshot] = useState(() => ({ anchor: { ...props.anchor }, accountId: props.accountId,
    statement: props.statement, visionId: props.visionId, tiles: freezeCinematicTiles(props.tiles) }));
  const enhancedImageUrl = snapshot.anchor.enhancedImageUrl;
  const assets = useCinematicAssets(snapshot.tiles, enhancedImageUrl);
  const enhancedMaskEffect = useMemo(() => {
    if (!enhancedImageUrl) return null;
    try { return Skia.RuntimeEffect.Make(ENHANCED_ANCHOR_MASK_SHADER); } catch { return null; }
  }, [enhancedImageUrl]);
  const [selected, setSelected] = useState<CinematicAssets | null>(null);
  const svgText = anchorArtworkSvg(snapshot.anchor);
  const svg = useMemo(() => {
    if (!svgText?.trim() || !/<svg\b/i.test(svgText) || !/<(?:path|circle|ellipse|line|polygon|polyline|rect|use|text|image)\b/i.test(svgText)) return null;
    // Saved Anchor art may define only a viewBox. Skia reports zero intrinsic
    // dimensions for that valid SVG; ImageSVG receives the measured mark bounds.
    try { return Skia.SVG.MakeFromString(svgText); }
    catch { return null; }
  }, [svgText]);
  useEffect(() => { if (!selected && assets.ready) setSelected(assets.select(snapshot.tiles)); }, [assets.ready, selected, snapshot]);
  useEffect(() => {
    if (assets.unavailable || assets.partial) props.onPreparationIssue?.('Some Vision assets could not load. Retry before beginning.');
  }, [assets.unavailable, assets.partial, props.onPreparationIssue]);
  const hasUsableArtwork = Boolean(svg || enhancedImageUrl);
  const enhancedMaskReady = !enhancedImageUrl || Boolean(enhancedMaskEffect);
  useEffect(() => {
    if (assets.partial && assets.enhancedReady && hasUsableArtwork && enhancedMaskReady)
      props.onAvailableImages?.(() => setSelected(assets.select(assets.available)));
  }, [assets.partial, assets.enhancedReady, assets.available, hasUsableArtwork, enhancedMaskReady, props.onAvailableImages]);

  useEffect(() => {
    if (!hasUsableArtwork || !enhancedMaskReady) props.onPreparationIssue?.('The actual Anchor artwork could not be prepared.');
  }, [hasUsableArtwork, enhancedMaskReady, props.onPreparationIssue]);
  if (selected && hasUsableArtwork && enhancedMaskReady && (!enhancedImageUrl || selected.enhancedAnchor)) return <View style={styles.root}>{assets.resources}<CinematicRun {...props} {...snapshot}
    assets={selected} svgText={svgText} svg={svg} enhancedMaskEffect={enhancedMaskEffect}
    onRetry={() => { setSelected(null); assets.retry(); }} /></View>;
  const unavailable = !hasUsableArtwork || !enhancedMaskReady || snapshot.tiles.length === 0 || assets.unavailable;
  return <View testID="v2-visualize-preparing" style={styles.root}>
    {assets.resources}
    <View style={styles.recovery}>
      {!unavailable && !assets.partial ? <ActivityIndicator color={colors.paper} /> : null}
      <Text style={styles.recoveryTitle}>{unavailable ? 'Vision unavailable' : assets.partial ? 'Some images could not load' : 'Preparing your Vision'}</Text>
      <Text style={styles.recoveryCopy}>{!hasUsableArtwork ? 'The actual Anchor artwork is unavailable.' : !enhancedMaskReady ? 'The enhanced Anchor artwork could not be prepared.' : assets.enhancedFailed ? 'The enhanced Anchor artwork could not load.' : snapshot.tiles.length === 0 ?
        'Add a Vision image before beginning.' : assets.oversizedCount > 0 ?
          'Some images are too large for this session. Retry to load them.' :
          assets.unavailable ? 'The board or Vision images could not load.' :
          assets.partial ? `${assets.available.length} image${assets.available.length === 1 ? '' : 's'} ready to visualize.` :
            'Your session begins when the images and board are ready.'}</Text>
      <View style={styles.recoveryActions}>
        <V2Button onPress={assets.retry} accessibilityLabel="Retry Vision images">Retry</V2Button>
        {assets.partial && hasUsableArtwork && assets.enhancedReady ? <V2Button onPress={() => setSelected(assets.select(assets.available))}
          accessibilityLabel="Continue with available images">Continue with available images</V2Button> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Practice" onPress={props.onExit} style={styles.recoveryBack}>
          <Text style={styles.recoveryCopy}>Back to Practice</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

function CinematicRun({ anchor, accountId, statement, visionId, durationSeconds, voice, ambient, haptics, source,
  onExit, onContinue, onRetry, assets, svgText, svg, enhancedMaskEffect, prepared, prepareOnly, onPrepared, onPreparationIssue }: CinematicSessionProps & {
  assets: CinematicAssets; svgText: string; svg: SkSVG | null;
  enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null; onRetry: () => void;
}) {
  const window = useWindowDimensions();
  const [{ width, height }] = useState(() => prepared?.viewport ?? ({ width: window.width, height: window.height }));
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const insets = useSafeAreaInsets();
  const reduced = useV2ReduceMotion();
  const scene = useMemo(() => boardSizeForWidth(width * 2), [width]);
  const board = useVisionBoardScene(assets.tiles, scene);
  const [markLocal, setMarkLocal] = useState<Rect | null>(prepared?.markLocal ?? null);
  const onMarkLayout = useCallback((rect: Rect) => setMarkLocal(previous => previous ?? rect), []);
  const card = useMemo(() => toSceneRect(board.layout.card, scene), [board.layout.card, scene]);
  const mark = useMemo(() => markLocal ? rotatedChild(card, markLocal) : null, [card, markLocal]);
  const photo = useMemo(() => photoWindow(toSceneRect(board.layout.photos[0], scene), board.layout.photos[0].frame), [board.layout.photos, scene]);
  const [frameError, setFrameError] = useState(false);
  const loadedFrameImage = useImage(prepared ? null : BOARD_FRAME_IMAGES[board.layout.photos[0].frame] as number, () => setFrameError(true));
  const loadedAttachmentImage = useImage(prepared ? null : BOARD_ATTACHMENT_ART[boardAttachmentFor(assets.tiles[0].sceneId)].source as number, () => setFrameError(true));
  const frameImage = prepared?.frameImage ?? loadedFrameImage;
  const attachmentImage = prepared?.attachmentImage ?? loadedAttachmentImage;
  const ready = Boolean(mark && mark.width > 0 && mark.height > 0 && frameImage && attachmentImage &&
    (!assets.enhancedAnchor || enhancedMaskEffect));
  useEffect(() => {
    if (ready || frameError) return;
    const timeout = setTimeout(() => setFrameError(true), 20_000);
    return () => clearTimeout(timeout);
  }, [frameError, ready]);
  useEffect(() => {
    if (prepareOnly && ready && markLocal && frameImage && attachmentImage) {
      onPrepared?.({ anchor, statement, visionId, assets, markLocal, viewport, frameImage, attachmentImage, svgText, svg, enhancedMaskEffect });
    }
  }, [prepareOnly, ready, markLocal, frameImage, attachmentImage, onPrepared, anchor, statement, visionId, assets, viewport, svgText, svg, enhancedMaskEffect]);
  useEffect(() => { if (frameError) onPreparationIssue?.('The board could not be prepared. Retry before beginning.'); }, [frameError, onPreparationIssue]);
  const timeline = useMemo(() => buildCinematicTimeline(durationSeconds, assets.tiles.length), [assets.tiles.length, durationSeconds]);
  const audioPlan = useMemo(() => resolveSessionAudioPlan({ sessionType: 'visualize', durationSeconds,
    configuration: { guidanceVoice: voice, backgroundAudio: ambient ? 'ambient' : 'off', source: 'session_override' },
  }), [ambient, durationSeconds, voice]);
  const audioManifest = useMemo(() => {
    const base = getVisualizeSessionAudioManifest(durationSeconds);
    const first = base.cues[0]; const immersion = timeline.segments.find(item => item.kind === 'immersion');
    return { ...base, cues: first && immersion ? [{ ...first, startSeconds: (immersion.startMs + 2000) / 1000 }] : [] };
  }, [durationSeconds, timeline]);
  const guidance = useMemo(() => buildCinematicGuidance(statement, timeline, {
    recordingWindows: audioManifest.cues.map(item => ({ startMs: item.startSeconds * 1000,
      endMs: item.startSeconds * 1000 + Math.max(item.expectedClipDurationSeconds.female, item.expectedClipDurationSeconds.male) * 1000 + 500 })),
  }), [audioManifest, statement, timeline]);
  const geometry = useMemo(() => mark ? cinematicSessionGeometry(scene, viewport, photo, mark, assets.tiles.length) : null,
    [assets.tiles.length, mark, photo, scene, viewport]);
  const sceneSnapshot = useMemo(() => buildVisionSceneSnapshot(statement, anchor), [anchor, statement]);
  const backgroundAudio = ambient ? 'ambient' as const : 'off' as const;
  const sessionId = useRef(`visualize:${accountId ?? 'guest'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`);
  const completionResult = useRef<CinematicCompletion>({ record: null, saved: false });
  const completionStarted = useRef(false); const exiting = useRef(false); const continued = useRef(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const appActiveRef = useRef(appActive);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const exitPromptOpenRef = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const active = nextState === 'active';
      appActiveRef.current = active;
      setAppActive(active);
    });
    return () => subscription.remove();
  }, []);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settled, setSettled] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (live) setScreenReader(enabled); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => setScreenReader(enabled));
    return () => { live = false; subscription.remove(); };
  }, []);
  const complete = useCallback(async ({ startedAt, completedAt }: { startedAt: string; completedAt: string }) => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    let outcome: 'queued' | 'failed' | 'not_recorded' = 'not_recorded';
    if (accountId) try {
      const record = await PracticeCompletionService.commitVisualizeCompletion({
        id: sessionId.current, accountId, anchor, durationSeconds, startedAt, completedAt,
        guidanceVoice: voice, backgroundAudio, sceneSnapshot, source: 'practice_screen',
        metadata: { v2_entry_source: source, ...(visionId ? { vision_id: visionId } : {}) },
      }); completionResult.current = { record, saved: true }; outcome = 'queued';
    } catch { outcome = 'failed'; }
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
      practice_mode: 'visualize', session_id: sessionId.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, sync_outcome: outcome, completed_at: completedAt, v2: true,
    });
  }, [accountId, anchor, backgroundAudio, durationSeconds, sceneSnapshot, source, visionId, voice]);
  const engine = useVisualizeSessionEngine({ durationSeconds, hapticsEnabled: haptics, phaseHapticsEnabled: false, onComplete: complete });
  const pauseForInterruption = useCallback(() => engine.pause('audio_interruption'), [engine.pause]);
  const sessionAudio = useVisualizeSessionAudio({ plan: audioPlan, manifest: audioManifest, elapsedMs: engine.elapsedMs,
    isActive: engine.state === 'running', isCompleting: engine.state === 'completing',
    isComplete: engine.state === 'completed', onInterruption: pauseForInterruption });
  const immersive = engine.state === 'running' || engine.state === 'paused' || engine.state === 'completing';
  useVisualizeImmersiveMode(immersive);
  const started = useRef(false);
  useEffect(() => {
    if (prepareOnly || !ready || frameError || started.current || !appActive || !appActiveRef.current ||
      exitPromptOpen || exitPromptOpenRef.current || exiting.current ||
      engine.state === 'ended_early' || engine.state === 'completed' || engine.state === 'completing') return;
    started.current = true; engine.start();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: 'visualize', session_id: sessionId.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, started_at: new Date().toISOString(), v2: true,
      assets_prepared_in_setup: Boolean(prepared),
      ...(prepared?.beginAtMs != null ? { begin_to_clock_ms: Math.max(0, getVisualizeMonotonicNow() - prepared.beginAtMs) } : {}),
    });
    trackSessionStartedWithAudio(audioPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareOnly, ready, frameError, appActive, exitPromptOpen, engine.state]);
  const elapsed = useSharedValue(0);
  const elapsedRef = useRef(engine.elapsedMs); elapsedRef.current = engine.elapsedMs;
  useEffect(() => {
    cancelAnimation(elapsed);
    const at = Math.min(timeline.durationMs, elapsedRef.current);
    elapsed.value = at;
    if (engine.state === 'running') elapsed.value = withTiming(timeline.durationMs, {
      duration: timeline.durationMs - at, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state, timeline.durationMs]);
  useEffect(() => () => cancelAnimation(elapsed), [elapsed]);
  const segment = cinematicSegmentAt(timeline, engine.elapsedMs);
  const hapticFired = useRef(new Set<string>());
  useEffect(() => {
    if (!haptics || engine.state !== 'running') return;
    const cue = segment.kind === 'immersion' && segment.imageIndex === 0 ? 'first_immersion' :
      segment.kind === 'recognition' ? 'compression_complete' : null;
    if (!cue || hapticFired.current.has(cue)) return;
    hapticFired.current.add(cue); void v2Haptics.selection();
  }, [engine.state, haptics, segment.imageIndex, segment.kind]);
  useEffect(() => {
    if (engine.state !== 'completing') return;
    let live = true;
    void Promise.allSettled([engine.completionPromise ?? Promise.resolve(), sessionAudio.finishCompletion()])
      .then(() => { if (live) setSettled(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state]);
  const engineRef = useRef(engine); engineRef.current = engine;
  const stopAudioRef = useRef(sessionAudio.fadeOutAndStop); stopAudioRef.current = sessionAudio.fadeOutAndStop;
  const requestExit = useCallback(() => {
    const current = engineRef.current;
    if (exiting.current || exitPromptOpenRef.current || current.state === 'completing' || current.state === 'completed') return;
    exitPromptOpenRef.current = true; setExitPromptOpen(true);
    const wasRunning = current.state === 'running'; current.pause('exit_prompt');
    Alert.alert('End Visualize?', 'This session only counts when it reaches the end.', [
      { text: 'Keep going', style: 'cancel', onPress: () => {
        exitPromptOpenRef.current = false; setExitPromptOpen(false);
        if (wasRunning && appActiveRef.current) engineRef.current.resume();
      } },
      { text: 'End session', style: 'destructive', onPress: () => {
        exitPromptOpenRef.current = false; setExitPromptOpen(false);
        exiting.current = true; engineRef.current.endEarly(); void stopAudioRef.current().finally(onExit);
      } },
    ], { cancelable: true, onDismiss: () => {
      if (!exitPromptOpenRef.current) return;
      exitPromptOpenRef.current = false; setExitPromptOpen(false);
      if (wasRunning && !exiting.current && appActiveRef.current) engineRef.current.resume();
    } });
  }, [onExit]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (engine.state === 'completing') return true;
      requestExit(); return true;
    });
    return () => listener.remove();
  }, [engine.state, requestExit]);
  const togglePlayback = () => {
    if (engine.state === 'paused') engine.resume(); else if (engine.state === 'running') engine.pause('user');
    setControlsVisible(true);
  };
  useEffect(() => {
    // The engine includes Carry and the silent board hold in the selected duration.
    // Only the settled final board can enter the existing Thread experience.
    if (!settled || !appActive || engine.state !== 'completing' || continued.current) return;
    continued.current = true;
    engine.markCompleted();
    onContinue(completionResult.current);
  }, [settled, appActive, engine.state, engine.markCompleted, onContinue]);
  const controls = controlsVisible || engine.state === 'paused' || screenReader;
  useEffect(() => {
    if (!controlsVisible || engine.state !== 'running' || screenReader) return;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [controlsVisible, engine.state, screenReader]);
  const chromeOpacity = useSharedValue(1);
  useEffect(() => { chromeOpacity.value = withTiming(controls ? 1 : 0, { duration: reduced ? 0 : 280 }); }, [chromeOpacity, controls, reduced]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));
  const cue = cinematicGuidanceAt(guidance, engine.elapsedMs);
  const fixedText = segment.kind === 'feeling' ? 'Hold the feeling.' : segment.kind === 'carry' ? 'Carry it with you.' : null;
  const line = fixedText ?? cue?.text ?? null;
  const [displayLine, setDisplayLine] = useState<string | null>(null);
  const textOpacity = useSharedValue(0);
  useEffect(() => {
    if (engine.state === 'paused') { cancelAnimation(textOpacity); return; }
    if (line) setDisplayLine(line);
    textOpacity.value = withTiming(line ? 1 : 0, { duration: reduced ? 0 : 500 });
  }, [line, engine.state, reduced, textOpacity]);
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value, transform: [{ translateY: (1 - textOpacity.value) * 6 }] }));

  if (frameError && !started.current) return <View testID="v2-visualize-session" style={styles.root}>
    <View style={styles.recovery}>
      <Text style={styles.recoveryTitle}>Vision unavailable</Text>
      <Text style={styles.recoveryCopy}>The board could not be prepared.</Text>
      <V2Button onPress={onRetry} accessibilityLabel="Retry board assets">Retry</V2Button>
      <V2Button onPress={onExit} accessibilityLabel="Back to Practice">Back to Practice</V2Button>
    </View>
  </View>;
  if (prepareOnly) return <View style={styles.measureBoard} pointerEvents="none">
    <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout} shared={board.shared}
      initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement} category={anchor.category}
      art={{ svg: svgText, imageUrl: anchor.enhancedImageUrl }} reduceMotion
      cinematic={{ photoId: '', photoOpacity: elapsed, onMarkLayout }} />
  </View>;
  return <View testID="v2-visualize-session" style={styles.root}>
    <StatusBar hidden={immersive} barStyle="light-content" backgroundColor={colors.ink.deep} />
    {immersive ? <KeepAwake /> : null}
    {!prepareOnly && mark && geometry && frameImage && attachmentImage ? <CinematicSessionStage tiles={assets.tiles} images={assets.images}
      intention={anchor.intentionText || statement} category={anchor.category} svgText={svgText} enhancedImageUrl={anchor.enhancedImageUrl}
      enhancedAnchor={assets.enhancedAnchor} enhancedMaskEffect={enhancedMaskEffect} svg={svg}
      scene={scene} viewport={viewport} mark={mark} geometry={geometry} timeline={timeline} elapsed={elapsed}
      frameImage={frameImage} attachmentImage={attachmentImage} reduced={reduced} onMarkLayout={onMarkLayout} /> :
      <View style={styles.measureBoard} pointerEvents="none">
        <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout} shared={board.shared}
          initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement} category={anchor.category}
          art={{ svg: svgText, imageUrl: anchor.enhancedImageUrl }} reduceMotion cinematic={{ photoId: '', photoOpacity: elapsed, onMarkLayout }} />
      </View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Show session controls" style={StyleSheet.absoluteFill}
      onPress={() => setControlsVisible(value => !value)} />
    <Animated.View pointerEvents="none" style={[styles.guidance, { bottom: insets.bottom + 160 }, textStyle]}>
      {displayLine ? <Text numberOfLines={2} style={styles.guidanceText}>{displayLine}</Text> : null}
    </Animated.View>
    <Animated.View style={[styles.topBar, { top: insets.top + spacing[2] }, chromeStyle]}
      pointerEvents={controls ? 'box-none' : 'none'} accessibilityElementsHidden={!controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="End Visualize" onPress={requestExit} style={styles.iconButton}>
        <X size={20} color={colors.ink.text.primary} />
      </Pressable>
      <Text testID="v2-visualize-timer" accessibilityLabel={`${engine.remainingSeconds} seconds remaining`} style={styles.timer}>
        {formatTime(engine.remainingSeconds)}
      </Text>
    </Animated.View>
    {engine.state === 'running' || engine.state === 'paused' ? <Animated.View style={[styles.bottomBar, { bottom: insets.bottom + spacing[5] }, chromeStyle]}
      pointerEvents={controls ? 'box-none' : 'none'} accessibilityElementsHidden={!controls}>
      {assets.tiles.length > 1 && segment.kind === 'immersion' ?
        <Text style={styles.counter}>{(segment.imageIndex ?? 0) + 1} / {assets.tiles.length}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={engine.state === 'paused' ? 'Resume Visualize' : 'Pause Visualize'}
        onPress={togglePlayback} style={styles.playButton}>
        {engine.state === 'paused' ? <Play size={20} color={colors.ink.text.primary} /> : <Pause size={20} color={colors.ink.text.primary} />}
      </Pressable>
      {engine.state === 'paused' ? <Text style={styles.counter}>Paused</Text> : null}
    </Animated.View> : null}

  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink.deep },
  recovery: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6], gap: spacing[4] },
  recoveryTitle: { ...typography.headingLG, color: colors.ink.text.primary, textAlign: 'center' },
  recoveryCopy: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  recoveryActions: { alignSelf: 'stretch', gap: spacing[3] },
  recoveryBack: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  measureBoard: { position: 'absolute', left: 0, top: 0, opacity: 0 },
  topBar: { position: 'absolute', left: spacing[4], right: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timer: { ...typography.labelMD, color: colors.ink.text.primary, fontVariant: ['tabular-nums'] },
  guidance: { position: 'absolute', left: spacing[6], right: spacing[6], alignItems: 'center' },
  guidanceText: { ...typography.headingMD, color: colors.ink.text.primary, textAlign: 'center' },
  bottomBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing[3] },
  playButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.ink.text.secondary, alignItems: 'center', justifyContent: 'center' },
  counter: { ...typography.caption, color: colors.ink.text.secondary },
  done: { position: 'absolute', left: spacing[5], right: spacing[5] },
});
