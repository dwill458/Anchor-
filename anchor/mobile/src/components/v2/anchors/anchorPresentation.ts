import type { Anchor } from '@/types';
import type { AnchorExpression } from '@/constants/v2/creation';
import { normalizeExpression } from '@/components/v2/anchor/anchorExpressions';

/** The stable artwork source: user-reinforced geometry if present, else base. */
export function anchorArtworkSvg(anchor: Pick<Anchor, 'baseSigilSvg' | 'reinforcedSigilSvg'>): string {
  return anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
}

/**
 * The kept expression, or undefined for an Anchor that never recorded one — those keep
 * rendering their stored SVG exactly as they always have.
 */
export function anchorKeptExpression(anchor: Pick<Anchor, 'classifierMeta'>): AnchorExpression | undefined {
  const stored = anchor.classifierMeta?.v2Expression;
  return typeof stored === 'string' && stored ? normalizeExpression(stored) : undefined;
}

/**
 * Structure + expression + finished artwork for one Anchor, resolved in one place so every
 * surface that spreads it into `CircularAnchorRenderer` shows the same Anchor the same way.
 */
export function anchorRenderProps(
  anchor: Pick<Anchor, 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl' | 'category' | 'classifierMeta'>,
): { svg: string; imageUrl?: string; category: string; expression?: AnchorExpression } {
  return {
    svg: anchorArtworkSvg(anchor),
    imageUrl: anchor.enhancedImageUrl,
    category: anchor.category,
    expression: anchorKeptExpression(anchor),
  };
}

/**
 * "career" -> "Career", "personal_growth" -> "Personal growth".
 *
 * Categories are stored as machine values, so the separators must be resolved
 * here: without this an enum such as PERSONAL_GROWTH reaches the screen as an
 * internal identifier. Presentation only.
 */
export function categoryLabel(category?: string | null): string {
  const value = category?.trim();
  if (!value) return 'Custom';
  const words = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words) return 'Custom';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** e.g. "Sep 3" */
export function shortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** e.g. "10 sec" / "1 min" / "12 min" */
export function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
