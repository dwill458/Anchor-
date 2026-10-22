import {
  VISION_PREVIEW_PRINT_ASPECT,
  VISION_PREVIEW_PRINT_LIMIT,
  normalizedCaption,
  visionItemCountLabel,
  visionPreviewCaption,
  visionPreviewItemCount,
  visionPreviewOverflow,
  visionPreviewPhotos,
  visionPreviewSeed,
  visionPrintSlots,
  visionPrintSpan,
  visionStageHeight,
} from '../visionPreviewCardModel';
import { VISION_PHOTO } from '../material/visionMaterialTokens';

const tile = (id: string, imageUrl: string | null = `https://vision.test/${id}.jpg`) => ({ id, imageUrl });

describe('visionPreviewOverflow', () => {
  it.each([
    [0, 0], [1, 0], [2, 0], [3, 0],
    [4, 1], [5, 2], [8, 5],
  ])('%i photographs show +%i', (total, expected) => {
    expect(visionPreviewOverflow(total)).toBe(expected);
  });

  it('never reports overflow when the total fits the visible thumbnails', () => {
    expect(VISION_PREVIEW_PRINT_LIMIT).toBe(3);
    expect(visionPreviewOverflow(3)).toBe(0);
    expect(visionPreviewOverflow(-4)).toBe(0);
    expect(visionPreviewOverflow(Number.NaN)).toBe(0);
  });
});

describe('item count', () => {
  it('counts photographs plus notes', () => {
    expect(visionPreviewItemCount(3, 2)).toBe(5);
    expect(visionPreviewItemCount(0, 1)).toBe(1);
    expect(visionPreviewItemCount(2)).toBe(2);
  });

  it('formats singular, plural and empty labels', () => {
    expect(visionItemCountLabel(1)).toBe('1 item');
    expect(visionItemCountLabel(3)).toBe('3 items');
    expect(visionItemCountLabel(0)).toBe('No items yet');
  });
});

describe('visionPreviewPhotos', () => {
  it('keeps only tiles with a real image URL, the featured one first, each tile once', () => {
    const photos = visionPreviewPhotos([tile('a'), tile('b', null), tile('c', '  '), tile('d'), tile('a')], 'd');
    expect(photos.map(photo => photo.tile.id)).toEqual(['d', 'a']);
  });

  it('falls back to canonical order when the featured tile was deleted', () => {
    const photos = visionPreviewPhotos([tile('a'), tile('b')], 'gone');
    expect(photos.map(photo => photo.tile.id)).toEqual(['a', 'b']);
  });
});

describe('print geometry', () => {
  it.each([1, 2, 3, 8])('reserves the complete rotated print height for %i photographs before the caption', count => {
    for (const slot of visionPrintSlots(count)) {
      const height = slot.width * (3 * VISION_PHOTO.sidePadRatio + (1 - 2 * VISION_PHOTO.sidePadRatio) / VISION_PREVIEW_PRINT_ASPECT);
      const radians = slot.rotation * Math.PI / 180;
      const rotatedHeight = Math.abs(slot.width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
      const bottom = slot.y + height / 2 + rotatedHeight / 2;
      expect(visionStageHeight(count)).toBeGreaterThanOrEqual(bottom);
    }
  });
  it('lays out one to three prints with the featured print first and largest', () => {
    for (const count of [1, 2, 3]) {
      const slots = visionPrintSlots(count);
      expect(slots).toHaveLength(count);
      expect(slots[0].width).toBe(Math.max(...slots.map(slot => slot.width)));
      expect(slots[0].zIndex).toBe(Math.max(...slots.map(slot => slot.zIndex)));
    }
  });

  it('clamps any higher count to the three-print layout', () => {
    expect(visionPrintSlots(8)).toHaveLength(3);
    expect(visionPrintSlots(0)).toEqual([]);
    expect(visionStageHeight(0)).toBe(0);
    expect(visionStageHeight(8)).toBe(visionStageHeight(3));
  });
});

describe('captions', () => {
  it('always captions with the vision text, falling back to the intention when there is no statement', () => {
    expect(visionPreviewCaption('  Build   Momentum ', 'build momentum')).toBe('Build   Momentum');
    expect(visionPreviewCaption('A considered future', 'Build momentum')).toBe('A considered future');
    expect(visionPreviewCaption('   ', 'Build momentum')).toBe('Build momentum');
    expect(visionPreviewCaption('   ', undefined)).toBeNull();
    expect(normalizedCaption('A  B')).toBe('a b');
  });
});

describe('visionPreviewSeed', () => {
  it('is stable for the same identity and differs between identities', () => {
    expect(visionPreviewSeed('tile-1')).toBe(visionPreviewSeed('tile-1'));
    expect(visionPreviewSeed('tile-1')).not.toBe(visionPreviewSeed('tile-2'));
  });
});

describe('Home spread', () => {
  const printHeight = (width: number) => width * (3 * VISION_PHOTO.sidePadRatio + (1 - 2 * VISION_PHOTO.sidePadRatio) / VISION_PREVIEW_PRINT_ASPECT);
  const overlapFraction = (side: { x: number; width: number }, featured: { x: number; width: number }) => {
    const overlap = Math.max(0, Math.min(side.x + side.width, featured.x + featured.width) - Math.max(side.x, featured.x));
    return overlap / side.width;
  };
  const WIDTHS = [250, 290, 320, 344, 390, 430, 520];

  it.each(WIDTHS)('shows at least 65%% of each side print and keeps the featured print dominant at %ipt', width => {
    const [featured, left, right] = visionPrintSlots(3, width);
    expect(featured.width).toBeGreaterThan(left.width * 1.25); expect(featured.width).toBeGreaterThan(right.width * 1.25);
    expect(featured.zIndex).toBeGreaterThan(left.zIndex); expect(featured.zIndex).toBeGreaterThan(right.zIndex);
    expect(1 - overlapFraction(left, featured)).toBeGreaterThanOrEqual(0.65); expect(1 - overlapFraction(left, featured)).toBeLessThanOrEqual(0.72);
    expect(1 - overlapFraction(right, featured)).toBeGreaterThanOrEqual(0.65); expect(1 - overlapFraction(right, featured)).toBeLessThanOrEqual(0.72);
  });
  it.each(WIDTHS)('keeps every tilted print inside the stage at %ipt, for 1, 2 and 3 prints', width => {
    for (const count of [1, 2, 3, 8]) {
      for (const slot of visionPrintSlots(count, width)) {
        const span = visionPrintSpan(slot);
        expect(span.left).toBeGreaterThanOrEqual(0); expect(span.right).toBeLessThanOrEqual(1);
      }
    }
  });
  it('spreads the side prints further out than the old tucked layout', () => {
    const [, oldLeft, oldRight] = visionPrintSlots(3);
    const [, left, right] = visionPrintSlots(3, 344);
    expect(left.x).toBeLessThanOrEqual(oldLeft.x + 0.03); expect(right.x + right.width).toBeGreaterThanOrEqual(oldRight.x + oldRight.width - 0.03);
    const [, oldLeft2] = [null, oldLeft];
    expect(overlapFraction(oldLeft2, visionPrintSlots(3)[0])).toBeGreaterThan(0.35);
  });
  it('reserves the full rotated print height for the caption below, at every width', () => {
    for (const width of WIDTHS) for (const count of [1, 2, 3]) {
      const stage = visionStageHeight(count, width);
      for (const slot of visionPrintSlots(count, width)) {
        const radians = slot.rotation * Math.PI / 180, height = printHeight(slot.width);
        expect(stage).toBeGreaterThanOrEqual(slot.y + height / 2 + (Math.abs(slot.width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2 - 1e-9);
      }
    }
  });
  it('one print is centred, two sit as a pair, four or more use the three-print layout', () => {
    const one = visionPrintSlots(1, 344); expect(one).toHaveLength(1); expect(one[0].x + one[0].width / 2).toBeCloseTo(0.5, 2);
    const two = visionPrintSlots(2, 344); expect(two).toHaveLength(2); expect(two[0].width).toBeGreaterThan(two[1].width);
    const span = [two[0], two[1]].map(visionPrintSpan); expect((Math.min(...span.map(s => s.left)) + Math.max(...span.map(s => s.right))) / 2).toBeCloseTo(0.5, 1);
    expect(visionPrintSlots(5, 344)).toEqual(visionPrintSlots(3, 344));
  });
});
