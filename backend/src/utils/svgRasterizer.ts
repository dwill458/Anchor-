/**
 * SVG Rasterizer - Convert SVG to high-contrast PNG for ControlNet
 *
 * Purpose: Prepare sigil SVGs for ControlNet conditioning by converting them
 * to rasterized images with optimal contrast and edge definition.
 *
 * Output format: Black background, white lines, 1024x1024px (optimal for SDXL)
 */

import sharp from 'sharp';

export interface RasterizeOptions {
  /** Output image width in pixels */
  width?: number;

  /** Output image height in pixels */
  height?: number;

  /** Background color (default: black for ControlNet) */
  backgroundColor?: string;

  /** Stroke color (default: white for high contrast) */
  strokeColor?: string;

  /** Apply edge enhancement (helps with Canny detection) */
  enhanceEdges?: boolean;
}

export interface RasterizeResult {
  /** PNG image as Buffer */
  buffer: Buffer;

  /** Image width */
  width: number;

  /** Image height */
  height: number;

  /** Size in bytes */
  size: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

const DEFAULT_OPTIONS: Required<RasterizeOptions> = {
  width: 1024,
  height: 1024,
  backgroundColor: '#000000',
  strokeColor: '#FFFFFF',
  enhanceEdges: true,
};

/**
 * Convert SVG string to high-contrast PNG buffer
 *
 * @param svgString - SVG markup as string
 * @param options - Rasterization options
 * @returns Promise<RasterizeResult>
 *
 * @example
 * ```typescript
 * const result = await rasterizeSVG(baseSigilSvg);
 * // Save to file or upload to storage
 * fs.writeFileSync('sigil.png', result.buffer);
 * ```
 */
export async function rasterizeSVG(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<RasterizeResult> {
  const startTime = Date.now();

  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Validate input
  if (!svgString || typeof svgString !== 'string') {
    throw new Error('Invalid SVG input: must be a non-empty string');
  }

  if (!svgString.trim().startsWith('<svg')) {
    throw new Error('Invalid SVG input: does not start with <svg tag');
  }

  try {
    // Step 1: Process SVG to ensure high contrast
    const processedSVG = preprocessSVG(svgString, config);

    // Step 2: Convert SVG to PNG using Sharp
    let sharpInstance = sharp(Buffer.from(processedSVG))
      .resize(config.width, config.height, {
        fit: 'contain',
        background: config.backgroundColor,
      })
      .png({
        compressionLevel: 9, // Maximum compression
        quality: 100,        // Maximum quality
      });

    // Step 3: Apply edge enhancement if requested
    if (config.enhanceEdges) {
      sharpInstance = sharpInstance.sharpen({
        sigma: 1.5,  // Sharpening strength
        m1: 1.0,     // Edge emphasis
        m2: 2.0,     // Edge slope
      });
    }

    // Step 4: Generate PNG buffer
    const buffer = await sharpInstance.toBuffer();
    const metadata = await sharp(buffer).metadata();

    const processingTimeMs = Date.now() - startTime;

    return {
      buffer,
      width: metadata.width || config.width,
      height: metadata.height || config.height,
      size: buffer.length,
      processingTimeMs,
    };

  } catch (error) {
    throw new Error(
      `SVG rasterization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Preprocess SVG to ensure high contrast and proper formatting
 *
 * @param svgString - Original SVG markup
 * @param config - Configuration options
 * @returns Processed SVG string
 */
function preprocessSVG(
  svgString: string,
  config: Required<RasterizeOptions>
): string {
  let processed = svgString;

  // Ensure SVG has viewBox for proper scaling
  if (!processed.includes('viewBox')) {
    // Try to extract width/height and create viewBox
    const widthMatch = processed.match(/width="(\d+)"/);
    const heightMatch = processed.match(/height="(\d+)"/);

    if (widthMatch && heightMatch) {
      const w = widthMatch[1];
      const h = heightMatch[1];
      processed = processed.replace(
        '<svg',
        `<svg viewBox="0 0 ${w} ${h}"`
      );
    } else {
      // Default viewBox if dimensions not found
      processed = processed.replace(
        '<svg',
        '<svg viewBox="0 0 100 100"'
      );
    }
  }

  // Add background rectangle for solid color
  if (config.backgroundColor !== 'transparent') {
    const bgRect = `<rect width="100%" height="100%" fill="${config.backgroundColor}"/>`;
    processed = processed.replace('<svg', `<svg`).replace('>', `>${bgRect}`);
  }

  // Force stroke color to white (or specified color)
  // Replace all stroke attributes
  processed = processed.replace(
    /stroke="[^"]*"/g,
    `stroke="${config.strokeColor}"`
  );

  // Replace all fill attributes in paths (sigils use stroke, not fill)
  processed = processed.replace(
    /fill="[^"]*"/g,
    'fill="none"'
  );

  // Ensure stroke-width is visible
  if (!processed.includes('stroke-width')) {
    processed = processed.replace(
      /<path /g,
      '<path stroke-width="2" '
    );
  }

  return processed;
}

/**
 * Batch rasterize multiple SVGs
 *
 * @param svgs - Array of SVG strings
 * @param options - Rasterization options (applied to all)
 * @returns Promise<RasterizeResult[]>
 */
export async function rasterizeBatch(
  svgs: string[],
  options: RasterizeOptions = {}
): Promise<RasterizeResult[]> {
  return Promise.all(svgs.map(svg => rasterizeSVG(svg, options)));
}

/**
 * Rasterize and save to file (for testing/debugging)
 *
 * @param svgString - SVG markup
 * @param outputPath - File path to save PNG
 * @param options - Rasterization options
 */
export async function rasterizeToFile(
  svgString: string,
  outputPath: string,
  options: RasterizeOptions = {}
): Promise<void> {
  const result = await rasterizeSVG(svgString, options);
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, result.buffer);
  console.log(`✅ Rasterized SVG saved to ${outputPath} (${result.size} bytes, ${result.processingTimeMs}ms)`);
}

/**
 * Get image data URL (base64 encoded) for web display
 *
 * @param svgString - SVG markup
 * @param options - Rasterization options
 * @returns Promise<string> - data:image/png;base64,... URL
 */
export async function rasterizeToDataURL(
  svgString: string,
  options: RasterizeOptions = {}
): Promise<string> {
  const result = await rasterizeSVG(svgString, options);
  const base64 = result.buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Validate that SVG can be rasterized without errors
 *
 * @param svgString - SVG markup to validate
 * @returns Promise<boolean>
 */
export async function validateSVG(svgString: string): Promise<boolean> {
  try {
    await rasterizeSVG(svgString);
    return true;
  } catch (error) {
    console.error('SVG validation failed:', error);
    return false;
  }
}
