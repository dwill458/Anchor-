import {
  VISION_CAPTION_FONTS,
  VISION_PAPER,
  VISION_PHOTO,
  VISION_SHADOW,
  VISION_TAPE,
  clampPhotoRotation,
  clampTapeRotation,
} from '../visionMaterialTokens';

describe('visionMaterialTokens', () => {
  it('uses the archival paper base', () => {
    expect(VISION_PAPER.base).toBe('#F4F1EA');
  });

  it('limits photograph tilt to 6 degrees either way', () => {
    expect(VISION_PHOTO.maxRotationDeg).toBe(6);
    expect(clampPhotoRotation(4)).toBe(4);
    expect(clampPhotoRotation(10)).toBe(6);
    expect(clampPhotoRotation(-10)).toBe(-6);
    expect(clampPhotoRotation(Number.NaN)).toBe(0);
  });

  it('limits tape tilt and keeps it within its own bound', () => {
    expect(clampTapeRotation(30)).toBe(VISION_TAPE.maxRotationDeg);
    expect(clampTapeRotation(-30)).toBe(-VISION_TAPE.maxRotationDeg);
    expect(clampTapeRotation(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('casts both shadows down and to the right, consistent with top-left light', () => {
    for (const shadow of [VISION_SHADOW.contact, VISION_SHADOW.ambient]) {
      expect(shadow.shadowOffset.width).toBeGreaterThan(0);
      expect(shadow.shadowOffset.height).toBeGreaterThan(0);
      expect(shadow.shadowOpacity).toBeGreaterThan(0);
      expect(shadow.shadowOpacity).toBeLessThanOrEqual(1);
      expect(shadow.elevation).toBeGreaterThan(0);
    }
  });

  it('makes the ambient shadow softer and wider than the contact shadow', () => {
    expect(VISION_SHADOW.ambient.shadowRadius).toBeGreaterThan(VISION_SHADOW.contact.shadowRadius);
    expect(VISION_SHADOW.ambient.shadowOpacity).toBeLessThan(VISION_SHADOW.contact.shadowOpacity);
  });

  it('keeps every tape tone translucent and warm', () => {
    for (const tone of Object.values(VISION_TAPE.tones)) {
      expect(tone.opacity).toBeGreaterThan(0);
      expect(tone.opacity).toBeLessThan(1);
      expect(tone.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('reuses the registered Vision caption fonts', () => {
    expect(VISION_CAPTION_FONTS).toEqual({
      handwritten: 'Allison-Regular',
      serif: 'EBGaramond-Regular',
      serifItalic: 'EBGaramond-Italic',
      sans: 'Inter-Regular',
    });
  });
});
