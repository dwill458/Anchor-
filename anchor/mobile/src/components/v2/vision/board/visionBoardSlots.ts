/**
 * The board's stable positions.
 *
 * The board has eight fixed slots, `slot-0` to `slot-7`, each at the same place on the sheet whatever else is on it.
 * A photograph belongs to one slot until the person moves it; adding, removing or moving another photograph never
 * shifts it. The board is a sparse array of scene ids indexed by slot, with `null` for an empty position.
 *
 * Nothing here knows about layout or rendering, so the rules can be tested in Node and reused by the UI thread's
 * drag handling (the helpers that run there are marked as worklets).
 */
export const VISION_SLOT_COUNT = 8;

export type VisionSlotMap = ReadonlyArray<string | null>;
/** Persisted shape: scene id to slot index. Scenes that are absent have not been placed yet. */
export type VisionSlotAssignments = Readonly<Record<string, number>>;

export const slotId = (slot: number) => `slot-${slot}`;

const validSlot = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < VISION_SLOT_COUNT;

export const emptySlotMap = (): (string | null)[] => Array.from({ length: VISION_SLOT_COUNT }, () => null);

/**
 * Resolves where every photograph sits.
 *
 * `sceneIds` are the Vision's active photographs in their saved order (`sortOrder`). A photograph with a stored,
 * valid and unclaimed slot keeps it. Every other photograph, which is every photograph of a board saved before
 * slots existed, takes the lowest free slot in saved order. For a legacy board that is slot `i` for the `i`th
 * photograph, which is exactly the arrangement the board always showed, so old boards migrate without moving.
 */
export function resolveSlotMap(sceneIds: readonly string[], stored?: VisionSlotAssignments | null): (string | null)[] {
  const map = emptySlotMap();
  const unplaced: string[] = [];
  for (const id of sceneIds) {
    const slot = stored?.[id];
    if (validSlot(slot) && map[slot] === null) map[slot] = id;
    else unplaced.push(id);
  }
  for (const id of unplaced) {
    const free = map.indexOf(null);
    if (free === -1) break;
    map[free] = id;
  }
  return map;
}

export const slotOf = (map: VisionSlotMap, sceneId: string) => map.indexOf(sceneId);
export const occupiedCount = (map: VisionSlotMap) => map.reduce<number>((count, id) => count + (id ? 1 : 0), 0);
export const freeSlots = (map: VisionSlotMap) => map.flatMap((id, slot) => (id ? [] : [slot]));
export const firstFreeSlot = (map: VisionSlotMap) => map.indexOf(null);
/** The highest occupied slot, or -1 for an empty board. */
export const highestOccupiedSlot = (map: VisionSlotMap) => map.reduce((highest, id, slot) => (id ? slot : highest), -1);

export type SlotMove =
  | { kind: 'moved'; map: (string | null)[] }
  /** The target holds another photograph. Nothing has changed: the caller offers to swap. */
  | { kind: 'occupied'; occupant: string }
  | { kind: 'unchanged' };

/** Moves a photograph into a slot. An empty slot takes it; an occupied slot is never overwritten. */
export function moveToSlot(map: VisionSlotMap, sceneId: string, slot: number): SlotMove {
  const from = slotOf(map, sceneId);
  if (!validSlot(slot) || from === -1 || from === slot) return { kind: 'unchanged' };
  const occupant = map[slot];
  if (occupant) return { kind: 'occupied', occupant };
  const next = map.slice();
  next[from] = null;
  next[slot] = sceneId;
  return { kind: 'moved', map: next };
}

/** Exchanges two photographs' slots. */
export function swapScenes(map: VisionSlotMap, a: string, b: string): (string | null)[] {
  const next = map.slice();
  const from = slotOf(map, a), to = slotOf(map, b);
  if (from === -1 || to === -1) return next;
  next[from] = b;
  next[to] = a;
  return next;
}

/** Puts a new photograph in a slot (the lowest free one when `slot` is absent or taken). Returns null when the board is full. */
export function placeScene(map: VisionSlotMap, sceneId: string, slot?: number): (string | null)[] | null {
  if (slotOf(map, sceneId) !== -1) return map.slice();
  const target = validSlot(slot) && map[slot] === null ? slot : firstFreeSlot(map);
  if (target === -1) return null;
  const next = map.slice();
  next[target] = sceneId;
  return next;
}

/** Removing a photograph empties its slot and leaves every other photograph exactly where it is. */
export function removeScene(map: VisionSlotMap, sceneId: string): (string | null)[] {
  return map.map(id => (id === sceneId ? null : id));
}

/** A replacement takes the exact slot of the photograph it replaces. */
export function replaceScene(map: VisionSlotMap, oldId: string, newId: string): (string | null)[] {
  return map.map(id => (id === oldId ? newId : id));
}

export function assignmentsFromMap(map: VisionSlotMap): Record<string, number> {
  const assignments: Record<string, number> = {};
  map.forEach((id, slot) => { if (id) assignments[id] = slot; });
  return assignments;
}

/** A UI-thread order (`''` marks an empty slot) back to a map. */
export function mapFromOrder(order: readonly string[]): (string | null)[] {
  const map = emptySlotMap();
  for (let slot = 0; slot < VISION_SLOT_COUNT; slot += 1) map[slot] = order[slot] ? order[slot] : null;
  return map;
}

/** The map as the UI thread holds it: always eight entries, `''` for an empty slot. */
export function orderFromMap(map: VisionSlotMap): string[] {
  return Array.from({ length: VISION_SLOT_COUNT }, (_, slot) => map[slot] ?? '');
}

/**
 * The saved order that goes with an arrangement: photographs in slot order. The server needs a dense 0..n-1 order, so
 * the arrangement itself lives in the slot assignments; this keeps Home, Visualize and the share image reading the
 * photographs in the same reading order as the board, top to bottom.
 */
export function sceneOrdersFromMap(map: VisionSlotMap, allSceneIds: readonly string[]): Array<{ id: string; sortOrder: number }> {
  const placed = map.filter((id): id is string => Boolean(id));
  const rest = allSceneIds.filter(id => !placed.includes(id));
  return [...placed, ...rest].map((id, sortOrder) => ({ id, sortOrder }));
}

/** Where the lowest free slot is, for an "add" that names no position. */
export function nextSlotFor(map: VisionSlotMap): number | null {
  const free = firstFreeSlot(map);
  return free === -1 ? null : free;
}

/** Spoken name of a slot, for accessibility. 1-based, in reading order. */
export const slotLabel = (slot: number) => `position ${slot + 1} of ${VISION_SLOT_COUNT}`;

/** Worklet-safe swap of two entries of the UI thread's order. Returns the same array when nothing changes. */
export function swapOrderEntries(order: readonly string[], from: number, to: number): string[] {
  'worklet';
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order as string[];
  const next = order.slice();
  const held = next[from];
  next[from] = next[to];
  next[to] = held;
  return next;
}
