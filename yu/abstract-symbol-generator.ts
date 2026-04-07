/**
 * Abstract Symbol Generator
 * 
 * Creates TRUE sigils following Austin Osman Spare's principle where
 * letters are transformed into completely unrecognizable abstract symbols.
 * 
 * The final output should look like mystical glyphs, geometric patterns,
 * or symbolic designs - NOT overlapping letters.
 */

export type SigilVariant = 'dense' | 'balanced' | 'minimal';

export interface SigilGenerationResult {
  svg: string;
  variant: SigilVariant;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Generate deterministic pseudo-random number
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Create a mystical symbol from letter positions
 * This creates geometric/abstract shapes that don't look like letters
 */
function createAbstractSymbol(
  letters: string[],
  variant: SigilVariant,
  size: number
): string {
  const center = { x: size / 2, y: size / 2 };
  const paths: string[] = [];
  
  // Generate points from letters (but transform them into symbol positions)
  const numPoints = letters.length;
  const symbolPoints: Point[] = [];
  
  letters.forEach((letter, index) => {
    const seed = index * 13 + letter.charCodeAt(0) * 7;
    const angle = (Math.PI * 2 * index) / numPoints;
    const radius = variant === 'dense' ? 40 : variant === 'balanced' ? 50 : 60;
    
    // Add variation to radius
    const radiusVar = (seededRandom(seed) - 0.5) * 15;
    const finalRadius = radius + radiusVar;
    
    const x = center.x + Math.cos(angle) * finalRadius;
    const y = center.y + Math.sin(angle) * finalRadius;
    
    symbolPoints.push({ x, y });
  });

  // Create geometric patterns based on variant
  if (variant === 'dense') {
    // Dense: Star pattern with cross-connections
    symbolPoints.forEach((point, i) => {
      // Connect to opposite points
      const opposite = symbolPoints[(i + Math.floor(numPoints / 2)) % numPoints];
      paths.push(`<line x1="${point.x}" y1="${point.y}" x2="${opposite.x}" y2="${opposite.y}" stroke="currentColor" stroke-width="2.5" opacity="0.8" />`);
      
      // Connect to center
      const midX = (center.x + point.x) / 2;
      const midY = (center.y + point.y) / 2;
      paths.push(`<line x1="${center.x}" y1="${center.y}" x2="${midX}" y2="${midY}" stroke="currentColor" stroke-width="1.5" opacity="0.6" />`);
    });
    
    // Add geometric shapes at points
    symbolPoints.forEach((point) => {
      paths.push(`<circle cx="${point.x}" cy="${point.y}" r="4" fill="currentColor" opacity="0.9" />`);
    });
    
  } else if (variant === 'balanced') {
    // Balanced: Flowing curves connecting points
    symbolPoints.forEach((point, i) => {
      const next = symbolPoints[(i + 1) % numPoints];
      const controlX = (point.x + next.x) / 2 + (i % 2 === 0 ? 15 : -15);
      const controlY = (point.y + next.y) / 2 + (i % 2 === 0 ? -15 : 15);
      
      paths.push(`<path d="M ${point.x} ${point.y} Q ${controlX} ${controlY} ${next.x} ${next.y}" stroke="currentColor" stroke-width="2" fill="none" opacity="0.85" />`);
    });
    
    // Add small circles at intersections
    symbolPoints.forEach((point) => {
      paths.push(`<circle cx="${point.x}" cy="${point.y}" r="3" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />`);
    });
    
  } else {
    // Minimal: Simple geometric shape
    symbolPoints.forEach((point, i) => {
      const next = symbolPoints[(i + 1) % numPoints];
      paths.push(`<line x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}" stroke="currentColor" stroke-width="1.8" opacity="0.9" />`);
    });
    
    // Add single point at each vertex
    symbolPoints.forEach((point) => {
      paths.push(`<circle cx="${point.x}" cy="${point.y}" r="2.5" fill="currentColor" opacity="0.85" />`);
    });
  }
  
  // Add central symbol based on number of letters
  if (variant === 'dense' || variant === 'balanced') {
    if (numPoints % 2 === 0) {
      // Even number: Add square/diamond
      const size = variant === 'dense' ? 20 : 15;
      paths.push(`<rect x="${center.x - size/2}" y="${center.y - size/2}" width="${size}" height="${size}" transform="rotate(45 ${center.x} ${center.y})" stroke="currentColor" stroke-width="2" fill="none" opacity="0.7" />`);
    } else {
      // Odd number: Add circle
      const radius = variant === 'dense' ? 12 : 10;
      paths.push(`<circle cx="${center.x}" cy="${center.y}" r="${radius}" stroke="currentColor" stroke-width="2" fill="none" opacity="0.7" />`);
    }
  }
  
  // Add decorative elements for Dense
  if (variant === 'dense') {
    // Add small symbols at cardinal directions
    const symbolSize = 8;
    const distance = 75;
    
    // Top
    paths.push(`<path d="M ${center.x} ${center.y - distance - symbolSize} L ${center.x} ${center.y - distance + symbolSize}" stroke="currentColor" stroke-width="2" opacity="0.5" />`);
    paths.push(`<path d="M ${center.x - symbolSize} ${center.y - distance} L ${center.x + symbolSize} ${center.y - distance}" stroke="currentColor" stroke-width="2" opacity="0.5" />`);
    
    // Bottom
    paths.push(`<circle cx="${center.x}" cy="${center.y + distance}" r="4" fill="currentColor" opacity="0.5" />`);
    
    // Left
    paths.push(`<rect x="${center.x - distance - symbolSize/2}" y="${center.y - symbolSize/2}" width="${symbolSize}" height="${symbolSize}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5" />`);
    
    // Right
    paths.push(`<polygon points="${center.x + distance},${center.y - symbolSize} ${center.x + distance + symbolSize},${center.y} ${center.x + distance},${center.y + symbolSize}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" />`);
  }
  
  return paths.join('');
}

/**
 * Create irregular border that looks hand-drawn
 */
function createOrganicBorder(
  centerX: number,
  centerY: number,
  baseRadius: number,
  variant: SigilVariant
): string {
  const points: Point[] = [];
  const numPoints = 36;
  const radiusVariation = variant === 'dense' ? 8 : variant === 'balanced' ? 6 : 4;
  const strokeWidth = variant === 'dense' ? 3 : variant === 'balanced' ? 2.5 : 2;

  for (let i = 0; i < numPoints; i++) {
    const angle = (Math.PI * 2 * i) / numPoints;
    const seed = i * 17 + 42;
    const variation = (seededRandom(seed) - 0.5) * radiusVariation;
    const radius = baseRadius + variation;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    points.push({ x, y });
  }

  // Create smooth curve through points
  let pathData = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;
    pathData += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
  }
  
  pathData += ' Z';

  return `<path d="${pathData}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" opacity="0.85" stroke-linecap="round" />`;
}

/**
 * Generate complete abstract sigil
 */
export function generateAbstractSigil(
  letters: string[],
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const size = 200;
  const center = { x: size / 2, y: size / 2 };

  // Create abstract symbol (NOT overlapping letters)
  const symbolPaths = createAbstractSymbol(letters, variant, size);

  // Create organic border
  const borderRadius = 95;
  const border = createOrganicBorder(center.x, center.y, borderRadius, variant);

  // Assemble SVG
  const svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${symbolPaths}${border}</svg>`;

  return {
    svg,
    variant,
  };
}

/**
 * Generate all three variants
 */
export function generateAllVariants(letters: string[]): SigilGenerationResult[] {
  return [
    generateAbstractSigil(letters, 'dense'),
    generateAbstractSigil(letters, 'balanced'),
    generateAbstractSigil(letters, 'minimal'),
  ];
}

/**
 * Variant metadata
 */
export const VARIANT_METADATA = {
  dense: {
    title: 'Dense',
    description: 'Powerful geometric patterns with bold energy',
  },
  balanced: {
    title: 'Balanced',
    description: 'Flowing curves and harmonious connections',
  },
  minimal: {
    title: 'Minimal',
    description: 'Pure essence, simple geometric form',
  },
};
