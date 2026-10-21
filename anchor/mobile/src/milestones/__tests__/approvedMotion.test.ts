import { approvedMotion, approvedMotionDuration, stepMatches, stepStart } from '../approvedMotion';
import { APPROVED_MILESTONE_ASSETS } from '../approvedAssets';

describe('approved reveal policy', () => {
  it('resolves Journey arrival timings from each approved emblem', () => {
    const first = approvedMotion('journey_first_waypoint', 'journey');
    const all = approvedMotion('journey_all_waypoints', 'journey');
    expect(first.steps.find(s => s.name === 'pennant')?.start).toBe(1000);
    expect(all.steps.find(s => s.name === 'pennant')?.start).toBe(2250);
    expect(all.steps.find(s => s.name === 'summit')?.op).toBe('pop');
  });
  it('preserves milestone-specific Vision focus and seam operations', () => {
    const focus = approvedMotion('vision_seen_clearly', 'vision');
    expect(focus.steps.find(s => s.name === 'focusPull')?.op).toBe('translateX');
    expect(stepMatches(focus.steps.find(s => s.name === 'engrave')!, 'vision__ghost-1', 'engraving')).toBe(false);
    expect(approvedMotion('vision_picture_complete', 'vision').steps.some(s => s.op === 'strokewidth')).toBe(true);
  });
  it('caps accumulation spread and honors numbered waypoint order', () => {
    expect(stepStart({ name: 'ticks', op: 'fade', start: 200, stagger: 12, maxSpread: 1300, ease: 'outCubic' }, 'tick-100', 99, 100)).toBe(1388);
    expect(stepStart({ name: 'route', op: 'draw', start: 500, stagger: 300, idIndex: 'seg-(\\d+)', ease: 'linear' }, 'seg-4', 0, 1)).toBe(1400);
  });
  it('allows all authored staggered children to finish before swapping to static artwork', () => {
    const asset = APPROVED_MILESTONE_ASSETS['vision.first'];
    const duration = approvedMotionDuration(asset);
    const plan = approvedMotion(asset.slug, 'vision');
    for (const step of plan.steps) {
      const layer = asset.manifest.layers.find(l => l.layer === step.layer);
      const children = layer?.children.filter(n => stepMatches(step, n.id ?? '', layer.layer)) ?? [];
      children.forEach((child, i) => expect(stepStart(step, child.id ?? '', i, children.length) + (step.dur ?? 0)).toBeLessThanOrEqual(duration));
    }
    expect(duration).toBeGreaterThanOrEqual(3000);
  });
});
