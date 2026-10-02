import { colors } from '@/theme/colors';
import type { DrawnPoint } from '@/utils/sigil/drawnGeometry';
import type { DrawnHero, IntentLayout, MapLayout, Pt } from '../geometry';
import type { CreationTimeline } from '../useCreationTimeline';

export interface Palette {
  /** Foreground ink for this pass: ink on cream, cream on ink. */
  fg: string;
}

export const CREAM_PALETTE: Palette = { fg: colors.creation.ink };
export const INK_PALETTE: Palette = { fg: colors.creation.cream };

/** The anchor's shape at hero size, as one or more pen strokes (offsets from HERO). */
export interface HeroShape {
  strokes: Pt[][];
  vertices: Pt[];
}

export interface SceneContext {
  layout: IntentLayout;
  /** Null on the draw path — there is no grid and there are no letters. */
  map: MapLayout | null;
  hero: HeroShape;
  drawn: DrawnHero | null;
  timeline: CreationTimeline;
  letterCount: number;
  isDrawn: boolean;
  reduceMotion: boolean;
  /** 'glide' animates glyphs from the Intention field; 'fade' fades centred text in. */
  entry: 'glide' | 'fade';
}

/** Live, per-frame draw state for the draw pad. */
export interface DrawPadState {
  strokes: DrawnPoint[][];
  current: DrawnPoint[] | null;
  /** 0..1, how far the pad has risen in. */
  riseU: number;
}

/** Stroke width of the raw polyline while it is being formed (design px). */
export const RAW_STROKE_WIDTH = 2.2;
/** The width the line settles to while the style is applied (D5: weight only, no geometry morph). */
export const FORM_FINAL_STROKE_WIDTH = 2.8;
