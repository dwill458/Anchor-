import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, StatusBar, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
// Gesture Handler's ScrollView takes part in gesture arbitration, so a lifted photo keeps the touch on Android.
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ChevronDown, Eye, MoreHorizontal } from 'lucide-react-native';
import { VisionChartLink } from './VisionChartLink';
import { VisionIntentionHeading } from './VisionIntentionHeading';
import { truncateVisionText } from './visionDetailText';
import { V2Button } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { useV2ReduceMotion } from '@/hooks/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionNote, VisionNotePresentation } from '@/adapters/v2/vision';
import type { ChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { VISION_GOLD, VISION_SERIF_ITALIC } from './VisionPaperChrome';
import { VisionHeaderRow, VisionStatusBarScrim, type VisionAnchorArt } from './VisionChrome';
import { VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS, visionDetailHint } from './visionGuidance';
import { detailBoardSizeForWidth } from './board/visionBoardLayouts';
import { VisionBoard } from './board/VisionBoard';
import { VisionPhotoCaptionEditor } from './board/VisionPhotoCaptionEditor';
import { orderTiles, toSceneOrders } from './board/visionBoardReorder';
import { VisionArrivalDestination, useVisionImageArrival } from './VisionImageArrival';
import { VisionAddSheet, type VisionAddChoice } from './VisionAddSheet';
import { visionCeremonyCopy } from './ceremony/visionCeremonyCopy';
import { useAuthStore } from '@/stores/authStore';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { setTeachingSeen } from '@/hooks/v2/teaching/teachingSeen';
import { visionTeachingBeats } from '@/hooks/v2/teaching/visionTeaching';
import { ScreenTeaching } from '@/components/v2/teaching/ScreenTeaching';
import { scrollToTarget, type TeachingRect } from '@/components/v2/teaching/scrollToTarget';

type Props = {
  justAdded?: 'create' | 'add';
  arrivingNoteId?: string;
  arrivingSceneId?: string | null;
  onAddImage?: () => void;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorImageUrl?: string | null;
  anchorArt?: VisionAnchorArt | null;
  initialEdit?: boolean;
  description: string;
  annotation?: string;
  onUpdateAnnotation?: (annotation: string) => Promise<boolean>;
  tiles: V2VisionTile[];
  notes?: readonly VisionNote[];
  onNotePresentationChange?: (id: string, presentation: VisionNotePresentation) => Promise<boolean>;
  onNoteEdit?: (id: string) => void;
  onNoteDelete?: (id: string) => void;
  onUpdateSceneCaption?: (sceneId: string, caption: string | null) => Promise<boolean>;
  error?: string | null;
  onBack: () => void;
  onShare?: () => void;
  onVisualize: (frame?: { x: number; y: number; width: number; height: number; sceneWidth?: number; sceneHeight?: number }) => void;
  visualizeReady?: boolean;
  preparationIssue?: string | null;
  onRetryVisualize?: () => void;
  onUseAvailableImages?: () => void;
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
  teachingEnabled?: boolean;
  teachingBlocked?: boolean;
  teachingSceneId?: string | null;
};

const PAGE_GUTTER = spacing[5];
/** The board runs nearly edge to edge: it is the hero. */
const BOARD_GUTTER = spacing[3];
/** Lets the screen transition finish before the board makes room for new images. */
const ARRIVAL_RECOMPOSE_DELAY_MS = 450;

export function V2SavedVision({
  chartSummary = null, visualizeReady = true, preparationIssue, onRetryVisualize, onUseAvailableImages,
  anchorIntention, anchorCategory, anchorImageUrl, anchorArt, description, annotation = '', onUpdateAnnotation, onUpdateSceneCaption, tiles, notes = [], onNotePresentationChange, onNoteEdit, onNoteDelete, error, initialEdit = false,
  onBack, onShare, onVisualize, onChart, onUpdateDescription, onReorder, onRemove,
  onAddPhoto, onAddGenerate, onAddImage, justAdded, arrivingSceneId, arrivingNoteId, onReplace, onRegenerate, canGenerateMore, onArchive, arrivedFrom = null, testID = 'v2-vision-screen', teachingEnabled = false, teachingBlocked = false, teachingSceneId = null,
}: Props) {
  const canvasRef = useRef<View>(null);
  const canvasCapture = useRef<(() => { x: number; y: number; width: number; height: number; sceneWidth?: number; sceneHeight?: number }) | null>(null);
  const canvasBounds = useRef<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const measureCanvas = () => canvasRef.current?.measureInWindow?.((x, y, width, height) => {
    if (width > 0 && height > 0) canvasBounds.current = { x, y, width, height };
  });
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const boardWidth = Math.min(width - BOARD_GUTTER * 2, 520);
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(() => truncateVisionText(description), [description]);
  const truncated = preview !== description;
  const [annotationDraft, setAnnotationDraft] = useState(annotation);
  const [manageImages, setManageImages] = useState(false);
  const [captionSceneId, setCaptionSceneId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(initialEdit ? 'edit' : 'view');
  const [draft, setDraft] = useState(description);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [nativeAlertOpen, setNativeAlertOpen] = useState(false);
  const [boardIdle, setBoardIdle] = useState(false);
  const [teachingScrolling, setTeachingScrolling] = useState(false);
  const teachingFocus = useTeachingFocus();
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const imageArrival = useVisionImageArrival();
  const teachingTarget = useRef<((sceneId: string | null) => Promise<TeachingRect | null>) | null>(null);
  const teachingScrollRef = useRef<ScrollView>(null);
  const teachingScrollMetrics = useRef({ y: 0, content: 0, viewport: 0 });
  const teachingControlledScroll = useRef(false);
  const revealedNote = useRef<string | null>(null);
  useEffect(() => {
    if (!arrivingNoteId || revealedNote.current === arrivingNoteId) return;
    const note = notes.find(item => item.id === arrivingNoteId && !item.isArchived);
    if (!note) return;
    const timer = setTimeout(() => {
      canvasRef.current?.measureInWindow?.((_x, y, _width, height) => {
        if (height <= 0) return;
        revealedNote.current = arrivingNoteId;
        const metrics = teachingScrollMetrics.current;
        const noteY = note.presentation.y * detailBoardSizeForWidth(boardWidth, tiles.length).height;
        const target = metrics.y + y + noteY - metrics.viewport * 0.45;
        teachingScrollRef.current?.scrollTo({ y: Math.max(0, Math.min(metrics.content - metrics.viewport, target)), animated: !reduceMotion });
      });
    }, reduceMotion ? 0 : 320);
    return () => clearTimeout(timer);
  }, [arrivingNoteId, boardWidth, notes, reduceMotion, tiles.length]);

  // Board edits show at once; the server catches up behind them.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => { setDraft(description); }, [description]);
  useEffect(() => { setAnnotationDraft(annotation); }, [annotation]);
  useEffect(() => { setExpanded(false); }, [description]);
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
  const visionTeachingBlocked = !teachingEnabled || teachingBlocked || teachingFocus.transitioning ||
    !arrivalSettled || Boolean(imageArrival?.url) || !boardIdle || dragging || busy || menuOpen || addSheetOpen ||
    nativeAlertOpen || mode !== 'view' || manageImages || teachingScrolling;
  useEffect(() => {
    if (teachingEnabled && boardTiles.length >= 2 && !visionTeachingBlocked) setTeachingSeen(teachingAccountId, 'vision.first');
  }, [teachingEnabled, boardTiles.length, visionTeachingBlocked, teachingAccountId]);
  const teachingQueue = useTeachingQueue({ screenId: 'vision', accountId: teachingAccountId,
    eligible: visionTeachingBeats(boardTiles.length), cap: 2, blocked: visionTeachingBlocked, isFocused: teachingFocus.isFocused });
  const getTeachingPhotoRect = useCallback(async () => {
    teachingControlledScroll.current = true;
    try {
      await scrollToTarget(canvasRef, teachingScrollRef, () => ({ y: teachingScrollMetrics.current.y, max: Math.max(0, teachingScrollMetrics.current.content - teachingScrollMetrics.current.viewport), viewportTop: 0 }), reduceMotion);
      const sceneId = teachingSceneId ?? arrivingSceneId ?? boardTiles[boardTiles.length - 1]?.sceneId ?? null;
      return await teachingTarget.current?.(sceneId) ?? null;
    } finally { teachingControlledScroll.current = false; }
  }, [teachingSceneId, arrivingSceneId, boardTiles, reduceMotion]);

  const saveText = async () => {
    if (draft.trim().length < VISION_DESCRIPTION_MIN_CHARS || busy) { setNotice(`Describe your Vision in at least ${VISION_DESCRIPTION_MIN_CHARS} characters.`); return; }
    setBusy(true);
    const captionSaved = !onUpdateAnnotation || annotationDraft.trim() === annotation || await onUpdateAnnotation(annotationDraft.trim());
    const success = captionSaved && await onUpdateDescription(draft.trim());
    setBusy(false);
    if (success) { setNotice(null); setMode('view'); }
    else setNotice('Vision could not be updated. Please try again.');
  };

  const reorder = useCallback((sceneIds: string[]) => {
    const previous = localOrder;
    setLocalOrder(sceneIds);
    setNotice(null);
    void onReorder(toSceneOrders([...sceneIds, ...boardTiles.map(tile => tile.sceneId).filter(id => !sceneIds.includes(id))])).then(success => {
      if (success) return;
      setLocalOrder(previous);
      setNotice('Image order could not be saved.');
    });
  }, [boardTiles, localOrder, onReorder]);

  const remove = useCallback((sceneId: string) => {
    if (boardTiles.length <= 1) { setNotice('Keep at least one image in your Vision.'); return; }
    setNativeAlertOpen(true);
    Alert.alert('Remove image?', 'This image will be removed from your Vision.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setNativeAlertOpen(false) },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setNativeAlertOpen(false);
        setNotice(null);
        setPendingRemovals(previous => new Set(previous).add(sceneId));
        void onRemove(sceneId).then(success => {
          if (success) return;
          setPendingRemovals(previous => new Set([...previous].filter(id => id !== sceneId)));
          setNotice('Image could not be removed.');
        });
      } },
    ], { onDismiss: () => setNativeAlertOpen(false) });
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

  const addImage = useCallback(() => (onAddImage ?? onAddGenerate)(), [onAddImage, onAddGenerate]);
  // Add opens the existing Ask entrance so note entry sits alongside the image paths.
  const closeAddSheet = useCallback(() => setAddSheetOpen(false), []);
  const chooseAdd = useCallback((choice: VisionAddChoice) => {
    if (choice === 'generate') onAddGenerate();
    else onAddPhoto(choice);
  }, [onAddGenerate, onAddPhoto]);

  const archive = () => {
    setMenuOpen(false);
    setNativeAlertOpen(true);
    Alert.alert('Archive Vision?', 'Your Vision and images will be kept in your account but removed from this Anchor.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setNativeAlertOpen(false) },
      { text: 'Archive', style: 'destructive', onPress: () => {
        setNativeAlertOpen(false);
        setBusy(true);
        void onArchive().then(success => {
          if (!success) setNotice('Vision could not be archived.');
        }).finally(() => setBusy(false));
      } },
    ], { onDismiss: () => setNativeAlertOpen(false) });
  };

  const header = (
    <VisionHeaderRow title={mode === 'edit' ? 'Edit Vision' : 'Vision'} serifTitle
      tone="dark" onBack={mode === 'view' ? onBack : () => { setMode('view'); setNotice(null); setDraft(description); setAnnotationDraft(annotation); }}
      utility={mode === 'view' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Vision options" hitSlop={8} onPress={() => setMenuOpen(value => !value)} style={styles.menuButton}>
          <MoreHorizontal size={22} color={colors.text.primary} />
        </Pressable>
      ) : undefined} />
  );

  return (
    <View testID={testID} style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={teachingScrollRef}
          onLayout={event => { teachingScrollMetrics.current.viewport = event.nativeEvent.layout.height; }}
          onContentSizeChange={(_width, height) => { teachingScrollMetrics.current.content = height; }}
          onScroll={event => { teachingScrollMetrics.current.y = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          onScrollBeginDrag={() => setTeachingScrolling(true)}
          onScrollEndDrag={() => { measureCanvas(); setTeachingScrolling(false); }}
          onMomentumScrollBegin={() => { if (!teachingControlledScroll.current) setTeachingScrolling(true); }}
          onMomentumScrollEnd={() => { measureCanvas(); setTeachingScrolling(false); }} scrollEnabled={!dragging} contentContainerStyle={{ paddingBottom: mode === 'view' ? 0 : insets.bottom + spacing[6] }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: insets.top }}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
            <View style={styles.bandContent}>
              {header}
              <VisionIntentionHeading intention={anchorIntention} category={anchorCategory} />
            </View>
            {mode === 'view' ? (
              <View style={styles.boardWrap}>
                <View ref={canvasRef} collapsable={false} onLayout={measureCanvas}><VisionBoard
                  tiles={boardTiles}
                  notes={notes}
                  onNotePresentationChange={onNotePresentationChange}
                  onNoteEdit={onNoteEdit}
                  onNoteDelete={onNoteDelete}
                  onCaptionEdit={onUpdateSceneCaption ? setCaptionSceneId : undefined}
                  arrivingSceneId={arrivingSceneId}
                  arrivingNoteId={arrivingNoteId}
                  intention={anchorIntention}
                  annotation={annotation}
                  category={anchorCategory}
                  art={anchorArt}
                  width={boardWidth}
                  reduceMotion={reduceMotion}
                  busy={busy}
                  captureFrame={canvasCapture}
                  teachingTarget={teachingEnabled ? teachingTarget : undefined}
                  onTeachingIdleChange={teachingEnabled ? setBoardIdle : undefined}
                  canRegenerate={canGenerateMore}
                  // DEFERRED: Replace locks at Seal (decision Oct 2026); remove + add remains.
                  onRegenerate={onRegenerate}
                  onRemove={remove}
                  onEditVision={() => setMode('edit')}
                  onReorder={reorder}
                  onAddImage={addImage}
                  onDragActive={setDragging}
                /></View>
              </View>
            ) : <View style={styles.bandTail} />}
          </View>

          <View style={styles.body}>
            {mode === 'edit' ? (
              <>
                <View pointerEvents="none" style={styles.sectionRule} />
                <Text style={styles.heading}>My Vision</Text>
                <TextInput testID="vision-edit-description" accessibilityLabel="Edit Vision description" multiline maxLength={VISION_DESCRIPTION_MAX_CHARS}
                  value={draft} onChangeText={setDraft} style={styles.textInput} textAlignVertical="top" />
                {onUpdateAnnotation ? <>
                  <Text style={styles.chartPosition}>Board caption (optional)</Text>
                  <TextInput accessibilityLabel="Board caption" maxLength={80} value={annotationDraft}
                    onChangeText={setAnnotationDraft} style={[styles.textInput, { minHeight: 48 }]} />
                </> : null}
                <View style={styles.meter}>
                  <Text style={styles.meterHint}>{visionDetailHint(draft) ?? ''}</Text>
                  <Text style={styles.counter}>{draft.length}/{VISION_DESCRIPTION_MAX_CHARS}</Text>
                </View>
                <V2Button size="large" disabled={busy || draft.trim().length < VISION_DESCRIPTION_MIN_CHARS} onPress={() => { void saveText(); }}>Save Vision</V2Button>
              </>
            ) : (
              <>
                <Text style={styles.heading}>My Vision</Text>
                <Text testID="vision-statement" style={styles.description}>{expanded ? description : preview}</Text>
                {(truncated || expanded) ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
                  onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 }}>
                  <Text style={styles.disclosure}>{expanded ? 'Read less' : 'Read more'}</Text>
                  <ChevronDown size={14} color={colors.text.primary} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
                </Pressable> : null}
                {manageImages ? <View style={{ gap: spacing[3] }}>{boardTiles.map((tile, index) =>
                  <View key={tile.sceneId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                    <VisionArrivalDestination url={tile.imageUrl} style={{ width: 80, height: 72, backgroundColor: colors.grouped }}>
                      {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} resizeMode="cover" style={{ width: 80, height: 72 }} /> : null}
                    </VisionArrivalDestination>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.chartPosition}>Image {index + 1} of {boardTiles.length}</Text>
                      {tile.caption?.trim() ? <Text testID={`vision-edit-caption-${tile.sceneId}`} numberOfLines={1} ellipsizeMode="tail"
                        style={{ fontFamily: VISION_SERIF_ITALIC, fontSize: 15, color: colors.text.primary }}>{tile.caption.trim()}</Text> : null}
                      <Pressable accessibilityRole="button" accessibilityLabel={`Manage image ${index + 1}`} onPress={() => Alert.alert('Vision image', undefined, [
                        { text: 'Make primary', onPress: () => reorder([tile.sceneId, ...boardTiles.filter(t => t.sceneId !== tile.sceneId).map(t => t.sceneId)]) },
                        // DEFERRED: Replace locks at Seal (decision Oct 2026); remove + add remains.
                        ...(canGenerateMore && tile.sourceType === 'AI_GENERATED' ? [{ text: 'Regenerate', onPress: () => onRegenerate(tile.sceneId) }] : []),
                        { text: 'Remove', style: 'destructive', onPress: () => remove(tile.sceneId) },
                        { text: 'Cancel', style: 'cancel' },
                      ])} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text style={styles.chartLinkText}>Image options</Text>
                      </Pressable>
                    </View>
                  </View>)}</View> : null}
                {justAdded ? <View testID="vision-just-added" style={{ marginTop: 16, gap: 4 }}>
                  <Text style={styles.heading}>{visionCeremonyCopy.sit}</Text>
                  <Text style={styles.chartPosition}>{justAdded === 'create' ? visionCeremonyCopy.sitCreate : visionCeremonyCopy.sitAdd}</Text>
                </View> : null}
                <V2Button size="large" accessibilityLabel="Begin Visualize" disabled={!visualizeReady} onPress={() => {
                    const begin = (bounds = canvasBounds.current) => {
                      const projection = canvasCapture.current?.();
                      onVisualize(bounds && projection ? { ...projection, x: bounds.x + projection.x, y: bounds.y + projection.y } : bounds);
                    };
                    // Native position is sampled at activation, including taps during momentum.
                    if (canvasRef.current?.measureInWindow) canvasRef.current.measureInWindow((x, y, width, height) => begin({ x, y, width, height }));
                    else begin();
                  }} style={styles.visualize}
                  iconLeft={<Eye size={18} color={colors.paper} />} iconRight={<ChevronRight size={18} color={colors.paper} />}>
                  <Text style={{ fontFamily: 'EBGaramond-Medium', fontSize: 18, fontWeight: 'normal' }}>Begin Visualize</Text>
                </V2Button>
                {!visualizeReady ? <Text accessibilityLiveRegion="polite" style={styles.chartPosition}>{preparationIssue ?? 'Preparing your Vision…'}</Text> : null}
                {preparationIssue && onRetryVisualize ? <Pressable accessibilityRole="button" onPress={onRetryVisualize} style={{ minHeight: 44 }}><Text style={styles.chartLinkText}>Retry Vision images</Text></Pressable> : null}
                {preparationIssue && onUseAvailableImages ? <Pressable accessibilityRole="button" onPress={onUseAvailableImages} style={{ minHeight: 44 }}><Text style={styles.chartLinkText}>Continue with available images</Text></Pressable> : null}
                <VisionChartLink chart={chartSummary} width={width} onPress={onChart} />
              </>
            )}
            {(notice || error) && <Text style={styles.error}>{notice || error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <VisionStatusBarScrim tone="dark" />
      {onUpdateSceneCaption ? <VisionPhotoCaptionEditor
        visible={captionSceneId !== null}
        caption={tiles.find(tile => tile.sceneId === captionSceneId)?.caption}
        onSave={async caption => captionSceneId ? onUpdateSceneCaption(captionSceneId, caption) : false}
        onClose={() => setCaptionSceneId(null)}
      /> : null}
      <ScreenTeaching screen="vision" queue={teachingQueue} reducedMotion={reduceMotion} targets={{ 'vision.second': { getRect: getTeachingPhotoRect } }} />
      <VisionAddSheet visible={addSheetOpen} onClose={closeAddSheet} onChoose={chooseAdd} />
      {menuOpen && mode === 'view' && (
        <>
          <Pressable testID="vision-menu-dismiss" style={StyleSheet.absoluteFill} accessible={false} onPress={() => setMenuOpen(false)} />
          <View accessibilityViewIsModal style={[styles.menu, { top: insets.top + 50 }]}>
            {onShare ? <Pressable accessibilityRole="button" accessibilityLabel="Share Vision"
              onPress={() => { setMenuOpen(false); onShare(); }} style={styles.menuItem}>
              <Text style={styles.chartLinkText}>Share Vision</Text>
            </Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Edit Vision" onPress={() => { setMenuOpen(false); setMode('edit'); }} style={styles.menuItem}>
              <Text style={styles.chartLinkText}>Edit Vision</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Manage images (${tiles.length})`} accessibilityState={{ expanded: manageImages }}
              onPress={() => { setMenuOpen(false); setManageImages(value => !value); }} style={styles.menuItem}>
              <Text style={styles.chartLinkText}>{manageImages ? 'Close images' : `Manage images (${tiles.length})`}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Archive Vision" onPress={archive} style={styles.menuItem}>
              <Text style={styles.archiveText}>Archive Vision</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRule: { width: 32, height: 2, backgroundColor: VISION_GOLD, marginBottom: spacing[2] },
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  bandContent: { paddingHorizontal: PAGE_GUTTER, gap: spacing[4] },
  boardWrap: { paddingHorizontal: BOARD_GUTTER, paddingTop: spacing[3], alignItems: 'center' },
  bandTail: { height: spacing[5] },
  menuButton: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  menu: { position: 'absolute', right: 18, zIndex: 5, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.md },
  menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  archiveText: { ...typography.labelMD, color: colors.semantic.error },
  body: { paddingHorizontal: PAGE_GUTTER, paddingTop: spacing[3], gap: spacing[2] },
  heading: { fontFamily: 'EBGaramond-Medium', fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: colors.text.primary },
  description: { ...typography.bodyMD, color: colors.text.primary, lineHeight: 23 },
  visualize: { marginTop: 0, backgroundColor: colors.ink.base, borderColor: colors.ink.base },
  disclosure: { ...typography.bodySM, color: colors.text.primary, textDecorationLine: 'underline' },
  pressed: { opacity: 0.72 },
  textInput: { ...typography.bodyMD, color: colors.text.primary, minHeight: 168, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface, padding: spacing[4] },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  counter: { ...typography.caption, color: colors.text.tertiary },
  error: { ...typography.caption, color: colors.semantic.error },
  chartPosition: { ...typography.labelMD, color: colors.text.secondary, marginTop: spacing[1] },
  chartLinkText: { ...typography.labelMD, color: colors.text.primary },
});
