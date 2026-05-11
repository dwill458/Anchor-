/**
 * SVG to Edge Map Converter - Prepare SVG for Vertex AI ControlNet
 *
 * Purpose: Convert sigil SVGs into edge-detected control images for
 * Google Vertex AI Imagen 3 ControlNet conditioning.
 *
 * Process:
 * 1. Convert SVG → PNG (black background, white lines)
 * 2. Apply edge detection to create high-contrast edge map
 * 3. Return buffer suitable for ControlNet image generation
 *
 * Output: 1024x1024 PNG edge map optimized for Imagen 3
 */

import sharp from 'sharp';
import { rasterizeSVG, RasterizeOptions } from './svgRasterizer';

export interface EdgeMapOptions {
  /**
   * Output image size (default: 1024 - optimal for Imagen 3)
   */
  size?: number;

  /**
   * Edge detection threshold - lower values detect more edges
   * (default: 10 - sensitive enough for sigil lines)
   */
  threshold?: number;

  /**
   * Apply gaussian blur before edge detection for smoother edges
   * (default: 0.5)
   */
  blurSigma?: number;

  /**
   * Stroke thickness multiplier for better edge visibility
   * (default: 2.5 - ensures edges are visible after detection)
   */
  strokeMultiplier?: number;

  /**
   * Padding as fraction of image size to prevent edge clipping
   * (default: 0.15)
   */
  padding?: number;

  /**
   * Invert output (white background, black edges vs black background, white edges)
   * Imagen 3 typically works better with white background
   * (default: true)
   */
  invertOutput?: boolean;
}

export interface EdgeMapResult {
  /**
   * PNG edge map as Buffer
   */
  buffer: Buffer;

  /**
   * Image width (usually 1024)
   */
  width: number;

  /**
   * Image height (usually 1024)
   */
  height: number;

  /**
   * Size in bytes
   */
  size: number;

  /**
   * Processing time in milliseconds
   */
  processingTimeMs: number;
}

const DEFAULT_OPTIONS: Required<EdgeMapOptions> = {
  size: 1024,
  threshold: 10,
  blurSigma: 0.5,
  strokeMultiplier: 2.5,
  padding: 0.15,
  invertOutput: true,
};

/**
 * Convert SVG to edge-detected control image for ControlNet
 *
 * This function prepares sigil SVGs for use with Google Vertex AI's Imagen 3
 * ControlNet capabilities. The output is a high-contrast edge map that preserves
 * the structure of the sigil while being optimized for AI conditioning.
 *
 * @param svgString - SVG markup as string
 * @param options - Edge map generation options
 * @returns Promise<EdgeMapResult> - Edge map buffer and metadata
 *
 * @example
 * ```typescript
 * const edgeMap = await svgToEdgeMap(baseSigilSvg, {
 *   size: 1024,
 *   threshold: 10,
 *   strokeMultiplier: 2.5
 * });
 *
 * // Use edge map buffer for ControlNet conditioning
 * const base64 = edgeMap.buffer.toString('base64');
 * ```
 */
export async function svgToEdgeMap(
  svgString: string,
  options: EdgeMapOptions = {}
): Promise<EdgeMapResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Step 1: Rasterize SVG to high-contrast PNG
    // Using white lines on black background for better edge detection
    const rasterOptions: RasterizeOptions = {
      width: config.size,
      height: config.size,
      backgroundColor: '#000000',
      strokeColor: '#FFFFFF',
      enhanceEdges: true,
      strokeMultiplier: config.strokeMultiplier,
      padding: config.padding,
    };

    const rasterResult = await rasterizeSVG(svgString, rasterOptions);

    // Step 2: Apply edge detection pipeline
    let edgeMapPipeline = sharp(rasterResult.buffer);

    // Optional: Apply gaussian blur for smoother edges
    if (config.blurSigma > 0) {
      edgeMapPipeline = edgeMapPipeline.blur(config.blurSigma);
    }

    // Apply edge detection using Sharp's convolve operation
    // This creates a Sobel-like edge detection filter
    // Sharp doesn't have built-in Canny, but convolve with edge detection kernel works well
    edgeMapPipeline = edgeMapPipeline.convolve({
      width: 3,
      height: 3,
      kernel: [
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
      ],
    });

    // Normalize and enhance contrast
    edgeMapPipeline = edgeMapPipeline
      .normalize() // Auto-adjust contrast to full range
      .threshold(config.threshold); // Binary threshold for clean edges

    // Step 3: Invert if needed (white background for Imagen 3)
    if (config.invertOutput) {
      edgeMapPipeline = edgeMapPipeline.negate();
    }

    // Step 4: Ensure output is PNG format
    edgeMapPipeline = edgeMapPipeline.png({
      compressionLevel: 9,
      quality: 100,
    });

    // Generate final buffer
    const buffer = await edgeMapPipeline.toBuffer();
    const metadata = await sharp(buffer).metadata();

    const processingTimeMs = Date.now() - startTime;

    return {
      buffer,
      width: metadata.width || config.size,
      height: metadata.height || config.size,
      size: buffer.length,
      processingTimeMs,
    };

  } catch (error) {
    throw new Error(
      `Edge map generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert SVG to edge map and return as base64 data URL
 *
 * Useful for sending to Vertex AI API directly without saving to disk.
 *
 * @param svgString - SVG markup
 * @param options - Edge map options
 * @returns Promise<string> - data:image/png;base64,... URL
 *
 * @example
 * ```typescript
 * const dataUrl = await svgToEdgeMapDataURL(sigilSvg);
 * // Send to Vertex AI in API request
 * ```
 */
export async function svgToEdgeMapDataURL(
  svgString: string,
  options: EdgeMapOptions = {}
): Promise<string> {
  const result = await svgToEdgeMap(svgString, options);
  const base64 = result.buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Save edge map to file for debugging/testing
 *
 * @param svgString - SVG markup
 * @param outputPath - File path to save edge map PNG
 * @param options - Edge map options
 */
export async function svgToEdgeMapFile(
  svgString: string,
  outputPath: string,
  options: EdgeMapOptions = {}
): Promise<void> {
  const result = await svgToEdgeMap(svgString, options);
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, result.buffer);
  console.log(
    `✅ Edge map saved to ${outputPath} (${result.size} bytes, ${result.processingTimeMs}ms)`
  );
}

/**
 * Validate that SVG can be converted to edge map without errors
 *
 * @param svgString - SVG markup to validate
 * @returns Promise<boolean>
 */
export async function validateEdgeMapGeneration(svgString: string): Promise<boolean> {
  try {
    await svgToEdgeMap(svgString);
    return true;
  } catch (error) {
    console.error('Edge map validation failed:', error);
    return false;
  }
}
