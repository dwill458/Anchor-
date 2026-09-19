import { buildSplicePath, V2_HOME_SPLICE_HEIGHT, V2_HOME_SPLICE_KEEL_RATIO } from '../V2HomeCreamSplice';

/** Pulls every "x y" coordinate pair out of a path string. */
function points(path: string): Array<{ x: number; y: number }> {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe('V2HomeCreamSplice geometry', () => {
  it('keeps a constant height regardless of device width', () => {
    expect(V2_HOME_SPLICE_HEIGHT).toBe(72);
    for (const width of [360, 393, 412, 430]) {
      const deepest = Math.max(...points(buildSplicePath(width)).map((point) => point.y));
      expect(deepest).toBeCloseTo(V2_HOME_SPLICE_HEIGHT * 0.9722, 1);
    }
  });

  it('lands the single keel point on the exact centre axis at every width', () => {
    for (const width of [320, 360, 393, 412, 430, 480]) {
      const path = buildSplicePath(width);
      const deepest = points(path).reduce((lowest, point) => (point.y > lowest.y ? point : lowest));
      expect(deepest.x).toBeCloseTo(width * V2_HOME_SPLICE_KEEL_RATIO, 1);
    }
  });

  it('reaches the keel at exactly one point — it narrows to a point, not a flat', () => {
    const path = buildSplicePath(393);
    const all = points(path);
    const deepestY = Math.max(...all.map((point) => point.y));
    expect(all.filter((point) => point.y === deepestY)).toHaveLength(1);
  });

  it('is symmetrical about the centre axis', () => {
    const width = 412;
    const path = buildSplicePath(width);
    const all = points(path).filter((point) => point.y > 0);
    const left = all.filter((point) => point.x < width / 2).map((point) => point.y);
    const right = all
      .filter((point) => point.x > width / 2)
      .map((point) => point.y)
      .reverse();
    expect(left).toEqual(right);
  });

  it('scales the geometry with the real width instead of stretching a fixed 393pt path', () => {
    const narrow = points(buildSplicePath(360));
    const wide = points(buildSplicePath(430));
    // Same proportional shape, different absolute coordinates.
    expect(narrow).not.toEqual(wide);
    const narrowShoulder = narrow.find((point) => point.y === Number((V2_HOME_SPLICE_HEIGHT * 0.5).toFixed(2)));
    const wideShoulder = wide.find((point) => point.y === Number((V2_HOME_SPLICE_HEIGHT * 0.5).toFixed(2)));
    expect(narrowShoulder!.x / 360).toBeCloseTo(wideShoulder!.x / 430, 3);
  });
});
