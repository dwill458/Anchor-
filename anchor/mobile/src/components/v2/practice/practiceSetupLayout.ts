import { clamp, type V2Viewport } from '@/theme/v2/responsive';

/** Focus setup artwork at its approved design size, and the tightest it may get. */
const FOCUS_ARTWORK: readonly [number, number] = [148, 186];
/** Deep Prime / Visualize setup carry a larger hero. */
const HERO_ARTWORK: readonly [number, number] = [188, 266];
/** Artwork never takes more than this share of the content width. */
const MAX_ARTWORK_WIDTH_SHARE = 0.62;
/** Total side padding of the setup body at the 393pt reference (24 screen + 16 body). */
const REFERENCE_SIDE_PADDING = 40;
const REFERENCE_WIDTH = 393;
const MIN_SIDE_PADDING = 24;
/** Duration chips keep a comfortable target on every phone. */
export const SETUP_CONTROL_MIN_HEIGHT = 48;

export type PracticeSetupVariant = 'focus' | 'hero';

/**
 * Vertical and horizontal rhythm for the Practice setup screens.
 *
 * Every value is `vertical(tightest, approved)`: the approved design value on a
 * tall phone, easing down to a floor on a short one. Control heights and type
 * are deliberately NOT here: they are held constant, and the body scrolls when
 * it still does not fit.
 */
export function resolvePracticeSetupMetrics(viewport: V2Viewport, variant: PracticeSetupVariant = 'focus') {
  const [minArtwork, maxArtwork] = variant === 'focus' ? FOCUS_ARTWORK : HERO_ARTWORK;
  const artworkSize = Math.round(Math.min(viewport.vertical(minArtwork, maxArtwork), viewport.contentWidth * MAX_ARTWORK_WIDTH_SHARE));
  return {
    artworkSize,
    /** The organic halo is 218/186 of the Anchor, as approved. */
    haloSize: Math.round(artworkSize * (218 / 186)),
    artworkFrameSize: artworkSize + 8,
    artworkGap: viewport.vertical(4, 12),
    heroTop: viewport.vertical(4, 8),
    sectionGap: viewport.vertical(14, 20),
    controlGap: viewport.vertical(12, 16),
    bodyGap: variant === 'focus' ? viewport.vertical(14, 20) : viewport.vertical(16, 24),
    sidePadding: Math.round(clamp(MIN_SIDE_PADDING, viewport.width * (REFERENCE_SIDE_PADDING / REFERENCE_WIDTH), REFERENCE_SIDE_PADDING)),
    // The screen's SafeAreaView already pads the bottom inset. This is only breathing room
    // above it, so it must not add `insets.bottom` a second time.
    footerPaddingBottom: viewport.vertical(12, 24),
  };
}

export type PracticeSetupMetrics = ReturnType<typeof resolvePracticeSetupMetrics>;
