import { tornEdgePath } from '../VisionTornEdge';
import { visionIntroArt } from '../visionIntroArt';

describe('Vision intro art', () => {
  it('chooses a photograph by Anchor category, with a fallback for unknown ones', () => {
    expect(visionIntroArt('health')).not.toBe(visionIntroArt('career'));
    expect(visionIntroArt('not-a-category')).toBe(visionIntroArt('custom'));
    expect(visionIntroArt(null)).toBeTruthy();
  });

  it('draws a deterministic torn edge that stays inside its box', () => {
    expect(tornEdgePath(7)).toBe(tornEdgePath(7));
    expect(tornEdgePath(7)).not.toBe(tornEdgePath(8));
    const ys = [...tornEdgePath(7).matchAll(/L[\d.]+,([\d.]+)/g)].map(match => Number(match[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys.slice(0, -1))).toBeLessThanOrEqual(90);
  });
});
