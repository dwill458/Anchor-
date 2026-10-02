import type { AnchorCategory } from '@/types';
import {
  REFINE_STYLES,
  getRecommendedStyles,
  type RefineStyleOption,
} from '../constants/refineStyles';

/**
 * DECISION D7: styles whose current names break the vocabulary rules are kept out of the
 * three-style rotation and out of the pre-selected default. They remain in the "All styles"
 * sheet because they are shipped styles. Flagged for a rename decision.
 */
export const BLOCKED_STYLE_IDS: ReadonlySet<string> = new Set([
  'cosmic',
  'prism-veil',
  'sacred-geometry',
  'resonance-rings',
  'aurora-glow',
  'solar-halo',
  'celestial-grid',
  'obsidian-mono',
]);

/** Ordered, non-blocked styles that rotate into the second and third chip. */
export const ROTATION_POOL: readonly string[] = [
  'architectural-trace',
  'ink-brush',
  'gold-leaf',
  'minimal-line',
  'monolith-ink',
  'watercolor',
  'lunar-etch',
  'ember-trace',
];

export const CHIP_COUNT = 3;

const byId = new Map(REFINE_STYLES.map((style) => [style.id, style] as const));

export const getStyleById = (id: string | undefined): RefineStyleOption | undefined =>
  id ? byId.get(id) : undefined;

export const isBlockedStyle = (id: string): boolean => BLOCKED_STYLE_IDS.has(id);

/** Every shipped style, for the "All styles" sheet. */
export const getAllStyles = (): RefineStyleOption[] => REFINE_STYLES;

/**
 * The style that is selected when the Style beat opens:
 * the last style the person committed, else the first non-blocked recommendation.
 */
export function getDefaultStyleId(
  category: AnchorCategory | undefined,
  intention: string,
  lastStyleId?: string
): string {
  if (lastStyleId && byId.has(lastStyleId) && !isBlockedStyle(lastStyleId)) {
    return lastStyleId;
  }

  const recommended = getRecommendedStyles(category, intention, REFINE_STYLES.length).find(
    (style) => !isBlockedStyle(style.id)
  );

  return recommended?.id ?? ROTATION_POOL[0];
}

/**
 * Three chips: the default, then the next two pool entries starting at
 * `rotationCounter % pool.length`, skipping the default.
 */
export function getChipStyleIds(defaultStyleId: string, rotationCounter: number): string[] {
  const chips = [defaultStyleId];
  const poolSize = ROTATION_POOL.length;
  const start = ((rotationCounter % poolSize) + poolSize) % poolSize;

  for (let offset = 0; offset < poolSize && chips.length < CHIP_COUNT; offset += 1) {
    const candidate = ROTATION_POOL[(start + offset) % poolSize];
    if (!chips.includes(candidate)) {
      chips.push(candidate);
    }
  }

  return chips;
}

/**
 * Picking a style that is not already a chip replaces the third chip — never the default.
 */
export function applyPickedStyle(chipIds: string[], pickedId: string): string[] {
  if (chipIds.includes(pickedId)) return chipIds;
  return [...chipIds.slice(0, CHIP_COUNT - 1), pickedId];
}
