import { assessPhotoFit, computeCropRect, computeExpandPlan, photoFitExplanation, VISION_PHOTO_TARGET_ASPECT } from '../visionPhotoFit';

describe('assessPhotoFit', () => {
  it('leaves a photo that already matches 9:16 alone', () => {
    expect(assessPhotoFit({ width: 1080, height: 1920 }).relation).toBe('fits');
    expect(assessPhotoFit({ width: 1080, height: 1920 }).canExpand).toBe(false);
    // Within tolerance (a 1079x1920 export).
    expect(assessPhotoFit({ width: 1079, height: 1920 }).relation).toBe('fits');
  });

  it('treats a 3:4 phone portrait as needing a choice, not as a fit', () => {
    const result = assessPhotoFit({ width: 3024, height: 4032 });
    expect(result.relation).toBe('wider');
    expect(result.retained).toBeCloseTo(0.75, 1);
  });

  it('classifies landscape and square as wider, and very tall as taller', () => {
    expect(assessPhotoFit({ width: 4000, height: 3000 }).relation).toBe('wider');
    expect(assessPhotoFit({ width: 2000, height: 2000 }).relation).toBe('wider');
    expect(assessPhotoFit({ width: 1000, height: 3000 }).relation).toBe('taller');
  });

  it('refuses to offer expansion when most of the frame would be invented', () => {
    const wide = assessPhotoFit({ width: 4000, height: 1000 });
    expect(wide.invented).toBeGreaterThan(0.6);
    expect(wide.canExpand).toBe(false);
    expect(assessPhotoFit({ width: 2000, height: 2000 }).canExpand).toBe(true);
  });

  it('treats unknown or invalid dimensions as needing no change instead of throwing', () => {
    for (const size of [{ width: 0, height: 0 }, { width: NaN, height: 10 }, { width: -5, height: 10 }, { width: Infinity, height: 3 }]) {
      expect(assessPhotoFit(size).relation).toBe('fits');
    }
  });
});

describe('computeCropRect', () => {
  const aspect = (rect: { width: number; height: number }) => rect.width / rect.height;

  it('crops a landscape photo to 9:16 at full height, centred by default', () => {
    const rect = computeCropRect({ width: 4000, height: 3000 });
    expect(rect.height).toBe(3000);
    expect(rect.width).toBe(1688);
    expect(aspect(rect)).toBeCloseTo(VISION_PHOTO_TARGET_ASPECT, 2);
    expect(rect.originX).toBe(Math.round((4000 - 1688) / 2));
    expect(rect.originY).toBe(0);
  });

  it('crops a very tall photo at full width', () => {
    const rect = computeCropRect({ width: 1000, height: 3000 });
    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(1778);
    expect(rect.originX).toBe(0);
  });

  it('follows the focal point and stays inside the source at the extremes', () => {
    const left = computeCropRect({ width: 4000, height: 3000 }, { x: 0, y: 0 });
    const right = computeCropRect({ width: 4000, height: 3000 }, { x: 1, y: 1 });
    expect(left.originX).toBe(0);
    expect(right.originX + right.width).toBe(4000);
    const wild = computeCropRect({ width: 4000, height: 3000 }, { x: 99, y: -4 });
    expect(wild.originX + wild.width).toBeLessThanOrEqual(4000);
    expect(wild.originY).toBe(0);
    expect(computeCropRect({ width: 4000, height: 3000 }, { x: NaN, y: NaN }).originX).toBe(left.originX + Math.round((4000 - 1688) * 0.5));
  });

  it('never exceeds the source and returns an empty rect for invalid sizes', () => {
    const rect = computeCropRect({ width: 3, height: 5 });
    expect(rect.width).toBeLessThanOrEqual(3);
    expect(rect.height).toBeLessThanOrEqual(5);
    expect(computeCropRect({ width: 0, height: 100 })).toEqual({ originX: 0, originY: 0, width: 0, height: 0 });
  });
});

describe('computeExpandPlan', () => {
  it('pads a square photo sideways-never: the original is never scaled, only surrounded', () => {
    const plan = computeExpandPlan({ width: 2000, height: 2000 })!;
    expect(plan.canvas.width).toBe(2000);
    expect(plan.canvas.height).toBe(3556);
    expect(plan.offset).toEqual({ x: 0, y: 778 });
    expect(plan.canvas.width / plan.canvas.height).toBeCloseTo(VISION_PHOTO_TARGET_ASPECT, 2);
  });

  it('extends a very tall photo sideways and keeps the original inside the canvas', () => {
    const plan = computeExpandPlan({ width: 1000, height: 3000 })!;
    expect(plan.canvas.height).toBe(3000);
    expect(plan.canvas.width).toBe(1688);
    expect(plan.offset.x + 1000).toBeLessThanOrEqual(plan.canvas.width);
  });

  it('offers nothing when the photo fits or the expansion would be mostly invented', () => {
    expect(computeExpandPlan({ width: 1080, height: 1920 })).toBeNull();
    expect(computeExpandPlan({ width: 4000, height: 1000 })).toBeNull();
    expect(computeExpandPlan({ width: 0, height: 0 })).toBeNull();
  });
});

describe('photoFitExplanation', () => {
  it('speaks plainly about why a choice is needed', () => {
    expect(photoFitExplanation('wider')).toMatch(/wider than your Vision frame/);
    expect(photoFitExplanation('taller')).toMatch(/taller than your Vision frame/);
  });
});

import { computeFitCanvas, looksTextHeavy } from '../visionPhotoFit';

describe('fit on paper', () => {
  it.each([[4000, 3000], [3000, 4000], [1080, 1080], [800, 2400]])('holds the whole %ix%i photograph, never cropped or stretched, in a 9:16 canvas', (width, height) => {
    const plan = computeFitCanvas({ width, height })!;
    expect(plan.canvas.width / plan.canvas.height).toBeCloseTo(9 / 16, 2);
    expect(plan.draw.width / plan.draw.height).toBeCloseTo(width / height, 2);
    expect(plan.draw.x).toBeGreaterThanOrEqual(0); expect(plan.draw.y).toBeGreaterThanOrEqual(0);
    expect(plan.draw.x + plan.draw.width).toBeLessThanOrEqual(plan.canvas.width + 1); expect(plan.draw.y + plan.draw.height).toBeLessThanOrEqual(plan.canvas.height + 1);
    expect(Math.max(plan.canvas.width, plan.canvas.height)).toBeLessThanOrEqual(2880);
  });
  it('returns null for an unknown size', () => { expect(computeFitCanvas({ width: 0, height: 5 })).toBeNull(); });
});

describe('looksTextHeavy', () => {
  it('recognises screenshots by name, by PNG at a phone-screen shape, and infographics by shape', () => {
    expect(looksTextHeavy({ fileName: 'Screenshot_2026.png', size: { width: 1000, height: 1000 } })).toBe(true);
    expect(looksTextHeavy({ mimeType: 'image/png', size: { width: 1170, height: 2532 } })).toBe(true);
    expect(looksTextHeavy({ mimeType: 'image/jpeg', size: { width: 800, height: 3000 } })).toBe(true);
  });
  it('leaves ordinary photographs alone', () => {
    expect(looksTextHeavy({ fileName: 'IMG_1234.jpg', mimeType: 'image/jpeg', size: { width: 4000, height: 3000 } })).toBe(false);
    expect(looksTextHeavy({ mimeType: 'image/jpeg', size: { width: 3000, height: 4000 } })).toBe(false);
  });
});
