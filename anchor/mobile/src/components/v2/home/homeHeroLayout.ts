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

/** Keep the visible carousel window compact without reserving space for all Anchors. */
export function resolveHomeHeroLayout({ platform, width, height, topInset, bottomInset, selectedIndex, intentions }: HeroLayoutInput) {
  const compact = height - topInset - bottomInset < 790;
  // The S24 Ultra can report only 384 dp of width at its default display
  // density. Its physical screen still has room for the full-size Anchor.
  const roomyAndroid = platform === 'android' && width >= 375;
  const charsPerLine = Math.max(22, Math.floor((width - 40) / 11));
  const visible = carouselWindow(intentions.length, Math.max(0, selectedIndex));
  const lines = Math.max(1, ...visible.map((index) => index < 0 ? 1 : wrappedLines(intentions[index] ?? '', charsPerLine)));

  return {
    anchorSize: roomyAndroid ? 164 : compact ? 136 : 154,
    artworkBoxHeight: roomyAndroid ? 194 : compact ? 160 : 190,
    constructionSize: roomyAndroid ? 194 : compact ? 168 : 190,
    trackHeight: (roomyAndroid ? 308 : compact ? 274 : 308) + (lines - 1) * 27,
  };
}
