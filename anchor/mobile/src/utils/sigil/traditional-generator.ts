import { logger } from '@/utils/logger';
import { PlanetaryTier } from '@/types';
import { getGridConfig, GridConfig } from './gridRegistry';

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

const EMPTY_SIGIL_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>';
const SIGIL_RESULT_CACHE = new Map<string, SigilGenerationResult>();

// ---------------------------------------------------------------------------
// 1. TRADITIONAL MAPPING LOGIC
// ---------------------------------------------------------------------------

// Pythagorean Numerology Mapping (1-9)
function letterToNumber(letter: string, maxValue: number): number {
  const code = letter.toUpperCase().charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
  if (code < 1 || code > 26) return 1;

  if (maxValue >= 26) return code;

  if (maxValue === 9) {
    let sum = code;
    while (sum > 9) {
      sum = String(sum).split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);
    }
    return sum;
  }

  return ((code - 1) % maxValue) + 1;
}

// ---------------------------------------------------------------------------
// 2. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

function normalizeLettersInput(letters: unknown): string {
  const rawText = Array.isArray(letters)
    ? letters.join('')
    : typeof letters === 'string'
      ? letters
      : '';

  return rawText.toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Clean and reduce the intent string (Austin Osman Spare method)
 */
function processIntent(rawText: string, variant: SigilVariant, maxValue: number): number[] {
  if (!rawText) return [Math.ceil(maxValue / 2) || 1]; // Fallback to center point

  let processed = rawText;

  // Step 1: Remove Vowels (unless string is too short)
  if (processed.length > 3) {
    processed = processed.replace(/[AEIOU]/g, '');
  }

  // Step 2: Remove Duplicates (Classic Sigil logic)
  processed = Array.from(new Set(processed.split(''))).join('');

  // Step 3: Map to numbers
  let points = processed.split('').map(char => letterToNumber(char, maxValue));

  // Variant Logic:
  // Minimal: Simplify path further if too long
  if (variant === 'minimal' && points.length > 5) {
    points = points.filter((_, i) => i % 2 === 0);
  }

  return points;
}

function createSeed(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  value ^= value >>> 16;
  return value / 4294967295;
}

/**
 * Add deterministic "hand-drawn" imperfections to a point.
 * Stable output keeps repeated renders cacheable and avoids XML churn.
 */
function jitter(val: number, seed: number, salt: number, intensity: number = 2): number {
  const offset = seededUnit(seed, salt) * intensity - intensity / 2;
  return Number((val + offset).toFixed(2));
}

/**
 * Generate the SVG Path Data (d attribute)
 */
function createSigilPath(points: number[], seed: number, gridConfig: GridConfig): string {
  if (points.length === 0) return '';

  const start = gridConfig.coords[points[0]];
  if (!start) return '';

  let path = `M ${jitter(start.x, seed, 1)},${jitter(start.y, seed, 2)}`;

  for (let i = 1; i < points.length; i++) {
    const curr = gridConfig.coords[points[i]];
    if (curr) {
      const saltBase = i * 2 + 1;
      path += ` L ${jitter(curr.x, seed, saltBase)},${jitter(curr.y, seed, saltBase + 1)}`;
    }
  }

  return path;
}

// ---------------------------------------------------------------------------
// 3. SVG COMPONENT GENERATORS
// ---------------------------------------------------------------------------

function createBorder(variant: SigilVariant): string {
  if (variant === 'minimal' || variant === 'balanced') return ''; // No border for minimal and balanced

  // "Hand-drawn" circle approximation
  const r = 44; // Increased from 42 to fit 20-80 grid comfortably
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
    return `<path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" /><circle cx="50" cy="50" r="48" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.4" />`;
  }

  return `<path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />`;
}

// ---------------------------------------------------------------------------
// 4. MAIN EXPORT
// ---------------------------------------------------------------------------

function calculateStrokeWidth(tier: PlanetaryTier, variant: SigilVariant, gridConfig: GridConfig): number {
  const baseDensity: Record<number, Record<SigilVariant, number>> = {
    3: { dense: 3, balanced: 2, minimal: 1.5 },
    4: { dense: 2.5, balanced: 1.8, minimal: 1.2 },
    5: { dense: 2, balanced: 1.5, minimal: 1 },
    6: { dense: 1.8, balanced: 1.3, minimal: 0.9 },
    7: { dense: 1.5, balanced: 1.1, minimal: 0.7 }
  };
  return baseDensity[gridConfig.size]?.[variant] ?? 2;
}

export function generateTrueSigil(
  letters: any,
  tier: PlanetaryTier = PlanetaryTier.SATURN,
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const normalizedLetters = normalizeLettersInput(letters);
  const cacheKey = `${tier}:${variant}:${normalizedLetters || 'CENTER'}`;
  const cachedResult = SIGIL_RESULT_CACHE.get(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  const gridConfig = getGridConfig(tier);

  // 1. Logic Layer
  const points = processIntent(normalizedLetters, variant, gridConfig.maxValue);

  // 2. Geometry Layer
  const seed = createSeed(cacheKey);
  const pathData = createSigilPath(points, seed, gridConfig);

  const strokeWidth = calculateStrokeWidth(tier, variant, gridConfig);

  // Assemble
  // NOTE: Do not add <filter>, <marker>, or marker-start/marker-end here.
  // react-native-svg does not reliably support these and they cause crashes.
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF"><g>${createBorder(variant)}<path d="${pathData}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" /></g></svg>`;

  const result = {
    svg,
    variant,
  };

  SIGIL_RESULT_CACHE.set(cacheKey, result);

  return result;
}

export function generateAllVariants(letters: any, tier: PlanetaryTier = PlanetaryTier.SATURN): SigilGenerationResult[] {
  try {
    return [
      generateTrueSigil(letters, tier, 'dense'),
      generateTrueSigil(letters, tier, 'balanced'),
      generateTrueSigil(letters, tier, 'minimal'),
    ];
  } catch (error) {
    logger.error('Error generating sigil variants:', error);
    // Return empty fallback array
    return [
      { svg: EMPTY_SIGIL_SVG, variant: 'dense' },
      { svg: EMPTY_SIGIL_SVG, variant: 'balanced' },
      { svg: EMPTY_SIGIL_SVG, variant: 'minimal' },
    ];
  }
}

export const VARIANT_METADATA = {
  dense: {
    title: 'Ritual',
    description: 'Dense geometry with containing circles',
  },
  balanced: {
    title: 'Focused',
    description: 'Clear paths, steady center',
  },
  minimal: {
    title: 'Raw',
    description: 'Simplified path, open structure',
  },
};
