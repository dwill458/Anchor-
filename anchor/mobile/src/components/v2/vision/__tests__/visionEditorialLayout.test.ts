import { editorialImageFit, editorialImageIdentity, getEditorialPhotoSlots, getEditorialPreviewHeight, selectEditorialImages } from '../visionEditorialLayout';

const tiles = Array.from({ length: 20 }, (_, index) => ({ id: `photo-${index}`, imageUrl: `https://vision.test/${index}.jpg` }));

describe('editorial preview image selection', () => {
  it.each(['home', 'details'] as const)('%s keeps every renderable photograph available to adaptive packing', variant => {
    for (const count of [1, 2, 3, 4, 6, 8, 20]) {
      const selected = selectEditorialImages(tiles.slice(0, count), variant);
      expect(selected).toHaveLength(count);
      expect(getEditorialPhotoSlots(variant, count)).toHaveLength(count);
    }
  });

  it('honors the featured photo and preserves canonical order for remaining photos', () => {
    expect(selectEditorialImages(tiles.slice(0, 6), 'home', 'photo-3').map(item => item.sourceIndex)).toEqual([3, 0, 1, 2, 4, 5]);
    expect(selectEditorialImages(tiles.slice(0, 6), 'details', 'missing').map(item => item.sourceIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps distinct tiles that reuse one image and removes duplicate tile records', () => {
    const input = [
      { id: 'pending', imageUrl: null },
      { id: 'blank', imageUrl: '  ' },
      { id: 'photo-a', imageUrl: 'https://vision.test/photo.jpg?X-Amz-Signature=one' },
      { id: 'photo-a', imageUrl: 'https://vision.test/photo.jpg?X-Amz-Signature=refreshed' },
      { id: 'photo-b', imageUrl: 'https://vision.test/photo.jpg?X-Amz-Signature=two' },
      { id: 'query-a', imageUrl: 'https://proxy.test/image?id=a' },
      { id: 'query-b', imageUrl: 'https://proxy.test/image?id=b' },
    ];
    expect(selectEditorialImages(input, 'details').map(item => item.tile.id)).toEqual(['photo-a', 'photo-b', 'query-a', 'query-b']);
    expect(editorialImageIdentity('https://proxy.test/image?id=a')).not.toBe(editorialImageIdentity('https://proxy.test/image?id=b'));
    expect(selectEditorialImages([], 'home')).toEqual([]);
  });
});

describe('adaptive collage geometry', () => {
  it.each(['home', 'details'] as const)('%s centers a prominent full-aspect hero and adapts its canvas to the source', variant => {
    for (const width of [280, 360, 600]) {
      const heights = [.8, 1, 1.5].map(aspect => {
        const height = getEditorialPreviewHeight(variant, width, 1, [aspect]);
        const [slot] = getEditorialPhotoSlots(variant, 1, [aspect], { width, height });
        expect(slot.x + slot.width / 2).toBeCloseTo(.5, 5);
        expect(slot.y + slot.height / 2).toBeCloseTo(.5, 5);
        expect(slot.height).toBeGreaterThan(.83);
        expect(slot.height).toBeLessThanOrEqual(.91);
        expect(slot.width * width / (slot.height * height)).toBeCloseTo(aspect, 5);
        expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(1);
        return height;
      });
      expect(heights[0]).toBeGreaterThan(heights[1]);
      expect(heights[1]).toBeGreaterThan(heights[2]);
    }
  });

  it.each(['home', 'details'] as const)('%s uses an asymmetric pair with modest edge overlap and clear subject centers', variant => {
    for (const aspects of [[.8, .8], [1, 1], [1.5, 1.5], [.8, 1.5], [1.5, .8]]) {
      const width = 360;
      const height = getEditorialPreviewHeight(variant, width, 2, aspects);
      const slots = getEditorialPhotoSlots(variant, 2, aspects, { width, height });
      expect(slots).toHaveLength(2);
      const [a, b] = slots;
      const areas = slots.map(slot => slot.width * slot.height);
      expect(Math.min(...areas) / Math.max(...areas)).toBeGreaterThanOrEqual(.75);
      expect(a.width).not.toBeCloseTo(b.width, 3);
      expect(a.y).not.toBeCloseTo(b.y, 3);
      expect(a.rotation * b.rotation).toBeLessThan(0);
      const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const overlap = Math.min(overlapX / Math.min(a.width, b.width), overlapY / Math.min(a.height, b.height));
      expect(overlap).toBeGreaterThanOrEqual(.08 - 1e-6);
      expect(overlap).toBeLessThanOrEqual(.12 + 1e-6);
      // The upper print can touch an edge, but cannot cover the lower photo's center.
      expect(a.x + a.width / 2 < b.x || a.x + a.width / 2 > b.x + b.width ||
        a.y + a.height / 2 < b.y || a.y + a.height / 2 > b.y + b.height).toBe(true);
      slots.forEach((slot, index) => {
        expect(slot.width * width / (slot.height * height)).toBeCloseTo(aspects[index], 5);
        const bounds = getRotatedBounds(slot, width / height);
        expect(bounds.left).toBeGreaterThanOrEqual(.025 - 1e-9);
        expect(bounds.right).toBeLessThanOrEqual(.975 + 1e-9);
        expect(bounds.top).toBeGreaterThanOrEqual(.025 - 1e-9);
        expect(bounds.bottom).toBeLessThanOrEqual(.975 + 1e-9);
      });
    }
  });

  it.each(['home', 'details'] as const)('%s returns stable in-bounds slots at small and large counts', variant => {
    const canvas = { width: 360, height: variant === 'home' ? 245 : 223 };
    for (const count of [1, 2, 3, 4, 6, 8, 20]) {
      const aspects = Array.from({ length: count }, (_, index) => [0.45, 0.7, 1, 1.8][index % 4]);
      const slots = getEditorialPhotoSlots(variant, count, aspects, canvas);
      expect(slots).toEqual(getEditorialPhotoSlots(variant, count, aspects, canvas));
      expect(slots).toHaveLength(count);
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.x + slot.width).toBeLessThanOrEqual(1);
        expect(slot.y + slot.height).toBeLessThanOrEqual(1);
        expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(6);
        expect([slot.x, slot.y, slot.width, slot.height].every(Number.isFinite)).toBe(true);
        const bounds = getRotatedBounds(slot, canvas.width / canvas.height);
        expect(bounds.left).toBeGreaterThanOrEqual(0.025 - 1e-9);
        expect(bounds.right).toBeLessThanOrEqual(0.975 + 1e-9);
        expect(bounds.top).toBeGreaterThanOrEqual(0.025 - 1e-9);
        expect(bounds.bottom).toBeLessThanOrEqual(0.975 + 1e-9);
      }
    }
    expect(getEditorialPhotoSlots(variant, 0)).toEqual([]);
  });

  it.each(['home', 'details'] as const)('%s packs connected actual prints through the center', variant => {
    const slots = getEditorialPhotoSlots(variant, 6, [1.5, 1.5, 1.5, 1.5, 1.5, 1.5], { width: 360, height: variant === 'home' ? 245 : 223 });
    expect(slots).toHaveLength(6);
    // A path of overlapping print bounds connects every photo, independent of
    // how many rows the optimizer chooses. No fixed left/right cell assertion.
    const reached = new Set([0]);
    for (let pass = 0; pass < slots.length; pass += 1) {
      slots.forEach((a, i) => slots.forEach((b, j) => {
        if (reached.has(i) && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) reached.add(j);
      }));
    }
    expect(reached.size).toBe(6);
    // Two dominant prints establish hierarchy; the supporting prints stay
    // readable rather than forcing every photograph to the same large size.
    expect(slots[0].width).toBeGreaterThan(0.48);
    expect(slots[4].width).toBeGreaterThan(0.48);
    expect(slots.every(slot => slot.width > 0.32)).toBe(true);
    expect(slots.filter(slot => slot.x < .5 && slot.x + slot.width > .5).length).toBeGreaterThanOrEqual(2);
  });

  it('uses the full canvas height for eight landscape photos in a staggered spread', () => {
    const slots = getEditorialPhotoSlots('home', 8, Array.from({ length: 8 }, () => 1.5), { width: 360, height: 245 });
    const centersX = slots.map(slot => slot.x + slot.width / 2);
    const canvasAspect = 360 / 245;
    const top = Math.min(...slots.map(slot => getRotatedBounds(slot, canvasAspect).top));
    const bottom = Math.max(...slots.map(slot => getRotatedBounds(slot, canvasAspect).bottom));
    expect(slots).toHaveLength(8);
    const left = Math.min(...slots.map(slot => getRotatedBounds(slot, canvasAspect).left));
    const right = Math.max(...slots.map(slot => getRotatedBounds(slot, canvasAspect).right));
    expect(right - left).toBeGreaterThan(0.78);
    expect(bottom - top).toBeGreaterThan(0.78);
    expect(new Set(slots.map(slot => `${Math.round(slot.x * 100)}:${Math.round(slot.y * 100)}`)).size).toBe(8);
  });
  it.each(['home', 'details'] as const)('%s gives portrait collections a connected asymmetric scrapbook with a dominant central print', variant => {
    const canvas = { width: 360, height: variant === 'home' ? 245 : 223 };
    const aspects = [.75, .75, .8, 1.2, .75, 1];
    const slots = getEditorialPhotoSlots(variant, 6, aspects, canvas);
    expect(slots).toHaveLength(6);
    expect(slots[0].height).toBeGreaterThan(.58);
    expect(slots[0].x).toBeLessThan(.5);
    expect(slots[0].x + slots[0].width).toBeGreaterThan(.5);
    slots.forEach((slot, i) => expect(slot.width * canvas.width / (slot.height * canvas.height)).toBeCloseTo(aspects[i], 5));
    const reached = new Set([0]);
    for (let pass = 0; pass < slots.length; pass++) slots.forEach((a, i) => slots.forEach((b, j) => {
      if (reached.has(i) && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) reached.add(j);
    }));
    expect(reached.size).toBe(6);
  });
  it('fits portrait, square, landscape and unknown sources without changing photo proportions', () => {
    expect(editorialImageFit(0, 1.1)).toBe('contain');
    expect(editorialImageFit(Number.NaN, 1.1)).toBe('contain');
    expect(editorialImageFit(0.55, 1.1)).toBe('contain');
    expect(editorialImageFit(1.8, 0.75)).toBe('contain');
    const canvas = { width: 360, height: 223 };
    const slots = getEditorialPhotoSlots('details', 3, [0.7, 1.8, 0.5], canvas);
    expect(slots).toHaveLength(3);
    expect(slots[0].width * (canvas.width / canvas.height) / slots[0].height).toBeCloseTo(0.7, 5);
    expect(slots[1].width * (canvas.width / canvas.height) / slots[1].height).toBeCloseTo(1.8, 5);
    expect(slots[2].width * (canvas.width / canvas.height) / slots[2].height).toBeCloseTo(0.5, 5);
    expect(editorialImageFit(0.75, 0.75)).toBe('cover');
  });
});
function getRotatedBounds(slot: { x: number; y: number; width: number; height: number; rotation: number }, canvasAspect: number) {
  const radians = Math.abs(slot.rotation) * Math.PI / 180;
  const width = Math.abs(slot.width * Math.cos(radians)) + Math.abs((slot.height / canvasAspect) * Math.sin(radians));
  const height = (Math.abs((slot.height / canvasAspect) * Math.cos(radians)) + Math.abs(slot.width * Math.sin(radians))) * canvasAspect;
  const centerX = slot.x + slot.width / 2;
  const centerY = slot.y + slot.height / 2;
  return { left: centerX - width / 2, right: centerX + width / 2, top: centerY - height / 2, bottom: centerY + height / 2 };
}
