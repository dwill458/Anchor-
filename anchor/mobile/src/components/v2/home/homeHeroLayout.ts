import { resolveV2Viewport, clamp } from '@/theme/v2/responsive';

type HeroLayoutInput = {
  platform: string;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  /** Unused: the track height no longer depends on which Anchors are in view. Kept so callers need not change. */
  selectedIndex?: number;
  /** Unused, as above. */
  intentions?: string[];
};

/**
 * The intention always owns exactly this many lines of the track, whatever it says. The track was
 * once sized from how many lines the visible intentions wrapped to, which moved the cream/graphite
 * divider (and Today with it) by a full line every time a swipe landed on a longer intention.
 * Longer text shrinks to fit (down to HERO_INTENTION_MIN_FONT_SCALE) and then truncates; the full
 * text is on the Anchor's details.
 */
export const HERO_INTENTION_LINES = 2;
export const HERO_INTENTION_MIN_FONT_SCALE = 0.72;
export const HERO_INTENTION_LINE_HEIGHT = 33;
/** Past this many characters the label steps down a size, so a long intention keeps its two lines. */
export const HERO_INTENTION_LONG_AFTER = 25;

/**
 * The label's font size by length. The block it sits in is a fixed height (see HERO_INTENTION_LINES),
 * so the size never moves the disc above or the practice sheet below; auto-fit stays as the net.
 */
export function heroIntentionFontSize(text: string): number {
  return text.length > HERO_INTENTION_LONG_AFTER ? 20 : 23;
}
/** Usable height below which the hero starts giving space back. Every tuned device sits above it. */
const SHORT_HEIGHT_THRESHOLD = 700;
const SHORT_HEIGHT_SPAN = 100;
/** Most an Anchor shrinks on the shortest supported height. */
const MAX_SHORT_ANCHOR_REDUCTION = 22;
const MAX_SHORT_TRACK_REDUCTION = 12;
/**
 * The Anchor never takes more than this share of the width, so neighbours keep their peek and the
 * coin never crowds the screen edges. It was 0.48 before the presence pass.
 */
const MAX_ANCHOR_WIDTH_SHARE = 0.56;
/**
 * ...nor more than this share of the usable height, so a short screen gives the coin back before it
 * squeezes the text rows around it. The tuned tiers below only ever apply on tall phones.
 */
const MAX_ANCHOR_HEIGHT_SHARE = 0.265;
/**
 * Room the artwork box keeps around the paper mount (14dp of mount padding is already inside it).
 * It holds the status ring (8dp out, ~2dp thick) and its start mark with clear air between the ring
 * and the "DESIRE · 4 OF 56" row above, which the ring used to touch.
 */
const BOX_SLACK = 52;
const CONSTRUCTION_SLACK = 30;
/** Everything in the track that is not the coin box or the intention: context row, Consistency line, gaps. */
const TRACK_CHROME = 87;

/**
 * Keep the visible carousel window compact without reserving space for all Anchors.
 *
 * The three tuned tiers below (roomy Android, compact, standard) were raised
 * ~12% on 2026-09-21 and a further ~20% in the presence pass, so the user's
 * Anchor is the dominant object on the screen.
 * Small phones are handled by *adding* two continuous reductions on top of
 * them — a usable-height give-back and a width cap — so nothing that already
 * fits is disturbed.
 */
export function resolveHomeHeroLayout({ platform, width, height, topInset, bottomInset }: HeroLayoutInput) {
  const viewport = resolveV2Viewport({ width, height, topInset, bottomInset });
  const compact = viewport.usableHeight < 790;
  // The S24 Ultra can report only 384 dp of width at its default display
  // density. Its physical screen still has room for the full-size Anchor.
  const roomyAndroid = platform === 'android' && width >= 375;

  const shortfall = clamp(0, (SHORT_HEIGHT_THRESHOLD - viewport.usableHeight) / SHORT_HEIGHT_SPAN, 1);
  // ~20% above the previous tiers (184 / 152 / 172): the Anchor is the product, so it carries the screen.
  const tunedAnchor = roomyAndroid ? 224 : compact ? 188 : 208;
  const tunedBox = tunedAnchor + BOX_SLACK;
  const tunedConstruction = tunedAnchor + CONSTRUCTION_SLACK;
  const tunedTrack = tunedBox + TRACK_CHROME + HERO_INTENTION_LINES * HERO_INTENTION_LINE_HEIGHT;

  const anchorSize = Math.round(Math.min(
    tunedAnchor - shortfall * MAX_SHORT_ANCHOR_REDUCTION,
    width * MAX_ANCHOR_WIDTH_SHARE,
    viewport.usableHeight * MAX_ANCHOR_HEIGHT_SHARE,
  ));
  const anchorDelta = tunedAnchor - anchorSize;

  return {
    anchorSize,
    artworkBoxHeight: tunedBox - anchorDelta,
    constructionSize: tunedConstruction - anchorDelta,
    trackHeight: Math.round(tunedTrack - anchorDelta - shortfall * MAX_SHORT_TRACK_REDUCTION),
    gutter: viewport.gutter,
  };
}
