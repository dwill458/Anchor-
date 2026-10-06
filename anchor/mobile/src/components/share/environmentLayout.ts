import { detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import { contrastRatio, mixHex } from './colorMath';
import { layoutIntention, classifyIntention, type IntentionLayout } from './intentionTypography';
import { resolveComposition, type ShareEnvironment } from './shareEnvironments';
import { SHARE_ASPECT, type ShareExportData } from './shareTypes';

export type EnvironmentKind = 'style' | 'editorial';

export interface EnvironmentGeometry {
  kind: EnvironmentKind;
  /** Circle centre and diameter, px at the rendered width. */
  anchorCx: number;
  anchorCy: number;
  diameter: number;
  text: {
    left: number;
    top: number;
    width: number;
    align: 'left' | 'center' | 'right';
    layout: IntentionLayout;
    /** `layout` scaled from 1080-space to the rendered width. */
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    height: number;
  };
  meta: { top: number; parts: string[] };
  wash: { cx: number; cy: number; rx: number; ry: number };
}

export interface EnvironmentPalette {
  text: string;
  meta: string;
  wash: string;
  halo: string;
  /** Warm ink for the Editorial intention. */
  ink: string;
  inkOpacity: number;
  /** Colour of the worn-ink speckle: the paper itself, as it looks under the text wash. */
  paper: string;
  /** Pressed-in highlight under Editorial letters. */
  highlight: string;
  brand: {
    /** What the mark sits on: 'dark' gets the light mark, 'light' the dark one. */
    ground: 'dark' | 'light';
    /** The faint pool of colour behind the mark; the opposite of the mark. */
    wash: string;
  };
}

const BRAND_LIGHT = '#F4EDE0';
const BRAND_DARK = '#14162B';
const WASH_FOR_LIGHT_MARK = '#06070E';
const WASH_FOR_DARK_MARK = '#F7F1E5';

/**
 * The mark switches by the pixels actually behind it, not by the environment's
 * overall tone: each candidate is judged on the bottom-edge colour as it will
 * look once its own wash is down, and the one with more contrast wins.
 */
export function resolveBrandTreatment(base: string): EnvironmentPalette['brand'] {
  const light = contrastRatio(BRAND_LIGHT, mixHex(base, WASH_FOR_LIGHT_MARK, 0.6));
  const dark = contrastRatio(BRAND_DARK, mixHex(base, WASH_FOR_DARK_MARK, 0.6));
  return light >= dark ? { ground: 'dark', wash: WASH_FOR_LIGHT_MARK } : { ground: 'light', wash: WASH_FOR_DARK_MARK };
}

export function environmentPalette(env: Pick<ShareEnvironment, 'tone' | 'ink' | 'paper' | 'base'>): EnvironmentPalette {
  const dark = env.tone === 'dark';
  const wash = dark ? '#06070E' : '#F7F1E5';
  return {
    text: dark ? detailsPalette.cream : detailsPalette.ink,
    meta: dark ? 'rgba(244,237,224,.78)' : 'rgba(20,22,43,.72)',
    wash,
    halo: dark ? '#02030A' : '#2A2118',
    ink: env.ink.color,
    inkOpacity: env.ink.opacity,
    paper: mixHex(env.paper, wash, 0.4),
    highlight: dark ? '#000000' : '#FFF8EA',
    brand: resolveBrandTreatment(env.base),
  };
}

/**
 * Where everything sits for one composition. Style is anchor-first (large
 * circle, regular intention); Editorial is intention-first (small circle,
 * dominant type chosen by intention length). Both read the same environment.
 */
export function resolveEnvironmentGeometry(
  env: ShareEnvironment,
  kind: EnvironmentKind,
  data: Pick<ShareExportData, 'intention' | 'categoryLabel' | 'stateLabel'>,
  width: number,
): EnvironmentGeometry {
  const s = width / 1080;
  const height = width * SHARE_ASPECT;
  const comp = resolveComposition(env, kind);

  const diameter = comp.anchorScale * width;
  const anchorCx = comp.anchorX * width;
  const anchorCy = comp.anchorY * height;
  const anchorBottom = anchorCy + diameter / 2;

  const column = comp.textWidth * 1080;
  const preset = kind === 'style' ? 'style' : classifyIntention(data.intention);
  // Editorial sets short and medium intentions as quoted statements.
  const layout = layoutIntention(data.intention, preset, column, { quote: kind === 'editorial' && preset !== 'longform' });
  const blockHeight = layout.blockHeight * s;

  const gap = height * (kind === 'style' ? 0.05 : 0.06);
  const centred = comp.textY * height - blockHeight / 2;
  const top = Math.max(centred, anchorBottom + gap);

  const metaGap = height * 0.04;
  const metaTop = Math.min(top + blockHeight + metaGap, height * 0.86);
  const parts = kind === 'style' ? [data.categoryLabel] : [data.categoryLabel, data.stateLabel ?? ''];

  const colWidth = comp.textWidth * width;
  return {
    kind,
    anchorCx,
    anchorCy,
    diameter,
    text: {
      left: comp.textX * width - colWidth / 2,
      top,
      width: colWidth,
      align: comp.align,
      layout,
      fontSize: layout.fontSize * s,
      lineHeight: layout.lineHeight * s,
      letterSpacing: layout.letterSpacing * s,
      height: blockHeight,
    },
    meta: { top: metaTop, parts: parts.filter(Boolean) },
    wash: {
      cx: comp.textX * width,
      cy: top + (blockHeight + metaGap) / 2,
      rx: Math.max(colWidth * 0.75, width * 0.36),
      ry: blockHeight / 2 + height * 0.09,
    },
  };
}
