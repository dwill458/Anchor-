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
