import {
  VISION_SLOT_COUNT, assignmentsFromMap, emptySlotMap, firstFreeSlot, freeSlots, highestOccupiedSlot, mapFromOrder, moveToSlot, occupiedCount,
  orderFromMap, placeScene, removeScene, replaceScene, resolveSlotMap, sceneOrdersFromMap, slotOf, swapScenes,
} from '../visionBoardSlots';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

describe('resolveSlotMap', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('migrates a legacy board of %i photographs onto slots 0..n-1 in saved order', count => {
    const map = resolveSlotMap(ids(count));
    expect(map).toHaveLength(VISION_SLOT_COUNT);
    ids(count).forEach((id, i) => expect(map[i]).toBe(id));
    expect(occupiedCount(map)).toBe(count);
  });
  it('honours stored slots, including nonconsecutive ones', () => {
    const map = resolveSlotMap(['a', 'b', 'c'], { a: 5, b: 0, c: 7 });
    expect(map).toEqual(['b', null, null, null, null, 'a', null, 'c']);
    expect(highestOccupiedSlot(map)).toBe(7); expect(freeSlots(map)).toEqual([1, 2, 3, 4, 6]);
  });
  it('places a not-yet-assigned photograph in the lowest free slot, never on top of an assigned one', () => {
    expect(resolveSlotMap(['a', 'b', 'new'], { a: 0, b: 2 })).toEqual(['a', 'new', 'b', null, null, null, null, null]);
  });
  it('ignores invalid and duplicate stored slots instead of overwriting', () => {
    const map = resolveSlotMap(['a', 'b', 'c', 'd'], { a: 3, b: 3, c: 99, d: -1 });
    expect(map[3]).toBe('a'); expect(new Set(map.filter(Boolean)).size).toBe(4);
    expect(map.filter(Boolean).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('is deterministic: the same inputs always give the same board', () => {
    const stored = { a: 4, c: 1 };
    expect(resolveSlotMap(['a', 'b', 'c'], stored)).toEqual(resolveSlotMap(['a', 'b', 'c'], stored));
  });
});

describe('arranging', () => {
  const board = () => resolveSlotMap(['a', 'b', 'c'], { a: 0, b: 3, c: 6 });
  it('moves a photograph into an empty slot without disturbing the others', () => {
    const result = moveToSlot(board(), 'b', 5);
    expect(result.kind).toBe('moved');
    if (result.kind === 'moved') expect(result.map).toEqual(['a', null, null, null, null, 'b', 'c', null]);
  });
  it('never overwrites an occupied slot: it reports the occupant so a swap can be offered', () => {
    expect(moveToSlot(board(), 'a', 3)).toEqual({ kind: 'occupied', occupant: 'b' });
  });
  it('swaps two photographs and nothing else', () => {
    expect(swapScenes(board(), 'a', 'c')).toEqual(['c', null, null, 'b', null, null, 'a', null]);
  });
  it('treats moving to its own slot as no change', () => { expect(moveToSlot(board(), 'a', 0)).toEqual({ kind: 'unchanged' }); });
  it('adding with a chosen slot puts the photograph exactly there; a taken or missing slot falls back to the lowest free one', () => {
    expect(placeScene(board(), 'n', 4)![4]).toBe('n');
    expect(placeScene(board(), 'n', 3)![1]).toBe('n');
    expect(placeScene(board(), 'n')![1]).toBe('n');
  });
  it('a full board has no slot to give', () => {
    const full = resolveSlotMap(ids(8));
    expect(placeScene(full, 'n')).toBeNull(); expect(firstFreeSlot(full)).toBe(-1);
  });
  it('removing a photograph leaves every other photograph where it was', () => {
    expect(removeScene(board(), 'b')).toEqual(['a', null, null, null, null, null, 'c', null]);
  });
  it('a replacement keeps the replaced photograph\'s slot', () => {
    expect(replaceScene(board(), 'b', 'z')[3]).toBe('z'); expect(slotOf(replaceScene(board(), 'b', 'z'), 'b')).toBe(-1);
  });
  it('add, remove, move, swap and reload never rearrange the rest of the board', () => {
    let map = resolveSlotMap(['a', 'b'], { a: 2, b: 5 });
    map = placeScene(map, 'c', 7)!; map = removeScene(map, 'a');
    const moved = moveToSlot(map, 'b', 0); if (moved.kind !== 'moved') throw new Error('expected a move'); map = moved.map;
    map = swapScenes(map, 'b', 'c');
    const stored = assignmentsFromMap(map);
    expect(resolveSlotMap(['b', 'c'], stored)).toEqual(map);
    expect(map).toEqual(['c', null, null, null, null, null, null, 'b']);
  });
});

describe('persistence shape', () => {
  it('round-trips through assignments and through the UI thread order', () => {
    const map = resolveSlotMap(['a', 'b', 'c'], { a: 6, b: 1, c: 4 });
    expect(assignmentsFromMap(map)).toEqual({ a: 6, b: 1, c: 4 });
    expect(mapFromOrder(orderFromMap(map))).toEqual(map);
    expect(orderFromMap(map)).toEqual(['', 'b', '', '', 'c', '', 'a', '']);
  });
  it('saves a dense reading order for the server, in slot order, and keeps unplaced photographs', () => {
    const map = resolveSlotMap(['a', 'b', 'c'], { a: 6, b: 1, c: 4 });
    expect(sceneOrdersFromMap(map, ['a', 'b', 'c'])).toEqual([{ id: 'b', sortOrder: 0 }, { id: 'c', sortOrder: 1 }, { id: 'a', sortOrder: 2 }]);
    expect(sceneOrdersFromMap(emptySlotMap(), ['x']).map(o => o.id)).toEqual(['x']);
  });
});
