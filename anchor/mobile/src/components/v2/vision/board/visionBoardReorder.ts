/**
 * Rearranging photos between the board's curated slots. Photos never land at
 * arbitrary positions: a drag only ever exchanges two photos' slots, so the
 * composition survives every rearrangement.
 */
import type { SceneRect } from './visionBoardLayouts';

/** Exchanges the photos in two slots. Returns the same array when nothing changes. */
export function swapBoardOrder<T>(order: readonly T[], from: number, to: number): T[] {
  'worklet';
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order as T[];
  const next = order.slice();
  const held = next[from];
  next[from] = next[to];
  next[to] = held;
  return next;
}

/** Accessible rearrangement: move the photo in `index` one place earlier (-1) or later (+1). */
export function moveBoardOrder<T>(order: readonly T[], index: number, direction: -1 | 1): T[] {
  return swapBoardOrder(order, index, index + direction);
}

/**
 * The slot a dragged photo is over, or -1. The target area is each slot's
 * rectangle shrunk towards its centre, so a photo has to be clearly over a
 * neighbour before they swap, and small movements near a boundary never
 * make two photos trade back and forth.
 */
export function boardSlotAtPoint(
  point: { x: number; y: number },
  rects: readonly Pick<SceneRect, 'x' | 'y' | 'width' | 'height'>[],
  exclude: number,
  inset = 0.2,
): number {
  'worklet';
  for (let index = 0; index < rects.length; index += 1) {
    if (index === exclude) continue;
    const rect = rects[index];
    const dx = rect.width * inset;
    const dy = rect.height * inset;
    if (point.x >= rect.x + dx && point.x <= rect.x + rect.width - dx && point.y >= rect.y + dy && point.y <= rect.y + rect.height - dy) {
      return index;
    }
  }
  return -1;
}

/** The persisted shape of an order (`PUT /visions/:id/scenes/reorder`). */
export function toSceneOrders(sceneIds: readonly string[]): Array<{ id: string; sortOrder: number }> {
  return sceneIds.map((id, sortOrder) => ({ id, sortOrder }));
}

/** Applies a locally chosen order to tiles, ignoring ids that no longer exist and appending new ones. */
export function orderTiles<T extends { sceneId: string }>(tiles: readonly T[], order: readonly string[] | null): T[] {
  if (!order) return tiles.slice();
  const byId = new Map(tiles.map(tile => [tile.sceneId, tile]));
  const ordered = order.map(id => byId.get(id)).filter((tile): tile is T => Boolean(tile));
  const seen = new Set(ordered.map(tile => tile.sceneId));
  return [...ordered, ...tiles.filter(tile => !seen.has(tile.sceneId))];
}

export type BoardRosterEntry<T> = { tile: T; exiting: boolean };

/**
 * Keeps photos that have just left the Vision on the board while they animate
 * out, so a removal is seen rather than the board simply re-mounting.
 * `previous` is the last roster; `exitingIds` already finished leave for good.
 */
export function nextBoardRoster<T extends { sceneId: string }>(
  previous: readonly BoardRosterEntry<T>[],
  tiles: readonly T[],
  finishedExitIds: ReadonlySet<string> = new Set(),
): BoardRosterEntry<T>[] {
  const current = new Set(tiles.map(tile => tile.sceneId));
  const entering = tiles.map(tile => ({ tile, exiting: false }));
  const leaving = previous
    .filter(entry => !current.has(entry.tile.sceneId) && !finishedExitIds.has(entry.tile.sceneId))
    .map(entry => ({ tile: entry.tile, exiting: true }));
  return [...entering, ...leaving];
}
