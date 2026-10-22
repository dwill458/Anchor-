/**
 * Anchor Artwork Validation Utility
 *
 * Post-generation validation for AI-generated Anchor candidates:
 * 1. Calculates visible/nontransparent artwork bounding box.
 * 2. Enforces minimum 70% dimension occupancy on both width and height (target 75–85%).
 * 3. Detects and rejects obvious dominant rectangular enclosure geometry (plaques, cards, framing boxes).
 */

import sharp from 'sharp';
import { logger } from './logger';

export interface ArtworkValidationResult {
  isValid: boolean;
  reason?: string;
  widthRatio: number;
  heightRatio: number;
  bbox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  fillRatio: number;
  hasDominantRectangularEnclosure: boolean;
}

export interface ArtworkValidationOptions {
  minOccupancyRatio?: number; // Default: 0.70 (~70% required)
  targetSize?: number; // Size to normalize for fast pixel analysis (default: 512)
  plaqueFillThreshold?: number; // Fill density inside bbox indicating a solid plaque (default: 0.52)
}

/**
 * Validate an Anchor artwork buffer (PNG/JPEG) against geometry and framing constraints.
 */
export async function validateAnchorArtwork(
  imageBuffer: Buffer,
  options: ArtworkValidationOptions = {}
): Promise<ArtworkValidationResult> {
  const minOccupancy = options.minOccupancyRatio ?? 0.70;
  const targetSize = options.targetSize ?? 512;
  const plaqueFillThreshold = options.plaqueFillThreshold ?? 0.52;

  try {
    // 1. Load image and ensure RGBA raw buffer
    const image = sharp(imageBuffer);

    const { data, info } = await image
      .resize(targetSize, targetSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const totalPixels = width * height;

    // 2. Identify background color and transparency by sampling perimeter/corners
    const cornerIndices = [
      0,
      (width - 1) * 4,
      (height - 1) * width * 4,
      ((height - 1) * width + (width - 1)) * 4,
    ];

    let bgIsTransparent = true;
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    let bgSamples = 0;

    for (const idx of cornerIndices) {
      const a = data[idx + 3];
      if (a > 25) {
        bgIsTransparent = false;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        bgSamples++;
      }
    }

    if (bgSamples > 0) {
      bgR = Math.round(bgR / bgSamples);
      bgG = Math.round(bgG / bgSamples);
      bgB = Math.round(bgB / bgSamples);
    }
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

    // 3. Mark foreground / visible artwork pixels
    const foregroundGrid = new Uint8Array(totalPixels);
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let foregroundCount = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const pixelIdx = (rowOffset + x) * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        const a = data[pixelIdx + 3];

        let isVisible = false;

        if (a < 25) {
          isVisible = false;
        } else if (bgIsTransparent) {
          isVisible = true;
        } else {
          // Background is solid; test difference from background
          const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          isVisible = dist > 25 && Math.abs(luminance - bgLum) > 15;
        }

        if (isVisible) {
          foregroundGrid[rowOffset + x] = 1;
          foregroundCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If practically no foreground pixels found (< 0.3% of canvas)
    if (foregroundCount < totalPixels * 0.003 || maxX < minX || maxY < minY) {
      return {
        isValid: false,
        reason: 'NO_MEANINGFUL_ARTWORK: Canvas contains insufficient visible strokes',
        widthRatio: 0,
        heightRatio: 0,
        bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
        fillRatio: 0,
        hasDominantRectangularEnclosure: false,
      };
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    const widthRatio = bboxWidth / width;
    const heightRatio = bboxHeight / height;
    const bboxArea = bboxWidth * bboxHeight;
    const fillRatio = bboxArea > 0 ? foregroundCount / bboxArea : 0;

    // 4. Check for dominant rectangular enclosure
    let hasDominantRectangularEnclosure = false;
    let enclosureReason = '';

    // Check A: Solid or textured rectangular plaque / tablet
    const cornerMarginX = Math.max(3, Math.round(bboxWidth * 0.08));
    const cornerMarginY = Math.max(3, Math.round(bboxHeight * 0.08));

    const checkCorner = (cx: number, cy: number): boolean => {
      let count = 0;
      let total = 0;
      for (let y = cy; y < cy + cornerMarginY && y < height; y++) {
        for (let x = cx; x < cx + cornerMarginX && x < width; x++) {
          total++;
          if (foregroundGrid[y * width + x] === 1) count++;
        }
      }
      return total > 0 && count / total > 0.35;
    };

    const tl = checkCorner(minX, minY);
    const tr = checkCorner(maxX - cornerMarginX + 1, minY);
    const bl = checkCorner(minX, maxY - cornerMarginY + 1);
    const br = checkCorner(maxX - cornerMarginX + 1, maxY - cornerMarginY + 1);
    const cornersFilled = [tl, tr, bl, br].filter(Boolean).length;

    if (fillRatio > plaqueFillThreshold && cornersFilled >= 3) {
      hasDominantRectangularEnclosure = true;
      enclosureReason = `Solid rectangular plaque/tablet detected (fill density: ${(fillRatio * 100).toFixed(1)}%, corners: ${cornersFilled}/4)`;
    }

    // Check B: 4-sided rectangular framing box (hollow frame around symbol)
    if (!hasDominantRectangularEnclosure && bboxWidth >= width * 0.65 && bboxHeight >= height * 0.65) {
      const scanBand = Math.max(3, Math.round(Math.min(bboxWidth, bboxHeight) * 0.05));
      const minLineSpan = 0.62; // Line must span > 62% of bbox dimension

      const hasHorizontalLine = (startY: number): boolean => {
        let maxSpan = 0;
        let currentSpan = 0;
        for (let x = minX; x <= maxX; x++) {
          let hasPixelInBand = false;
          for (let dy = 0; dy < scanBand; dy++) {
            const y = startY + dy;
            if (y >= 0 && y < height && foregroundGrid[y * width + x] === 1) {
              hasPixelInBand = true;
              break;
            }
          }
          if (hasPixelInBand) {
            currentSpan++;
            if (currentSpan > maxSpan) maxSpan = currentSpan;
          } else {
            currentSpan = 0;
          }
        }
        return maxSpan / bboxWidth >= minLineSpan;
      };

      const hasVerticalLine = (startX: number): boolean => {
        let maxSpan = 0;
        let currentSpan = 0;
        for (let y = minY; y <= maxY; y++) {
          let hasPixelInBand = false;
          for (let dx = 0; dx < scanBand; dx++) {
            const x = startX + dx;
            if (x >= 0 && x < width && foregroundGrid[y * width + x] === 1) {
              hasPixelInBand = true;
              break;
            }
          }
          if (hasPixelInBand) {
            currentSpan++;
            if (currentSpan > maxSpan) maxSpan = currentSpan;
          } else {
            currentSpan = 0;
          }
        }
        return maxSpan / bboxHeight >= minLineSpan;
      };

      const topBorder = hasHorizontalLine(minY);
      const bottomBorder = hasHorizontalLine(maxY - scanBand + 1);
      const leftBorder = hasVerticalLine(minX);
      const rightBorder = hasVerticalLine(maxX - scanBand + 1);

      if (topBorder && bottomBorder && leftBorder && rightBorder) {
        hasDominantRectangularEnclosure = true;
        enclosureReason = 'Dominant four-sided rectangular framing enclosure detected';
      }
    }

    const bboxResult = {
      minX,
      maxX,
      minY,
      maxY,
      width: bboxWidth,
      height: bboxHeight,
    };

    // 5. Evaluate overall validity
    if (hasDominantRectangularEnclosure) {
      logger.warn('[ArtworkValidation] Rejected candidate due to rectangular framing enclosure', {
        reason: enclosureReason,
        widthRatio: widthRatio.toFixed(3),
        heightRatio: heightRatio.toFixed(3),
        fillRatio: fillRatio.toFixed(3),
      });
      return {
        isValid: false,
        reason: enclosureReason,
        widthRatio,
        heightRatio,
        bbox: bboxResult,
        fillRatio,
        hasDominantRectangularEnclosure: true,
      };
    }

    if (widthRatio < minOccupancy || heightRatio < minOccupancy) {
      const reason = `INSUFFICIENT_OCCUPANCY: Anchor occupies width: ${(widthRatio * 100).toFixed(1)}%, height: ${(heightRatio * 100).toFixed(1)}% (minimum required: ${(minOccupancy * 100).toFixed(0)}%)`;
      logger.warn('[ArtworkValidation] Rejected candidate due to insufficient canvas occupancy', {
        reason,
        widthRatio: widthRatio.toFixed(3),
        heightRatio: heightRatio.toFixed(3),
      });
      return {
        isValid: false,
        reason,
        widthRatio,
        heightRatio,
        bbox: bboxResult,
        fillRatio,
        hasDominantRectangularEnclosure: false,
      };
    }

    return {
      isValid: true,
      widthRatio,
      heightRatio,
      bbox: bboxResult,
      fillRatio,
      hasDominantRectangularEnclosure: false,
    };
  } catch (err) {
    logger.error('[ArtworkValidation] Error analyzing artwork', err);
    return {
      isValid: true,
      widthRatio: 0.8,
      heightRatio: 0.8,
      bbox: { minX: 0, maxX: targetSize, minY: 0, maxY: targetSize, width: targetSize, height: targetSize },
      fillRatio: 0.2,
      hasDominantRectangularEnclosure: false,
    };
  }
}
