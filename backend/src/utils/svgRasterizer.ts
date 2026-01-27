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

  /** Stroke thickness multiplier for edge survival during diffusion (1.5-2.5 recommended) */
  strokeMultiplier?: number;

  /** Padding as fraction of image size (0.10-0.18 recommended) */
  padding?: number;
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
  strokeMultiplier: 1.0,  // No thickening by default (set 2.0 for structure preservation)
  padding: 0.0,           // No padding by default (set 0.12 for structure preservation)
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
 * Now supports stroke thickening for better edge survival during diffusion.
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

  // Extract or create viewBox for proper scaling
  let viewBoxW = 100;
  let viewBoxH = 100;

  const viewBoxMatch = processed.match(/viewBox=["']([^"']+)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    if (parts.length >= 4) {
      viewBoxW = parts[2];
      viewBoxH = parts[3];
    }
  } else {
    // Try to extract width/height and create viewBox
    const widthMatch = processed.match(/width=["'](\d+)["']/);
    const heightMatch = processed.match(/height=["'](\d+)["']/);

    if (widthMatch && heightMatch) {
      viewBoxW = parseInt(widthMatch[1]);
      viewBoxH = parseInt(heightMatch[1]);
      processed = processed.replace(
        '<svg',
        `<svg viewBox="0 0 ${viewBoxW} ${viewBoxH}"`
      );
    } else {
      // Default viewBox if dimensions not found
      processed = processed.replace(
        '<svg',
        '<svg viewBox="0 0 100 100"'
      );
    }
  }

  // Apply padding by adjusting viewBox (negative margins = zoom out)
  if (config.padding > 0) {
    const padX = viewBoxW * config.padding;
    const padY = viewBoxH * config.padding;
    const newViewBox = `${-padX} ${-padY} ${viewBoxW + 2 * padX} ${viewBoxH + 2 * padY}`;
    processed = processed.replace(
      /viewBox=["'][^"']*["']/,
      `viewBox="${newViewBox}"`
    );
  }

  // Add background rectangle for solid color
  if (config.backgroundColor !== 'transparent') {
    const bgRect = `<rect x="-50%" y="-50%" width="200%" height="200%" fill="${config.backgroundColor}"/>`;
    processed = processed.replace('<svg', `<svg`).replace('>', `>${bgRect}`);
  }

  // Force stroke color to white (or specified color)
  processed = processed.replace(
    /stroke=["'][^"']*["']/g,
    `stroke="${config.strokeColor}"`
  );

  // Replace all fill attributes in paths (sigils use stroke, not fill)
  processed = processed.replace(
    /fill=["'][^"']*["']/g,
    'fill="none"'
  );

  // Calculate stroke width with multiplier for edge survival
  const baseStrokeWidth = 2;
  const thickenedWidth = Math.round(baseStrokeWidth * config.strokeMultiplier);

  // Apply stroke thickening - update existing stroke-width or add new ones
  if (config.strokeMultiplier > 1.0) {
    // Replace existing stroke-width values with thickened version
    processed = processed.replace(
      /stroke-width=["'](\d+(?:\.\d+)?)["']/g,
      (match, width) => {
        const newWidth = Math.round(parseFloat(width) * config.strokeMultiplier);
        return `stroke-width="${newWidth}"`;
      }
    );

    // Add stroke-width to paths that don't have it
    processed = processed.replace(
      /<path(?![^>]*stroke-width)/g,
      `<path stroke-width="${thickenedWidth}" `
    );

    // Also handle other stroke elements (line, polyline, polygon, circle, rect)
    processed = processed.replace(
      /<(line|polyline|polygon|circle|rect|ellipse)(?![^>]*stroke-width)/g,
      `<$1 stroke-width="${thickenedWidth}" `
    );
  } else {
    // No thickening - just ensure stroke-width exists
    if (!processed.includes('stroke-width')) {
      processed = processed.replace(
        /<path /g,
        '<path stroke-width="2" '
      );
    }
  }

  // Clean up any existing stroke-linecap/linejoin to prevent duplicates
  processed = processed.replace(/stroke-linecap=["'][^"']*["']/g, '');
  processed = processed.replace(/stroke-linejoin=["'][^"']*["']/g, '');

  // Add stroke-linecap and stroke-linejoin for cleaner lines
  processed = processed.replace(
    /<path /g,
    '<path stroke-linecap="round" stroke-linejoin="round" '
  );

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
