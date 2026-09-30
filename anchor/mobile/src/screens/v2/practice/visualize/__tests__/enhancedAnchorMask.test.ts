import { enhancedInkAlpha } from '../enhancedAnchorMask';

describe('enhanced Anchor photo mask', () => {
  it('maps paper, gray linework, and ink continuously by inverse luminance', () => {
    const paper = enhancedInkAlpha(0.97, 0.96, 0.92);
    const gray = enhancedInkAlpha(0.55, 0.53, 0.49);
    const ink = enhancedInkAlpha(0.04, 0.04, 0.04);
    expect(paper).toBeGreaterThan(0);
    expect(paper).toBeLessThan(gray);
    expect(gray).toBeLessThan(ink);
    expect(ink).toBeLessThan(1);
  });
});
