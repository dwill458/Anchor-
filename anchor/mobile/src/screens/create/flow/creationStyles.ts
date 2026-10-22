import type { AnchorCategory } from '@/types';
import {
  REFINE_STYLES,
  getRecommendedStyles,
  type RefineStyleOption,
} from '../constants/refineStyles';

/**
 * Anchor 2.0 style system: all 15 styles are fully validated and approved.
 * No blocked styles in the 2.0 set.
 */
export const BLOCKED_STYLE_IDS: ReadonlySet<string> = new Set([]);

/** Ordered Anchor 2.0 styles that rotate into the second and third chip. */
export const ROTATION_POOL: readonly string[] = [
  'velvet-ember',
  'porcelain',
  'prism-flow',
  'joybrush',
  'deep-cosmos',
  'woven',
  'paper',
  'mineral-wash',
  'graphic',
  'plush',
  'herbarium',
  'alloy',
  'gilt',
  'flash',
  'buff',
];

export const CHIP_COUNT = 3;

/** Backward-compatibility map for legacy 1.5 styles to Anchor 2.0 equivalents. */
const LEGACY_STYLE_FALLBACK: Record<string, string> = {
  'watercolor': 'joybrush',
  'ink_brush': 'woven',
  'ink-brush': 'woven',
  'gold_leaf': 'gilt',
  'gold-leaf': 'gilt',
  'cosmic': 'deep-cosmos',
  'minimal_line': 'graphic',
  'minimal-line': 'graphic',
  'obsidian_mono': 'buff',
  'obsidian-mono': 'buff',
  'aurora_glow': 'prism-flow',
  'aurora-glow': 'prism-flow',
  'ember_trace': 'velvet-ember',
  'ember-trace': 'velvet-ember',
  'monolith_ink': 'buff',
  'monolith-ink': 'buff',
  'celestial_grid': 'porcelain',
  'celestial-grid': 'porcelain',
  'echo_chamber': 'prism-flow',
  'echo-chamber': 'prism-flow',
  'prism_veil': 'prism-flow',
  'prism-veil': 'prism-flow',
  'verdigris_relic': 'alloy',
  'verdigris-relic': 'alloy',
  'solar_halo': 'velvet-ember',
  'solar-halo': 'velvet-ember',
  'tideglass': 'prism-flow',
  'sacred_geometry': 'porcelain',
  'sacred-geometry': 'porcelain',
  'architectural_trace': 'porcelain',
  'architectural-trace': 'porcelain',
  'lunar_etch': 'deep-cosmos',
  'lunar-etch': 'deep-cosmos',
  'resonance_rings': 'woven',
  'resonance-rings': 'woven',
  'velvet_ember': 'velvet-ember',
  'clay_v2': 'mineral-wash',
  'mineral_wash_v2': 'mineral-wash',
};

const byId = new Map<string, RefineStyleOption>();
for (const style of REFINE_STYLES) {
  byId.set(style.id, style);
  byId.set(style.name, style);
  byId.set(style.generationStyle, style);
  byId.set(style.displayName.toLowerCase(), style);
  byId.set(style.id.replace(/-/g, '_'), style);
}

export const getStyleById = (id: string | undefined): RefineStyleOption | undefined => {
  if (!id) return undefined;
  const direct = byId.get(id) ?? byId.get(id.toLowerCase());
  if (direct) return direct;

  const fallbackId = LEGACY_STYLE_FALLBACK[id] ?? LEGACY_STYLE_FALLBACK[id.toLowerCase()];
  return fallbackId ? byId.get(fallbackId) : undefined;
};

export const isBlockedStyle = (id: string): boolean => BLOCKED_STYLE_IDS.has(id);

/** Every shipped style (the 15 Anchor 2.0 styles), for the "All styles" sheet. */
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
  if (lastStyleId) {
    const resolved = getStyleById(lastStyleId);
    if (resolved && !isBlockedStyle(resolved.id)) {
      return resolved.id;
    }
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
