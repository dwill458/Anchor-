import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ImagePlus, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react-native';
import { v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VisionBoardScene } from './VisionBoardScene';
import type { VisionBoardCardArt } from './VisionBoardIntentionCard';
import { useVisionBoardScene } from './useVisionBoardScene';
import { boardSizeForWidth, toSceneRect, VISION_BOARD_MAX_IMAGES } from './visionBoardLayouts';
import { focusCamera, restCamera, type CameraState } from './visionBoardCamera';
import { boardCameraEasing, boardDelay, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';
import { moveBoardOrder } from './visionBoardReorder';

export type VisionBoardFocus = { kind: 'photo'; sceneId: string } | { kind: 'card' } | null;

export type VisionBoardProps = {
  tiles: V2VisionTile[];
  intention: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  /** Width the board is shown at; its height follows the board's proportions. */
  width: number;
  reduceMotion: boolean;
  busy?: boolean;
  canRegenerate: boolean;
  onReplace: (sceneId: string) => void;
  onRegenerate: (sceneId: string) => void;
  onRemove: (sceneId: string) => void;
  onEditVision: () => void;
  /** A new order of scene ids, after a drag or an accessibility move. */
  onReorder: (sceneIds: string[]) => void;
  /** Omitted when the board is full. */
  onAddImage?: () => void;
  /** True while a photo is being dragged (the host should stop scrolling). */
  onDragActive?: (active: boolean) => void;
  /** Reads the current UI-thread canvas projection once at Begin, including photo focus. */
  captureFrame?: React.MutableRefObject<(() => { x: number; y: number; width: number; height: number }) | null>;
  testID?: string;
};

/**
 * The interactive Vision board. One camera (x, y, scale) moves the whole
 * scene: tapping a photo glides it into focus, tapping the Anchor card does
 * the same for the Vision itself, and anywhere else returns to the board.
 * Long-press lifts a photo so it can trade places with another.
 */
export function VisionBoard({
  tiles, intention, category, art, width, reduceMotion, busy = false, canRegenerate,
  onReplace, onRegenerate, onRemove, onEditVision, onReorder, onAddImage, onDragActive, captureFrame, testID = 'vision-board',
}: VisionBoardProps) {
  const viewport = useMemo(() => boardSizeForWidth(width, tiles.length), [width, tiles.length]);
  const scene = useMemo(() => boardSizeForWidth(width * MOTION.renderScale, tiles.length), [width, tiles.length]);
  const rest = useMemo(() => restCamera(scene, viewport), [scene, viewport]);
  const board = useVisionBoardScene(tiles, scene, rest.scale);
  const { shared, layout, slotRects, order } = board;

  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraScale = shared.cameraScale;
  const sceneOpacity = useSharedValue(1);
  const controls = useSharedValue(0);
  const [focus, setFocus] = useState<VisionBoardFocus>(null);
  const [dragging, setDragging] = useState(false);

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

  const wasFocused = useRef(false);
  useEffect(() => {
    if (focus && !focusRect) { setFocus(null); return; }
    if (focusRect) {
      wasFocused.current = true;
      const target = focusCamera(focusRect, scene, viewport, {
        fill: MOTION.focus.fill, minZoom: MOTION.focus.minZoom, maxZoom: MOTION.focus.maxZoom, clamp: true, offsetY: -24,
      });
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
  const handleOrderCommit = useCallback((next: string[]) => { onReorder([...next, ...tiles.map(tile => tile.sceneId).filter(id => !next.includes(id))]); }, [onReorder, tiles]);
  const handleMove = useCallback((sceneId: string, direction: -1 | 1) => {
    const index = order.indexOf(sceneId);
    const next = moveBoardOrder(order, index, direction);
    if (next === order) return;
    handleOrderCommit(next);
    AccessibilityInfo.announceForAccessibility?.(`Moved to position ${index + direction + 1} of ${order.length}.`);
  }, [handleOrderCommit, order]);

  const focusedTile = focus?.kind === 'photo' ? tiles.find(tile => tile.sceneId === focus.sceneId) ?? null : null;
  const count = tiles.length;

  return (
    <View testID={testID} style={[styles.viewport, { width: viewport.width, height: viewport.height }]}>
      <Animated.View style={[styles.scene, {
        width: scene.width, height: scene.height,
        left: (viewport.width - scene.width) / 2, top: (viewport.height - scene.height) / 2,
      }, cameraStyle]}>
        <VisionBoardScene
          scene={scene}
          roster={board.roster}
          entering={board.entering}
          layout={layout}
          shared={shared}
          initialRectFor={board.initialRectFor}
          intention={intention}
          category={category}
          art={art}
          reduceMotion={reduceMotion}
          interactive
          dragEnabled={!focus && !busy && count > 1}
          onPhotoPress={focusPhoto}
          onCardPress={focusCard}
          onBackgroundPress={focus ? clearFocus : undefined}
          onDragActive={handleDragActive}
          onSwap={handleSwap}
          onOrderCommit={handleOrderCommit}
          onPhotoExited={board.markExited}
          onMovePhoto={handleMove}
          onAddPress={onAddImage}
        />
      </Animated.View>

      {count === 0 ? <View pointerEvents="none" style={styles.empty}><Text style={styles.emptyText}>Bring your future into view.</Text></View> : null}
      {!focus && !dragging && onAddImage && count < VISION_BOARD_MAX_IMAGES ? (
        <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel={`Add an image, ${count} of ${VISION_BOARD_MAX_IMAGES}`}
          onPress={onAddImage} hitSlop={8} style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}>
          <Plus size={14} color={colors.text.primary} />
          <Text style={styles.addText}>Add image</Text>
        </Pressable>
      ) : null}

      {focus ? (
        <Animated.View style={[styles.controls, controlsStyle]} pointerEvents="box-none">
          {focus.kind === 'photo' && !canRegenerate && !busy ? (
            <Text style={styles.regenerationNote}>No image sets left for this Vision.</Text>
          ) : null}
          <View style={styles.controlRow}>
            {focus.kind === 'photo' && focusedTile ? (
              <>
                <ControlButton label="Replace" icon={<ImagePlus size={18} color={colors.paper} />} disabled={busy}
                  onPress={() => onReplace(focusedTile.sceneId)} />
                <ControlButton label="Regenerate" icon={<RefreshCw size={18} color={colors.paper} />} disabled={busy || !canRegenerate}
                  hint={canRegenerate ? undefined : 'No image sets left for this Vision.'}
                  onPress={() => onRegenerate(focusedTile.sceneId)} />
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
    position: 'absolute', bottom: spacing[2], alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.grouped,
  },
  addText: { ...typography.labelMD, color: colors.text.primary },
  controls: { position: 'absolute', left: spacing[2], right: spacing[2], bottom: spacing[3], alignItems: 'center' },
  regenerationNote: { ...typography.caption, color: colors.paper, backgroundColor: INK_GLASS,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.lg, marginBottom: spacing[1] },
  // One compact glass bar: it must fit the narrowest phone's board.
  controlRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 22,
    backgroundColor: INK_GLASS, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,240,230,0.22)',
  },
  control: { minWidth: 70, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 3 },
  controlText: { ...typography.caption, color: colors.paper },
  closeButton: {
    width: 44, height: 40, marginLeft: 2, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(245,240,230,0.22)',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
