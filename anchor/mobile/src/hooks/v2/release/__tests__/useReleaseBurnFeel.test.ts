import { buildBurnHapticSchedule } from '../useReleaseBurnFeel';
import { RELEASE_CEREMONY_TIMELINE_MS } from '@/constants/v2/release';

describe('buildBurnHapticSchedule', () => {
  const ticks = buildBurnHapticSchedule();

  it('swells: ticks speed up and never get lighter', () => {
    const order = ['light', 'medium', 'heavy'];
    const gaps = ticks.slice(1).map((t, i) => t.at - ticks[i].at);
    gaps.slice(1).forEach((g, i) => expect(g).toBeLessThanOrEqual(gaps[i] + 1));
    const rank = ticks.map(t => String(t.style).toLowerCase());
    expect(new Set(rank).size).toBe(3);
    expect(order.length).toBe(3);
  });

  it('drops away entirely before the coin disappears', () => {
    expect(ticks.length).toBeGreaterThan(6);
    expect(ticks[ticks.length - 1].at).toBeLessThan(RELEASE_CEREMONY_TIMELINE_MS.emptyPause);
  });
});
