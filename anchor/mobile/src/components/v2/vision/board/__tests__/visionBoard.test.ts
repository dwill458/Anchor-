import {
  boardAttachmentFor, boardSizeForWidth, emptyBoardPlaceholderSlots, selectBoardLayout, toSceneRect,
  VISION_BOARD_ASPECT, VISION_BOARD_MAX_IMAGES, type SceneRect,
} from '../visionBoardLayouts';
import { cameraTransform, cameraTravelMs, clampCamera, focusCamera, restCamera } from '../visionBoardCamera';
import {
  boardSlotAtPoint, moveBoardOrder, nextBoardRoster, orderTiles, swapBoardOrder, toSceneOrders,
} from '../visionBoardReorder';
import { intentionTypeScale } from '../VisionBoardIntentionCard';
import { VISION_BOARD_ASSET_METRICS } from '../visionBoardAssetMetrics.generated';

const scene = boardSizeForWidth(600);

function overlapArea(a: SceneRect, b: SceneRect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

describe('board layouts', () => {
  it('has a curated composition for every count from empty to the maximum', () => {
    for (let count = 0; count <= VISION_BOARD_MAX_IMAGES; count++) {
      expect(selectBoardLayout(count).photos).toHaveLength(count);
    }
  });

  it('never exceeds the maximum and never goes below empty', () => {
    expect(selectBoardLayout(9).photos).toHaveLength(VISION_BOARD_MAX_IMAGES);
    expect(selectBoardLayout(-2).photos).toHaveLength(0);
    expect(selectBoardLayout(Number.NaN).photos).toHaveLength(0);
  });

  it.each([3, 4, 5, 6])('%i photos stay on the board, overlap only slightly, and leave the Anchor dominant', count => {
    const layout = selectBoardLayout(count);
    const photos = layout.photos.map(slot => toSceneRect(slot, scene));
    const card = toSceneRect(layout.card, scene);
    for (const photo of photos) {
      // Centres stay within the linen; edges may overhang the frame a little, as on a real board.
      expect(photo.x + photo.width / 2).toBeGreaterThan(scene.width * 0.08);
      expect(photo.x + photo.width / 2).toBeLessThan(scene.width * 0.92);
      expect(photo.y).toBeGreaterThan(-scene.height * 0.01);
      expect(photo.y + photo.height).toBeLessThan(scene.height * 1.01);
      // Mild rotation only.
      expect(Math.abs(photo.rotation)).toBeLessThanOrEqual(4);
      // The Anchor card sits above every photo.
      expect(card.zIndex).toBeGreaterThan(photo.zIndex);
    }
    for (let a = 0; a < photos.length; a++) {
      for (let b = a + 1; b < photos.length; b++) {
        const shared = overlapArea(photos[a], photos[b]);
        const smaller = Math.min(photos[a].width * photos[a].height, photos[b].width * photos[b].height);
        expect(shared / smaller).toBeLessThan(0.12);
      }
    }
    // Not a grid: sizes and rotations vary.
    expect(new Set(layout.photos.map(slot => slot.width)).size).toBeGreaterThan(1);
    expect(new Set(layout.photos.map(slot => slot.rotation)).size).toBe(count);
    // The card is centred and as large as the largest photo's shorter side.
    expect(Math.abs(card.x + card.width / 2 - scene.width / 2)).toBeLessThan(scene.width * 0.04);
    expect(card.height).toBeGreaterThan(Math.max(...photos.map(photo => Math.min(photo.width, photo.height))));
  });

  it('keeps ephemera restrained and beneath the photographs', () => {
    for (let count = 0; count <= VISION_BOARD_MAX_IMAGES; count++) {
      const layout = selectBoardLayout(count);
      expect(layout.decor.length).toBeLessThanOrEqual(3);
      const lowestPhoto = Math.min(...layout.photos.map(slot => slot.zIndex), Infinity);
      for (const item of layout.decor) expect(item.zIndex).toBeLessThan(Math.min(lowestPhoto, layout.card.zIndex));
    }
  });

  it('resolves normalised slots for any board size', () => {
    const slot = selectBoardLayout(3).photos[0];
    const small = toSceneRect(slot, boardSizeForWidth(300));
    const large = toSceneRect(slot, boardSizeForWidth(900));
    expect(large.width / small.width).toBeCloseTo(3);
    expect(large.x / small.x).toBeCloseTo(3);
    expect(large.height / large.width).toBeCloseTo(1 / slot.aspectRatio);
    expect(boardSizeForWidth(300).height).toBeCloseTo(300 / VISION_BOARD_ASPECT);
  });

  it('frames match their torn-frame artwork, so nothing is distorted', () => {
    for (const slot of selectBoardLayout(6).photos) {
      expect(slot.aspectRatio).toBe(VISION_BOARD_ASSET_METRICS[`frame-${slot.frame}`].aspect);
    }
  });

  it('offers placeholders on an empty board where the first photos will go', () => {
    expect(emptyBoardPlaceholderSlots()).toHaveLength(3);
  });

  it('fixes each photo the same way every time', () => {
    expect(boardAttachmentFor('scene-a')).toBe(boardAttachmentFor('scene-a'));
  });
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
    const rect = toSceneRect(selectBoardLayout(4).photos[3], scene);
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
    expect(selectBoardLayout(after.length).count).toBe(4);
  });
});

describe('intention card', () => {
  it('writes short intentions large and long ones smaller, within a line limit', () => {
    expect(intentionTypeScale('Anchor has ten thousand users')).toEqual({ fontScale: 1, lines: 3 });
    const long = intentionTypeScale('I lead a calm, profitable studio that gives my family time and lets me travel with them every summer');
    expect(long.fontScale).toBeLessThan(1);
    expect(long.lines).toBeLessThanOrEqual(4);
  });
});
