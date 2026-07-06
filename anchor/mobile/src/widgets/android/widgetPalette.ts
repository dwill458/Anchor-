/**
 * Shared visual constants + SVG builders for the Android home screen widgets.
 *
 * Colors, opacity values, and glyph geometry come from the approved widget
 * spec — do not tweak without flagging back (the not-primed ring value in
 * particular is a deliberate legibility fix).
 *
 * Native widgets can't run CSS filters/box-shadows, so "glow" is approximated
 * with layered low-opacity strokes and radial gradients inside the SVGs.
 */

export const WIDGET_BG = '#080C10';
export const GOLD = '#D4AF37';
export const BONE = '#F5F5DC';
export const DIM_GLYPH = '#3d4147';
export const MUTED_LABEL = '#9a9488';
export const FAINT_LABEL = '#8a8577';
export const SILVER_LABEL = '#C0C0C0';

/**
 * FIX #1 (small widget, not-primed): visible silver ring —
 * rgba(192,192,192,0.14). Replaces the near-invisible rgba(255,255,255,0.05)
 * ring; without it the dim glyph reads as a rendering error. Required.
 */
export const RING_NOT_PRIMED = '#C0C0C024'; // rgba(192,192,192,0.14)
/** Primed ring: rgba(212,175,55,0.16) */
export const RING_PRIMED = '#D4AF3729';
/** Medium CTA border (primed): rgba(212,175,55,0.4) */
export const CTA_BORDER_PRIMED = '#D4AF3766';

export const WIDGET_CORNER_RADIUS = 26;

/** Heatmap cell colors by level — Focus (gold) family */
export const HEAT_GOLD: Record<0 | 1 | 2 | 3, string> = {
  0: '#161a1f',
  1: '#57491f',
  2: '#9c7c26',
  3: '#E8C860',
};
/** Deep Prime (Deep Purple) family — intentional brand tie-in */
export const HEAT_DEEP: Record<1 | 2 | 3, string> = {
  1: '#5c4079',
  2: '#7e58a6',
  3: '#9d74cf',
};

/** Widget font families — file basenames registered via the plugin `fonts` option */
export const FONT_SERIF_SEMIBOLD = 'CrimsonPro_600SemiBold';
export const FONT_DISPLAY = 'Cinzel_500Medium';
export const FONT_DISPLAY_SEMIBOLD = 'Cinzel_600SemiBold';

/**
 * The anchor glyph paths (viewBox 0 0 120 130) — same geometry in every
 * state; only stroke color / opacity / glow change.
 */
function glyphPaths(): string {
  return (
    '<circle cx="60" cy="18" r="9"/>' +
    '<line x1="60" y1="27" x2="60" y2="104"/>' +
    '<line x1="41" y1="44" x2="79" y2="44"/>' +
    '<path d="M60 104 Q28 104 25 72"/>' +
    '<path d="M60 104 Q92 104 95 72"/>' +
    '<path d="M25 72 L21 78 M25 72 L31 74"/>' +
    '<path d="M95 72 L99 78 M95 72 L89 74"/>'
  );
}

function glyphGroup(stroke: string, strokeWidth: number, opacity: number): string {
  return (
    `<g fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">` +
    glyphPaths() +
    '</g>'
  );
}

export interface GlyphOptions {
  strokeWidth: number;
  /** Crisp stroke color */
  stroke: string;
  /** Overall glyph opacity */
  opacity: number;
  /** Adds layered gold under-strokes approximating the CSS drop-shadow glow */
  glow: boolean;
}

/**
 * Returns the glyph as SVG inner markup (no <svg> wrapper) in glyph
 * coordinate space (120 × 130). Compose inside an <svg> or a transformed <g>.
 */
export function buildGlyphMarkup({ strokeWidth, stroke, opacity, glow }: GlyphOptions): string {
  let markup = '';
  if (glow) {
    // drop-shadow(0 0 ~7px gold) approximation: two soft under-strokes
    markup += glyphGroup(GOLD, strokeWidth * 4.2, 0.12);
    markup += glyphGroup(GOLD, strokeWidth * 2.4, 0.28);
  }
  markup += glyphGroup(stroke, strokeWidth, opacity);
  return markup;
}

/** Standalone glyph SVG (for the medium/large header glyphs) */
export function buildGlyphSvg(options: GlyphOptions): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">${buildGlyphMarkup(options)}</svg>`;
}
