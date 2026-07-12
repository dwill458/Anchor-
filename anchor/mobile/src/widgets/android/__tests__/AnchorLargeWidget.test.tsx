jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  OverlapWidget: 'OverlapWidget',
  SvgWidget: 'SvgWidget',
  TextWidget: 'TextWidget',
}));

import { buildHeatmapSvg } from '../AnchorLargeWidget';

describe('buildHeatmapSvg', () => {
  it('renders a larger grid with month labels aligned to week columns', () => {
    const svg = buildHeatmapSvg([], '2026-07-31', false);

    expect(svg).toContain('>Mar</text>');
    expect(svg).toContain('>Apr</text>');
    expect(svg).toContain('>May</text>');
    expect(svg).toContain('>Jun</text>');
    expect(svg).toContain('>Jul</text>');
    expect(svg).toContain('viewBox="-3 -3 379 165"');
    expect(svg).toContain('x="0" y="17" width="16" height="16"');
  });
});
