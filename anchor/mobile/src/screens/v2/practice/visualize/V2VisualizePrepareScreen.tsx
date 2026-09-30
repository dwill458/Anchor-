import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { VisionHeaderRow, VisionIdentity, VisionInkBand } from '@/components/v2/vision/VisionChrome';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { boardSizeForWidth, VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';
import { v2PracticeDurationLabel } from '@/constants/v2/practice';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { DEFAULT_SESSION_AUDIO_DEFAULTS, type BackgroundAudioMode, type GuidanceVoice } from '@/types/sessionAudio';
import type { Anchor } from '@/types';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { V2_VISUALIZE_DURATIONS } from './visualizeVisionPlan';
import { V2CinematicSessionScreen, type PreparedCinematicSession } from './V2CinematicSessionScreen';
import { getVisualizeMonotonicNow } from '@/screens/visualize/useVisualizeSessionEngine';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorTransitionPlace } from '@/navigation/v2/ProgressiveFocusTransition';

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
  tiles: V2VisionTile[];
  initialDuration?: number;
  onBack: () => void;
  onOpenVision?: (anchorId: string) => void;
  onBegin: (config: V2VisualizeBeginConfig) => void;
  /** The shared Anchor transition darkens setup and carries the Anchor into the session. */
  anchorHandoff?: boolean;
};

const ACCENT = practiceColors.visualize;

/**
 * Visualize setup. The person is here to see their Vision, so the Vision's
 * photography is the hero and the Anchor is a small line of provenance.
 * Sound and haptics apply to this session only; saved defaults are untouched.
 */
export function V2VisualizePrepareScreen({ anchor, statement, visionId, tiles, initialDuration, onBack, onOpenVision, onBegin }: Props) {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const [prepared, setPrepared] = useState<PreparedCinematicSession | null>(null);
  const [preparationIssue, setPreparationIssue] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [useAvailable, setUseAvailable] = useState<(() => void) | null>(null);
  const offerAvailable = useCallback((useImages: () => void) => setUseAvailable(() => useImages), []);
  const acceptPrepared = useCallback((session: PreparedCinematicSession) => {
    setPrepared(session); setPreparationIssue(null); setUseAvailable(null);
  }, []);
  const reportIssue = useCallback((message: string) => setPreparationIssue(message), []);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const defaults = useSettingsStore(state => state.sessionAudioDefaults?.visualize);
  const hapticIntensity = useSettingsStore(state => state.hapticIntensity);
  const savedVoice: GuidanceVoice = defaults?.guidanceVoice ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice;
  const savedAmbient: BackgroundAudioMode = defaults?.backgroundAudio ?? DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.backgroundAudio;
  const [duration, setDuration] = useState<number>(
    initialDuration && (V2_VISUALIZE_DURATIONS as readonly number[]).includes(initialDuration) ? initialDuration : 180,
  );
  const [soundOn, setSoundOn] = useState(savedVoice !== 'none' || savedAmbient !== 'off');
  const [hapticsOn, setHapticsOn] = useState((hapticIntensity ?? 70) > 0);
  // Visualize keeps the saved SVG as its only Anchor source across identity,
  // transition, board, and cinematic stage. Do not substitute raster/expression art.
  const art = useMemo(() => anchorRenderProps(anchor), [anchor]);
  const place = useAnchorTransitionPlace('practiceSetup', anchor.id, 'paper', { measureDelayMs: Platform.OS === 'android' ? 120 : 0 });
  const boardTiles = useMemo(() => tiles.filter(tile => Boolean(tile.imageUrl)).slice(0, VISION_BOARD_MAX_IMAGES), [tiles]);
  const boardSize = useMemo(() => boardSizeForWidth(width - spacing[5] * 2), [width]);

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
  const board = useVisionBoardScene(ready ? prepared.assets.tiles : boardTiles, boardSize);
  const retry = () => { setUseAvailable(null); setPreparationIssue(null); setPrepared(null); setAttempt(value => value + 1); };

  const begin = () => {
    if (beganRef.current || !ready || !prepared) return;
    beganRef.current = true;
    // Turning sound on when the saved defaults are fully silent uses the
    // product defaults rather than starting a silent "sound on" session.
    const voice: GuidanceVoice = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedVoice : DEFAULT_SESSION_AUDIO_DEFAULTS.visualize.guidanceVoice) : 'none';
    const ambient = soundOn ? (savedVoice !== 'none' || savedAmbient !== 'off' ? savedAmbient !== 'off' : true) : false;
    onBegin({ durationSeconds: duration, voice, ambient, haptics: hapticsOn, prepared: { ...prepared, beginAtMs: getVisualizeMonotonicNow() } });
  };

  return (
    <View testID="v2-practice-prepare-visualize" style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <VisionInkBand fadeTo={colors.ink.deep}>
          <View style={styles.band}>
            <VisionHeaderRow title="Visualize" onBack={onBack} backLabel="Back to Practice" />
            <VisionIdentity intention={anchor.intentionText} category={anchor.category} art={art} artworkPlace={place} />
            <Text accessibilityRole="header" style={styles.title}>Step into your Vision.</Text>
            <Text style={styles.subtitle}>Step into the moments you’ve created and let them feel real.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open this Anchor’s Vision" disabled={!onOpenVision}
              onPress={() => onOpenVision?.(anchor.id)} style={({ pressed }) => [pressed && styles.pressed]}>
              <View testID="v2-visualize-prepare-vision" style={[styles.board, { width: boardSize.width, height: boardSize.height }]}>
                <VisionBoardScene scene={boardSize} roster={board.roster} entering={board.entering} layout={board.layout}
                  shared={board.shared} initialRectFor={board.initialRectFor} intention={anchor.intentionText || statement}
                  category={anchor.category} art={art} reduceMotion onAddPress={onOpenVision ? () => onOpenVision(anchor.id) : undefined} />
              </View>
            </Pressable>
          </View>
        </VisionInkBand>

        <View style={styles.controls}>
          <Text style={styles.label}>HOW LONG?</Text>
          <View style={styles.durations}>
            {V2_VISUALIZE_DURATIONS.map(option => {
              const selected = option === duration;
              return (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }}
                  accessibilityLabel={`${v2PracticeDurationLabel(option)}${selected ? ', selected' : ''}`}
                  onPress={() => setDuration(option)}
                  style={[styles.duration, selected && { borderColor: ACCENT, backgroundColor: `${ACCENT}14` }]}>
                  <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{v2PracticeDurationLabel(option)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.toggles}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sound</Text>
              <Switch accessibilityLabel="Sound" value={soundOn} onValueChange={setSoundOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Haptics</Text>
              <Switch accessibilityLabel="Haptics" value={hapticsOn} onValueChange={setHapticsOn}
                trackColor={{ true: ACCENT, false: colors.border.default }} thumbColor={colors.paper} ios_backgroundColor={colors.border.default} />
            </View>
          </View>
        </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        {boardTiles.length === 0 ? <Text style={styles.emptyHint}>Add a Vision image before beginning.</Text> : null}
        {boardTiles.length > 0 && !ready ? <Text accessibilityLiveRegion="polite" style={styles.emptyHint}>
          {preparationIssue ?? 'Preparing your Vision...'}
        </Text> : null}
        {useAvailable && !ready ? <V2Button variant="secondary" onPress={useAvailable}>Continue with available images</V2Button> : null}
        {preparationIssue ? <V2Button variant="secondary" onPress={retry}>Retry Vision</V2Button> : null}
        <V2Button size="large" accessibilityLabel="Begin Visualize" onPress={begin} disabled={boardTiles.length === 0 || !ready || beganRef.current}
          style={styles.beginButton} iconLeft={<Eye size={18} color={ACCENT} />} iconRight={<ArrowRight size={17} color={colors.paper} />}>
          Begin Visualize
        </V2Button>
      </View>
      </ScrollView>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={styles.preparationSurface}>
        {boardTiles.length > 0 ? <V2CinematicSessionScreen key={preparationKey} anchor={anchor} accountId={accountId}
          tiles={boardTiles} statement={statement} visionId={visionId} durationSeconds={180} voice="none" ambient={false}
          haptics={false} source="practice_hub" prepareOnly onPrepared={onPrepared} onPreparationIssue={reportIssue} onAvailableImages={offerAvailable}
          onExit={onBack} onContinue={() => undefined} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink.deep },
  scroll: { paddingBottom: spacing[5] },
  band: { paddingHorizontal: spacing[5], gap: spacing[3], paddingBottom: spacing[2] },
  // The board leads; introductory copy stays subordinate to the photographs.
  title: { ...typography.headingLG, color: colors.ink.text.primary, marginTop: spacing[4] },
  subtitle: { ...typography.bodyLG, color: colors.ink.text.secondary, maxWidth: 320 },
  board: { marginTop: spacing[3], borderRadius: radii.lg, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  controls: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[2] },
  label: { ...typography.labelSM, fontSize: 10, letterSpacing: 0.8, color: colors.ink.text.secondary },
  durations: { flexDirection: 'row', gap: spacing[1], padding: spacing[1], borderRadius: radii.md, backgroundColor: colors.ink.raised, marginBottom: spacing[2] },
  duration: { flex: 1, minHeight: 44, borderRadius: radii.sm, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  durationText: { ...typography.labelMD, color: colors.ink.text.primary },
  durationTextSelected: { fontFamily: typography.utilityBold.fontFamily, color: ACCENT },
  preparationSurface: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  toggles: { paddingHorizontal: spacing[1] },
  toggleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { ...typography.bodyMD, color: colors.ink.text.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[3], backgroundColor: colors.ink.deep },
  beginButton: { borderWidth: 1, borderColor: colors.ink.hairlineStrong },
  emptyHint: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center', marginBottom: spacing[2] },
});
