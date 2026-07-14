jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  OverlapWidget: 'OverlapWidget',
  SvgWidget: 'SvgWidget',
  TextWidget: 'TextWidget',
}));

import { buildHeatmapSvg } from '../AnchorLargeWidget';

describe('buildHeatmapSvg', () => {
  it('renders the full-width grid with month labels aligned to week columns', () => {
    const svg = buildHeatmapSvg([], '2026-07-31', false);

    expect(svg).toContain('>Mar</text>');
    expect(svg).toContain('>Apr</text>');
    expect(svg).toContain('>May</text>');
    expect(svg).toContain('>Jun</text>');
    expect(svg).toContain('>Jul</text>');
    expect(svg).toContain('viewBox="-3 -3 380 162"');
    expect(svg).toContain('x="0" y="13" width="17" height="17"');
  });
});
