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

  it('dims from the resting opacity of the control under reduced motion, so a disabled control stays dimmed', () => {
    expect(pressFrame(0, 0.98, true, 0.5).opacity).toBe(0.5);
    expect(pressFrame(1, 0.98, true, 0.5).opacity).toBeCloseTo(0.425, 5);
  });

  it('keeps full opacity as the resting default', () => {
    expect(pressFrame(0, 0.98, true).opacity).toBe(1);
  });
});
