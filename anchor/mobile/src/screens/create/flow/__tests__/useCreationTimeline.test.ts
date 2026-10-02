import { buildCreationTimeline } from '../useCreationTimeline';

describe('buildCreationTimeline', () => {
  it('first anchor: raw geometry lands at about 10.3 s for 7 letters', () => {
    const t = buildCreationTimeline({ mode: 'first', n: 7, drawn: false });

    expect(t.handoff).toBe(1.3);
    expect(t.distill).toBe(3);
    expect(t.map).toBe(4); // 0.5 + 0.42*7 = 3.44, clamped up to 4
    expect(t.forget).toBe(2);
    expect(t.rawGeometryAt).toBeCloseTo(10.3, 5);
    expect(t.stillness).toBe(0.45);
    expect(t.styleAt).toBeCloseTo(10.75, 5);
    expect(t.styleCountdown).toBe(4);
    expect(t.sweep).toBe(1.1);
  });

  it('repeat anchor: raw geometry lands at about 6.3 s and Style opens at ~6.65 s for 7 letters', () => {
    const t = buildCreationTimeline({ mode: 'repeat', n: 7, drawn: false });

    expect(t.handoff).toBe(0.6);
    expect(t.distill).toBe(1.9);
    expect(t.map).toBe(2.5); // 0.3 + 0.26*7 = 2.12, clamped up to 2.5
    expect(t.forget).toBe(1.3);
    expect(t.rawGeometryAt).toBeCloseTo(6.3, 5);
    expect(t.stillness).toBe(0.35);
    expect(t.styleAt).toBeCloseTo(6.65, 5);
    expect(t.styleCountdown).toBe(3);
    expect(t.sweep).toBe(1);
  });

  it('repeat anchor: a 7-letter run reaches Style in 6.5-7 s', () => {
    const t = buildCreationTimeline({ mode: 'repeat', n: 7, drawn: false });
    expect(t.styleAt).toBeGreaterThanOrEqual(6.5);
    expect(t.styleAt).toBeLessThanOrEqual(7);
  });

  it('clamps the map duration to 4..6 s (first) and 2.5..3.6 s (repeat)', () => {
    expect(buildCreationTimeline({ mode: 'first', n: 2, drawn: false }).map).toBe(4);
    expect(buildCreationTimeline({ mode: 'first', n: 10, drawn: false }).map).toBeCloseTo(4.7, 5);
    expect(buildCreationTimeline({ mode: 'first', n: 40, drawn: false }).map).toBe(6);
    expect(buildCreationTimeline({ mode: 'repeat', n: 40, drawn: false }).map).toBe(3.6);
    expect(buildCreationTimeline({ mode: 'repeat', n: 2, drawn: false }).map).toBe(2.5);
  });

  it('draw path: distill and map are zero, forget-settle is 1.6 / 0.8 s', () => {
    const first = buildCreationTimeline({ mode: 'first', n: 7, drawn: true });
    const repeat = buildCreationTimeline({ mode: 'repeat', n: 7, drawn: true });

    expect(first.distill).toBe(0);
    expect(first.map).toBe(0);
    expect(first.forget).toBe(1.6);
    expect(first.rawGeometryAt).toBeCloseTo(1.3 + 1.6, 5);

    expect(repeat.distill).toBe(0);
    expect(repeat.map).toBe(0);
    expect(repeat.forget).toBe(0.8);
  });

  it('segments are contiguous', () => {
    const t = buildCreationTimeline({ mode: 'first', n: 7, drawn: false });
    expect(t.start.distill).toBe(t.handoff);
    expect(t.start.map).toBeCloseTo(t.start.distill + t.distill, 5);
    expect(t.start.forget).toBeCloseTo(t.start.map + t.map, 5);
    expect(t.start.stillness).toBeCloseTo(t.start.forget + t.forget, 5);
  });
});
