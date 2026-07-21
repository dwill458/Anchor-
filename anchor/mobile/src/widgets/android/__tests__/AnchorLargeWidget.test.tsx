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
    expect(svg).toContain('viewBox="-3 -3 309 135"');
    expect(svg).toContain('x="0" y="13" width="14" height="14"');
  });

  it('uses the most recent mode color for mixed-mode days while preserving total intensity', () => {
    const svg = buildHeatmapSvg(
      [{ date: '2026-07-30', level: 2, deep: true, mode: 'visualize' }],
      '2026-07-31',
      false
    );

    expect(svg).toContain('fill="#2C5F99"');
  });
});
