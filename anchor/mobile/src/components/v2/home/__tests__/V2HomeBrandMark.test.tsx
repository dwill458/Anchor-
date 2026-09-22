import { resolveV2Viewport } from '@/theme/v2/responsive';
import { brandMarkSpacing, V2_HOME_BRAND_MARK_HEIGHT, V2_HOME_BRAND_MARK_WIDTH } from '../V2HomeBrandMark';
import { V2_HOME_SPLICE_HEIGHT, V2_HOME_SPLICE_TIP_RATIO } from '../V2HomeCreamSplice';
import { TODAY_ART_BLEED_TOP } from '../V2HomeTodaySection';

/** Smallest supported → large, iOS and Android, as [width, height, top inset, bottom inset]. */
const VIEWPORTS: Array<[string, number, number, number, number]> = [
  ['iPhone SE', 320, 568, 20, 0],
  ['iPhone 13 mini', 375, 812, 50, 34],
  ['iPhone 15', 393, 852, 59, 34],
  ['iPhone 15 Pro Max', 430, 932, 59, 34],
  ['small Android', 360, 640, 24, 16],
  ['Pixel 7', 412, 915, 32, 24],
  ['S24 Ultra', 384, 832, 32, 24],
];

const keelClearance = V2_HOME_SPLICE_HEIGHT * (1 - V2_HOME_SPLICE_TIP_RATIO);

describe('V2HomeBrandMark', () => {
  it('renders at brand-signature size, keeping the artwork ratio', () => {
    expect(V2_HOME_BRAND_MARK_HEIGHT).toBe(29);
    expect(V2_HOME_BRAND_MARK_WIDTH).toBe(22);
  });

  it.each(VIEWPORTS)('sits 12–20pt under the keel and clears the Today artwork on %s', (_name, width, height, top, bottom) => {
    const { vertical } = resolveV2Viewport({ width, height, topInset: top, bottomInset: bottom });
    const { marginTop, marginBottom } = brandMarkSpacing(vertical);
    const underKeel = keelClearance + marginTop;
    expect(underKeel).toBeGreaterThanOrEqual(12);
    expect(underKeel).toBeLessThanOrEqual(20);
    // Today's artwork rises TODAY_ART_BLEED_TOP above its container; it must never reach the mark.
    expect(marginBottom).toBeGreaterThan(TODAY_ART_BLEED_TOP);
    // More room below than above: the mark closes the cream world, not the Today section.
    expect(marginBottom).toBeGreaterThan(underKeel);
  });
});
