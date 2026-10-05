import { segmentGeometry } from '../segmentedGeometry';

describe('segmentGeometry', () => {
  it('places the pill on the selected segment', () => {
    expect(segmentGeometry(300, 3, 1, 3)).toEqual({ segmentWidth: 98, offset: 101 });
  });

  it('is finite and non-negative before the first layout', () => {
    expect(segmentGeometry(0, 3, 1, 3)).toEqual({ segmentWidth: 0, offset: 3 });
  });

  it('fills the whole control with a single option', () => {
    expect(segmentGeometry(300, 1, 0, 3)).toEqual({ segmentWidth: 294, offset: 3 });
  });

  it('clamps a selection outside the options', () => {
    expect(segmentGeometry(300, 3, -1, 3).offset).toBe(3);
    expect(segmentGeometry(300, 3, 9, 3).offset).toBe(199);
  });

  it('handles no options at all', () => {
    expect(segmentGeometry(300, 0, 0, 3)).toEqual({ segmentWidth: 0, offset: 3 });
  });

  it('never returns NaN for non-finite input', () => {
    const geometry = segmentGeometry(Number.NaN, 3, Number.NaN, 3);
    expect(Number.isFinite(geometry.segmentWidth)).toBe(true);
    expect(Number.isFinite(geometry.offset)).toBe(true);
  });
});
