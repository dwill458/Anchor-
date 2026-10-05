import { revealFrame, staggerDelay } from '../entrance';

describe('staggerDelay', () => {
  it('starts at the base', () => {
    expect(staggerDelay(0)).toBe(0);
  });

  it('steps by 60ms per order', () => {
    expect(staggerDelay(3)).toBe(180);
    expect(staggerDelay(2, 100)).toBe(220);
  });

  it('never exceeds the cap, however many siblings there are', () => {
    expect(staggerDelay(40)).toBe(360);
    expect(staggerDelay(40, 100)).toBe(460);
  });

  it('treats negative and non-finite orders as 0', () => {
    expect(staggerDelay(-2)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
  });
});

describe('revealFrame', () => {
  it('starts transparent and displaced', () => {
    expect(revealFrame(0, 14, false)).toEqual({ opacity: 0, translateY: 14 });
  });

  it('interpolates the rise', () => {
    expect(revealFrame(0.5, 14, false).translateY).toBe(7);
  });

  it('ends at rest', () => {
    expect(revealFrame(1, 14, false)).toEqual({ opacity: 1, translateY: 0 });
  });

  it('never travels under reduced motion', () => {
    expect(revealFrame(0, 14, true)).toEqual({ opacity: 0, translateY: 0 });
    expect(revealFrame(0.5, 14, true).translateY).toBe(0);
  });
});
