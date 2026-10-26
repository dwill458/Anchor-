import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { V2VisionTile } from '@/adapters/v2/vision';
import {
  BOARD_FRAME_KINDS, selectBoardLayout, selectDetailBoardLayout, selectSlotBoardLayout, toSceneRect,
  type BoardLayout, type SceneRect, type Size,
} from './visionBoardLayouts';
import { nextBoardRoster, type BoardRosterEntry } from './visionBoardReorder';
import { orderFromMap } from './visionBoardSlots';
import type { VisionBoardComposition } from './visionBoardComposition';

/** A slot resolved for the UI thread: scene px plus its frame kind as an index into BOARD_FRAME_KINDS. */
export type BoardSlotRect = SceneRect & { frame: number };

export type VisionBoardShared = {
  /** Slot rectangles of the current composition, in scene px. */
  slots: SharedValue<BoardSlotRect[]>;
  /** Scene id in each slot. Rewritten on the UI thread while a photo is dragged. */
  order: SharedValue<string[]>;
  /** Bumped when the composition itself changes (image count, board size). */
  layoutVersion: SharedValue<number>;
  /** The scene id being dragged, or ''. */
  dragging: SharedValue<string>;
  /** Current camera scale, so drags can convert finger movement into scene px. */
  cameraScale: SharedValue<number>;
  recomposeMs?: SharedValue<number>;
};

export function resolveBoardSlots(layout: BoardLayout, scene: Size): BoardSlotRect[] {
  return layout.photos.map(slot => ({ ...toSceneRect(slot, scene), frame: BOARD_FRAME_KINDS.indexOf(slot.frame) }));
}

/**
 * Owns the board's composition for a set of Vision tiles: which preset, where
 * every slot is in scene px, which photos are entering or leaving, and the
 * shared values the photos animate from on the UI thread.
 *
 * Photos are never re-mounted for a layout change: the composition changes
 * underneath them and each one travels to its new slot.
 *
 * With `slotBoard` (the Vision board), the composition is the fixed eight-slot arrangement and each photograph is in the
 * slot it was given, so `order` has eight entries (`''` for an empty slot) and nothing is ever re-flowed.
 */
export function useVisionBoardScene(tiles: readonly V2VisionTile[], scene: Size, initialCameraScale = 1, detail = false,
  slotBoard?: { map: readonly (string | null)[]; heightRatio: number }, composition?: VisionBoardComposition) {
  const [finishedExits, setFinishedExits] = useState<ReadonlySet<string>>(() => new Set());
  const rosterRef = useRef<BoardRosterEntry<V2VisionTile>[]>([]);
  const roster = useMemo(() => {
    const next = nextBoardRoster(rosterRef.current, tiles, finishedExits);
    rosterRef.current = next;
    return next;
  }, [finishedExits, tiles]);

  // Photos present on the first render are simply there; later arrivals enter.
  const seenRef = useRef<Set<string> | null>(null);
  if (seenRef.current === null) seenRef.current = new Set(tiles.map(tile => tile.sceneId));
  const entering = useMemo(() => {
    const seen = seenRef.current!;
    const ids = new Set<string>();
    for (const tile of tiles) {
      if (!seen.has(tile.sceneId)) ids.add(tile.sceneId);
    }
    return ids;
  }, [tiles]);
  useEffect(() => {
    tiles.forEach(tile => seenRef.current!.add(tile.sceneId));
  }, [tiles]);

  const slotMap = slotBoard?.map, slotHeightRatio = slotBoard?.heightRatio;
  const layout = useMemo(() => composition?.layout ?? (slotHeightRatio !== undefined ? selectSlotBoardLayout(slotHeightRatio)
    : detail ? selectDetailBoardLayout(tiles.length) : selectBoardLayout(tiles.length)), [composition?.layout, tiles.length, detail, slotHeightRatio]);
  const slotRects = useMemo(() => resolveBoardSlots(layout, scene), [layout, scene]);
  const order = useMemo(() => composition?.order ?? (slotMap ? orderFromMap(slotMap) : tiles.slice(0, layout.photos.length).map(tile => tile.sceneId)), [composition?.order, layout.photos.length, tiles, slotMap]);

  const slots = useSharedValue<BoardSlotRect[]>(slotRects);
  const orderValue = useSharedValue<string[]>(order);
  const layoutVersion = useSharedValue(0);
  const dragging = useSharedValue('');
  const cameraScale = useSharedValue(initialCameraScale);
  const recomposeMs = useSharedValue(1000);
  // One stable object: the scene is memoised and must not re-render with its host.
  const shared: VisionBoardShared = useMemo(
    () => ({ slots, order: orderValue, layoutVersion, dragging, cameraScale, recomposeMs }),
    [cameraScale, dragging, layoutVersion, orderValue, slots, recomposeMs],
  );

  const layoutKey = JSON.stringify(slotRects);
  const lastLayoutKey = useRef(layoutKey);
  useEffect(() => {
    const key = layoutKey;
    shared.slots.value = slotRects;
    shared.order.value = order;
    if (key !== lastLayoutKey.current) {
      lastLayoutKey.current = key;
      shared.layoutVersion.value += 1;
    }
    // Shared values are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, slotRects]);

  const markExited = useCallback((sceneId: string) => {
    setFinishedExits(previous => {
      if (previous.has(sceneId)) return previous;
      const next = new Set(previous);
      next.add(sceneId);
      return next;
    });
  }, []);

  /** Where each photo currently belongs, for first placement on mount. */
  const initialRectFor = useCallback((sceneId: string): BoardSlotRect | null => {
    const index = order.indexOf(sceneId);
    return index >= 0 ? slotRects[index] : null;
  }, [order, slotRects]);

  return { roster, entering, layout, slotRects, order, shared, markExited, initialRectFor };
}
