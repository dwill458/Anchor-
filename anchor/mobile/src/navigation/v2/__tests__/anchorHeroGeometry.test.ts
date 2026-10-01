import { predictSessionAnchorRect, resolveFocusSessionGeometry } from '../anchorHeroGeometry';

describe('Focus session geometry', () => {
  it.each([
    { width: 320, height: 568, topInset: 24, bottomInset: 24 },
    { width: 390, height: 844, topInset: 59, bottomInset: 34 },
    { width: 430, height: 932, topInset: 59, bottomInset: 34 },
  ])('keeps the Anchor responsive and separates it from the progress field at $width × $height', (viewport) => {
    const geometry = resolveFocusSessionGeometry(viewport);
    const progressDiameter = geometry.fieldSize * 0.92;
    const ringGap = (progressDiameter - geometry.anchorSize) / 2;
    const predicted = predictSessionAnchorRect({ ...viewport, mode: 'focus' });
    expect(predictSessionAnchorRect({ ...viewport, mode: 'deep_prime' })).toEqual(predicted);

    expect(geometry.fieldSize).toBeGreaterThan(geometry.anchorSize);
    expect(ringGap).toBeGreaterThanOrEqual(8);
    expect(predicted.width).toBe(geometry.anchorSize);
    expect(predicted.y + predicted.height / 2).toBe(geometry.centerY);
    expect(geometry.centerY).toBeLessThan(viewport.height * 0.52);
  });
});
