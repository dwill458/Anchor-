import {
  BOARD_FRAME_ASPECT, BOARD_FRAME_WINDOW, VISION_BOARD_MAX_IMAGES, VISION_BOARD_PAPER_MARK_SCALE, detailBoardSizeForWidth, selectDetailBoardLayout, toSceneRect,
  type BoardLayout, type SceneRect, type Size,
} from '../visionBoardLayouts';

const COUNTS = Array.from({ length: VISION_BOARD_MAX_IMAGES + 1 }, (_, count) => count);
const WIDTH = 320;
/** Tolerance in scene pixels for edge and bounds checks, absorbing float rounding only. */
const EDGE_PX = 0.5;

type Box = { left: number; right: number; top: number; bottom: number };

function sceneFor(count: number): Size {
  return detailBoardSizeForWidth(WIDTH, count);
}

/** The unrotated rectangle of a slot, in scene pixels. */
function rectOf(layout: BoardLayout, index: number, scene: Size): SceneRect {
  return toSceneRect(layout.photos[index], scene);
}

/** The axis-aligned bounds of a rotated rectangle, so a tilted print is checked by its real extent. */
function rotatedBounds(rect: SceneRect): Box {
  const radians = rect.rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.height * cos + rect.width * sin;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return { left: cx - width / 2, right: cx + width / 2, top: cy - height / 2, bottom: cy + height / 2 };
}

function boxOf(rect: SceneRect): Box {
  return { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height };
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function area(box: Box): number {
  return (box.right - box.left) * (box.bottom - box.top);
}

/** Position of every photo, in board-width units, so compositions with different heights compare fairly. */
function widthUnitCentres(layout: BoardLayout, count: number): Array<{ x: number; y: number }> {
  const scene = sceneFor(count);
  return layout.photos.map(slot => {
    const rect = toSceneRect(slot, scene);
    return { x: (rect.x + rect.width / 2) / WIDTH, y: (rect.y + rect.height / 2) / WIDTH };
  });
}

describe('scrapbook recipes for every photo count', () => {
  it.each(COUNTS)('composes %i photos with one slot each', count => {
    const layout = selectDetailBoardLayout(count);
    expect(layout.count).toBe(count);
    expect(layout.photos).toHaveLength(count);
    for (const slot of layout.photos) {
      expect(slot.width).toBeGreaterThan(0);
      expect(slot.aspectRatio).toBeGreaterThan(0);
    }
  });

  it.each(COUNTS)('is deterministic for %i photos and never reads Math.random', count => {
    const random = jest.spyOn(Math, 'random');
    const first = selectDetailBoardLayout(count);
    const second = selectDetailBoardLayout(count);
    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('clamps invalid and oversized counts to the board range', () => {
    expect(selectDetailBoardLayout(-3).count).toBe(0);
    expect(selectDetailBoardLayout(Number.NaN).count).toBe(0);
    expect(selectDetailBoardLayout(Infinity).count).toBe(0);
    expect(selectDetailBoardLayout(99).count).toBe(VISION_BOARD_MAX_IMAGES);
    expect(selectDetailBoardLayout(99).photos).toHaveLength(VISION_BOARD_MAX_IMAGES);
  });

  it.each(COUNTS)('keeps every print and the Anchor inside the board for %i photos, rotation included', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    layout.photos.forEach((_, index) => {
      const bounds = rotatedBounds(rectOf(layout, index, scene));
      expect(bounds.left).toBeGreaterThanOrEqual(-EDGE_PX);
      expect(bounds.top).toBeGreaterThanOrEqual(-EDGE_PX);
      expect(bounds.right).toBeLessThanOrEqual(scene.width + EDGE_PX);
      expect(bounds.bottom).toBeLessThanOrEqual(scene.height + EDGE_PX);
    });
    const anchor = rotatedBounds(toSceneRect(layout.card, scene));
    expect(anchor.left).toBeGreaterThanOrEqual(-EDGE_PX);
    expect(anchor.top).toBeGreaterThanOrEqual(-EDGE_PX);
    expect(anchor.right).toBeLessThanOrEqual(scene.width + EDGE_PX);
    expect(anchor.bottom).toBeLessThanOrEqual(scene.height + EDGE_PX);
  });

  it.each(COUNTS)('keeps tape strips on the board for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    for (const tape of layout.decor) {
      expect(tape.photo).toBeGreaterThanOrEqual(0);
      expect(tape.photo).toBeLessThan(count);
      const print = rectOf(layout, tape.photo, scene);
      const tapeWidth = tape.width * print.width;
      const tapeLeft = print.x + tape.offset * print.width - tapeWidth / 2;
      // The strip overhangs the print's top edge by less than half its height (18pt tape, 0.45 overhang).
      const tapeTop = print.y - 18 * 0.45;
      expect(tapeLeft).toBeGreaterThanOrEqual(-EDGE_PX);
      expect(tapeLeft + tapeWidth).toBeLessThanOrEqual(scene.width + EDGE_PX);
      expect(tapeTop).toBeGreaterThanOrEqual(-EDGE_PX);
    }
  });

  it.each(COUNTS)('tilts every print within the photograph limit for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    for (const slot of layout.photos) expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(6);
    expect(Math.abs(layout.card.rotation)).toBeLessThanOrEqual(3);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('keeps every print at least 26%% of the board width for %i photos', count => {
    // On a 260pt board that is 68pt or more: enough for a handwritten caption to stay readable.
    const layout = selectDetailBoardLayout(count);
    for (const slot of layout.photos) expect(slot.width * 260).toBeGreaterThanOrEqual(67.6);
  });

  it.each([0, 4, 5, 6, 7, 8])('places zero photo overlaps on the Anchor centre region for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    const anchor = boxOf(toSceneRect(layout.card, scene));
    const anchorArea = area(anchor);
    layout.photos.forEach((_, index) => {
      // Tolerance: a sliver of 0.5% of the Anchor's own area, for rounding at shared edges.
      expect(overlapArea(boxOf(rectOf(layout, index, scene)), anchor)).toBeLessThanOrEqual(anchorArea * 0.005);
    });
  });

  it.each([1, 2, 3])('centres the full paper medallion over the %i-photo collage and clears Add', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    expect(layout.card.x).toBe(0.5);
    const markBottom = layout.card.y * scene.height + layout.card.width * scene.width * VISION_BOARD_PAPER_MARK_SCALE / 2;
    const addTop = scene.height - 8 - 44;
    expect(addTop - markBottom).toBeGreaterThanOrEqual(8);
    for (const photo of layout.photos) expect(photo.zIndex).toBeLessThan(layout.card.zIndex);
  });

  it.each(COUNTS.slice(3))('centres the Anchor horizontally for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    const rect = toSceneRect(layout.card, scene);
    expect(rect.x + rect.width / 2).toBeCloseTo(scene.width / 2, 6);
  });

  it.each(COUNTS.slice(4))('centres the Anchor exactly on the board for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    const rect = toSceneRect(layout.card, scene);
    expect(rect.x + rect.width / 2).toBeCloseTo(scene.width / 2, 6);
    expect(rect.y + rect.height / 2).toBeCloseTo(scene.height / 2, 6);
  });

  it('places the three-photo Anchor centre below the hero, overlapping its lower paper edge', () => {
    const layout = selectDetailBoardLayout(3);
    const scene = sceneFor(3);
    const hero = boxOf(rectOf(layout, 0, scene));
    const anchor = boxOf(toSceneRect(layout.card, scene));
    expect((anchor.top + anchor.bottom) / 2).toBeGreaterThan(hero.bottom);
    expect(anchor.top).toBeLessThan(hero.bottom);
    expect(anchor.bottom).toBeLessThan(scene.height);
    expect(anchor.top).toBeGreaterThan(scene.height / 2);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])('leaves about a 24pt gap between the lowest print and the Add control for %i photos', count => {
    // The Add chip sits 8pt above the board's foot and is 44pt tall. On a 320pt board the gap should be 10 to 30pt.
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    const lowest = Math.max(...layout.photos.map((_, index) => rectOf(layout, index, scene).y + rectOf(layout, index, scene).height));
    const addTop = scene.height - 8 - 44;
    expect(addTop - lowest).toBeGreaterThanOrEqual(10);
    expect(addTop - lowest).toBeLessThanOrEqual(30);
  });

  it.each(COUNTS)('keeps overlaps between prints controlled for %i photos', count => {
    const layout = selectDetailBoardLayout(count);
    const scene = sceneFor(count);
    for (let i = 0; i < layout.photos.length; i++) {
      for (let j = i + 1; j < layout.photos.length; j++) {
        const a = boxOf(rectOf(layout, i, scene));
        const b = boxOf(rectOf(layout, j, scene));
        const smaller = Math.min(area(a), area(b));
        // No print hides more than 30% of a neighbour: layered like a scrapbook, never stacked.
        expect(overlapArea(a, b)).toBeLessThanOrEqual(smaller * 0.3);
      }
    }
  });

  it('gives the hero (first print) the largest width at every count with three or more prints', () => {
    for (const count of COUNTS.slice(3)) {
      const layout = selectDetailBoardLayout(count);
      const widest = Math.max(...layout.photos.map(slot => slot.width));
      expect(layout.photos[0].width).toBe(widest);
    }
  });

  it('keeps the composition stable when a photo is added: existing prints move no more than a fifth of the board width', () => {
    for (let count = 1; count < VISION_BOARD_MAX_IMAGES; count++) {
      const before = widthUnitCentres(selectDetailBoardLayout(count), count);
      const after = widthUnitCentres(selectDetailBoardLayout(count + 1), count + 1);
      before.forEach((centre, index) => {
        const moved = Math.hypot(after[index].x - centre.x, after[index].y - centre.y);
        expect(moved).toBeLessThanOrEqual(0.2);
      });
    }
  });

  it('keeps the seven-print spread\'s sides, sizes and tilts for its first seven prints at eight photos', () => {
    // The board is taller at eight photos, so vertical positions are not compared here: the step test bounds them.
    const seven = selectDetailBoardLayout(7).photos;
    const eight = selectDetailBoardLayout(8).photos;
    const strip = (slot: (typeof seven)[number]) => ({ frame: slot.frame, x: slot.x, width: slot.width, aspectRatio: slot.aspectRatio, rotation: slot.rotation, zIndex: slot.zIndex });
    expect(eight.slice(0, 7).map(strip)).toEqual(seven.map(strip));
  });

  it('uses the board proportions of each count for its size', () => {
    expect(detailBoardSizeForWidth(WIDTH, 0).height).toBeCloseTo(WIDTH * 0.45);
    expect(detailBoardSizeForWidth(WIDTH, 1).height).toBeCloseTo(WIDTH * 1.25);
    expect(detailBoardSizeForWidth(WIDTH, 3).height).toBeCloseTo(WIDTH * 1.15);
    expect(detailBoardSizeForWidth(WIDTH, 6).height).toBeCloseTo(WIDTH * 1.44);
    expect(detailBoardSizeForWidth(WIDTH, 8).height).toBeCloseTo(WIDTH * 1.93);
  });
});

describe('mount windows', () => {
  it.each(['landscape', 'portrait', 'square'] as const)('keeps the %s photograph window inside its print', kind => {
    const window = BOARD_FRAME_WINDOW[kind];
    expect(window.left).toBeGreaterThan(0);
    expect(window.right).toBeLessThan(1);
    expect(window.top).toBeGreaterThan(0);
    expect(window.left).toBeLessThan(window.right);
    expect(window.top).toBeLessThan(window.bottom);
    expect(window.bottom).toBeLessThan(1);
  });

  /** Window width / height in the print's own proportions. */
  const windowAspect = (kind: 'landscape' | 'portrait' | 'square') => {
    const window = BOARD_FRAME_WINDOW[kind];
    return (window.right - window.left) * BOARD_FRAME_ASPECT[kind] / (window.bottom - window.top);
  };

  it('gives the hero (landscape) window about 4:3, so a cover crop keeps faces', () => {
    expect(windowAspect('landscape')).toBeGreaterThanOrEqual(1.25);
    expect(windowAspect('landscape')).toBeLessThanOrEqual(1.35);
  });

  it('gives the square supporting prints a window between 1.1 and 1.25 : 1', () => {
    expect(windowAspect('square')).toBeGreaterThanOrEqual(1.1);
    expect(windowAspect('square')).toBeLessThanOrEqual(1.25);
  });

  it.each(['landscape', 'portrait', 'square'] as const)('keeps the %s caption band at or under 12%% of the print', kind => {
    expect(1 - BOARD_FRAME_WINDOW[kind].bottom).toBeLessThanOrEqual(0.12 + 1e-9);
  });
});
