import {
  buildFogField,
  buildFogFieldBruteForce,
  buildFogFieldGrid,
  buildRouteTable,
  decodeBase64,
  decodeFogFieldData,
  fogRouteHash,
  precomputeFogFieldAsync,
} from '../chartMapGeometry';
import { FOG_FIELD_DATA } from '../chartFogFieldData';

describe('generated fog field data', () => {
  const table = buildRouteTable();
  const brute = buildFogFieldBruteForce(table);

  it('version hash matches the current route constants (a route edit forces regeneration)', () => {
    expect(FOG_FIELD_DATA.hash).toBe(fogRouteHash());
  });

  it('decoded data equals the runtime brute force within the quantisation, for all cells', () => {
    const field = decodeFogFieldData();
    expect(field).not.toBeNull();
    let maxDist = 0;
    let maxArc = 0;
    let maxNoise = 0;
    for (let i = 0; i < brute.dist.length; i++) {
      maxDist = Math.max(maxDist, Math.abs(field!.dist[i] - Math.min(brute.dist[i], 4095.9)));
      maxArc = Math.max(maxArc, Math.abs(field!.arc[i] - brute.arc[i]));
      maxNoise = Math.max(maxNoise, Math.abs(field!.noise[i] - brute.noise[i]));
    }
    expect(maxDist).toBeLessThanOrEqual(1 / 32 + 1e-6);
    expect(maxArc).toBeLessThanOrEqual(1 / 32 + 1e-6);
    expect(maxNoise).toBeLessThanOrEqual(1 / 510 + 1e-6);
  });

  it('buildFogField is memoised and returns the decoded data; decode is fast', () => {
    const t0 = performance.now();
    const field = buildFogField(table);
    const ms = performance.now() - t0;
    if (process.env.CHART_FOG_TIMING) {
      // eslint-disable-next-line no-console
      console.log(`fog decode: ${ms.toFixed(1)}ms`);
    }
    expect(buildFogField(table)).toBe(field);
    expect(field.cols).toBe(213);
    expect(field.dist).toHaveLength(213 * 295);
    expect(ms).toBeLessThan(50);
  });

  it('base64 decoder handles padding', () => {
    expect(Array.from(decodeBase64('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(decodeBase64('AQI='))).toEqual([1, 2]);
    expect(Array.from(decodeBase64('AQ=='))).toEqual([1]);
  });
});

describe('runtime grid fallback', () => {
  const table = buildRouteTable();

  it('matches brute force exactly on 2,000 random cells', () => {
    const grid = buildFogFieldGrid(table);
    const ref = buildFogFieldBruteForce(table);
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let n = 0; n < 2000; n++) {
      const i = Math.floor(rnd() * grid.dist.length);
      expect(grid.dist[i]).toBe(ref.dist[i]);
      expect(grid.arc[i]).toBe(ref.arc[i]);
    }
  });

  it('precomputeFogFieldAsync resolves on a later macrotask with the memoised field', async () => {
    await expect(precomputeFogFieldAsync(table)).resolves.toBe(buildFogField(table));
  });
});
