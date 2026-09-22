import { resolveV2Viewport, clamp } from '@/theme/v2/responsive';
import { carouselWindow } from './V2HomeAnchorCarousel';

type HeroLayoutInput = {
  platform: string;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  selectedIndex: number;
  intentions: string[];
};

/** The intention is capped here; a longer one truncates rather than pushing Today off the fold. */
export const HERO_INTENTION_MAX_LINES = 3;
const INTENTION_LINE_HEIGHT = 27;
/** Usable height below which the hero starts giving space back. Every tuned device sits above it. */
const SHORT_HEIGHT_THRESHOLD = 700;
const SHORT_HEIGHT_SPAN = 100;
/** Most an Anchor shrinks on the shortest supported height. */
const MAX_SHORT_ANCHOR_REDUCTION = 12;
const MAX_SHORT_TRACK_REDUCTION = 12;
/** The Anchor never takes more than this share of the width, so neighbours keep their peek. */
const MAX_ANCHOR_WIDTH_SHARE = 0.48;

function wrappedLines(text: string, charsPerLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.trim().split(/\s+/)) {
    const length = word.length;
    if (used && used + 1 + length > charsPerLine) {
      lines += 1;
      used = length;
    } else {
      used += (used ? 1 : 0) + length;
    }
  }
  return lines;
}

/**
 * Keep the visible carousel window compact without reserving space for all Anchors.
 *
 * The three tuned tiers below (roomy Android, compact, standard) were raised
 * ~12% on 2026-09-21 so the user's Anchor carries more of the screen than the
 * Today block beneath it. Small phones are handled by
 * *adding* two continuous reductions on top of them — a usable-height give-back
 * and a width cap — so nothing that already fits is disturbed.
 */
export function resolveHomeHeroLayout({ platform, width, height, topInset, bottomInset, selectedIndex, intentions }: HeroLayoutInput) {
  const viewport = resolveV2Viewport({ width, height, topInset, bottomInset });
  const compact = viewport.usableHeight < 790;
  // The S24 Ultra can report only 384 dp of width at its default display
  // density. Its physical screen still has room for the full-size Anchor.
  const roomyAndroid = platform === 'android' && width >= 375;
  const charsPerLine = Math.max(18, Math.floor((width - viewport.gutter * 2) / 11));
  const visible = carouselWindow(intentions.length, Math.max(0, selectedIndex));
  const lines = Math.min(
    HERO_INTENTION_MAX_LINES,
    Math.max(1, ...visible.map((index) => index < 0 ? 1 : wrappedLines(intentions[index] ?? '', charsPerLine))),
  );

  const shortfall = clamp(0, (SHORT_HEIGHT_THRESHOLD - viewport.usableHeight) / SHORT_HEIGHT_SPAN, 1);
  const tunedAnchor = roomyAndroid ? 184 : compact ? 152 : 172;
  const tunedBox = roomyAndroid ? 214 : compact ? 176 : 208;
  const tunedConstruction = roomyAndroid ? 214 : compact ? 184 : 208;
  const tunedTrack = roomyAndroid ? 328 : compact ? 290 : 326;

  const anchorSize = Math.round(Math.min(tunedAnchor - shortfall * MAX_SHORT_ANCHOR_REDUCTION, width * MAX_ANCHOR_WIDTH_SHARE));
  const anchorDelta = tunedAnchor - anchorSize;

  return {
    anchorSize,
    artworkBoxHeight: tunedBox - anchorDelta,
    constructionSize: tunedConstruction - anchorDelta,
    trackHeight: Math.round(tunedTrack - anchorDelta - shortfall * MAX_SHORT_TRACK_REDUCTION) + (lines - 1) * INTENTION_LINE_HEIGHT,
    gutter: viewport.gutter,
  };
}
