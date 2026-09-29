import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
// Gesture Handler's ScrollView takes part in gesture arbitration, so a lifted photo keeps the touch on Android.
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye, MoreHorizontal } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { useV2ReduceMotion } from '@/hooks/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { ChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { VisionHeaderRow, VisionIdentity, VisionInkBand, type VisionAnchorArt } from './VisionChrome';
import { VisionEnvironment } from './environment/VisionEnvironment';
import { VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS, visionDetailHint } from './visionGuidance';
import { VisionBoard } from './board/VisionBoard';
import { orderTiles, toSceneOrders } from './board/visionBoardReorder';
import { VISION_BOARD_MAX_IMAGES } from './board/visionBoardLayouts';
import { VisionAddSheet, type VisionAddChoice } from './VisionAddSheet';

type Props = {
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorImageUrl?: string | null;
  anchorArt?: VisionAnchorArt | null;
  description: string;
  tiles: V2VisionTile[];
  error?: string | null;
  onBack: () => void;
  onVisualize: () => void;
  onChart: () => void;
  /** Real Chart state for this Anchor; null when there is no route. */
  chartSummary?: ChartSummary | null;
  onUpdateDescription: (description: string) => Promise<boolean>;
  onReorder: (sceneOrders: Array<{ id: string; sortOrder: number }>) => Promise<boolean>;
  onRemove: (sceneId: string) => Promise<boolean>;
  /** Starts adding a photo the person chooses or takes; it is previewed before anything is saved. */
  onAddPhoto: (source: 'library' | 'camera') => void;
  /** Opens "Add to your Vision": describe a scene and choose a generated image. */
  onAddGenerate: () => void;
  /** Swaps one photo for one of the person's own, in the same place on the board. */
  onReplace: (sceneId: string) => Promise<void>;
  /** Opens image generation to choose a new image for this place on the board. */
  onRegenerate: (sceneId: string) => void;
  canGenerateMore: boolean;
  onArchive: () => Promise<boolean>;
  /** Scene ids on the board before images were added elsewhere; the board recomposes from them. */
  arrivedFrom?: string[] | null;
  testID?: string;
};

const PAGE_GUTTER = spacing[5];
/** The board runs nearly edge to edge: it is the hero. */
const BOARD_GUTTER = spacing[3];
/** Lets the screen transition finish before the board makes room for new images. */
const ARRIVAL_RECOMPOSE_DELAY_MS = 450;

export function V2SavedVision({
  chartSummary = null,
  anchorIntention, anchorCategory, anchorImageUrl, anchorArt, description, tiles, error,
  onBack, onVisualize, onChart, onUpdateDescription, onReorder, onRemove,
  onAddPhoto, onAddGenerate, onReplace, onRegenerate, canGenerateMore, onArchive, arrivedFrom = null, testID = 'v2-vision-screen',
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const boardWidth = Math.min(width - BOARD_GUTTER * 2, 520);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState(description);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  // Board edits show at once; the server catches up behind them.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => { setDraft(description); }, [description]);
  useEffect(() => {
    // The server has caught up with a local order, or the Vision changed underneath it.
    if (localOrder && tiles.map(tile => tile.sceneId).join('|') === localOrder.join('|')) setLocalOrder(null);
    if (pendingRemovals.size && [...pendingRemovals].some(id => !tiles.some(tile => tile.sceneId === id))) {
      setPendingRemovals(previous => new Set([...previous].filter(id => tiles.some(tile => tile.sceneId === id))));
    }
  }, [localOrder, pendingRemovals, tiles]);

  // A replacement keeps the old photo on the board until the new one exists,
  // then lays the new one into the same place: the board never recounts.
  const [replaceTarget, setReplaceTarget] = useState<{ oldId: string; index: number; knownIds: string[] } | null>(null);
  // Arriving back from image generation, the board starts as it was and then recomposes.
  const [arrivalSettled, setArrivalSettled] = useState(!arrivedFrom?.length);
  useEffect(() => {
    if (arrivalSettled) return;
    const timer = setTimeout(() => setArrivalSettled(true), ARRIVAL_RECOMPOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [arrivalSettled]);

  const boardTiles = useMemo(() => {
    let list = orderTiles(tiles.filter(tile => !pendingRemovals.has(tile.sceneId)), localOrder);
    if (!arrivalSettled && arrivedFrom?.length) {
      const before = list.filter(tile => arrivedFrom.includes(tile.sceneId));
      if (before.length) list = before;
    }
    if (replaceTarget) {
      const incoming = list.find(tile => !replaceTarget.knownIds.includes(tile.sceneId));
      if (incoming) {
        list = list.filter(tile => tile.sceneId !== replaceTarget.oldId && tile.sceneId !== incoming.sceneId);
        list.splice(Math.min(replaceTarget.index, list.length), 0, incoming);
      }
    }
    return list;
  }, [arrivalSettled, arrivedFrom, localOrder, pendingRemovals, replaceTarget, tiles]);

  const saveText = async () => {
    if (draft.trim().length < VISION_DESCRIPTION_MIN_CHARS || busy) { setNotice(`Describe your Vision in at least ${VISION_DESCRIPTION_MIN_CHARS} characters.`); return; }
    setBusy(true);
    const success = await onUpdateDescription(draft.trim());
    setBusy(false);
    if (success) { setNotice(null); setMode('view'); }
    else setNotice('Vision could not be updated. Please try again.');
  };

  const reorder = useCallback((sceneIds: string[]) => {
    const previous = localOrder;
    setLocalOrder(sceneIds);
    setNotice(null);
    void onReorder(toSceneOrders(sceneIds)).then(success => {
      if (success) return;
      setLocalOrder(previous);
      setNotice('Image order could not be saved.');
    });
  }, [localOrder, onReorder]);

  const remove = useCallback((sceneId: string) => {
    if (boardTiles.length <= 1) { setNotice('Keep at least one image in your Vision.'); return; }
    Alert.alert('Remove image?', 'This image will be removed from your Vision.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setNotice(null);
        setPendingRemovals(previous => new Set(previous).add(sceneId));
        void onRemove(sceneId).then(success => {
          if (success) return;
          setPendingRemovals(previous => new Set([...previous].filter(id => id !== sceneId)));
          setNotice('Image could not be removed.');
        });
      } },
    ]);
  }, [boardTiles.length, onRemove]);

  const replace = useCallback((sceneId: string) => {
    setReplaceTarget({
      oldId: sceneId,
      index: boardTiles.findIndex(tile => tile.sceneId === sceneId),
      knownIds: tiles.map(tile => tile.sceneId),
    });
    setBusy(true);
    setNotice(null);
    void onReplace(sceneId).finally(() => { setBusy(false); setReplaceTarget(null); });
  }, [boardTiles, onReplace, tiles]);

  const addImage = useCallback(() => setAddSheetOpen(true), []);
  const closeAddSheet = useCallback(() => setAddSheetOpen(false), []);
  const chooseAdd = useCallback((choice: VisionAddChoice) => {
    if (choice === 'generate') onAddGenerate();
    else onAddPhoto(choice);
  }, [onAddGenerate, onAddPhoto]);

  const archive = () => {
    setMenuOpen(false);
    Alert.alert('Archive Vision?', 'Your Vision and images will be kept in your account but removed from this Anchor.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => {
        setBusy(true);
        void onArchive().then(success => {
          if (!success) setNotice('Vision could not be archived.');
        }).finally(() => setBusy(false));
      } },
    ]);
  };

  const header = (
    <VisionHeaderRow title={mode === 'edit' ? 'Edit Vision' : 'Vision'}
      onBack={mode === 'view' ? onBack : () => { setMode('view'); setNotice(null); setDraft(description); }}
      utility={mode === 'view' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Vision options" hitSlop={8} onPress={() => setMenuOpen(value => !value)} style={styles.menuButton}>
          <MoreHorizontal size={22} color={colors.ink.text.primary} />
        </Pressable>
      ) : undefined} />
  );

  return (
    <View testID={testID} style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <VisionInkBand>
            <VisionEnvironment category={anchorCategory} boardWidth={boardWidth} reduceMotion={reduceMotion} />
            <View style={styles.bandContent}>
              {header}
              <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} showAnchor={false} />
            </View>
            {mode === 'view' ? (
              <View style={styles.boardWrap}>
                <VisionBoard
                  tiles={boardTiles}
                  intention={anchorIntention}
                  category={anchorCategory}
                  art={anchorArt}
                  width={boardWidth}
                  reduceMotion={reduceMotion}
                  busy={busy}
                  canRegenerate={canGenerateMore}
                  onReplace={replace}
                  onRegenerate={onRegenerate}
                  onRemove={remove}
                  onEditVision={() => setMode('edit')}
                  onReorder={reorder}
                  onAddImage={boardTiles.length < VISION_BOARD_MAX_IMAGES ? addImage : undefined}
                  onDragActive={setDragging}
                />
              </View>
            ) : <View style={styles.bandTail} />}
          </VisionInkBand>

          <View style={styles.body}>
            {mode === 'edit' ? (
              <>
                <Text style={styles.heading}>My Vision</Text>
                <TextInput testID="vision-edit-description" accessibilityLabel="Edit Vision description" multiline maxLength={VISION_DESCRIPTION_MAX_CHARS}
                  value={draft} onChangeText={setDraft} style={styles.textInput} textAlignVertical="top" />
                <View style={styles.meter}>
                  <Text style={styles.meterHint}>{visionDetailHint(draft) ?? ''}</Text>
                  <Text style={styles.counter}>{draft.length}/{VISION_DESCRIPTION_MAX_CHARS}</Text>
                </View>
                <V2Button size="large" disabled={busy || draft.trim().length < VISION_DESCRIPTION_MIN_CHARS} onPress={() => { void saveText(); }}>Save Vision</V2Button>
              </>
            ) : (
              <>
                <Text style={styles.heading}>My Vision</Text>
                <Text style={styles.description}>{description}</Text>
                <V2Button size="large" accessibilityLabel="Begin Visualize" onPress={onVisualize} style={styles.visualize}
                  iconLeft={<Eye size={18} color={practiceColors.visualize} />} iconRight={<ArrowRight size={17} color={colors.paper} />}>
                  Begin Visualize
                </V2Button>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={chartSummary
                    ? `On your Chart: ${chartSummary.isFinished ? 'destination reached' : `waypoint ${chartSummary.waypointNumber} of ${chartSummary.total}, ${chartSummary.waypointTitle}`}. View Chart.`
                    : 'On your Chart: no route yet. Create a Chart.'}
                  onPress={onChart}
                  testID="vision-on-your-chart"
                  style={({ pressed }) => [styles.chartCard, pressed && styles.pressed]}
                >
                  <Text style={styles.chartEyebrow}>ON YOUR CHART</Text>
                  {chartSummary ? (
                    <>
                      <Text style={styles.chartPosition}>
                        {chartSummary.isFinished ? 'Destination reached' : `Waypoint ${chartSummary.waypointNumber} of ${chartSummary.total}`}
                      </Text>
                      <Text style={styles.chartTitle}>{chartSummary.waypointTitle}</Text>
                    </>
                  ) : (
                    <Text style={styles.chartPosition}>Map the route from here to this Vision.</Text>
                  )}
                  <View style={styles.chartLink}>
                    <Text style={styles.chartLinkText}>{chartSummary ? 'View Chart' : 'Create a Chart'}</Text>
                    <ArrowRight size={15} color={colors.text.primary} />
                  </View>
                </Pressable>
              </>
            )}
            {(notice || error) && <Text style={styles.error}>{notice || error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <VisionAddSheet visible={addSheetOpen} onClose={closeAddSheet} onChoose={chooseAdd} />
      {menuOpen && mode === 'view' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Archive Vision" onPress={archive} style={[styles.menu, { top: insets.top + 50 }]}>
          <Text style={styles.archiveText}>Archive Vision</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  bandContent: { paddingHorizontal: PAGE_GUTTER, gap: spacing[4] },
  boardWrap: { paddingHorizontal: BOARD_GUTTER, paddingTop: spacing[4], alignItems: 'center' },
  bandTail: { height: spacing[5] },
  menuButton: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  menu: { position: 'absolute', right: 18, zIndex: 5, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.md },
  archiveText: { ...typography.labelMD, color: colors.semantic.error },
  body: { paddingHorizontal: PAGE_GUTTER, paddingTop: spacing[5], gap: spacing[3] },
  heading: { ...typography.headingMD, color: colors.text.primary },
  description: { ...typography.bodyMD, color: colors.text.primary, lineHeight: 23 },
  visualize: { marginTop: spacing[2] },
  pressed: { opacity: 0.72 },
  textInput: { ...typography.bodyMD, color: colors.text.primary, minHeight: 168, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface, padding: spacing[4] },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  counter: { ...typography.caption, color: colors.text.tertiary },
  error: { ...typography.caption, color: colors.semantic.error },
  chartCard: {
    marginTop: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
    gap: 4,
  },
  chartEyebrow: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1.1 },
  chartPosition: { ...typography.labelMD, color: colors.text.secondary, marginTop: spacing[1] },
  chartTitle: { ...typography.headingSM, color: colors.text.primary },
  chartLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] },
  chartLinkText: { ...typography.labelMD, color: colors.text.primary },
});
