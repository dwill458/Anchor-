jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  SvgWidget: 'SvgWidget',
}));

import { buildSmallWidgetSvg } from '../AnchorSmallWidget';

describe('buildSmallWidgetSvg', () => {
  it('uses the saved SVG geometry inside a centered, safe artwork frame', () => {
    const svg = buildSmallWidgetSvg(
      false,
      '<svg viewBox="10 20 40 80"><path id="saved-artwork" stroke="currentColor" /></svg>'
    );

    expect(svg).toContain('id="saved-artwork"');
    expect(svg).toContain('stroke="#C0C0C0"');
    expect(svg).toContain('scale(1.2)');
    expect(svg).not.toContain('<svg x=');
  });

  it('uses the glyph fallback only when no valid saved SVG exists', () => {
    expect(buildSmallWidgetSvg(false, '<svg><path /></svg>')).toContain('<circle cx="60"');
  });
});
