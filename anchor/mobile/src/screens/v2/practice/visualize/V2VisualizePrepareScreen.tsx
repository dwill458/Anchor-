import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowRight, Eye, Smartphone, Volume2 } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2PracticeSetupLayout } from '@/components/v2/practice/V2PracticeSetupLayout';
import { resolvePracticeSetupMetrics } from '@/components/v2/practice/practiceSetupLayout';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { boardSizeForWidth } from '@/components/v2/vision/board/visionBoardLayouts';
import { v2PracticeDurationLabel } from '@/constants/v2/practice';
import { useV2ReduceMotion, useV2Responsive } from '@/hooks/v2';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, getCategoryColor, radii, spacing } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { DEFAULT_SESSION_AUDIO_DEFAULTS, type BackgroundAudioMode, type GuidanceVoice } from '@/types/sessionAudio';
import type { Anchor } from '@/types';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { V2_VISUALIZE_DURATIONS } from './visualizeVisionPlan';
import { V2CinematicSessionScreen, type PreparedCinematicSession } from './V2CinematicSessionScreen';
import { getVisualizeMonotonicNow } from '@/screens/visualize/useVisualizeSessionEngine';
import { useAuthStore } from '@/stores/authStore';

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
  initialDuration?: number;
  onBack: () => void;
  onOpenVision?: (anchorId: string) => void;
  onBegin: (config: V2VisualizeBeginConfig) => void;
  /** The shared Anchor transition carries Begin into the session; setup skips its own hand-off. */
  anchorHandoff?: boolean;
};

const ACCENT = practiceColors.visualize;
const SERIF = 'EBGaramond-Medium';
/** Where the lower photographs of the shared board composition end, as a share of its width. */
const COLLAGE_CROP_RATIO = 1.45;
/**
 * The hand-off into the session. The setup's chrome fades while the collage stays exactly where it is on the same
 * cream page: the session opens on that very board, then the camera carries it into the first photograph.
 * (Darkening the page first made the session's cream opening flash.)
 */
export const VISUALIZE_BEGIN_TIMING = { fadeMs: 360 } as const;

/** What of the shared board is shown: all of a one-photo board, the photographs of a larger one. */
export function visualizeCollageCrop(imageCount: number, width: number): { sceneHeight: number; visibleHeight: number } {
  const sceneHeight = boardSizeForWidth(width, imageCount).height;
  return { sceneHeight, visibleHeight: Math.min(sceneHeight, width * COLLAGE_CROP_RATIO) };
}

/**
 * Visualize setup. Cream means configuring a Practice; the person's own Vision
 * is the hero (the same board composition as the Vision screen, in the same
 * order), their real Anchor sits on it, and Begin darkens the page into the
 * session without a cut. Sound and haptics apply to this session only.
 */
export function V2VisualizePrepareScreen({ anchor, statement, visionId, tiles, initialDuration, onBack, onOpenVision, onBegin }: Props) {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const viewport = useV2Responsive();
  const metrics = resolvePracticeSetupMetrics(viewport, 'hero');
  const { width, height } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
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
  // Visualize keeps the saved SVG as its only Anchor source across setup and session.
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);
  const boardTiles = useMemo(() => tiles.filter(tile => Boolean(tile.imageUrl)), [tiles]);

  // The collage is the Vision's board composition at a width that keeps the controls in reach.
  const contentWidth = width - metrics.sidePadding * 2;
  const cropRatio = Math.min(boardSizeForWidth(1, boardTiles.length).height, COLLAGE_CROP_RATIO);
  const collageWidth = Math.round(Math.min(contentWidth, (height * 0.54) / cropRatio));
  const { sceneHeight, visibleHeight } = useMemo(() => visualizeCollageCrop(boardTiles.length, collageWidth), [boardTiles.length, collageWidth]);
  const scene = useMemo(() => ({ width: collageWidth, height: sceneHeight }), [collageWidth, sceneHeight]);

  // Keep the real setup board visible while the exact session textures and geometry prepare.
  const preparationKey = useMemo(() => JSON.stringify([accountId, anchor.id, anchor.enhancedImageUrl, art.svg,
    anchor.intentionText, statement, visionId, boardTiles.map(tile => [tile.sceneId, tile.imageUrl]), width, height, attempt]),
    [accountId, anchor.id, anchor.enhancedImageUrl, art.svg, anchor.intentionText, statement, visionId, boardTiles, width, height, attempt]);
  const beganRef = useRef(false);
  const preparedKey = useRef<string | null>(null);
  const onPrepared = useCallback((session: PreparedCinematicSession) => {
    preparedKey.current = preparationKey;
    acceptPrepared(session);
  }, [acceptPrepared, preparationKey]);
  const ready = prepared !== null && preparedKey.current === preparationKey;
  const board = useVisionBoardScene(ready ? prepared.assets.tiles : boardTiles, scene);
  const retry = () => { setPreparationIssue(null); setPrepared(null); setAttempt(value => value + 1); };

  // Begin: settings lock, the chrome fades around the collage, then the session takes the same frame.
  const darken = useSharedValue(0);
  const frameRef = useRef<View>(null);
  const rootRef = useRef<View>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - darken.value * 1.6) }));

  const begin = () => {
    if (beganRef.current || !ready || !prepared) return;
    beganRef.current = true;
    setBeginning(true);
    // Turning sound on when the saved defaults are fully silent uses the
    // product defaults rather than starting a silent "sound on" session.
    const voice: GuidanceVoice = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedVoice : DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice) : 'none';
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
      start(frameWidth > 0 && frameHeight > 0 ? { x: x - originX, y: y - originY, width: frameWidth, height: frameHeight } : undefined);
    });
    const root = rootRef.current;
    if (root?.measureInWindow) root.measureInWindow((rootX, rootY, rootWidth, rootHeight) =>
      (rootWidth > 0 && rootHeight > 0 ? measureFrame(rootX, rootY) : measureFrame(0, 0)));
    else measureFrame(0, 0);
  };

  const categoryColor = getCategoryColor(anchor.category);
  const locked = beginning;

  return (
    <V2PracticeSetupLayout
      testID="v2-practice-prepare-visualize"
      rootRef={rootRef}
      onBack={onBack}
      sidePadding={metrics.sidePadding}
      footerPaddingBottom={metrics.footerPaddingBottom}
      chromeStyle={fadeStyle}
      footer={(
        <View>
          {boardTiles.length === 0 ? <Text style={styles.hint}>Add a Vision image before beginning.</Text> : null}
          {boardTiles.length > 0 && !ready ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{preparationIssue ?? 'Preparing your Vision...'}</Text> : null}
          {preparationIssue ? <V2Button variant="secondary" onPress={retry} style={styles.hintAction}>Retry Vision</V2Button> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Begin Visualize"
            accessibilityState={{ disabled: boardTiles.length === 0 || !ready || locked }}
            disabled={boardTiles.length === 0 || !ready || locked}
            onPress={begin}
            style={({ pressed }) => [styles.begin, (boardTiles.length === 0 || !ready) && styles.beginDisabled, pressed && styles.pressed]}
          >
            <Eye size={20} color={ACCENT} />
            <Text style={styles.beginText}>Begin Visualize</Text>
            <ArrowRight size={20} color={colors.ink.text.primary} />
          </Pressable>
        </View>
      )}
    >
      <View style={styles.body}>
        <Animated.View style={[styles.head, fadeStyle]}>
          <View style={styles.eyebrowWrap} accessible accessibilityRole="header" accessibilityLabel="Visualize">
            <Text style={styles.eyebrow} importantForAccessibility="no">VISUALIZE</Text>
            <View style={styles.eyebrowRule}><View style={styles.eyebrowDiamond} /></View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>Step into your Vision</Text>
          <Text style={styles.subtitle}>Step into the moments you’ve created and let them feel real.</Text>
        </Animated.View>

        <Pressable accessibilityRole="button" accessibilityLabel="Open this Anchor’s Vision" disabled={!onOpenVision || locked}
          onPress={() => onOpenVision?.(anchor.id)} style={styles.collageHit}>
          <View testID="v2-visualize-prepare-vision" style={{ width: collageWidth, height: visibleHeight, overflow: 'hidden' }}>
            <View ref={frameRef} collapsable={false} style={{ width: scene.width, height: scene.height }}>
              <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout}
                shared={board.shared} initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement}
                category={anchor.category} art={art} markAppearance="paper" reduceMotion />
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
        {boardTiles.length > 0 ? <V2CinematicSessionScreen key={preparationKey} anchor={anchor} accountId={accountId}
          tiles={boardTiles} statement={statement} visionId={visionId} durationSeconds={180} voice="none" ambient={false}
          haptics={false} source="practice_hub" prepareOnly onPrepared={onPrepared} onPreparationIssue={reportIssue}
          onExit={onBack} onContinue={() => undefined} /> : null}
      </View>
    </V2PracticeSetupLayout>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing[4], paddingTop: spacing[1] },
  head: { alignItems: 'center', gap: spacing[2], alignSelf: 'stretch' },
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
  hint: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.text.secondary, marginBottom: spacing[2] },
  hintAction: { marginBottom: spacing[2] },
  begin: {
    minHeight: 58, borderRadius: 29, paddingHorizontal: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.ink.hairlineStrong,
  },
  beginDisabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.99 }] },
  beginText: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: colors.ink.text.primary },
});
