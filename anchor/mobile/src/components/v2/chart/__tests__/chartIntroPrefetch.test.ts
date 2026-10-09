import { CHART_INTRO_TIMING } from '../chartMotion';
import { MAP_H, MAP_W } from '../map/chartMapContracts';
import { buildRouteTable } from '../map/chartMapGeometry';
import { chartIntroCoverHeld, chartIntroMapHeight, prefetchChartIntro } from '../chartIntroPrefetch';
import { getChartIntroSeen } from '../chartIntroSeen';
import { prepareChartMapIntroArt } from '../map/ChartMapLand';

jest.mock('../map/ChartMapLand', () => ({
  prepareChartMapIntroArt: jest.fn(async () => true),
  warmChartMapResources: jest.fn(),
}));
jest.mock('../chartIntroSeen', () => ({
  getChartIntroSeen: jest.fn(async () => true),
}));

const prepare = prepareChartMapIntroArt as unknown as jest.Mock;
const seen = getChartIntroSeen as unknown as jest.Mock;

describe('chart intro prefetch', () => {
  beforeEach(() => {
    prepare.mockClear();
    seen.mockClear();
  });

  it('decodes the intro art and primes the seen flag with the same table and height the flow computes', async () => {
    const width = 390;
    await prefetchChartIntro(width);
    expect(prepare).toHaveBeenCalledTimes(1);
    const [table, requestedWidth, requestedHeight] = prepare.mock.calls[0];
    expect(table).toBe(buildRouteTable());
    expect(requestedWidth).toBe(width);
    expect(requestedHeight).toBeCloseTo(width * MAP_H / MAP_W, 6);
    expect(requestedHeight).toBe(chartIntroMapHeight(width));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('resolves to the decode result and never throws when the seen flag cannot be read', async () => {
    seen.mockRejectedValueOnce(new Error('storage down'));
    await expect(prefetchChartIntro(390)).resolves.toBe(true);
  });

  it('resolves to false when the art fails to decode, so the intro takes the reduced path', async () => {
    prepare.mockResolvedValueOnce(false);
    await expect(prefetchChartIntro(390)).resolves.toBe(false);
  });
});

describe('chart intro cover cap', () => {
  it('caps the cold preparation cover at 250ms', () => {
    expect(CHART_INTRO_TIMING.coverMax).toBe(250);
  });

  it('holds the cover only while not ready and inside the cap', () => {
    expect(chartIntroCoverHeld(0, false)).toBe(true);
    expect(chartIntroCoverHeld(249, false)).toBe(true);
    expect(chartIntroCoverHeld(250, false)).toBe(false);
    expect(chartIntroCoverHeld(10, true)).toBe(false);
  });
});
