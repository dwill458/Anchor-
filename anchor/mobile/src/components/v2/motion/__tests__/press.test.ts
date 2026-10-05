import { pressFrame } from '../press';

describe('pressFrame', () => {
  it('is at rest when not pressed', () => {
    expect(pressFrame(0, 0.98, false)).toEqual({ scale: 1, opacity: 1 });
  });

  it('sinks to the target scale when fully pressed', () => {
    expect(pressFrame(1, 0.98, false).scale).toBeCloseTo(0.98, 5);
  });

  it('dims instead of scaling under reduced motion', () => {
    const frame = pressFrame(1, 0.98, true);
    expect(frame.scale).toBe(1);
    expect(frame.opacity).toBeCloseTo(0.85, 5);
  });
});
