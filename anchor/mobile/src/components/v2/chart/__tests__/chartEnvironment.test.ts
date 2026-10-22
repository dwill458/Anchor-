import { DESIRE_CHART_ENVIRONMENT, chartEnvironmentFor, decodedTextureBytes } from '../chartEnvironment';

describe('Chart environment manifest', () => {
  it('uses the complete Desire master with no unapproved alpha layers', () => {
    expect(chartEnvironmentFor('Desire')).toBe(DESIRE_CHART_ENVIRONMENT);
    expect(DESIRE_CHART_ENVIRONMENT.master).toMatchObject({ width: 720, height: 1280, routeKind: 'cinematic' });
    expect(DESIRE_CHART_ENVIRONMENT.layers).toEqual([]);
    expect(DESIRE_CHART_ENVIRONMENT.camera).toEqual({
      focalPoint: { x: 0.54, y: 0.42 },
      preferredZoom: 1.4,
      maximumZoom: 1.5,
    });
  });

  it('does not pretend legacy art has calibrated cinematic layers', () => {
    expect(chartEnvironmentFor('career')).toBeNull();
  });

  it('estimates decoded RGBA texture memory rather than compressed size', () => {
    expect(decodedTextureBytes(720, 1280)).toBe(3_686_400);
    expect(decodedTextureBytes(1440, 2560)).toBe(14_745_600);
    expect(decodedTextureBytes(1800, 3200)).toBe(23_040_000);
  });
});
