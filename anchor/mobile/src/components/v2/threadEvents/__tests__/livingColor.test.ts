import { livingColorForEvent } from '../livingColor';

describe('Living Color mapping', () => {
  it('maps canonical significance to controlled semantic intensity', () => {
    expect(livingColorForEvent('LOW').intensity).toBe(0);
    expect(livingColorForEvent('MEDIUM').intensity).toBe(1);
    expect(livingColorForEvent('HIGH').intensity).toBe(2);
    expect(livingColorForEvent('MAJOR').intensity).toBe(3);
  });

  it('uses no brush assets and reduces static intensity for reduced motion', () => {
    const reduced = livingColorForEvent('MAJOR', true);
    expect(reduced.motionMs).toBe(0);
    expect(reduced.bloomOpacity).toBeLessThan(livingColorForEvent('MAJOR').bloomOpacity);
  });
});
