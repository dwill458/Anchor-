import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowRight, Eye, Smartphone, Volume2 } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2PracticeSetupLayout } from '@/components/v2/practice/V2PracticeSetupLayout';
import { resolvePracticeSetupMetrics } from '@/components/v2/practice/practiceSetupLayout';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { v2PracticeDurationLabel } from '@/constants/v2/practice';
import { useV2ReduceMotion, useV2Responsive } from '@/hooks/v2';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { DEFAULT_SESSION_AUDIO_DEFAULTS, type BackgroundAudioMode, type GuidanceVoice } from '@/types/sessionAudio';
import type { Anchor } from '@/types';
import type { V2VisionTile, VisionNote, VisionVisualizeEntry } from '@/adapters/v2/vision';
import { V2_VISUALIZE_DURATIONS } from './visualizeVisionPlan';
import { V2CinematicSessionScreen, type PreparedCinematicSession } from './V2CinematicSessionScreen';
import { getVisualizeMonotonicNow } from '@/screens/visualize/useVisualizeSessionEngine';
import { useAuthStore } from '@/stores/authStore';
import { useRemoteAudioReady } from '@/hooks/useRemoteAudioReady';
import { getGuidedTrackAsset } from '@/services/visualizeGuidedTracks';
import { guideForVoice, trackForDuration, type GuidedDurationSeconds } from './guided/visualizeBeatMap';
import { availableVisualizePhotoHeight, fitVisualizePhotoFrame, VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION, visualizeEntrySceneTransform, visualizePhotoSceneTarget } from './visualizePhotoFrame';

export type V2VisualizeBeginConfig = {
  durationSeconds: number;
  voice: GuidanceVoice;
  ambient: boolean;
  haptics: boolean;
  prepared: PreparedCinematicSession;
};

type Props = {
  anchor: Anchor;
  statement: string;
  visionId?: string;
  /** The Vision's images in their one display order (`getOrderedVisionImages`). */
  tiles: V2VisionTile[];
  notes?: readonly VisionNote[];
  initialDuration?: number;
  onBack: () => void;
  onOpenVision?: (anchorId: string) => void;
  onBegin: (config: V2VisualizeBeginConfig) => void;
  /** The shared Anchor transition carries Begin into the session; setup skips its own hand-off. */
  anchorHandoff?: boolean;
  entry?: VisionVisualizeEntry;
};

const ACCENT = practiceColors.visualize;
const SERIF = 'EBGaramond-Medium';
/**
 * The hand-off into the session. The setup's chrome fades while the collage stays exactly where it is on the same
 * cream page: the session opens on that very board, then the camera carries it into the first photograph.
 * (Darkening the page first made the session's cream opening flash.)
 */
export const VISUALIZE_BEGIN_TIMING = { fadeMs: 360 } as const;
/** The entry waits for the Vision's photos to be in the image cache, but never longer than this. */
const PHOTO_WARM_MAX_MS = 800;

/**
 * Visualize setup. Cream means configuring a Practice; the person's own Vision
 * is the hero (the same board composition as the Vision screen, in the same
 * order), their real Anchor sits on it, and Begin darkens the page into the
 * session without a cut. Sound and haptics apply to this session only.
 */
export function V2VisualizePrepareScreen({ anchor, statement, visionId, tiles, notes, initialDuration, onBack, onOpenVision, onBegin, entry }: Props) {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const viewport = useV2Responsive();
  const metrics = resolvePracticeSetupMetrics(viewport, 'hero');
  const { width, height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [headingHeight, setHeadingHeight] = useState(0);
  const onScrollViewportLayout = useCallback((nextHeight: number) => setScrollViewportHeight(previous => Math.abs(previous - nextHeight) < 1 ? previous : nextHeight), []);
  const onHeadingLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    setHeadingHeight(previous => Math.abs(previous - measuredHeight) < 1 ? previous : measuredHeight);
  }, []);
  const [prepared, setPrepared] = useState<PreparedCinematicSession | null>(null);
  const [preparationIssue, setPreparationIssue] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const acceptPrepared = useCallback((session: PreparedCinematicSession) => {
    setPrepared(session); setPreparationIssue(null);
  }, []);
  const reportIssue = useCallback((message: string) => setPreparationIssue(message), []);
  const defaults = useSettingsStore(state => state.sessionAudioDefaults?.visualize);
  const hapticIntensity = useSettingsStore(state => state.hapticIntensity);
  const savedVoice: GuidanceVoice = defaults?.guidanceVoice ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice;
  const savedAmbient: BackgroundAudioMode = defaults?.backgroundAudio ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.backgroundAudio;
  const [duration, setDuration] = useState<number>(
    initialDuration && (V2_VISUALIZE_DURATIONS as readonly number[]).includes(initialDuration) ? initialDuration : 180,
  );
  const [soundOn, setSoundOn] = useState(savedVoice !== 'none' || savedAmbient !== 'off');
  const [hapticsOn, setHapticsOn] = useState((hapticIntensity ?? 70) > 0);
  const [beginning, setBeginning] = useState(false);
  const [entrySettled, setEntrySettled] = useState(() => !entry?.sourceFrame || entry.sourceFrame.width <= 0 || entry.sourceFrame.height <= 0);
  const [entryTargetMeasured, setEntryTargetMeasured] = useState(() => !entry?.sourceFrame || entry.sourceFrame.width <= 0 || entry.sourceFrame.height <= 0);
  const [entryMotion, setEntryMotion] = useState<null | { from: { x: number; y: number; width: number; height: number }; to: { x: number; y: number; width: number; height: number } }>(() => {
    const source = entry?.sourceFrame;
    return source && source.width > 0 && source.height > 0 ? { from: { ...source }, to: { ...source } } : null;
  });
  // Visualize keeps the saved SVG as its only Anchor source across setup and session.
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);
  const boardTiles = useMemo(() => tiles.filter(tile => Boolean(tile.imageUrl)), [tiles]);

  // The Vision screen warms these on load; this confirms they are cached before the entry flies the board in.
  // Without a prefetch API there is nothing to wait for, and a stalled prefetch releases the entry after a cap.
  const photoUrlKey = boardTiles.map(tile => tile.imageUrl).join('|');
  const [photosWarm, setPhotosWarm] = useState(() => typeof Image.prefetch !== 'function');
  useEffect(() => {
    if (typeof Image.prefetch !== 'function') { setPhotosWarm(true); return undefined; }
    let live = true;
    const warming = Promise.all(photoUrlKey.split('|').filter(Boolean).map(url => Promise.resolve(Image.prefetch(url)).catch(() => false)));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bound = new Promise<void>(resolve => { timer = setTimeout(resolve, PHOTO_WARM_MAX_MS); });
    void Promise.race([warming.then(() => undefined), bound]).then(() => {
      if (timer) clearTimeout(timer);
      if (live) setPhotosWarm(true);
    });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [photoUrlKey]);

  // The preview uses the saved multi-photo board composition and fits the whole
  // canvas in the same space the previous cropped preview occupied.
  const contentWidth = width - metrics.sidePadding * 2;
  const maximumPhotoHeight = height * VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION;
  const frameLayoutReady = scrollViewportHeight > 0 && headingHeight > 0;
  const availablePhotoHeight = frameLayoutReady
    ? availableVisualizePhotoHeight({ viewportHeight: scrollViewportHeight, headingHeight,
      topPadding: spacing[1], bodyGap: spacing[3], maximumHeight: maximumPhotoHeight })
    : maximumPhotoHeight;
  const sourceSceneWidth = entry?.sourceFrame?.sceneWidth;
  const sourceSceneHeight = entry?.sourceFrame?.sceneHeight;
  const sceneWidth = Number.isFinite(sourceSceneWidth) && (sourceSceneWidth ?? 0) > 0 ? sourceSceneWidth! : contentWidth;
  const photoFrame = useMemo(() => fitVisualizePhotoFrame(sceneWidth, boardTiles.length, contentWidth, availablePhotoHeight, sourceSceneHeight),
    [sceneWidth, boardTiles.length, contentWidth, availablePhotoHeight, sourceSceneHeight]);
  const scene = photoFrame.scene;

  // Keep the real setup board visible while the exact session textures and geometry prepare.
  const preparationKey = useMemo(() => JSON.stringify([accountId, anchor.id, anchor.enhancedImageUrl, art.svg,
    anchor.intentionText, statement, visionId, boardTiles.map(tile => [tile.sceneId, tile.imageUrl]), notes, width, height, attempt]),
    [accountId, anchor.id, anchor.enhancedImageUrl, art.svg, anchor.intentionText, statement, visionId, boardTiles, notes, width, height, attempt]);
  const beganRef = useRef(false);
  const preparedKey = useRef<string | null>(null);
  const onPrepared = useCallback((session: PreparedCinematicSession) => {
    preparedKey.current = preparationKey;
    acceptPrepared(session);
  }, [acceptPrepared, preparationKey]);
  const ready = prepared !== null && preparedKey.current === preparationKey;
  // Keep source Vision URLs stable in setup; frozen Skia assets are for the guided session. Swapping native photo
  // sources at readiness can turn a cached image into a failed reload.
  const board = useVisionBoardScene(boardTiles, scene, 1, true);
  const retry = () => { setPreparationIssue(null); setPrepared(null); setAttempt(value => value + 1); };

  // Turning sound on when the saved defaults are fully silent uses the
  // product defaults rather than starting a silent "sound on" session.
  const sessionVoice: GuidanceVoice = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedVoice : DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice) : 'none';
  // The guided track is the session's clock (it plays muted when sound is off), so a long track
  // that is not bundled must be on disk before Begin. Shorter tracks are bundled and always ready.
  const guidedAsset = useMemo(
    () => getGuidedTrackAsset(trackForDuration(duration as GuidedDurationSeconds), guideForVoice(sessionVoice)),
    [duration, sessionVoice],
  );
  const audio = useRemoteAudioReady([guidedAsset]);
  const canBegin = ready && audio.readiness === 'ready' && entrySettled;

  // Begin: settings lock, the chrome fades around the collage, then the session takes the same frame.
  const darken = useSharedValue(0);
  const frameRef = useRef<View>(null);
  const rootRef = useRef<View>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryProgress = useSharedValue(0);
  const entryNotesOpacity = useSharedValue(1);
  const entryCardOpacity = useSharedValue(1);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - darken.value * 1.6) }));
  const entryFrameStyle = useAnimatedStyle(() => {
    if (!entryMotion) return { opacity: 0 };
    const progress = entryProgress.value;
    const lerp = (from: number, to: number) => from + (to - from) * progress;
    return { position: 'absolute', left: lerp(entryMotion.from.x, entryMotion.to.x), top: lerp(entryMotion.from.y, entryMotion.to.y),
      width: lerp(entryMotion.from.width, entryMotion.to.width), height: lerp(entryMotion.from.height, entryMotion.to.height), opacity: 1 };
  }, [entryMotion]);
  const entrySceneStyle = useAnimatedStyle(() => {
    if (!entryMotion) return { transform: [{ scale: 0 }] };
    const transform = visualizeEntrySceneTransform(entryProgress.value, entryMotion.from, photoFrame);
    return { left: transform.left, top: transform.top, transform: [{ scale: transform.scale }] };
  }, [entryMotion, photoFrame.scale, scene]);

  const finishEntry = useCallback(() => {
    setEntrySettled(true);
    setEntryMotion(null);
  }, []);

  useEffect(() => {
    if (!entry?.sourceFrame || entrySettled || entryTargetMeasured || !frameLayoutReady || !photosWarm) return;
    const root = rootRef.current;
    const target = frameRef.current;
    if (!root?.measureInWindow || !target?.measureInWindow) { setEntrySettled(true); return; }
    let active = true;
    const measurementTimeout = setTimeout(() => { active = false; setEntrySettled(true); }, 120);
    const source = entry.sourceFrame;
    root.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
      if (!active) return;
      if (rootWidth <= 0 || rootHeight <= 0) { clearTimeout(measurementTimeout); setEntrySettled(true); return; }
      target.measureInWindow((targetX, targetY, targetWidth, targetHeight) => {
        if (!active) return;
        clearTimeout(measurementTimeout);
        if (targetWidth <= 0 || targetHeight <= 0) { setEntrySettled(true); return; }
        const target = visualizePhotoSceneTarget({ x: targetX - rootX, y: targetY - rootY, width: targetWidth, height: targetHeight }, photoFrame);
        setEntryMotion({ from: { x: source.x - rootX, y: source.y - rootY, width: source.width, height: source.height }, to: target });
        setEntryTargetMeasured(true);
      });
    });
    return () => { active = false; clearTimeout(measurementTimeout); };
  }, [entry, entrySettled, entryTargetMeasured, frameLayoutReady, photoFrame, photosWarm, scene]);

  useEffect(() => {
    if (!entryMotion || !entryTargetMeasured) return undefined;
    cancelAnimation(entryProgress);
    entryProgress.value = 0;
    entryNotesOpacity.value = 1;
    entryCardOpacity.value = 1;
    if (reduceMotion) {
      entryProgress.value = 1;
      entryNotesOpacity.value = 0;
      entryCardOpacity.value = 0;
      finishEntry();
      return undefined;
    }
    const duration = VISUALIZE_BEGIN_TIMING.fadeMs;
    entryNotesOpacity.value = withTiming(0, { duration, easing: Easing.inOut(Easing.cubic) });
    entryCardOpacity.value = withTiming(0, { duration, easing: Easing.inOut(Easing.cubic) });
    entryProgress.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }, finished => {
      if (finished) runOnJS(finishEntry)();
    });
    return () => cancelAnimation(entryProgress);
  }, [entryMotion, entryTargetMeasured, entryCardOpacity, entryNotesOpacity, entryProgress, finishEntry, reduceMotion]);

  const begin = () => {
    if (beganRef.current || !canBegin || !prepared) return;
    beganRef.current = true;
    setBeginning(true);
    const voice = sessionVoice;
    const ambient = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedAmbient !== 'off' : true) : false;
    const start = (canvasFrame?: { x: number; y: number; width: number; height: number }) => {
      darken.value = reduceMotion ? 1 : withTiming(1, { duration: VISUALIZE_BEGIN_TIMING.fadeMs, easing: Easing.inOut(Easing.cubic) });
      timer.current = setTimeout(() => {
        onBegin({ durationSeconds: duration, voice, ambient, haptics: hapticsOn,
          prepared: { ...prepared, ...(canvasFrame ? { canvasFrame } : {}), beginAtMs: getVisualizeMonotonicNow() } });
      }, reduceMotion ? 0 : VISUALIZE_BEGIN_TIMING.fadeMs);
    };
    const node = frameRef.current;
    if (!node?.measureInWindow) { start(); return; }
    // The session begins from exactly where this collage is on screen. If it cannot be measured, it begins from rest.
    let settled = false;
    const fallback = setTimeout(() => { if (!settled) { settled = true; start(); } }, 120);
    // Window coordinates can have an origin below the top of the screen (Android keeps the status bar's offset). The
    // session is full-screen, so it receives the frame relative to this screen's own root.
    const measureFrame = (originX: number, originY: number) => node.measureInWindow((x, y, frameWidth, frameHeight) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      start(frameWidth > 0 && frameHeight > 0 ? { x: x - originX + photoFrame.sceneOriginX, y: y - originY + photoFrame.sceneOriginY, width: scene.width * photoFrame.scale, height: scene.height * photoFrame.scale } : undefined);
    });
    const root = rootRef.current;
    if (root?.measureInWindow) root.measureInWindow((rootX, rootY, rootWidth, rootHeight) =>
      (rootWidth > 0 && rootHeight > 0 ? measureFrame(rootX, rootY) : measureFrame(0, 0)));
    else measureFrame(0, 0);
  };

  const categoryColor = getCategoryColor(anchor.category);
  const locked = beginning;
  const entryActive = Boolean(entryMotion && !entrySettled);
  const setupStatus = boardTiles.length === 0 ? 'Add a Vision image before beginning.'
    : !ready ? (preparationIssue ?? 'Preparing your Vision...')
      : audio.readiness === 'downloading' ? "Downloading this session's audio..."
        : audio.readiness === 'failed' ? "This session's audio couldn't download. Check your connection, or choose a shorter session."
          : '';
  // While the entry flies, the overlay is the only Vision board mounted; the resting board takes over when it settles.
  const entryOverlay = entryActive ? (
    <Animated.View testID="v2-visualize-entry-overlay" pointerEvents="none" style={entryFrameStyle}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ position: 'absolute', width: scene.width, height: scene.height }, entrySceneStyle]}>
          <VisionBoardScene notes={entry?.notes} notesOpacity={entryNotesOpacity} intentionCardOpacity={entryCardOpacity}
            scene={scene} roster={board.roster} entering={board.entering} layout={board.layout} shared={board.shared}
            initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement} category={anchor.category}
            art={art} markAppearance="paper" reduceMotion />
        </Animated.View>
      </View>
    </Animated.View>
  ) : null;

  return (
    <V2PracticeSetupLayout
      testID="v2-practice-prepare-visualize"
      rootRef={rootRef}
      onBack={onBack}
      sidePadding={metrics.sidePadding}
      footerPaddingBottom={metrics.footerPaddingBottom}
      onScrollViewportLayout={onScrollViewportLayout}
      chromeStyle={fadeStyle}
      overlay={entryOverlay}
      footer={(
        <View>
          {/* One fixed-height slot for every status line: the copy changes, the Begin row below never moves. */}
          <View style={styles.statusSlot} accessibilityLiveRegion="polite">
            <Text style={styles.hint}>{setupStatus}</Text>
          </View>
          {preparationIssue ? <V2Button variant="secondary" onPress={retry} style={styles.hintAction}>Retry Vision</V2Button> : null}
          {boardTiles.length > 0 && ready && audio.readiness === 'failed' ? <V2Button variant="secondary" onPress={audio.retry} style={styles.hintAction}>Retry download</V2Button> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Begin Visualize"
            accessibilityState={{ disabled: boardTiles.length === 0 || !canBegin || locked }}
            disabled={boardTiles.length === 0 || !canBegin || locked}
            onPress={begin}
            style={({ pressed }) => [styles.begin, (boardTiles.length === 0 || !canBegin) && styles.beginDisabled, pressed && styles.pressed]}
          >
            <Eye size={20} color={ACCENT} />
            <Text style={styles.beginText}>Begin Visualize</Text>
            <ArrowRight size={20} color={colors.ink.text.primary} />
          </Pressable>
        </View>
      )}
    >
      <View style={styles.body}>
        <Animated.View testID="v2-visualize-prepare-heading" onLayout={onHeadingLayout} style={[styles.head, fadeStyle]}>
          <View style={styles.eyebrowWrap} accessible accessibilityRole="header" accessibilityLabel="Visualize">
            <Text style={styles.eyebrow} importantForAccessibility="no">VISUALIZE</Text>
            <View style={styles.eyebrowRule}><View style={styles.eyebrowDiamond} /></View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>Step into your Vision</Text>
          <Text style={styles.subtitle}>Step into the moments you’ve created and let them feel real.</Text>
        </Animated.View>

        <Pressable accessibilityRole="button" accessibilityLabel="Open this Anchor’s Vision" disabled={!onOpenVision || locked}
          onPress={() => onOpenVision?.(anchor.id)} style={styles.collageHit}>
          {/* Hidden until the layout is measured, so the photo box is never seen at its pre-measurement size. */}
          <View testID="v2-visualize-prepare-vision" style={{ width: photoFrame.width, height: photoFrame.height, overflow: 'hidden',
            opacity: entryActive || !frameLayoutReady ? 0 : 1 }}>
            <View ref={frameRef} collapsable={false} style={{ width: photoFrame.width, height: photoFrame.height, alignItems: 'center', justifyContent: 'center' }}>
              {entryActive ? null : (
                <View style={{ position: 'absolute', left: photoFrame.sceneLayoutLeft, top: photoFrame.sceneLayoutTop,
                  width: scene.width, height: scene.height, transform: [{ scale: photoFrame.scale }] }}>
                <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout}
                  shared={board.shared} initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement}
                  category={anchor.category} art={art} showAnchorMark={false} showIntentionCard={false} markAppearance="paper" reduceMotion />
                </View>
              )}
            </View>
          </View>
        </Pressable>

        <Animated.View style={[styles.identity, fadeStyle]}>
          <Text style={styles.intention} numberOfLines={2}>{anchor.intentionText}</Text>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={styles.category}>{categoryLabel(anchor.category).toUpperCase()}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.controls, fadeStyle]} pointerEvents={locked ? 'none' : 'auto'}>
          <View style={styles.divider} />
          <Text style={styles.label}>HOW LONG?</Text>
          <View style={styles.durations}>
            {V2_VISUALIZE_DURATIONS.map(option => {
              const selected = option === duration;
              return (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }}
                  accessibilityLabel={`${v2PracticeDurationLabel(option)}${selected ? ', selected' : ''}`}
                  onPress={() => setDuration(option)}
                  style={[styles.duration, selected && { borderColor: ACCENT, backgroundColor: `${ACCENT}1F` }]}>
                  <Text style={[styles.durationText, selected && { color: ACCENT, fontFamily: 'Inter-SemiBold' }]}>{v2PracticeDurationLabel(option)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.toggles}>
            <View style={styles.toggleRow}>
              <Volume2 size={22} color={colors.text.primary} strokeWidth={1.6} />
              <Text style={styles.toggleLabel}>Sound</Text>
              <Switch accessibilityLabel="Sound" value={soundOn} onValueChange={setSoundOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <Smartphone size={22} color={colors.text.primary} strokeWidth={1.6} />
              <Text style={styles.toggleLabel}>Haptics</Text>
              <Switch accessibilityLabel="Haptics" value={hapticsOn} onValueChange={setHapticsOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
          </View>
        </Animated.View>
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preparationSurface}>
        {/* Mounted after the entry has settled, so its texture decode never runs inside the fade. */}
        {boardTiles.length > 0 && entrySettled ? <V2CinematicSessionScreen key={preparationKey} anchor={anchor} accountId={accountId}
          tiles={boardTiles} notes={notes} statement={statement} visionId={visionId} durationSeconds={180} voice="none" ambient={false}
          haptics={false} source="practice_hub" prepareOnly onPrepared={onPrepared} onPreparationIssue={reportIssue}
          onExit={onBack} onContinue={() => undefined} /> : null}
      </View>
    </V2PracticeSetupLayout>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[1] },
  head: { alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  eyebrowWrap: { alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, letterSpacing: 2.4, color: ACCENT },
  eyebrowRule: { width: 120, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border.strong, alignItems: 'center', justifyContent: 'center' },
  eyebrowDiamond: { width: 5, height: 5, backgroundColor: colors.border.strong, transform: [{ rotate: '45deg' }] },
  title: { alignSelf: 'stretch', marginTop: spacing[1], fontFamily: SERIF, fontSize: 36, lineHeight: 40, letterSpacing: -0.7, textAlign: 'center', color: colors.text.primary },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text.secondary, maxWidth: 320 },
  collageHit: { alignItems: 'center' },
  identity: { alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  intention: { alignSelf: 'stretch', fontFamily: SERIF, fontSize: 25, lineHeight: 30, letterSpacing: -0.3, textAlign: 'center', color: colors.text.primary },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryDot: { width: 9, height: 9, borderRadius: 5 },
  category: { fontFamily: 'Inter-SemiBold', fontSize: 12, letterSpacing: 1.6, color: colors.text.secondary },
  controls: { alignSelf: 'stretch', gap: spacing[3] },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border.default },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 11, letterSpacing: 1.4, color: colors.text.secondary },
  durations: { flexDirection: 'row', gap: spacing[2] },
  duration: {
    flex: 1, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  durationText: { fontFamily: 'Inter-Regular', fontSize: 16, color: colors.text.primary },
  toggles: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface, paddingHorizontal: spacing[4] },
  toggleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  toggleLabel: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 16, color: colors.text.primary },
  toggleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.default },
  preparationSurface: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  statusSlot: { minHeight: 40, justifyContent: 'center', marginBottom: spacing[2] },
  hint: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.text.secondary },
  hintAction: { marginBottom: spacing[2] },
  begin: {
    minHeight: 58, borderRadius: 29, paddingHorizontal: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.ink.hairlineStrong,
  },
  beginDisabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.99 }] },
  beginText: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: colors.ink.text.primary },
});
