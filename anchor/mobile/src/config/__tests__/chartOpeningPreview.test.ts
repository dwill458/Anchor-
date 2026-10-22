import { isChartOpeningPreviewEnabled } from '../chartOpeningPreview';

describe('Chart opening preview access', () => {
  it('allows an explicitly enabled internal V2 preview', () => {
    expect(isChartOpeningPreviewEnabled('staging', 'true')).toBe(true);
    expect(isChartOpeningPreviewEnabled('preview', 'true')).toBe(true);
  });

  it('keeps production and incomplete preview configurations closed', () => {
    expect(isChartOpeningPreviewEnabled('production', 'true')).toBe(false);
    expect(isChartOpeningPreviewEnabled(undefined, 'true')).toBe(false);
    expect(isChartOpeningPreviewEnabled('staging', undefined)).toBe(false);
    expect(isChartOpeningPreviewEnabled('preview', 'false')).toBe(false);
  });
});
