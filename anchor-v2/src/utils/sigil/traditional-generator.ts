/**
 * Organic Traditional Sigil Generator
 * 
 * Creates flowing, hand-drawn style sigils following Austin Osman Spare's
 * "technology of forgetting" with organic, imperfect aesthetics.
 * 
 * Key features:
 * - Organic letter overlays with rotation/flipping
 * - Hand-drawn irregular outer border
 * - Flowing connection lines between letters
 * - Subtle imperfections for natural feel
 * - Three distinct styles: Dense, Balanced, Minimal
 */

import { DENSE_VECTORS, BALANCED_VECTORS, MINIMAL_VECTORS } from './letterVectors';

export type SigilVariant = 'dense' | 'balanced' | 'minimal';

export interface SigilGenerationResult {
  svg: string;
  variant: SigilVariant;
}

/**
 * Configuration for each variant style
 */
const VARIANT_CONFIGS = {
  dense: {
    strokeWidth: 2.5,
    opacity: 0.85,
    scale: { min: 0.7, max: 1.0 },
    offset: 15,
    connectionOpacity: 0.3,
    decorativeElements: true,
    borderStyle: 'irregular-thick',
  },
  balanced: {
    strokeWidth: 2.0,
    opacity: 0.9,
    scale: { min: 0.6, max: 0.85 },
    offset: 20,
    connectionOpacity: 0.25,
    decorativeElements: true,
    borderStyle: 'irregular-medium',
  },
  minimal: {
    strokeWidth: 1.5,
    opacity: 0.95,
    scale: { min: 0.5, max: 0.7 },
    offset: 25,
    connectionOpacity: 0.15,
    decorativeElements: false,
    borderStyle: 'irregular-thin',
  },
};

/**
 * Get vector set for a specific variant
 */
function getVectorSet(variant: SigilVariant): Record<string, string> {
  switch (variant) {
    case 'dense':
      return DENSE_VECTORS;
    case 'balanced':
      return BALANCED_VECTORS;
    case 'minimal':
      return MINIMAL_VECTORS;
  }
}

/**
 * Generate pseudo-random seed from letter and index
 */
function getSeed(letter: string, index: number): number {
  return index * 13 + letter.charCodeAt(0) * 7;
}

/**
 * Pseudo-random number generator (deterministic)
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Create an irregular, hand-drawn circle border
 */
function createIrregularBorder(
  centerX: number,
  centerY: number,
  baseRadius: number,
  style: string
): string {
  const points: { x: number; y: number }[] = [];
  const numPoints = 36; // Points around the circle

  // Thickness variation based on style
  const radiusVariation = style === 'irregular-thick' ? 8 : style === 'irregular-medium' ? 6 : 4;
  const strokeWidth = style === 'irregular-thick' ? 3 : style === 'irregular-medium' ? 2 : 1.5;

  for (let i = 0; i < numPoints; i++) {
    const angle = (Math.PI * 2 * i) / numPoints;

    // Add organic variation to radius
    const seed = i * 17;
    const variation = (seededRandom(seed) - 0.5) * radiusVariation;
    const radius = baseRadius + variation;

    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    points.push({ x, y });
  }

  // Create smooth curve through points using quadratic curves
  let pathData = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;
    pathData += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
  }

  pathData += ' Z';

  return `<path d="${pathData}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" opacity="0.8" stroke-linecap="round" />`;
}

/**
 * Create flowing connection lines between letter positions
 */
function createConnectionLines(
  positions: { x: number; y: number }[],
  opacity: number
): string {
  if (positions.length < 2) return '';

  const lines: string[] = [];

  // Connect each letter to 1-2 nearby letters
  positions.forEach((pos, i) => {
    // Connect to next letter
    if (i < positions.length - 1) {
      const next = positions[i + 1];
      const controlX = (pos.x + next.x) / 2;
      const controlY = (pos.y + next.y) / 2 - 10; // Slight curve

      lines.push(
        `<path d="M ${pos.x} ${pos.y} Q ${controlX} ${controlY} ${next.x} ${next.y}" stroke="currentColor" stroke-width="1" opacity="${opacity * 0.6}" fill="none" />`
      );
    }
  });

  return lines.join('');
}

/**
 * Create decorative elements for Dense variant
 */
function createDecorativeElements(
  centerX: number,
  centerY: number,
  positions: { x: number; y: number }[],
  opacity: number
): string {
  const elements: string[] = [];

  // Add radiating lines from center to letter positions
  positions.forEach((pos, i) => {
    if (i % 2 === 0) { // Only every other letter
      const midX = (centerX + pos.x) / 2;
      const midY = (centerY + pos.y) / 2;

      elements.push(
        `<line x1="${centerX}" y1="${centerY}" x2="${midX}" y2="${midY}" stroke="currentColor" stroke-width="0.8" opacity="${opacity * 0.25}" />`
      );
    }
  });

  return elements.join('');
}

/**
 * Generate organic sigil from distilled letters
 */
export function generateOrganicSigil(
  letters: string[],
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const config = VARIANT_CONFIGS[variant];
  const vectorSet = getVectorSet(variant);
  const size = 200;
  const center = { x: size / 2, y: size / 2 };

  const letterPaths: string[] = [];
  const letterPositions: { x: number; y: number }[] = [];

  // Generate transformed letter paths
  letters.forEach((letter, index) => {
    const pathData = vectorSet[letter];
    if (!pathData) return;

    const seed = getSeed(letter, index);

    // Rotation: Pseudo-random but deterministic
    const rotation = seededRandom(seed) * 360;

    // Scale: Varies by variant
    const scaleRange = config.scale.max - config.scale.min;
    const scale = config.scale.min + seededRandom(seed + 1) * scaleRange;

    // Flip: Occasional mirroring
    const flipX = seededRandom(seed + 2) > 0.7 ? -1 : 1;
    const flipY = seededRandom(seed + 3) > 0.7 ? -1 : 1;

    // Offset: Position around center with organic clustering
    const angle = (seed % 100) / 100 * Math.PI * 2;
    const distance = seededRandom(seed + 4) * config.offset;
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    const finalX = center.x + offsetX;
    const finalY = center.y + offsetY;

    letterPositions.push({ x: finalX, y: finalY });

    // Build transform string
    const transform = `translate(${finalX}, ${finalY}) rotate(${rotation}, 0, 0) scale(${scale * flipX}, ${scale * flipY}) translate(-50, -50)`;

    letterPaths.push(
      `<path d="${pathData}" stroke="currentColor" stroke-width="${config.strokeWidth}" fill="none" opacity="${config.opacity}" transform="${transform}" stroke-linecap="round" stroke-linejoin="round" />`
    );
  });

  // Create irregular organic border
  const borderRadius = 95;
  const border = createIrregularBorder(
    center.x,
    center.y,
    borderRadius,
    config.borderStyle
  );

  // Create flowing connections
  const connections = createConnectionLines(letterPositions, config.connectionOpacity);

  // Create decorative elements (Dense only)
  const decorative = config.decorativeElements
    ? createDecorativeElements(center.x, center.y, letterPositions, config.opacity)
    : '';

  // Assemble SVG
  const svgContent = [
    decorative,
    connections,
    ...letterPaths,
    border,
  ]
    .filter(Boolean)
    .join('');

  const svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;

  return {
    svg,
    variant,
  };
}

/**
 * Generate all three variants for selection
 */
export function generateAllVariants(letters: string[]): SigilGenerationResult[] {
  return [
    generateOrganicSigil(letters, 'dense'),
    generateOrganicSigil(letters, 'balanced'),
    generateOrganicSigil(letters, 'minimal'),
  ];
}

/**
 * Variant metadata for UI display
 */
export const VARIANT_METADATA = {
  dense: {
    title: 'Dense',
    description: 'Bold and flowing, mystical presence',
  },
  balanced: {
    title: 'Balanced',
    description: 'Elegant curves, harmonious energy',
  },
  minimal: {
    title: 'Minimal',
    description: 'Simple essence, pure intention',
  },
};
