import { drawAsImage } from '@shopify/react-native-skia';
import {
  cachedCloudTiles, cloudClusters, cloudRng, cloudWisps, loadCloudTiles, resetCloudTilesCache,
} from '../chartCloudTiles';

const round = (n: number) => Math.round(n * 1000) / 1000;

beforeEach(() => {
  resetCloudTilesCache();
  (drawAsImage as jest.Mock).mockClear();
});

describe('cloud tile layout', () => {
  it('uses the prototype LCG (16807), so every device draws the same clouds', () => {
    const r = cloudRng(7);
    // s1 = 7 * 16807 = 117649; (s - 1) / 2147483646
    expect(r()).toBeCloseTo(117648 / 2147483646, 12);
    const a = cloudRng(19);
    const b = cloudRng(19);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('billows (512, seed 7, 7 clusters, r 46-96) are deterministic and pinned', () => {
    const clusters = cloudClusters(512, 7, 7, 46, 96);
    expect(clusters).toHaveLength(7);
    expect(cloudClusters(512, 7, 7, 46, 96)).toEqual(clusters);
    // Drawn back to front by y.
    for (let i = 1; i < clusters.length; i++) expect(clusters[i].cy).toBeGreaterThanOrEqual(clusters[i - 1].cy);
    clusters.forEach((cl) => {
      expect(cl.puffs.length).toBeGreaterThanOrEqual(5);
      expect(cl.puffs.length).toBeLessThanOrEqual(9);
      expect(cl.w).toBeGreaterThanOrEqual(96 * 2.2);
      expect(cl.w).toBeLessThanOrEqual(96 * 4.2);
      cl.puffs.forEach((p) => {
        expect(p.r).toBeGreaterThanOrEqual(46);
        expect(p.r).toBeLessThanOrEqual(96);
      });
    });
    expect(clusters.map((cl) => cl.puffs.map((p) => [round(p.x), round(p.y), round(p.r)]))).toMatchSnapshot();
  });

  it('puffs grow toward the cluster centre and lift, so each cluster reads as a rounded top', () => {
    const clusters = cloudClusters(384, 19, 8, 22, 50);
    clusters.forEach((cl) => {
      const centre = cl.puffs.reduce((best, p) => (Math.abs(p.x - cl.cx) < Math.abs(best.x - cl.cx) ? p : best));
      const edge = cl.puffs.reduce((best, p) => (Math.abs(p.x - cl.cx) > Math.abs(best.x - cl.cx) ? p : best));
      expect(centre.r).toBeGreaterThanOrEqual(edge.r * 0.7);
      cl.puffs.forEach((p) => expect(p.y).toBeLessThanOrEqual(cl.cy));
    });
  });

  it('wisps (26) are long and thin', () => {
    const wisps = cloudWisps(512, 31, 26);
    expect(wisps).toHaveLength(26);
    expect(cloudWisps(512, 31, 26)).toEqual(wisps);
    wisps.forEach((w) => {
      expect(w.rx).toBeGreaterThanOrEqual(50);
      expect(w.rx).toBeLessThanOrEqual(180);
      expect(w.ry).toBeGreaterThanOrEqual(6);
      expect(w.ry).toBeLessThanOrEqual(18);
      expect(w.a).toBeGreaterThanOrEqual(0.25);
      expect(w.a).toBeLessThanOrEqual(0.6);
    });
  });
});

describe('loadCloudTiles', () => {
  it('draws the three tiles once and caches them; concurrent callers share the build', async () => {
    expect(cachedCloudTiles()).toBeNull();
    const [a, b] = await Promise.all([loadCloudTiles(), loadCloudTiles()]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(drawAsImage).toHaveBeenCalledTimes(3);
    const sizes = (drawAsImage as jest.Mock).mock.calls.map((call) => call[1]);
    expect(sizes).toEqual([{ width: 512, height: 512 }, { width: 384, height: 384 }, { width: 512, height: 512 }]);
    expect(await loadCloudTiles()).toBe(a);
    expect(cachedCloudTiles()).toBe(a);
    expect(drawAsImage).toHaveBeenCalledTimes(3);
  });

  it('resolves null (never throws) when Skia cannot draw a tile, and retries next time', async () => {
    (drawAsImage as jest.Mock).mockResolvedValueOnce(null);
    expect(await loadCloudTiles()).toBeNull();
    expect(cachedCloudTiles()).toBeNull();
    expect(await loadCloudTiles()).not.toBeNull();
  });
});
