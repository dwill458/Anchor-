/**
 * TRUE Sigil Generator - Planetary Grid Method (Kamea)
 * * ARCHITECTURE CHANGE:
 * Instead of overlapping full letter vectors (which creates "noise"),
 * this version uses the traditional "Magic Square" technique:
 * 1. Reduces intent (removes vowels/duplicates).
 * 2. Maps letters to a 3x3 numerology grid.
 * 3. Draws a single continuous "path of power" connecting the points.
 * 4. Applies SVG filters for a hand-drawn ink aesthetic.
 */

export type SigilVariant = 'dense' | 'balanced' | 'minimal';

export interface SigilGenerationResult {
  svg: string;
  variant: SigilVariant;
}

// ---------------------------------------------------------------------------
// 1. TRADITIONAL MAPPING LOGIC
// ---------------------------------------------------------------------------

// Pythagorean Numerology Mapping (1-9)
const NUMEROLOGY_MAP: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9
};

// 3x3 Grid Coordinate System (0-100 scale for ease)
// We add a little 'wobble' offset in the generating function so it's not robotic
const GRID_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 20, y: 20 }, 2: { x: 50, y: 20 }, 3: { x: 80, y: 20 },
  4: { x: 20, y: 50 }, 5: { x: 50, y: 50 }, 6: { x: 80, y: 50 },
  7: { x: 20, y: 80 }, 8: { x: 50, y: 80 }, 9: { x: 80, y: 80 }
};

// ---------------------------------------------------------------------------
// 2. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Clean and reduce the intent string (Austin Osman Spare method)
 */
function processIntent(letters: string[] | string | undefined | null, variant: SigilVariant): number[] {
  // Normalize letters to a string
  let rawText = '';
  if (Array.isArray(letters)) {
    rawText = letters.join('').toUpperCase().replace(/[^A-Z]/g, '');
  } else if (typeof letters === 'string') {
    rawText = letters.toUpperCase().replace(/[^A-Z]/g, '');
  }

  if (!rawText) return [5]; // Fallback to center point

  let processed = rawText;

  // Step 1: Remove Vowels (unless string is too short)
  if (processed.length > 3) {
    processed = processed.replace(/[AEIOU]/g, '');
  }

  // Step 2: Remove Duplicates (Classic Sigil logic)
  processed = Array.from(new Set(processed.split(''))).join('');

  // Step 3: Map to numbers
  let points = processed.split('').map(char => NUMEROLOGY_MAP[char] || 5);

  // Variant Logic:
  // Minimal: Simplify path further if too long
  if (variant === 'minimal' && points.length > 5) {
    points = points.filter((_, i) => i % 2 === 0);
  }

  return points;
}

/**
 * Add "Hand-Drawn" imperfections to a point
 */
function jitter(val: number, intensity: number = 2): number {
  return val + (Math.random() * intensity - intensity / 2);
}

/**
 * Generate the SVG Path Data (d attribute)
 */
function createSigilPath(points: number[]): string {
  if (points.length === 0) return '';

  const start = GRID_COORDS[points[0]];
  if (!start) return '';

  let path = `M ${jitter(start.x)},${jitter(start.y)}`;

  for (let i = 1; i < points.length; i++) {
    const curr = GRID_COORDS[points[i]];
    if (curr) {
      path += ` L ${jitter(curr.x)},${jitter(curr.y)}`;
    }
  }

  return path;
}

// ---------------------------------------------------------------------------
// 3. SVG COMPONENT GENERATORS
// ---------------------------------------------------------------------------

function createInkFilter(): string {
  // Filters can cause performance issues/crashes in React Native Svg on some platforms
  // Returning basic markers and empty filter definition for safety
  return `
    <defs>
      <marker id="dot-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
        <circle cx="5" cy="5" r="3" fill="currentColor" />
      </marker>
      <marker id="bar-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <line x1="5" y1="0" x2="5" y2="10" stroke="currentColor" stroke-width="2" />
      </marker>
    </defs>
  `;
}

function createBorder(variant: SigilVariant): string {
  if (variant === 'minimal') return ''; // No border for minimal

  // "Hand-drawn" circle approximation
  const r = 42;
  const c = 50;
  // A slightly imperfect circle path
  const d = `
    M ${c + r},${c} 
    Q ${c + r},${c + r} ${c},${c + r} 
    Q ${c - r},${c + r} ${c - r},${c} 
    Q ${c - r},${c - r} ${c},${c - r} 
    Q ${c + r},${c - r} ${c + r},${c}
  `;

  // Dense gets a double ring
  if (variant === 'dense') {
    return `
      <path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />
      <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.4" />
    `;
  }

  return `<path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />`;
}

// ---------------------------------------------------------------------------
// 4. MAIN EXPORT
// ---------------------------------------------------------------------------

export function generateTrueSigil(
  letters: any,
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const size = 300; // Increased resolution

  // 1. Logic Layer
  const points = processIntent(letters, variant);

  // 2. Geometry Layer
  const pathData = createSigilPath(points);

  // 3. Style Layer (Markers)
  // Balanced/Dense get traditional "start/end" markers
  const markers = variant !== 'minimal'
    ? 'marker-start="url(#dot-start)" marker-end="url(#bar-end)"'
    : '';

  const strokeWidth = variant === 'dense' ? 3 : 2;

  // Assemble
  const svg = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF">
      <g>
        ${createBorder(variant)}
        
        <path 
          d="${pathData}" 
          stroke="currentColor" 
          stroke-width="${strokeWidth}" 
          fill="none" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </g>
    </svg>
  `;

  return {
    svg,
    variant,
  };
}

export function generateAllVariants(letters: any): SigilGenerationResult[] {
  try {
    return [
      generateTrueSigil(letters, 'dense'),
      generateTrueSigil(letters, 'balanced'),
      generateTrueSigil(letters, 'minimal'),
    ];
  } catch (error) {
    console.error('Error generating sigil variants:', error);
    // Return empty fallback array
    return [
      { svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>', variant: 'dense' },
      { svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>', variant: 'balanced' },
      { svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>', variant: 'minimal' },
    ];
  }
}

export const VARIANT_METADATA = {
  dense: {
    title: 'Ritual',
    description: 'Enclosed power structure with binding rings',
  },
  balanced: {
    title: 'Focused',
    description: 'The classic path of intent',
  },
  minimal: {
    title: 'Raw',
    description: 'Unbound essential energy',
  },
};
