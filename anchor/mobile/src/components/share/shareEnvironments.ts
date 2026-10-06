import type { ImageSourcePropType } from 'react-native';
import { getStyleById } from '@/screens/create/flow/creationStyles';

/**
 * Share Environments: curated, static 9:16 backgrounds, one per Anchor 2.0
 * creation style. They contain no Anchor symbol; they extend each style's
 * visual language and sit behind the user's actual circular Anchor.
 *
 * Keyed by the style's canonical id (`REFINE_STYLES[].id`). Each style holds a
 * list so several variants can ship later; V1 has one per style.
 */
export const STYLE_SHARE_BACKGROUNDS: Record<string, ImageSourcePropType[]> = {
  'velvet-ember': [require('@/assets/share-environments/velvet-ember.jpg')],
  porcelain: [require('@/assets/share-environments/porcelain.jpg')],
  'prism-flow': [require('@/assets/share-environments/prism-flow.jpg')],
  joybrush: [require('@/assets/share-environments/joybrush.jpg')],
  'deep-cosmos': [require('@/assets/share-environments/deep-cosmos.jpg')],
  woven: [require('@/assets/share-environments/woven.jpg')],
  paper: [require('@/assets/share-environments/paper.jpg')],
  'mineral-wash': [require('@/assets/share-environments/mineral-wash.jpg')],
  graphic: [require('@/assets/share-environments/graphic.jpg')],
  plush: [require('@/assets/share-environments/plush.jpg')],
  herbarium: [require('@/assets/share-environments/herbarium.jpg')],
  alloy: [require('@/assets/share-environments/alloy.jpg')],
  gilt: [require('@/assets/share-environments/gilt.jpg')],
  flash: [require('@/assets/share-environments/flash.jpg')],
  buff: [require('@/assets/share-environments/buff.jpg')],
};

/**
 * Where things sit on one poster, as fractions of its width/height.
 * `anchor*` is the circle's centre; `anchorScale` is its diameter over the
 * poster width; `textY` is the vertical centre of the intention block.
 */
export interface ShareComposition {
  anchorX: number;
  anchorY: number;
  anchorScale: number;
  textX: number;
  textY: number;
  /** Width of the text column, over poster width. */
  textWidth: number;
  align: 'left' | 'center' | 'right';
}

/**
 * Per-style art direction. `tone` describes the environment: 'dark' means a
 * dark ground (light text), 'light' means a light ground (ink text).
 * `style` and `editorial` override the shared defaults only where a given
 * environment's clean space is not the usual centred oval.
 */
export interface ShareEnvironment {
  id: string | null;
  source: ImageSourcePropType | null;
  tone: 'light' | 'dark';
  style: Partial<ShareComposition>;
  editorial: Partial<ShareComposition>;
  /** Mean colour of the text zone (what ink sits on). Sampled from the asset. */
  paper: string;
  /** Mean colour along the bottom edge (what the brand mark sits on). Sampled from the asset. */
  base: string;
  ink: EditorialInk;
}

/**
 * How the Editorial intention is printed into this environment. Everything is
 * code-drawn and deliberately subtle: a warm ink that lets the surface show
 * through, a faint wear texture, a soft bleed and, on paper-like grounds, a
 * hint of impression.
 */
export interface EditorialInk {
  color: string;
  opacity: number;
  /** 0-1: strength of the worn-ink speckle. */
  wear: number;
  /** 0-1: soft ink spread around the letterforms. */
  bleed: number;
  /** A faint pressed-in highlight just below the letters. */
  impression: boolean;
}

export const STYLE_COMPOSITION: ShareComposition = {
  anchorX: 0.5,
  anchorY: 0.32,
  anchorScale: 0.5,
  textX: 0.5,
  textY: 0.585,
  textWidth: 0.7,
  align: 'center',
};

export const EDITORIAL_COMPOSITION: ShareComposition = {
  anchorX: 0.5,
  anchorY: 0.2,
  anchorScale: 0.24,
  textX: 0.5,
  textY: 0.47,
  textWidth: 0.66,
  align: 'center',
};

type Direction = Pick<ShareEnvironment, 'tone' | 'style' | 'editorial'>;

/** Colours measured from the 15 environment assets (text zone and bottom edge). */
const SAMPLES: Record<string, { paper: string; base: string }> = {
  'velvet-ember': { paper: '#ce9466', base: '#78200c' },
  porcelain: { paper: '#f5eadb', base: '#d2c7b9' },
  'prism-flow': { paper: '#2a1945', base: '#5a366d' },
  joybrush: { paper: '#f6e5ce', base: '#f5aa6b' },
  'deep-cosmos': { paper: '#060b18', base: '#3e3d4d' },
  woven: { paper: '#e0cdb7', base: '#b19476' },
  paper: { paper: '#e4dacf', base: '#9e9fa0' },
  'mineral-wash': { paper: '#cebda3', base: '#947f5e' },
  graphic: { paper: '#e9d9c6', base: '#aa8368' },
  plush: { paper: '#edd9c1', base: '#8f6958' },
  herbarium: { paper: '#e6d3bb', base: '#c9b18e' },
  alloy: { paper: '#dac6b0', base: '#987e63' },
  gilt: { paper: '#1d2a36', base: '#282725' },
  flash: { paper: '#e7cdab', base: '#a68160' },
  buff: { paper: '#e2d2c0', base: '#a07e77' },
};

const WARM_INK: EditorialInk = { color: '#2C2219', opacity: 0.9, wear: 0.5, bleed: 0.45, impression: false };
const LIGHT_INK: EditorialInk = { color: '#F0E6D2', opacity: 0.93, wear: 0.25, bleed: 0.3, impression: false };

/** Print character per style; anything not listed gets the tone's default ink. */
const INK: Record<string, Partial<EditorialInk>> = {
  // Strongest printed-on-paper integration.
  paper: { color: '#2E231A', wear: 0.6, bleed: 0.55, impression: true },
  herbarium: { color: '#2F2418', wear: 0.6, bleed: 0.55, impression: true },
  'mineral-wash': { wear: 0.5, impression: true },
  woven: { wear: 0.55, impression: true },
  // Paste-up poster: a little rougher.
  buff: { color: '#1F1712', opacity: 0.94, wear: 0.85, bleed: 0.6, impression: true },
  // Aged flash sheet: darker, a touch bolder.
  flash: { color: '#1B120D', opacity: 0.96, wear: 0.5, bleed: 0.8 },
  // Modern and precise: almost no distress.
  graphic: { color: '#1B1D2F', opacity: 0.94, wear: 0.1, bleed: 0.15 },
  // Refined luxury: gold-cream, little roughness, a hairline of impression.
  gilt: { color: '#EFE2BE', opacity: 0.95, wear: 0.18, bleed: 0.25 },
  // Softer tonal treatment.
  plush: { color: '#3A2D3A', opacity: 0.84, wear: 0.25, bleed: 0.65 },
  porcelain: { color: '#2B2823', wear: 0.35, bleed: 0.35 },
  'velvet-ember': { color: '#2A160F', wear: 0.3 },
  joybrush: { color: '#2B1B19', wear: 0.35 },
  alloy: { color: '#28231E', wear: 0.3 },
};

const DIRECTION: Record<string, Direction> = {
  // Cream centre inside a fire edge: the clean oval is small, so everything tightens.
  'velvet-ember': { tone: 'light', style: { anchorScale: 0.46, anchorY: 0.31, textWidth: 0.58 }, editorial: { textWidth: 0.52, textY: 0.48 } },
  porcelain: { tone: 'light', style: {}, editorial: {} },
  // Violet swirl gathers bottom-left; the dark field is clear up and to the right.
  'prism-flow': { tone: 'dark', style: { anchorX: 0.52, textX: 0.52 }, editorial: { anchorX: 0.52, textX: 0.52 } },
  joybrush: { tone: 'light', style: { anchorScale: 0.48, textWidth: 0.62 }, editorial: { textWidth: 0.6 } },
  'deep-cosmos': { tone: 'dark', style: {}, editorial: {} },
  woven: { tone: 'light', style: {}, editorial: {} },
  paper: { tone: 'light', style: {}, editorial: {} },
  'mineral-wash': { tone: 'light', style: {}, editorial: {} },
  // Hard geometric notches narrow the clean column: keep to its centre.
  graphic: { tone: 'light', style: { anchorScale: 0.46, textWidth: 0.52 }, editorial: { textWidth: 0.5 } },
  // Felt blobs crowd the right edge and the lower left.
  plush: { tone: 'light', style: { anchorX: 0.47, textX: 0.47, anchorY: 0.31 }, editorial: { anchorX: 0.47, textX: 0.47, textWidth: 0.56 } },
  herbarium: { tone: 'light', style: { textWidth: 0.64 }, editorial: { textWidth: 0.62 } },
  // Ribbons sweep in from the right and bottom.
  alloy: { tone: 'light', style: { anchorX: 0.47, textX: 0.47 }, editorial: { anchorX: 0.47, textX: 0.47 } },
  // A dark diamond: narrow at the top and bottom, wide through the middle.
  gilt: { tone: 'dark', style: { anchorScale: 0.46, anchorY: 0.34, textWidth: 0.6 }, editorial: { anchorScale: 0.22, textWidth: 0.6 } },
  flash: { tone: 'light', style: { textWidth: 0.62 }, editorial: { textWidth: 0.6 } },
  buff: { tone: 'light', style: { anchorX: 0.52, textX: 0.52, textWidth: 0.64 }, editorial: { anchorX: 0.52, textX: 0.52, textWidth: 0.62 } },
};

/** Neutral premium ground for an Anchor with no recorded style or a style without a share asset. */
const FALLBACK: Direction = { tone: 'dark', style: {}, editorial: {} };
const FALLBACK_SAMPLE = { paper: '#1f2037', base: '#14162b' };

/**
 * Resolves whatever style marker an Anchor carries (`v2StyleChoice`,
 * `enhancementMetadata.styleApplied`, legacy names) to a canonical style id.
 */
export function resolveShareStyleId(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate) continue;
    const style = getStyleById(candidate);
    if (style) return style.id;
  }
  return null;
}

/** The one place Style and Editorial both ask for their background. */
export function getShareEnvironment(styleId: string | null | undefined, variant = 0): ShareEnvironment {
  const sources = styleId ? STYLE_SHARE_BACKGROUNDS[styleId] : undefined;
  const source = sources?.length ? sources[variant % sources.length] : null;
  const direction = (source && styleId && DIRECTION[styleId]) || FALLBACK;
  const key = source && styleId ? styleId : null;
  const sample = (key && SAMPLES[key]) || FALLBACK_SAMPLE;
  const ink = { ...(direction.tone === 'dark' ? LIGHT_INK : WARM_INK), ...(key ? INK[key] : null) };
  return { id: key, source, ...direction, ...sample, ink };
}

export function resolveComposition(env: ShareEnvironment, kind: 'style' | 'editorial'): ShareComposition {
  return { ...(kind === 'style' ? STYLE_COMPOSITION : EDITORIAL_COMPOSITION), ...env[kind] };
}
