import sharp from 'sharp';
import { validateAnchorArtwork } from '../artworkValidation';

describe('validateAnchorArtwork', () => {
  it('accepts a standalone geometric anchor occupying ~80% of canvas with open negative space', async () => {
    // Generate an image with strokes occupying 80% of 512x512 canvas (from 50 to 460)
    const svg = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#000000" />
        <circle cx="256" cy="256" r="200" stroke="#FFFFFF" stroke-width="8" fill="none" />
        <line x1="56" y1="256" x2="456" y2="256" stroke="#FFFFFF" stroke-width="8" />
        <line x1="256" y1="56" x2="256" y2="456" stroke="#FFFFFF" stroke-width="8" />
        <polygon points="256,76 436,386 76,386" stroke="#FFFFFF" stroke-width="6" fill="none" />
      </svg>
    `;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await validateAnchorArtwork(buffer);

    expect(result.isValid).toBe(true);
    expect(result.widthRatio).toBeGreaterThanOrEqual(0.70);
    expect(result.heightRatio).toBeGreaterThanOrEqual(0.70);
    expect(result.hasDominantRectangularEnclosure).toBe(false);
  });

  it('rejects an Anchor occupying less than 70% of canvas dimensions', async () => {
    // Small glyph in center occupying only 40% of canvas (from 150 to 350 on 512x512)
    const svg = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#000000" />
        <circle cx="256" cy="256" r="100" stroke="#FFFFFF" stroke-width="6" fill="none" />
        <line x1="160" y1="256" x2="350" y2="256" stroke="#FFFFFF" stroke-width="6" />
      </svg>
    `;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await validateAnchorArtwork(buffer);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('INSUFFICIENT_OCCUPANCY');
    expect(result.widthRatio).toBeLessThan(0.70);
  });

  it('rejects a solid rectangular stone plaque/tablet enclosure', async () => {
    // Solid filled rectangular plaque covering 80% of canvas
    const svg = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#000000" />
        <rect x="50" y="50" width="412" height="412" rx="10" fill="#222225" stroke="#888888" stroke-width="4" />
        <circle cx="256" cy="256" r="80" stroke="#FFFFFF" stroke-width="6" fill="none" />
      </svg>
    `;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await validateAnchorArtwork(buffer);

    expect(result.isValid).toBe(false);
    expect(result.hasDominantRectangularEnclosure).toBe(true);
    expect(result.reason).toContain('plaque');
  });

  it('rejects an Anchor surrounded by a dominant 4-sided rectangular framing box', async () => {
    // An anchor with an explicit 4-sided bounding box frame around it
    const svg = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#000000" />
        <!-- 4-sided border frame -->
        <rect x="50" y="50" width="412" height="412" stroke="#FFFFFF" stroke-width="6" fill="none" />
        <!-- Small glyph inside -->
        <circle cx="256" cy="256" r="80" stroke="#FFFFFF" stroke-width="4" fill="none" />
      </svg>
    `;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await validateAnchorArtwork(buffer);

    expect(result.isValid).toBe(false);
    expect(result.hasDominantRectangularEnclosure).toBe(true);
    expect(result.reason).toContain('rectangular framing enclosure');
  });

  it('handles transparent PNG images correctly', async () => {
    // Transparent background with standalone glyph
    const svg = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <circle cx="256" cy="256" r="200" stroke="#D4AF37" stroke-width="12" fill="none" />
        <line x1="56" y1="256" x2="456" y2="256" stroke="#D4AF37" stroke-width="10" />
      </svg>
    `;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await validateAnchorArtwork(buffer);

    expect(result.isValid).toBe(true);
    expect(result.widthRatio).toBeGreaterThanOrEqual(0.70);
    expect(result.hasDominantRectangularEnclosure).toBe(false);
  });
});
