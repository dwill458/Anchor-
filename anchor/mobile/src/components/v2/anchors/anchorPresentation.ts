import type { Anchor } from '@/types';

/** The stable artwork source: user-reinforced geometry if present, else base. */
export function anchorArtworkSvg(anchor: Pick<Anchor, 'baseSigilSvg' | 'reinforcedSigilSvg'>): string {
  return anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
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
