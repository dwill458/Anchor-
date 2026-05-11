/**
 * Structure Matching Utility
 *
 * Computes structure preservation scores between original sigil control image
 * and AI-generated output. Uses pixel overlap and edge comparison.
 *
 * This replaces the placeholder Math.random() scores with real metrics.
 */

import sharp from 'sharp';
import https from 'https';
import http from 'http';
import { logger } from './logger';

/**
 * Structure match result
 */
export interface StructureMatchResult {
  iouScore: number;           // Intersection over Union (0-1)
  edgeOverlapScore: number;   // Edge-based overlap (0-1)
  combinedScore: number;      // Weighted combination (0-1)
  structurePreserved: boolean;
  classification: 'Structure Preserved' | 'More Artistic' | 'Style Drift';
  analysisDetails: {
    originalWhitePixels: number;
    generatedWhitePixels: number;
    intersectionPixels: number;
    unionPixels: number;
  };
}

/**
 * Thresholds for classification
 */
const THRESHOLDS = {
  preserved: 0.85,
  artistic: 0.70,
};

/**
 * Download image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Convert image to grayscale and extract binary mask
 * White pixels (>threshold) become 1, others become 0
 */
async function extractBinaryMask(
  imageBuffer: Buffer,
  threshold: number = 128,
  targetSize: number = 512
): Promise<{ mask: Uint8Array; width: number; height: number }> {
  // Resize and convert to grayscale
  const { data, info } = await sharp(imageBuffer)
    .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create binary mask
  const mask = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    mask[i] = data[i] > threshold ? 1 : 0;
  }

  return { mask, width: info.width, height: info.height };
}

/**
 * Extract sigil structure from generated image using adaptive thresholding
 * Generated images have textures/colors, so we need smarter extraction
 */
async function extractGeneratedSigilMask(
  imageBuffer: Buffer,
  targetSize: number = 512
): Promise<{ mask: Uint8Array; width: number; height: number }> {
  // Convert to grayscale
  const { data, info } = await sharp(imageBuffer)
    .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate histogram to find optimal threshold (Otsu's method simplified)
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++;
  }

  // Find threshold using mean of non-black pixels
  let sum = 0;
  let count = 0;
  for (let i = 10; i < 256; i++) {  // Skip very dark pixels
    sum += i * histogram[i];
    count += histogram[i];
  }
  const meanBrightness = count > 0 ? sum / count : 128;

  // Use threshold slightly below mean
  const threshold = Math.max(30, meanBrightness * 0.6);

  // Create binary mask
  const mask = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    mask[i] = data[i] > threshold ? 1 : 0;
  }

  return { mask, width: info.width, height: info.height };
}

/**
 * Compute Intersection over Union (IoU) between two binary masks
 */
function computeIoU(mask1: Uint8Array, mask2: Uint8Array): {
  iou: number;
  intersection: number;
  union: number;
  mask1Pixels: number;
  mask2Pixels: number;
} {
  let intersection = 0;
  let union = 0;
  let mask1Pixels = 0;
  let mask2Pixels = 0;

  for (let i = 0; i < mask1.length; i++) {
    const a = mask1[i];
    const b = mask2[i];

    mask1Pixels += a;
    mask2Pixels += b;

    if (a === 1 && b === 1) {
      intersection++;
    }
    if (a === 1 || b === 1) {
      union++;
    }
  }

  const iou = union > 0 ? intersection / union : 0;

  return { iou, intersection, union, mask1Pixels, mask2Pixels };
}

/**
 * Compute edge-based overlap with tolerance
 * Dilates the original mask slightly before comparison
 */
function computeEdgeOverlap(
  originalMask: Uint8Array,
  generatedMask: Uint8Array,
  width: number,
  height: number,
  tolerancePx: number = 3
): number {
  // Dilate original mask to allow for slight position differences
  const dilatedMask = new Uint8Array(originalMask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Check if any pixel in the tolerance radius is set
      let found = false;
      for (let dy = -tolerancePx; dy <= tolerancePx && !found; dy++) {
        for (let dx = -tolerancePx; dx <= tolerancePx && !found; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nidx = ny * width + nx;
            if (originalMask[nidx] === 1) {
              found = true;
            }
          }
        }
      }
      dilatedMask[idx] = found ? 1 : 0;
    }
  }

  // Count how many generated pixels fall within dilated original
  let covered = 0;
  let totalGenerated = 0;

  for (let i = 0; i < generatedMask.length; i++) {
    if (generatedMask[i] === 1) {
      totalGenerated++;
      if (dilatedMask[i] === 1) {
        covered++;
      }
    }
  }

  return totalGenerated > 0 ? covered / totalGenerated : 0;
}

/**
 * Compute structure match between original control image and generated image
 *
 * @param originalControlBuffer - The original high-contrast control image (white on black)
 * @param generatedImageUrl - URL of the AI-generated image
 * @returns StructureMatchResult with scores and classification
 */
export async function computeStructureMatch(
  originalControlBuffer: Buffer,
  generatedImageUrl: string
): Promise<StructureMatchResult> {
  try {
    logger.debug('[StructureMatch] Downloading generated image...');
    const generatedBuffer = await downloadImage(generatedImageUrl);

    logger.debug('[StructureMatch] Extracting masks...');
    const targetSize = 512;  // Smaller for faster comparison

    // Extract original mask (simple threshold - it's already high contrast)
    const originalResult = await extractBinaryMask(originalControlBuffer, 128, targetSize);

    // Extract generated mask (adaptive threshold for textured image)
    const generatedResult = await extractGeneratedSigilMask(generatedBuffer, targetSize);

    logger.debug('[StructureMatch] Computing IoU...');
    const iouResult = computeIoU(originalResult.mask, generatedResult.mask);

    logger.debug('[StructureMatch] Computing edge overlap...');
    const edgeOverlap = computeEdgeOverlap(
      originalResult.mask,
      generatedResult.mask,
      originalResult.width,
      originalResult.height,
      3  // 3px tolerance
    );

    // Weighted combination (IoU is stricter, edge overlap is more forgiving)
    const combinedScore = 0.7 * iouResult.iou + 0.3 * edgeOverlap;

    // Classify
    let classification: 'Structure Preserved' | 'More Artistic' | 'Style Drift';
    if (combinedScore >= THRESHOLDS.preserved) {
      classification = 'Structure Preserved';
    } else if (combinedScore >= THRESHOLDS.artistic) {
      classification = 'More Artistic';
    } else {
      classification = 'Style Drift';
    }

    const result: StructureMatchResult = {
      iouScore: iouResult.iou,
      edgeOverlapScore: edgeOverlap,
      combinedScore,
      structurePreserved: combinedScore >= THRESHOLDS.preserved,
      classification,
      analysisDetails: {
        originalWhitePixels: iouResult.mask1Pixels,
        generatedWhitePixels: iouResult.mask2Pixels,
        intersectionPixels: iouResult.intersection,
        unionPixels: iouResult.union,
      },
    };

    logger.info('[StructureMatch] Complete', {
      iouScore: result.iouScore.toFixed(3),
      edgeOverlap: result.edgeOverlapScore.toFixed(3),
      combined: result.combinedScore.toFixed(3),
      classification: result.classification,
    });

    return result;

  } catch (error) {
    logger.error('[StructureMatch] Error computing structure match', error);

    // Return conservative estimate on error (assume drift)
    return {
      iouScore: 0.5,
      edgeOverlapScore: 0.5,
      combinedScore: 0.5,
      structurePreserved: false,
      classification: 'More Artistic',
      analysisDetails: {
        originalWhitePixels: 0,
        generatedWhitePixels: 0,
        intersectionPixels: 0,
        unionPixels: 0,
      },
    };
  }
}

/**
 * Batch compute structure match for multiple generated images
 */
export async function computeStructureMatchBatch(
  originalControlBuffer: Buffer,
  generatedImageUrls: string[]
): Promise<StructureMatchResult[]> {
  const results = await Promise.all(
    generatedImageUrls.map(url => computeStructureMatch(originalControlBuffer, url))
  );
  return results;
}
