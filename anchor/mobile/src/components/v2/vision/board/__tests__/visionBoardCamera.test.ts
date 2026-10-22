import { focusCamera, photoFocusOptions, type FocusOptions } from '../visionBoardCamera';

const scene = { width: 1000, height: 800 };
const viewport = { width: 400, height: 600 };
const photo = { x: 240, y: 230, width: 320, height: 200, rotation: 0, zIndex: 1 };
const options: FocusOptions = { fill: 0.6, minZoom: 1.1, maxZoom: 2, clamp: false };

it('increases photo focus scale by 35% while keeping its focal center fixed', () => {
  const baseline = focusCamera(photo, scene, viewport, options);
  const focused = focusCamera(photo, scene, viewport, photoFocusOptions(options));

  expect(focused.scale).toBeCloseTo(baseline.scale * 1.35, 6);
  expect(focused.x).toBeCloseTo(baseline.x, 6);
  expect(focused.y).toBeCloseTo(baseline.y, 6);
});

it('preserves camera behavior options while scaling the photo zoom factors', () => {
  const boosted = photoFocusOptions({ ...options, clamp: true, offsetY: -24 });

  expect(boosted.fill).toBeCloseTo(0.81, 8);
  expect(boosted.minZoom).toBeCloseTo(1.485, 8);
  expect(boosted.maxZoom).toBeCloseTo(2.7, 8);
  expect(boosted.clamp).toBe(true);
  expect(boosted.offsetY).toBe(-24);
});
