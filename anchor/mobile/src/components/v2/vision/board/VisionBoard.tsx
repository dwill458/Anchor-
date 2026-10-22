import type { ViewInstance } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Check, Crop, LayoutGrid, Move, Pencil, Plus, RefreshCw, Replace, RotateCcw, Trash2, Type, X } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionNote, VisionNotePresentation } from '@/adapters/v2/vision';
import { VisionBoardScene } from './VisionBoardScene';
import type { VisionBoardCardArt } from './VisionBoardIntentionCard';
import { useVisionBoardScene } from './useVisionBoardScene';
import { detailBoardSizeForWidth, slotBoardHeightRatio, slotBoardSizeForWidth, toSceneRect } from './visionBoardLayouts';
import { freeSlots, highestOccupiedSlot, mapFromOrder, moveToSlot, orderFromMap, slotLabel, swapScenes, type VisionSlotMap } from './visionBoardSlots';
import type { VisionFocal } from '../visionPhotoFocus';
import type { VisionSlotOverlay } from './VisionBoardScene';
import { focusCamera, photoFocusOptions, restCamera, type CameraState } from './visionBoardCamera';
import { boardCameraEasing, boardDelay, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';
import { moveBoardOrder } from './visionBoardReorder';
import { VISION_SERIF_ITALIC } from '../VisionPaperChrome';
import { measureTeachingTarget, type TeachingRect } from '@/components/v2/teaching/scrollToTarget';
import { projectTeachingSlot } from '@/hooks/v2/teaching/visionTeaching';

export type VisionBoardFocus = { kind: 'photo'; sceneId: string } | { kind: 'card' } | null;

/**
 * What the person is doing with the board's positions. `arrange` shows every empty position so a photograph can be
 * added to an exact one; `add` and `move` ask for one position and then act.
 */
type ArrangeState = { kind: 'off' } | { kind: 'arrange' } | { kind: 'add' } | { kind: 'move'; sceneId: string };

/**
 * The Vision screen's saved arrangement. Passing it turns on the eight fixed positions: each photograph keeps its
 * slot, and adding, removing or moving another never re-flows it. Without it the board keeps the count-based
 * composition (older callers and tests).
 */
export type VisionBoardArrangement = {
  /** The photograph in each of the eight positions, `null` for an empty one. */
  slotMap: VisionSlotMap;
  focals: Readonly<Record<string, VisionFocal>>;
  /** A drag, move or swap changed the arrangement. */
  onArrange: (slotMap: (string | null)[]) => void;
  /** A photograph was repositioned in its print; `null` returns it to the automatic position. */
  onFocalChange: (sceneId: string, focal: VisionFocal | null) => void;
};

/** Points between the board's lowest print (or the Anchor) and the handwritten title below it. */
const CAPTION_CLEARANCE = 12;

export type VisionBoardProps = {
  arrivingNoteId?: string;
  arrivingSceneId?: string | null;
  tiles: V2VisionTile[];
  notes?: readonly VisionNote[];
  onNotePresentationChange?: (id: string, presentation: VisionNotePresentation) => Promise<boolean>;
  onNoteEdit?: (id: string) => void;
  onNoteDelete?: (id: string) => void;
  onCaptionEdit?: (sceneId: string) => void;
  intention: string;
  /** Optional, persisted user title. Never filled with sample content. */
  annotation?: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  /** Width the board is shown at; its height follows the board's proportions. */
  width: number;
  reduceMotion: boolean;
  busy?: boolean;
  canRegenerate: boolean;
  onReplace?: (sceneId: string) => void;
  onRegenerate: (sceneId: string) => void;
  onRemove: (sceneId: string) => void;
  onEditVision: () => void;
  /** A new order of scene ids, after a drag or an accessibility move. */
  onReorder: (sceneIds: string[]) => void;
  /** Opens the Vision add flow; it remains available at the image limit for note entry. With a target, the photograph goes to that exact position. */
  onAddImage?: (target?: { slot: number }) => void;
  arrangement?: VisionBoardArrangement;
  /** True while a photo is being dragged (the host should stop scrolling). */
  onDragActive?: (active: boolean) => void;
  /** Reads the current UI-thread canvas projection once at Begin, including photo focus. */
  captureFrame?: React.MutableRefObject<(() => { x: number; y: number; width: number; height: number; sceneWidth?: number; sceneHeight?: number }) | null>;
  testID?: string;
  onTeachingIdleChange?: (idle: boolean) => void;
  teachingTarget?: React.MutableRefObject<((sceneId: string | null) => Promise<TeachingRect | null>) | null>;
};

/**
 * The interactive Vision board. One camera (x, y, scale) moves the whole
 * scene: tapping a photo glides it into focus, tapping the Anchor card does
 * the same for the Vision itself, and anywhere else returns to the board.
 * Long-press lifts a photo so it can trade places with another.
 */
export function VisionBoard({
  tiles, arrangement, notes = [], onNotePresentationChange, onNoteEdit, onNoteDelete, onCaptionEdit, intention, annotation = '', category, art, width, reduceMotion, busy = false, canRegenerate, arrivingSceneId, arrivingNoteId,
  onReplace, onRegenerate, onRemove, onEditVision, onReorder, onAddImage, onDragActive, captureFrame, testID = 'vision-board', onTeachingIdleChange, teachingTarget,
}: VisionBoardProps) {
  const [arrange, setArrange] = useState<ArrangeState>({ kind: 'off' });
  const slotMap = arrangement?.slotMap;
  const arranging = arrange.kind !== 'off';
  // Height follows the lowest occupied position, and opens to the whole board while positions are being chosen.
  const heightRatio = useMemo(() => slotMap ? slotBoardHeightRatio(highestOccupiedSlot(slotMap), arranging) : 0, [slotMap, arranging]);
  const viewport = useMemo(() => slotMap ? slotBoardSizeForWidth(width, heightRatio) : detailBoardSizeForWidth(width, tiles.length), [slotMap, width, heightRatio, tiles.length]);
  const scene = useMemo(() => slotMap ? slotBoardSizeForWidth(width * MOTION.renderScale, heightRatio) : detailBoardSizeForWidth(width * MOTION.renderScale, tiles.length), [slotMap, width, heightRatio, tiles.length]);
  // Notes stay where they were placed: they use the count-based board height, not the slot board's.
  const noteScene = useMemo(() => detailBoardSizeForWidth(width * MOTION.renderScale, tiles.length), [width, tiles.length]);
  const [captionExtra, setCaptionExtra] = useState(0);
  const rest = useMemo(() => restCamera(scene, viewport), [scene, viewport]);
  const board = useVisionBoardScene(tiles, scene, rest.scale, true, slotMap ? { map: slotMap, heightRatio } : undefined);
  const { shared, layout, slotRects, order } = board;
  // The title sits below the board's lowest print or the Anchor, whichever is lower, and never on top of them.
  const captionTop = useMemo(() => {
    const inked = slotMap ? [...layout.photos.filter((_, slot) => Boolean(slotMap[slot])), layout.card] : [...layout.photos, layout.card];
    const inkBottom = inked.reduce((bottom, slot) => {
      const rect = toSceneRect(slot, viewport);
      return Math.max(bottom, rect.y + rect.height);
    }, 0);
    if (slotMap) return inkBottom + CAPTION_CLEARANCE;
    return Math.max(viewport.height * (tiles.length > 3 ? 0.95 : tiles.length === 1 ? 0.92 : tiles.length === 2 ? 0.9 : 0.83), inkBottom + CAPTION_CLEARANCE);
  }, [layout, viewport, tiles.length, slotMap]);

  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraScale = shared.cameraScale;
  const sceneOpacity = useSharedValue(1);
  const controls = useSharedValue(0);
  const [focus, setFocus] = useState<VisionBoardFocus>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectNote = useCallback((id: string) => { setSelectedNoteId(id); v2Haptics.selection(); }, []);
  useEffect(() => {
    if (selectedNoteId && !notes.some(note => note.id === selectedNoteId && !note.isArchived)) setSelectedNoteId(null);
  }, [notes, selectedNoteId]);
  const [dragging, setDragging] = useState(false);
  const [repositioningId, setRepositioningId] = useState<string | null>(null);
  const teachingViewportRef = useRef<ViewInstance>(null);
  const [teachingMovingObjects, setTeachingMovingObjects] = useState<ReadonlySet<string>>(() => new Set());
  const [cameraAtRest, setCameraAtRest] = useState(false);
  const onTeachingMotionChange = useCallback((sceneId: string, moving: boolean) => {
    setTeachingMovingObjects(previous => {
      if (previous.has(sceneId) === moving) return previous;
      const next = new Set(previous);
      if (moving) next.add(sceneId); else next.delete(sceneId);
      return next;
    });
  }, []);
  useAnimatedReaction(() => Math.abs(cameraX.value - rest.x) < 0.1 && Math.abs(cameraY.value - rest.y) < 0.1 && Math.abs(cameraScale.value - rest.scale) < 0.001 && sceneOpacity.value > 0.999,
    (atRest, previous) => { if (onTeachingIdleChange && atRest !== previous) runOnJS(setCameraAtRest)(atRest); }, [rest, onTeachingIdleChange]);
  useEffect(() => {
    onTeachingIdleChange?.(!focus && !dragging && !busy && cameraAtRest && teachingMovingObjects.size === 0);
  }, [focus, dragging, busy, cameraAtRest, teachingMovingObjects, onTeachingIdleChange]);
  useEffect(() => {
    if (!teachingTarget) return;
    teachingTarget.current = async sceneId => {
      if (focus || dragging || !cameraAtRest || teachingMovingObjects.size) return null;
      const origin = await measureTeachingTarget(teachingViewportRef.current);
      if (!origin) return null;
      const slot = slotRects[order.indexOf(sceneId ?? '')];
      return slot ? projectTeachingSlot(slot, scene, viewport, rest, origin) : origin;
    };
    return () => { teachingTarget.current = null; };
  }, [teachingTarget, focus, dragging, cameraAtRest, teachingMovingObjects, order, slotRects, rest, scene, viewport]);

  const moveCamera = useCallback((target: CameraState, duration: number) => {
    if (reduceMotion) {
      // Crossfade rather than travel: dip, cut, return.
      const cut = (finished?: boolean) => {
        'worklet';
        if (!finished) return;
        cameraX.value = target.x;
        cameraY.value = target.y;
        cameraScale.value = target.scale;
        sceneOpacity.value = boardTiming(1, { duration: MOTION.reduced.focusFadeInMs });
      };
      sceneOpacity.value = boardTiming(0.15, { duration: MOTION.reduced.focusFadeOutMs }, cut);
      return;
    }
    const config = { duration, easing: boardCameraEasing };
    cameraX.value = boardTiming(target.x, config);
    cameraY.value = boardTiming(target.y, config);
    cameraScale.value = boardTiming(target.scale, config);
  }, [cameraScale, cameraX, cameraY, reduceMotion, sceneOpacity]);

  // The camera follows focus, and re-frames if the composition changes underneath it.
  const focusRect = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === 'card') return toSceneRect(layout.card, scene);
    const index = order.indexOf(focus.sceneId);
    return index >= 0 ? slotRects[index] : null;
  }, [focus, layout.card, order, scene, slotRects]);

  useEffect(() => {
    if (arrivingNoteId) { setFocus(null); setSelectedNoteId(null); }
  }, [arrivingNoteId]);
  const wasFocused = useRef(false);
  useEffect(() => {
    if (focus && !focusRect) { setFocus(null); return; }
    if (focusRect) {
      wasFocused.current = true;
      // The Anchor is a small object: zoom in 40% further than a photo so it reads larger.
      const zoomBoost = focus?.kind === 'card' ? 1.4 : 1;
      const focusOptions = {
        fill: MOTION.focus.fill * zoomBoost, minZoom: MOTION.focus.minZoom * zoomBoost, maxZoom: MOTION.focus.maxZoom * zoomBoost, clamp: true, offsetY: -24,
      };
      const target = focusCamera(focusRect, scene, viewport, focus?.kind === 'photo' ? photoFocusOptions(focusOptions) : focusOptions);
      moveCamera(target, MOTION.focus.moveMs);
      controls.value = boardDelay(reduceMotion ? MOTION.reduced.focusFadeOutMs : MOTION.focus.controlsAtMs,
        boardTiming(1, { duration: MOTION.focus.controlsFadeMs }));
    } else if (wasFocused.current) {
      wasFocused.current = false;
      moveCamera(rest, MOTION.focus.returnMs);
      controls.value = boardTiming(0, { duration: 160 });
    } else {
      // Not focused and never moved: a new board size only needs the resting frame.
      cameraX.value = rest.x;
      cameraY.value = rest.y;
      cameraScale.value = rest.scale;
    }
    // Focus changes and composition changes both re-aim the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRect, rest]);

  useEffect(() => {
    if (!focus) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setFocus(null); return true; });
    return () => subscription.remove();
  }, [focus]);

  const cameraStyle = useAnimatedStyle(() => ({
    opacity: sceneOpacity.value,
    transform: [
      { translateX: -cameraScale.value * cameraX.value },
      { translateY: -cameraScale.value * cameraY.value },
      { scale: cameraScale.value },
    ],
  }));
  useEffect(() => {
    if (!captureFrame) return;
    captureFrame.current = () => ({
      x: viewport.width / 2 - cameraScale.value * (scene.width / 2 + cameraX.value),
      y: viewport.height / 2 - cameraScale.value * (scene.height / 2 + cameraY.value),
      width: scene.width * cameraScale.value, height: scene.height * cameraScale.value,
      sceneWidth: scene.width, sceneHeight: scene.height,
    });
    return () => { captureFrame.current = null; };
  }, [captureFrame, viewport, scene, cameraScale, cameraX, cameraY]);

  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value, transform: [{ translateY: (1 - controls.value) * 8 }] }));

  const focusPhoto = useCallback((sceneId: string) => {
    v2Haptics.selection();
    setFocus(current => (current?.kind === 'photo' && current.sceneId === sceneId ? current : { kind: 'photo', sceneId }));
  }, []);
  const focusCard = useCallback(() => {
    v2Haptics.selection();
    setFocus({ kind: 'card' });
  }, []);
  const clearFocus = useCallback(() => setFocus(null), []);

  const handleDragActive = useCallback((active: boolean) => {
    setDragging(active);
    if (active) v2Haptics.selection();
    onDragActive?.(active);
  }, [onDragActive]);
  const handleSwap = useCallback(() => { v2Haptics.selection(); }, []);
  const handleOrderCommit = useCallback((next: string[]) => {
    if (arrangement) { arrangement.onArrange(mapFromOrder(next)); return; }
    onReorder([...next, ...tiles.map(tile => tile.sceneId).filter(id => !next.includes(id))]);
  }, [arrangement, onReorder, tiles]);
  const handleMove = useCallback((sceneId: string, direction: -1 | 1) => {
    const index = order.indexOf(sceneId);
    const next = moveBoardOrder(order, index, direction);
    if (next === order) return;
    handleOrderCommit(next);
    AccessibilityInfo.announceForAccessibility?.(`Moved to position ${index + direction + 1} of ${order.length}.`);
  }, [handleOrderCommit, order]);

  const focusedTile = focus?.kind === 'photo' ? tiles.find(tile => tile.sceneId === focus.sceneId) ?? null : null;
  const count = tiles.length;

  const empty = useMemo(() => slotMap ? freeSlots(slotMap) : [], [slotMap]);
  const leaveArrange = useCallback(() => setArrange({ kind: 'off' }), []);
  // A position was chosen. Add goes to the add flow with the exact slot; Move fills an empty slot or offers a swap.
  const choosePosition = useCallback((slot: number) => {
    if (!slotMap) return;
    v2Haptics.selection();
    if (arrange.kind === 'move') {
      const result = moveToSlot(slotMap, arrange.sceneId, slot);
      if (result.kind === 'moved') { arrangement?.onArrange(result.map); setArrange({ kind: 'off' }); AccessibilityInfo.announceForAccessibility?.(`Moved to ${slotLabel(slot)}.`); return; }
      if (result.kind === 'occupied') {
        const mover = arrange.sceneId;
        Alert.alert('Swap photos?', `The photo in ${slotLabel(slot)} will take this photo's place.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Swap', onPress: () => { arrangement?.onArrange(swapScenes(slotMap, mover, result.occupant)); setArrange({ kind: 'off' }); } },
        ]);
      }
      return;
    }
    setArrange({ kind: 'off' });
    onAddImage?.({ slot });
  }, [arrange, arrangement, onAddImage, slotMap]);
  const slotOverlay = useMemo<VisionSlotOverlay | undefined>(() => {
    if (!slotMap || arrange.kind === 'off' || focus) return undefined;
    const slots: Array<{ slot: number; kind: 'empty' | 'occupied' }> = empty.map(slot => ({ slot, kind: 'empty' as const }));
    if (arrange.kind === 'move') slotMap.forEach((id, slot) => { if (id && id !== arrange.sceneId) slots.push({ slot, kind: 'occupied' }); });
    return { slots, emphasis: arrange.kind === 'arrange' ? 'subtle' : 'strong', onPress: choosePosition };
  }, [slotMap, arrange, focus, empty, choosePosition]);
  // The Add chip: with room it asks where; at the limit it goes straight to the add flow (notes still need it).
  const requestAdd = useCallback(() => {
    if (slotMap && empty.length > 0) { setFocus(null); setArrange({ kind: 'add' }); return; }
    onAddImage?.();
  }, [empty.length, onAddImage, slotMap]);
  const moveFocused = useCallback((sceneId: string) => { setFocus(null); setArrange({ kind: 'move', sceneId }); }, []);
  const finishReposition = useCallback(() => setRepositioningId(null), []);
  const commitFocal = useCallback((sceneId: string, focal: VisionFocal) => arrangement?.onFocalChange(sceneId, focal), [arrangement]);
  useEffect(() => { if (!focus) setRepositioningId(null); }, [focus]);

  return (
    // The board is transparent: the archival paper is one continuous sheet behind the whole Vision screen.
    <View ref={teachingViewportRef} collapsable={false} testID={testID} style={[styles.viewport, { width: viewport.width, height: viewport.height + (annotation.trim() ? captionExtra : 0) }]}>
      <Animated.View style={[styles.scene, {
        width: scene.width, height: scene.height,
        left: (viewport.width - scene.width) / 2, top: (viewport.height - scene.height) / 2,
      }, cameraStyle]}>
        <VisionBoardScene materialMode="photographic" arrivingNoteId={arrivingNoteId}
          scene={scene}
          roster={board.roster}
          entering={board.entering}
          arrivingSceneId={arrivingSceneId}
          layout={layout}
          shared={shared}
          initialRectFor={board.initialRectFor}
          intention={intention}
          category={category}
          art={art}
          markAppearance="paper"
          detailEdges
          reduceMotion={reduceMotion}
          notes={notes}
          selectedNoteId={selectedNoteId}
          onNoteSelect={focus ? undefined : selectNote}
          onNotePresentationChange={focus ? undefined : onNotePresentationChange}
          onNoteDragActive={handleDragActive}
          interactive
          dragEnabled={!focus && !busy && (arrangement ? count >= 1 && arrange.kind !== 'add' && arrange.kind !== 'move' : count > 1)}
          noteScene={slotMap ? noteScene : undefined}
          slotOrder={slotMap ? order : undefined}
          displayScale={slotMap ? rest.scale : undefined}
          focals={arrangement?.focals}
          repositioningId={repositioningId}
          onFocalCommit={commitFocal}
          slotOverlay={slotOverlay}
          onMoveRequest={arrangement ? moveFocused : undefined}
          onPhotoPress={focusPhoto}
          onCaptionEdit={onCaptionEdit}
          onCardPress={focusCard}
          onBackgroundPress={focus && !repositioningId ? clearFocus : arranging ? leaveArrange : undefined}
          onDragActive={handleDragActive}
          onSwap={handleSwap}
          onOrderCommit={handleOrderCommit}
          onPhotoExited={board.markExited}
          onTeachingMotionChange={onTeachingIdleChange ? onTeachingMotionChange : undefined}
          onMovePhoto={handleMove}
          onAddPress={onAddImage ? requestAdd : undefined}
        />
      </Animated.View>

      {count === 0 ? <View pointerEvents="none" style={styles.empty}><Text style={styles.emptyText}>Bring your future into view.</Text></View> : null}
      {selectedNoteId && !focus ? <View style={styles.noteActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit selected note" onPress={() => onNoteEdit?.(selectedNoteId)} style={styles.noteAction}><Text style={styles.noteActionText}>Edit note</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Delete selected note" onPress={() => onNoteDelete?.(selectedNoteId)} style={styles.noteAction}><Text style={styles.noteActionText}>Delete</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Deselect note" onPress={() => setSelectedNoteId(null)} style={styles.noteAction}><Text style={styles.noteActionText}>Done</Text></Pressable>
      </View> : null}
      {!focus && !dragging && annotation.trim() ? <Text testID="vision-board-annotation" pointerEvents="none"
        onLayout={event => setCaptionExtra(Math.max(0, captionTop + event.nativeEvent.layout.height + 16 - viewport.height))}
        style={[styles.annotation, { top: captionTop, width: width * 0.22, fontSize: annotation.length > 40 ? 21 : 24 }]}>{annotation.trim()}</Text> : null}
      {!focus && !dragging && arrange.kind === 'off' && onAddImage ? (
        <View style={styles.chipRow} pointerEvents="box-none">
          {arrangement ? (
            <Pressable testID={`${testID}-arrange`} accessibilityRole="button" accessibilityLabel="Arrange photos"
              onPress={() => setArrange({ kind: 'arrange' })} hitSlop={8} style={({ pressed }) => [styles.addChip, styles.chipInRow, pressed && styles.pressed]}>
              <LayoutGrid size={14} color={colors.text.primary} />
              <Text style={styles.addText}>Arrange</Text>
            </Pressable>
          ) : null}
          <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add to Vision"
            onPress={arrangement ? requestAdd : () => onAddImage()} hitSlop={8} style={({ pressed }) => [styles.addChip, arrangement ? styles.chipInRow : null, pressed && styles.pressed]}>
            <Plus size={14} color={colors.text.primary} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      {arrangement && !focus && arrange.kind !== 'off' ? (
        <View style={styles.arrangeBar} pointerEvents="box-none">
          <Text accessibilityLiveRegion="polite" style={styles.arrangeHint}>
            {arrange.kind === 'add' ? 'Choose where it goes' : arrange.kind === 'move' ? 'Choose a new position' : empty.length ? 'Tap an empty spot to add a photo' : 'Every position is filled'}
          </Text>
          <View style={styles.arrangeButtons}>
            {arrange.kind === 'add' && empty.length ? (
              <Pressable testID={`${testID}-next-free`} accessibilityRole="button" accessibilityLabel="Use the next free position"
                onPress={() => { setArrange({ kind: 'off' }); onAddImage?.({ slot: empty[0] }); }} style={({ pressed }) => [styles.arrangeButton, pressed && styles.pressed]}>
                <Text style={styles.addText}>Next free spot</Text>
              </Pressable>
            ) : null}
            <Pressable testID={`${testID}-arrange-done`} accessibilityRole="button" accessibilityLabel={arrange.kind === 'arrange' ? 'Done arranging' : 'Cancel'}
              onPress={leaveArrange} style={({ pressed }) => [styles.arrangeButton, arrange.kind === 'arrange' && styles.arrangeButtonPrimary, pressed && styles.pressed]}>
              <Text style={[styles.addText, arrange.kind === 'arrange' && styles.arrangeButtonPrimaryText]}>{arrange.kind === 'arrange' ? 'Done' : 'Cancel'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {focus ? (
        <Animated.View style={[styles.controls, controlsStyle]} pointerEvents="box-none">
          {/* The line written at Keep, under the focused photo; it fades in with the focus controls. */}
          {focusedTile?.caption?.trim() ? <Text testID="vision-board-focused-caption" numberOfLines={1} ellipsizeMode="tail" style={styles.focusedCaption}>
            {focusedTile.caption.trim()}</Text> : null}
          {focus.kind === 'photo' && !canRegenerate && !busy ? (
            <Text style={styles.regenerationNote}>No image sets left for this Vision.</Text>
          ) : null}
          {repositioningId && focusedTile ? (
            <View style={styles.controlRow}>
              <Text accessibilityLiveRegion="polite" style={styles.repositionHint}>Drag the photo to reposition it</Text>
              <ControlButton label="Reset" icon={<RotateCcw size={18} color={colors.paper} />} onPress={() => arrangement?.onFocalChange(focusedTile.sceneId, null)} />
              <ControlButton label="Done" icon={<Check size={18} color={colors.paper} />} onPress={finishReposition} />
            </View>
          ) : (
          <View style={styles.controlRow}>
            {focus.kind === 'photo' && focusedTile ? (
              <>
                {/* DEFERRED: Replace locks at Seal (decision Oct 2026); remove + add remains.
                  <ControlButton label="Replace" onPress={() => onReplace?.(focusedTile.sceneId)} /> */}
                {arrangement ? <>
                  <ControlButton label="Move" icon={<Move size={18} color={colors.paper} />} disabled={busy} onPress={() => moveFocused(focusedTile.sceneId)} />
                  {onReplace ? <ControlButton label="Replace" icon={<Replace size={18} color={colors.paper} />} disabled={busy} onPress={() => onReplace(focusedTile.sceneId)} /> : null}
                  <ControlButton label="Reposition" icon={<Crop size={18} color={colors.paper} />} disabled={busy} onPress={() => setRepositioningId(focusedTile.sceneId)} />
                  {onCaptionEdit ? <ControlButton label="Caption" icon={<Type size={18} color={colors.paper} />} disabled={busy} onPress={() => { setFocus(null); onCaptionEdit(focusedTile.sceneId); }} /> : null}
                </> : null}
                {focusedTile.sourceType === 'AI_GENERATED' ? <ControlButton label="Regenerate" icon={<RefreshCw size={18} color={colors.paper} />} disabled={busy || !canRegenerate}
                  hint={canRegenerate ? undefined : 'No image sets left for this Vision.'}
                  onPress={() => onRegenerate(focusedTile.sceneId)} /> : null}
                <ControlButton label="Remove" icon={<Trash2 size={18} color="#F1B8AE" />} disabled={busy}
                  onPress={() => onRemove(focusedTile.sceneId)} />
              </>
            ) : focus.kind === 'card' ? (
              <ControlButton label="Edit Vision" icon={<Pencil size={18} color={colors.paper} />} disabled={busy}
                onPress={() => { setFocus(null); onEditVision(); }} />
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Back to the whole board" onPress={clearFocus} hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <X size={16} color={colors.paper} />
            </Pressable>
          </View>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

function ControlButton({ label, icon, onPress, disabled, hint }: {
  label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; hint?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [styles.control, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.controlText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// The board is laid out in a larger scene for sharp zooming; this is the
// frame it is shown in.
const INK_GLASS = 'rgba(14,21,28,0.95)';

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden', alignSelf: 'center' },
  scene: { position: 'absolute' },
  empty: { position: 'absolute', top: spacing[2], left: spacing[4], right: spacing[4], alignItems: 'center' },
  emptyText: { ...typography.bodySM, color: colors.text.secondary },
  addChip: {
    position: 'absolute', bottom: spacing[2], left: '36%', flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.grouped,
  },
  addText: { ...typography.labelMD, color: colors.text.primary },
  chipRow: { position: 'absolute', bottom: spacing[2], left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: spacing[2] },
  chipInRow: { position: 'relative', bottom: undefined, left: undefined },
  arrangeBar: { position: 'absolute', bottom: spacing[2], left: spacing[2], right: spacing[2], alignItems: 'center', gap: spacing[2] },
  arrangeHint: { ...typography.labelMD, color: colors.text.primary, textAlign: 'center' },
  arrangeButtons: { flexDirection: 'row', gap: spacing[2] },
  arrangeButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grouped },
  arrangeButtonPrimary: { backgroundColor: colors.ink.base },
  arrangeButtonPrimaryText: { color: colors.paper },
  repositionHint: { ...typography.caption, color: colors.paper, paddingHorizontal: spacing[3], maxWidth: 120, textAlign: 'center' },
  annotation: { position: 'absolute', left: 16, fontFamily: 'Allison-Regular',
    lineHeight: 25, includeFontPadding: false, color: '#303027', transform: [{ rotate: '-7deg' }] },
  controls: { position: 'absolute', left: spacing[2], right: spacing[2], bottom: spacing[3], alignItems: 'center' },
  regenerationNote: { ...typography.caption, color: colors.paper, backgroundColor: INK_GLASS,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.lg, marginBottom: spacing[1] },
  // One compact glass bar: it must fit the narrowest phone's board.
  controlRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 22, maxWidth: '100%',
    backgroundColor: INK_GLASS, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,240,230,0.22)',
  },
  control: { minWidth: 62, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 3 },
  controlText: { ...typography.caption, color: colors.paper },
  closeButton: {
    width: 44, height: 40, marginLeft: 2, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(245,240,230,0.22)',
  },
  focusedCaption: { maxWidth: '100%', fontFamily: VISION_SERIF_ITALIC, fontSize: 15, lineHeight: 20, color: colors.text.primary, textAlign: 'center',
    backgroundColor: 'rgba(244,237,224,0.92)', paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radii.lg, marginBottom: spacing[2] },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  noteActions: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 6, zIndex: 30 },
  noteAction: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F8F3E9', borderWidth: 1, borderColor: '#C9BFAE' },
  noteActionText: { ...typography.labelSM, color: colors.text.primary },
});

