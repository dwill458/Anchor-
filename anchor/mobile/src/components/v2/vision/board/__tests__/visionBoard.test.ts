import { boardSizeForWidth, emptyBoardPlaceholderSlots, selectBoardLayout, toSceneRect, VISION_BOARD_ASPECT, type SceneRect } from '../visionBoardLayouts';
import { cameraTransform, cameraTravelMs, clampCamera, focusCamera, restCamera } from '../visionBoardCamera';
import { boardSlotAtPoint, moveBoardOrder, nextBoardRoster, orderTiles, swapBoardOrder, toSceneOrders } from '../visionBoardReorder';

const scene = boardSizeForWidth(600);

function overlapArea(a: SceneRect, b: SceneRect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

describe('shared canvas layouts', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])('keeps %i images in the collection with three large visible scenes', count => {
    expect(selectBoardLayout(count).photos).toHaveLength(Math.min(count, 3));
    expect(selectBoardLayout(count).decor).toEqual([]);
  });
  it('normalizes invalid counts', () => {
    expect(selectBoardLayout(-5).photos).toEqual([]);
    expect(selectBoardLayout(Infinity).photos).toEqual([]);
    expect(selectBoardLayout(99).photos).toHaveLength(3);
  });
  it('scales each photograph and seal proportionally', () => {
    const slot = selectBoardLayout(3).photos[0];
    const small = toSceneRect(slot, boardSizeForWidth(300));
    const large = toSceneRect(slot, boardSizeForWidth(900));
    expect(large.width / small.width).toBeCloseTo(3);
    expect(large.height / small.height).toBeCloseTo(3);
    expect(boardSizeForWidth(300).height).toBeCloseTo(300 / VISION_BOARD_ASPECT);
  });
  it('does not fabricate empty photo slots', () => expect(emptyBoardPlaceholderSlots()).toEqual([]));
});

describe('board camera', () => {
  const viewport = { width: 360, height: 360 / VISION_BOARD_ASPECT };

  it('rests on the whole board', () => {
    const rest = restCamera(scene, viewport);
    expect(rest).toEqual({ x: 0, y: 0, scale: 0.6 });
    expect(cameraTransform(rest)).toEqual({ translateX: -0, translateY: -0, scale: 0.6 });
  });

  it('focuses a photo within the 1.4-1.7x range and centres it where the board allows', () => {
    const rest = restCamera(scene, viewport);
    for (const slot of selectBoardLayout(6).photos) {
      const rect = toSceneRect(slot, scene);
      const camera = focusCamera(rect, scene, viewport, { fill: 0.8, minZoom: 1.4, maxZoom: 1.7, clamp: true });
      expect(camera.scale / rest.scale).toBeGreaterThanOrEqual(1.4 - 1e-9);
      expect(camera.scale / rest.scale).toBeLessThanOrEqual(1.7 + 1e-9);
      // Clamped: the board always covers the viewport.
      const halfVisibleW = viewport.width / 2 / camera.scale;
      expect(Math.abs(camera.x) + halfVisibleW).toBeLessThanOrEqual(scene.width / 2 + 1e-6);
    }
  });

  it('centres exactly when unclamped (Visualize)', () => {
    const rect = toSceneRect(selectBoardLayout(4).photos[2], scene);
    const camera = focusCamera(rect, scene, { width: 390, height: 844 }, { fill: 0.86, minZoom: 1, maxZoom: 10, clamp: false });
    expect(camera.x).toBeCloseTo(rect.x + rect.width / 2 - scene.width / 2);
    expect(camera.y).toBeCloseTo(rect.y + rect.height / 2 - scene.height / 2);
  });

  it('clamps nothing when the board is smaller than the viewport', () => {
    expect(clampCamera({ x: 50, y: -40, scale: 0.1 }, scene, viewport)).toEqual({ x: 0, y: 0, scale: 0.1 });
  });

  it('travels longer for farther moves, within bounds', () => {
    const near = cameraTravelMs({ x: 0, y: 0, scale: 1 }, { x: 10, y: 0, scale: 1 }, viewport, 1200, 1800);
    const far = cameraTravelMs({ x: 0, y: 0, scale: 1 }, { x: 900, y: 900, scale: 2 }, viewport, 1200, 1800);
    expect(near).toBeGreaterThanOrEqual(1200);
    expect(far).toBe(1800);
    expect(far).toBeGreaterThan(near);
  });
});

describe('rearranging', () => {
  it('swaps two slots and leaves the rest', () => {
    expect(swapBoardOrder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('ignores impossible swaps without copying', () => {
    const order = ['a', 'b'];
    expect(swapBoardOrder(order, 0, 0)).toBe(order);
    expect(swapBoardOrder(order, 0, 5)).toBe(order);
    expect(moveBoardOrder(order, 0, -1)).toBe(order);
  });

  it('moves one place for accessible rearrangement', () => {
    expect(moveBoardOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveBoardOrder(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('only swaps when a photo is clearly over another slot', () => {
    const rects = [{ x: 0, y: 0, width: 100, height: 100 }, { x: 200, y: 0, width: 100, height: 100 }];
    expect(boardSlotAtPoint({ x: 250, y: 50 }, rects, 0)).toBe(1);
    // On the neighbour's edge: not yet.
    expect(boardSlotAtPoint({ x: 205, y: 50 }, rects, 0)).toBe(-1);
    // Over its own slot: never a swap.
    expect(boardSlotAtPoint({ x: 50, y: 50 }, rects, 0)).toBe(-1);
  });

  it('persists an order as contiguous sort orders', () => {
    expect(toSceneOrders(['c', 'a', 'b'])).toEqual([{ id: 'c', sortOrder: 0 }, { id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }]);
  });

  it('applies a local order, dropping stale ids and keeping new ones', () => {
    const tiles = ['a', 'b', 'c'].map(sceneId => ({ sceneId }));
    expect(orderTiles(tiles, ['c', 'x', 'a']).map(tile => tile.sceneId)).toEqual(['c', 'a', 'b']);
    expect(orderTiles(tiles, null).map(tile => tile.sceneId)).toEqual(['a', 'b', 'c']);
  });
});

describe('add / remove transitions', () => {
  const tile = (sceneId: string) => ({ sceneId });

  it('keeps a removed photo on the board while it leaves', () => {
    const before = nextBoardRoster([], [tile('a'), tile('b'), tile('c')]);
    const after = nextBoardRoster(before, [tile('a'), tile('c')]);
    expect(after.map(entry => [entry.tile.sceneId, entry.exiting])).toEqual([['a', false], ['c', false], ['b', true]]);
  });

  it('lets it go once its exit has finished', () => {
    const before = nextBoardRoster([], [tile('a'), tile('b')]);
    const leaving = nextBoardRoster(before, [tile('a')]);
    expect(nextBoardRoster(leaving, [tile('a')], new Set(['b'])).map(entry => entry.tile.sceneId)).toEqual(['a']);
  });

  it('adds a new photo without disturbing the others', () => {
    const before = nextBoardRoster([], [tile('a'), tile('b'), tile('c')]);
    const after = nextBoardRoster(before, [tile('a'), tile('b'), tile('c'), tile('d')]);
    expect(after.every(entry => !entry.exiting)).toBe(true);
    expect(after.map(entry => entry.tile.sceneId)).toEqual(['a', 'b', 'c', 'd']);
    // Four photos recompose into the four-photo preset.
    expect(selectBoardLayout(after.length).photos).toHaveLength(3);
  });
});
