import { getCategoryColor, getCategoryTextColor } from '@/theme/v2';
import { CHART_MAP_TOKENS } from '../map/chartMapTokens';

/**
 * Colour helpers for the ink panel. Every category colour starts from
 * getCategoryColor(category); these only pick a readable companion.
 */

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour (light or ink) that reads best on a category-filled button. */
export function onCategoryFill(fill: string): string {
  const light = '#FFFFFF';
  return contrastRatio(fill, light) >= contrastRatio(fill, CHART_MAP_TOKENS.ink) ? light : CHART_MAP_TOKENS.ink;
}

export type PanelAccent = {
  /** The category colour itself: fills, borders, the check ring, the bar. */
  fill: string;
  /** Same hue lifted to AA contrast on the #1A232E panel: small labels and numerals. */
  text: string;
  /** Readable label colour on a `fill` background. */
  onFill: string;
};

export function panelAccent(category: string | null | undefined): PanelAccent {
  const fill = getCategoryColor(category);
  return {
    fill,
    text: getCategoryTextColor(category, CHART_MAP_TOKENS.panel, CHART_MAP_TOKENS.light),
    onFill: onCategoryFill(fill),
  };
}

/** Category label colour for text on the paper map: AA (4.5:1) against paper, derived from the category colour. */
export function categoryLabelOnPaper(category: string | null | undefined): string {
  return getCategoryTextColor(category, CHART_MAP_TOKENS.paper, CHART_MAP_TOKENS.ink);
}
