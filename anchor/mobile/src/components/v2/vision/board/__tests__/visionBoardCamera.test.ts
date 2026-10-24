import { focusCamera, focusContentRect, photoFocusOptions, type FocusOptions } from '../visionBoardCamera';

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

it('keeps a wide captioned hero inside the visible space even when the usual minimum zoom would clip it', () => {
  const hero = { ...photo, width: 950, height: 800, rotation: 5 };
  const space = { width: 376, height: 420 };
  const focused = focusCamera(hero, scene, viewport, { ...photoFocusOptions(options), fitBounds: space });
  const angle = 5 * Math.PI / 180;
  expect((hero.width * Math.cos(angle) + hero.height * Math.sin(angle)) * focused.scale).toBeLessThanOrEqual(space.width + .001);
  expect((hero.height * Math.cos(angle) + hero.width * Math.sin(angle)) * focused.scale).toBeLessThanOrEqual(space.height + .001);
});

it('includes the rotated print and its separate paper caption when focusing', () => {
  const content = focusContentRect([photo, { ...photo, x: 220, y: 440, width: 360, height: 90, rotation: 0 }]);
  expect(content).toMatchObject({ x: 220, y: 230, width: 360, height: 300, rotation: 0 });
});
