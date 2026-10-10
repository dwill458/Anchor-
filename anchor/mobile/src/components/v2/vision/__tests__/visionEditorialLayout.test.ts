import { editorialImageFit, editorialImageIdentity, getEditorialPhotoSlots, selectEditorialImages } from '../visionEditorialLayout';

const tiles = Array.from({ length: 7 }, (_, index) => ({ id: `photo-${index}`, imageUrl: `https://vision.test/${index}.jpg`, sortOrder: index }));

describe('editorial preview image selection', () => {
  it.each([1, 2, 3])('uses exactly %i available photos without empty frames', count => {
    expect(selectEditorialImages(tiles.slice(0, count), 'home')).toHaveLength(count);
    expect(getEditorialPhotoSlots('home', count)).toHaveLength(count);
  });

  it('limits Home to three photographs and Details to five', () => {
    expect(selectEditorialImages(tiles, 'home').map(item => item.tile.id)).toEqual(['photo-0', 'photo-1', 'photo-2']);
    expect(selectEditorialImages(tiles, 'details').map(item => item.tile.id)).toEqual(['photo-0', 'photo-1', 'photo-2', 'photo-3', 'photo-4']);
  });

  it('honors a renderable featured photo and preserves canonical support order', () => {
    expect(selectEditorialImages(tiles, 'home', 'photo-3').map(item => item.sourceIndex)).toEqual([3, 0, 1]);
    expect(selectEditorialImages(tiles, 'home', 'missing').map(item => item.sourceIndex)).toEqual([0, 1, 2]);
  });

  it('skips unresolved and blank URLs and duplicates, including refreshed signed URLs', () => {
    const input = [
      { id: 'pending', imageUrl: null },
      { id: 'blank', imageUrl: '  ' },
      { id: 'real', imageUrl: ' https://vision.test/photo.jpg?X-Amz-Signature=one ' },
      { id: 'same', imageUrl: 'https://vision.test/photo.jpg?X-Amz-Signature=two' },
      { id: 'other', imageUrl: 'file:///local/portrait.jpg' },
    ];
    expect(selectEditorialImages(input, 'details', 'pending').map(item => item.sourceIndex)).toEqual([2, 4]);
    expect(selectEditorialImages(input, 'home')[0].imageUrl).toBe('https://vision.test/photo.jpg?X-Amz-Signature=one');
    expect(selectEditorialImages([], 'details')).toEqual([]);
  });

  it('does not mutate source data and produces identical selections on repeated visits', () => {
    const frozen = Object.freeze(tiles.map(tile => Object.freeze({ ...tile })));
    expect(selectEditorialImages(frozen, 'details')).toEqual(selectEditorialImages(frozen, 'details'));
    expect(frozen.map(tile => tile.id)).toEqual(tiles.map(tile => tile.id));
  });

  it('preserves query-routed image identity while ignoring known storage signing parameters', () => {
    const proxy = [
      { id: 'a', imageUrl: 'https://proxy.test/image?id=a&X-Amz-Signature=one' },
      { id: 'b', imageUrl: 'https://proxy.test/image?id=b&X-Amz-Signature=two' },
      { id: 'a-refreshed', imageUrl: 'https://proxy.test/image?id=a&X-Amz-Signature=three' },
    ];
    expect(selectEditorialImages(proxy, 'home').map(item => item.tile.id)).toEqual(['a', 'b']);
    expect(editorialImageIdentity('https://proxy.test/image?id=a')).not.toBe(editorialImageIdentity('https://proxy.test/image?id=b'));
    expect(editorialImageIdentity('file:///local/image.jpg?version=1')).toBe('file:///local/image.jpg?version=1');
    expect(editorialImageIdentity('https://proxy.test/image?token=a&signature=b')).toBe('https://proxy.test/image?token=a&signature=b');
    expect(editorialImageIdentity('https://store.test/storage/v1/object/sign/vision/photo.jpg?token=one')).toBe('https://store.test/storage/v1/object/sign/vision/photo.jpg');
  });
});

describe('editorial preview geometry', () => {
  it.each(['home', 'details'] as const)('%s reserves deterministic in-bounds slots with a dominant hero', variant => {
    for (let count = 1; count <= (variant === 'home' ? 3 : 5); count += 1) {
      const slots = getEditorialPhotoSlots(variant, count);
      expect(slots).toEqual(getEditorialPhotoSlots(variant, count));
      expect(slots).toHaveLength(count);
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.x + slot.width).toBeLessThanOrEqual(1);
        expect(slot.y + slot.height).toBeLessThanOrEqual(1);
        expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(3);
        expect(slot.width * slot.height).toBeLessThanOrEqual(slots[0].width * slots[0].height);
      }
    }
    expect(getEditorialPhotoSlots(variant, 0)).toEqual([]);
  });

  it('contains portrait, landscape, square and unknown dimensions when a crop would remove subjects', () => {
    expect(editorialImageFit(0, 1.1)).toBe('contain');
    expect(editorialImageFit(Number.NaN, 1.1)).toBe('contain');
    expect(editorialImageFit(0.55, 1.1)).toBe('contain');
    expect(editorialImageFit(1.8, 0.75)).toBe('contain');
    expect(editorialImageFit(1, 0.75)).toBe('contain');
    expect(editorialImageFit(0.75, 0.75)).toBe('cover');
    expect(editorialImageFit(1.8, 1.7)).toBe('cover');
    expect(editorialImageFit(1, 1)).toBe('cover');
    expect(editorialImageFit(1, 0)).toBe('contain');
  });

  it.each([4, 5])('keeps the complete primary photo clear in the %i-image Details composition', count => {
    const [primary, ...supporting] = getEditorialPhotoSlots('details', count);
    expect(supporting).toHaveLength(count - 1);
    for (const support of supporting) expect(support.x).toBeGreaterThan(primary.x + primary.width);
  });
});
