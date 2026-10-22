import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, BackHandler, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { Skia, type SkSVG } from '@shopify/react-native-skia';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pause, Play, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { getGuidedTrackAsset } from '@/services/visualizeGuidedTracks';
import { getVisualizeMonotonicNow } from '@/screens/visualize/useVisualizeSessionEngine';
import { useVisualizeImmersiveMode } from '@/screens/visualize/useVisualizeImmersiveMode';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { GuidanceVoice } from '@/types/sessionAudio';
import type { PracticeSessionRecord } from '@/types/practice';
import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';
import { freezeVisionNotes } from '@/components/v2/vision/notes/freezeVisionNotes';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { detailBoardSizeForWidth, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { buildVisionSceneSnapshot, type V2VisualizeDuration } from './visualizeVisionPlan';
import { preserveVisualizeAnchorLayout } from './visualizePhotoFrame';
import { useCinematicAssets, freezeCinematicTiles, type CinematicAssets } from './cinematicAssets';
import { cinematicSegmentAt } from './prototype/cinematicTimeline';
import { guideForVoice } from './guided/visualizeBeatMap';
import { cinematicGradeAt } from './guided/cinematicGrade';
import { buildGuidedPlan, resolveGuidedState } from './guided/visualizeGuidedPlan';
import { useGuidedPlayback } from './guided/useGuidedPlayback';
import { cinematicSessionGeometry } from './cinematicSessionMotion';
import { CinematicSessionStage } from './CinematicSessionStage';
import { ENHANCED_ANCHOR_MASK_SHADER } from './enhancedAnchorMask';
import { photoWindow, rotatedChild, type Rect } from './prototype/cinematicGeometry';

export type PreparedCinematicSession = {
  anchor: Anchor; statement: string; visionId?: string | null; assets: CinematicAssets; notes?: readonly VisionNote[];
  markLocal: Rect; viewport: { width: number; height: number }; beginAtMs?: number; canvasFrame?: Rect;
  svgText: string; svg: SkSVG | null; enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null;
};
export type CinematicCompletion = { record: PracticeSessionRecord | null; saved: boolean };
export type CinematicSessionProps = {
  anchor: Anchor; accountId: string | null; tiles: V2VisionTile[]; statement: string; visionId?: string | null;
  notes?: readonly VisionNote[];
  durationSeconds: V2VisualizeDuration; voice: GuidanceVoice; ambient: boolean; haptics: boolean;
  source: 'practice_hub' | 'recommended_today'; onExit: () => void; onContinue: (result: CinematicCompletion) => void;
  prepared?: PreparedCinematicSession;
  prepareOnly?: boolean;
  onPrepared?: (session: PreparedCinematicSession) => void;
  onPreparationIssue?: (message: string) => void;
  onAvailableImages?: (useAvailable: () => void) => void;
};
/** Longest the settled final board is held for audio fade-out and the local completion write. */
export const COMPLETION_SETTLE_MAX_MS = 4000;
/** A seal that lands later than this after its moment (a long pause, a background return) is skipped, not replayed. */
const SEAL_HAPTIC_WINDOW_MS = 1500;
export const traceVisualize = (message: string, detail?: unknown) => {
  if (__DEV__ && !process.env.JEST_WORKER_ID) console.log(`[Visualize] ${message}`, detail ?? '');
};
const KeepAwake = () => { useKeepAwake('v2-visualize-session'); return null; };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Asset failures resolve before the clock, preserving the same available board at both ends. */
export function V2CinematicSessionScreen(props: CinematicSessionProps) {
  // Preferences and content cannot be replaced by a store refresh during playback.
  const [frozen] = useState(() => ({ ...props, notes: freezeVisionNotes(props.prepared?.notes ?? props.notes), ...(props.prepared ? {
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
          assets.unavailable ? 'The Vision images could not load.' :
          assets.partial ? 'Load every Vision image before beginning.' :
            'Your session begins when the images and canvas are ready.'}</Text>
      <View style={styles.recoveryActions}>
        <V2Button onPress={assets.retry} accessibilityLabel="Retry Vision images">Retry</V2Button>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Practice" onPress={props.onExit} style={styles.recoveryBack}>
          <Text style={styles.recoveryCopy}>Back to Practice</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

function CinematicRun({ anchor, accountId, statement, visionId, notes, durationSeconds, voice, ambient, haptics, source,
  onExit, onContinue, onRetry, assets, svgText, svg, enhancedMaskEffect, prepared, prepareOnly, onPrepared, onPreparationIssue }: CinematicSessionProps & {
  assets: CinematicAssets; svgText: string; svg: SkSVG | null;
  enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null; onRetry: () => void;
}) {
  const window = useWindowDimensions();
  const [{ width, height }] = useState(() => prepared?.viewport ?? ({ width: window.width, height: window.height }));
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const insets = useSafeAreaInsets();
  const reduced = useV2ReduceMotion();
  const scene = useMemo(() => detailBoardSizeForWidth(width * 2, assets.tiles.length), [width, assets.tiles.length]);
  const board = useVisionBoardScene(assets.tiles, scene, 1, true);
  const sessionLayout = preserveVisualizeAnchorLayout(board.layout, assets.tiles.length, scene);
  const [markLocal, setMarkLocal] = useState<Rect | null>(prepared?.markLocal ?? null);
  const onMarkLayout = useCallback((rect: Rect) => setMarkLocal(previous => previous ?? rect), []);
  const card = useMemo(() => toSceneRect(sessionLayout.card, scene), [sessionLayout.card, scene]);
  const mark = useMemo(() => markLocal ? rotatedChild(card, markLocal) : null, [card, markLocal]);
  const photo = useMemo(() => photoWindow(toSceneRect(board.layout.photos[0], scene), board.layout.photos[0].frame), [board.layout.photos, scene]);
  const [frameError, setFrameError] = useState(false);
  const ready = Boolean(mark && mark.width > 0 && mark.height > 0 &&
    (!assets.enhancedAnchor || enhancedMaskEffect));
  useEffect(() => {
    if (ready || frameError) return;
    const timeout = setTimeout(() => setFrameError(true), 20_000);
    return () => clearTimeout(timeout);
  }, [frameError, ready]);
  useEffect(() => {
    if (prepareOnly && ready && markLocal) {
      onPrepared?.({ anchor, statement, visionId, notes, assets, markLocal, viewport, svgText, svg, enhancedMaskEffect });
    }
  }, [prepareOnly, ready, markLocal, onPrepared, anchor, statement, visionId, notes, assets, viewport, svgText, svg, enhancedMaskEffect]);
  useEffect(() => { if (frameError) onPreparationIssue?.('The canvas could not be prepared. Retry before beginning.'); }, [frameError, onPreparationIssue]);
  // One plan per session: the selected guide's beat map, resolved against the Vision images that exist.
  const plan = useMemo(() => buildGuidedPlan({ durationSeconds, guide: guideForVoice(voice), imageCount: assets.tiles.length }),
    [assets.tiles.length, durationSeconds, voice]);
  const timeline = plan.timeline;
  useEffect(() => {
    traceVisualize(`plan photos=${plan.imageCount} lightReturnMs=${plan.timeline.lightReturnMs} durationMs=${plan.durationMs}`,
      { focus: assets.focalPoints, softBackdrops: assets.backdrops?.map(Boolean) });
  }, [plan, assets]);
  const guidedAsset = useMemo(() => getGuidedTrackAsset(plan.track, plan.guide), [plan.guide, plan.track]);
  const geometry = useMemo(() => mark ? cinematicSessionGeometry(scene, viewport, photo, mark, plan.imageCount, prepared?.canvasFrame) : null,
    [plan.imageCount, mark, photo, scene, viewport, prepared?.canvasFrame]);
  const watermark = useMemo(() => ({ x: width - 58, y: height - insets.bottom - 104, size: 68 }), [width, height, insets.bottom]);
  const sceneSnapshot = useMemo(() => buildVisionSceneSnapshot(statement, anchor), [anchor, statement]);
  const backgroundAudio = ambient ? 'ambient' as const : 'off' as const;
  const sessionId = useRef(`visualize:${accountId ?? 'guest'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`);
  const completionResult = useRef<CinematicCompletion>({ record: null, saved: false });
  const completionStarted = useRef(false); const exiting = useRef(false); const continued = useRef(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const appActiveRef = useRef(appActive);
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
        metadata: { v2_entry_source: source, guided_visualize_version: 1, ...(visionId ? { vision_id: visionId } : {}) },
      }); completionResult.current = { record, saved: true }; outcome = 'queued';
    } catch { outcome = 'failed'; }
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_COMPLETED, {
      practice_mode: 'visualize', session_id: sessionId.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, sync_outcome: outcome, completed_at: completedAt, v2: true,
    });
  }, [accountId, anchor, backgroundAudio, durationSeconds, sceneSnapshot, source, visionId, voice]);
  // The guided track's playback position is the only clock. `elapsed` mirrors it for the UI thread.
  const elapsed = useSharedValue(0);
  const engine = useGuidedPlayback({ asset: guidedAsset, enabled: !prepareOnly, muted: voice === 'none', durationMs: plan.durationMs,
    positionSV: elapsed, onComplete: complete });
  const immersive = engine.state === 'running' || engine.state === 'paused' || engine.state === 'completing';
  useVisualizeImmersiveMode(immersive);
  const started = useRef(false);
  useEffect(() => {
    if (prepareOnly || !ready || frameError || started.current || !appActive || !appActiveRef.current || exiting.current ||
      engine.state === 'ended_early' || engine.state === 'completed' || engine.state === 'completing' || engine.state === 'failed') return;
    started.current = true; engine.start();
    AnalyticsService.track(AnalyticsEvents.PRACTICE_SESSION_STARTED, {
      practice_mode: 'visualize', session_id: sessionId.current, anchor_id: anchor.id, duration_seconds: durationSeconds,
      guidance_voice: voice, background_audio: backgroundAudio, started_at: new Date().toISOString(), v2: true,
      assets_prepared_in_setup: Boolean(prepared), guide: plan.guide, track: plan.track,
      ...(prepared?.beginAtMs != null ? { begin_to_clock_ms: Math.max(0, getVisualizeMonotonicNow() - prepared.beginAtMs) } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareOnly, ready, frameError, appActive, engine.state]);
  useEffect(() => () => cancelAnimation(elapsed), [elapsed]);
  const resolved = resolveGuidedState(plan, engine.positionMs);
  const segment = cinematicSegmentAt(timeline, engine.positionMs);
  // Development telemetry: the last line of a stalled run says where it stopped.
  useEffect(() => {
    traceVisualize(`${formatTime(Math.floor(engine.positionMs / 1000))}/${formatTime(Math.round(plan.durationMs / 1000))} ${engine.state} chapter=${resolved.chapter ?? '-'} segment=${segment.kind} image=${resolved.imageIndex} silence=${resolved.silence}`);
  }, [engine.state, resolved.chapter, segment.kind, resolved.imageIndex, resolved.silence]); // eslint-disable-line react-hooks/exhaustive-deps
  // The seal haptic fires once, when the Anchor resolves. Returning after the moment has passed never replays it.
  const sealHandled = useRef(false);
  useEffect(() => {
    if (engine.state !== 'running' || sealHandled.current || engine.positionMs < plan.sealAtMs) return;
    sealHandled.current = true;
    if (haptics && engine.positionMs - plan.sealAtMs < SEAL_HAPTIC_WINDOW_MS) void v2Haptics.confirmation();
  }, [engine.state, engine.positionMs, haptics, plan.sealAtMs]);
  useEffect(() => {
    if (engine.state !== 'completing') return;
    let live = true;
    const settle = () => { if (live) setSettled(true); };
    void Promise.allSettled([engine.completionPromise ?? Promise.resolve()]).then(settle);
    // The final board is held for the local queue write, never for it to behave:
    // a stalled storage write cannot keep the person on the last image.
    const failsafe = setTimeout(() => { traceVisualize('completion failsafe: continuing without settled persistence'); settle(); }, COMPLETION_SETTLE_MAX_MS);
    return () => { live = false; clearTimeout(failsafe); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state]);
  const engineRef = useRef(engine); engineRef.current = engine;
  // One session control opens one paused state: Resume or End session. A single tap never ends the session.
  const openPause = useCallback((reason: string) => {
    if (exiting.current) return;
    const current = engineRef.current;
    if (current.state === 'running') current.pause(reason);
  }, []);
  const resumeSession = useCallback(() => {
    if (exiting.current || !appActiveRef.current) return;
    engineRef.current.resume();
  }, []);
  const endSession = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    void engineRef.current.endEarly().finally(onExit);
  }, [onExit]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (engine.state === 'completing' || engine.state === 'completed') return true;
      if (engine.state === 'paused') resumeSession(); else openPause('back');
      return true;
    });
    return () => listener.remove();
  }, [engine.state, openPause, resumeSession]);
  useEffect(() => {
    // The track plays to its own end; only that settled final board can enter the existing Thread experience.
    if (!settled || !appActive || engine.state !== 'completing' || continued.current) return;
    continued.current = true;
    engine.markCompleted();
    onContinue(completionResult.current);
  }, [settled, appActive, engine.state, engine.markCompleted, onContinue]);
  const paused = engine.state === 'paused';
  const controls = controlsVisible || paused || screenReader;
  useEffect(() => {
    if (!controlsVisible || engine.state !== 'running' || screenReader) return;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [controlsVisible, engine.state, screenReader]);
  const chromeOpacity = useSharedValue(1);
  useEffect(() => { chromeOpacity.value = withTiming(controls ? 1 : 0, { duration: reduced ? 0 : 280 }); }, [chromeOpacity, controls, reduced]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));
  // Captions come from the beat map at the audio position, never from a timer chain; none appears without a clean phrase.
  const line = resolved.caption?.text ?? null;
  // Over the cream board a caption is ink; over a photograph, or the board once it is dimmed, it is light.
  const segmentProgress = (engine.positionMs - segment.startMs) / Math.max(1, segment.endMs - segment.startMs);
  const boardShowing = segment.kind === 'carry' || segment.kind === 'boardHold' ||
    (segment.kind === 'return' && segmentProgress > 0.55) || segment.kind === 'arrival' || (segment.kind === 'breakout' && segmentProgress < 0.6);
  const ambientLight = engine.positionMs < 1000 || engine.positionMs > (timeline.lightReturnMs ?? plan.durationMs) + 1500;
  const onPaper = boardShowing && ambientLight && cinematicGradeAt(timeline, engine.positionMs).dim < 0.35;
  const [displayLine, setDisplayLine] = useState<string | null>(null);
  const textOpacity = useSharedValue(0);
  useEffect(() => {
    if (engine.state === 'paused') { cancelAnimation(textOpacity); return; }
    if (line) setDisplayLine(line);
    textOpacity.value = withTiming(line ? 1 : 0, { duration: reduced ? 0 : line ? 260 : 360 });
  }, [line, engine.state, reduced, textOpacity]);
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  if (engine.state === 'failed') return <View testID="v2-visualize-session" style={styles.root}>
    <View style={styles.recovery}>
      <Text style={styles.recoveryTitle}>Guided audio unavailable</Text>
      <Text style={styles.recoveryCopy}>Visualize keeps time with its narration, so it cannot begin without it.</Text>
      <V2Button onPress={onExit} accessibilityLabel="Back to Practice">Back to Practice</V2Button>
    </View>
  </View>;
  if (frameError && !started.current) return <View testID="v2-visualize-session" style={styles.root}>
    <View style={styles.recovery}>
      <Text style={styles.recoveryTitle}>Vision unavailable</Text>
      <Text style={styles.recoveryCopy}>The canvas could not be prepared.</Text>
      <V2Button onPress={onRetry} accessibilityLabel="Retry board assets">Retry</V2Button>
      <V2Button onPress={onExit} accessibilityLabel="Back to Practice">Back to Practice</V2Button>
    </View>
  </View>;
  if (prepareOnly) return <View style={styles.measureBoard} pointerEvents="none">
      <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={sessionLayout} shared={board.shared}
      initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement} category={anchor.category}
      art={{ svg: svgText, imageUrl: anchor.enhancedImageUrl }} reduceMotion
      cinematic={{ photoId: '', photoOpacity: elapsed, onMarkLayout }} />
  </View>;
  return <View testID="v2-visualize-session" style={styles.root}>
    <StatusBar hidden={immersive} barStyle="light-content" />
    {immersive ? <KeepAwake /> : null}
    {!prepareOnly && mark && geometry ? <CinematicSessionStage tiles={assets.tiles} images={assets.images} focalPoints={assets.focalPoints}
      intention={anchor.intentionText || statement} category={anchor.category} svgText={svgText} enhancedImageUrl={anchor.enhancedImageUrl}
      enhancedAnchor={assets.enhancedAnchor} enhancedMaskEffect={enhancedMaskEffect} svg={svg}
      scene={scene} viewport={viewport} mark={mark} geometry={geometry} timeline={timeline} elapsed={elapsed}
      sequenceCount={plan.imageCount} activeIndex={resolved.imageIndex} watermark={watermark} backdrops={assets.backdrops}
      reduced={reduced} onMarkLayout={onMarkLayout} /> :
      <View style={styles.measureBoard} pointerEvents="none">
          <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={sessionLayout} shared={board.shared}
          initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement} category={anchor.category}
          art={{ svg: svgText, imageUrl: anchor.enhancedImageUrl }} reduceMotion cinematic={{ photoId: '', photoOpacity: elapsed, onMarkLayout }} />
      </View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Show session controls" style={StyleSheet.absoluteFill}
      onPress={() => setControlsVisible(value => !value)} />
    <Animated.View pointerEvents="none" style={[styles.guidance, { bottom: insets.bottom + 160 }, textStyle]}>
      {displayLine ? <Text testID="v2-visualize-caption" adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={4}
        style={[styles.guidanceText, onPaper ? styles.guidanceOnPaper : styles.guidanceOnPhoto]}>{displayLine}</Text> : null}
    </Animated.View>
    <Animated.View style={[styles.topBar, { top: insets.top + spacing[2] }, chromeStyle]}
      pointerEvents={controls ? 'box-none' : 'none'} accessibilityElementsHidden={!controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="End Visualize" onPress={() => openPause('end_control')} style={styles.iconButton}>
        <X size={20} color={colors.ink.text.primary} />
      </Pressable>
      <Text testID="v2-visualize-timer" accessibilityLabel={`${engine.remainingSeconds} seconds remaining`} style={styles.timer}>
        {formatTime(engine.remainingSeconds)}
      </Text>
    </Animated.View>
    {engine.state === 'running' ? <Animated.View style={[styles.bottomBar, { bottom: insets.bottom + spacing[5] }, chromeStyle]}
      pointerEvents={controls ? 'box-none' : 'none'} accessibilityElementsHidden={!controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pause Visualize" onPress={() => { openPause('user'); setControlsVisible(true); }} style={styles.playButton}>
        <Pause size={20} color={colors.ink.text.primary} />
      </Pressable>
    </Animated.View> : null}
    {paused ? <View testID="v2-visualize-paused" style={styles.pausedScrim} accessibilityViewIsModal>
      <Text style={styles.pausedTitle}>Paused</Text>
      <Text style={styles.pausedCopy}>This session only counts when it reaches the end.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Resume Visualize" onPress={resumeSession} style={styles.resumeButton}>
        <Play size={18} color={colors.ink.text.primary} />
        <Text style={styles.resumeLabel}>Resume</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="End session" onPress={endSession} style={styles.endButton}>
        <Text style={styles.endLabel}>End session</Text>
      </Pressable>
    </View> : null}
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
  guidanceText: { ...typography.headingMD, textAlign: 'center' },
  guidanceOnPhoto: { color: colors.ink.text.primary, textShadowColor: 'rgba(8,11,15,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  // Over the board the caption sits on its own paper, so it reads against any photograph tile beneath it.
  guidanceOnPaper: { color: colors.ink.deep, backgroundColor: 'rgba(244,239,228,0.92)', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 12, overflow: 'hidden' },
  pausedScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,16,21,0.78)', alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  pausedTitle: { ...typography.headingMD, color: colors.ink.text.primary },
  pausedCopy: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center', marginBottom: spacing[3] },
  resumeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], minWidth: 200, minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.ink.text.primary },
  resumeLabel: { ...typography.headingSM, color: colors.ink.text.primary },
  endButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  endLabel: { ...typography.labelMD, color: colors.ink.text.secondary },
  bottomBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing[3] },
  playButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.ink.text.secondary, alignItems: 'center', justifyContent: 'center' },
  counter: { ...typography.caption, color: colors.ink.text.secondary },
  done: { position: 'absolute', left: spacing[5], right: spacing[5] },
});
