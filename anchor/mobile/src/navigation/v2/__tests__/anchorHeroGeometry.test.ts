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
    const deepPredicted = predictSessionAnchorRect({ ...viewport, mode: 'deep_prime' });
    const deepGeometry = resolveFocusSessionGeometry({ ...viewport, mode: 'deep_prime' });
    expect(deepPredicted.width).toBe(deepGeometry.anchorSize);
    expect(deepPredicted.y + deepPredicted.height / 2).toBe(deepGeometry.centerY);
    expect(deepGeometry.anchorSize).toBeGreaterThanOrEqual(geometry.anchorSize);

    expect(geometry.fieldSize).toBeGreaterThan(geometry.anchorSize);
    expect(ringGap).toBeGreaterThanOrEqual(8);
    expect(predicted.width).toBe(geometry.anchorSize);
    expect(predicted.y + predicted.height / 2).toBe(geometry.centerY);
    expect(geometry.centerY).toBeLessThan(viewport.height * 0.52);
  });

  it.each([
    { width: 832, height: 384, topInset: 30, bottomInset: 15 },
    { width: 844, height: 390, topInset: 48, bottomInset: 21 },
    { width: 932, height: 430, topInset: 59, bottomInset: 34 },
  ])('scales hero to fill most of the screen in landscape and brings anchor down for notifications at $width × $height', (viewport) => {
    const geometry = resolveFocusSessionGeometry(viewport);
    const progressDiameter = geometry.fieldSize * 0.92;
    const ringGap = (progressDiameter - geometry.anchorSize) / 2;
    const predicted = predictSessionAnchorRect({ ...viewport, mode: 'focus' });

    expect(geometry.fieldSize).toBeGreaterThan(geometry.anchorSize);
    expect(ringGap).toBeGreaterThanOrEqual(8);
    expect(predicted.width).toBe(geometry.anchorSize);
    expect(predicted.y + predicted.height / 2).toBe(geometry.centerY);
    // Hero fills most of the usable screen height (>= 70% of usable height or >= 235dp)
    expect(geometry.anchorSize).toBeGreaterThanOrEqual(235);
    // Anchor top sits safely below top notifications/status bar and header text
    const anchorTop = geometry.centerY - geometry.anchorSize / 2;
    expect(anchorTop).toBeGreaterThanOrEqual(viewport.topInset + 54);
    // Anchor bottom preserves bottom safe clearance
    const anchorBottom = geometry.centerY + geometry.anchorSize / 2;
    expect(viewport.height - anchorBottom).toBeGreaterThanOrEqual(16);

    // Deep Focus provides an even larger hero than regular Focus
    const deepGeometry = resolveFocusSessionGeometry({ ...viewport, mode: 'deep_prime' });
    const deepPredicted = predictSessionAnchorRect({ ...viewport, mode: 'deep_prime' });
    expect(deepPredicted.width).toBe(deepGeometry.anchorSize);
    expect(deepPredicted.y + deepPredicted.height / 2).toBe(deepGeometry.centerY);
    expect(deepGeometry.anchorSize).toBeGreaterThan(geometry.anchorSize);
    expect(deepGeometry.fieldSize).toBeGreaterThan(deepGeometry.anchorSize);
    expect(deepGeometry.centerY - deepGeometry.anchorSize / 2).toBeGreaterThanOrEqual(viewport.topInset + 38);
    expect(viewport.height - (deepGeometry.centerY + deepGeometry.anchorSize / 2)).toBeGreaterThanOrEqual(16);
  });
});
