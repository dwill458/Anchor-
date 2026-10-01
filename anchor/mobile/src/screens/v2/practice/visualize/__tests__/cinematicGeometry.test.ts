import { boardSizeForWidth, selectBoardLayout, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import {
  photoWindow, projectPoint, cameraAtRect, restCinematicCamera, coverRect, rotatedChild,
} from '../prototype/cinematicGeometry';

describe('cinematic shared coordinates', () => {
  it.each([[390, 844], [412, 915], [844, 390]])('locks the mark to screen center at %sx%s', (width, height) => {
    const viewport = { width, height };
    const scene = boardSizeForWidth(width);
    const card = toSceneRect(selectBoardLayout(3).card, scene);
    const mark = rotatedChild(card, { x: 70, y: 35, width: 64, height: 64 });
    const camera = cameraAtRect(mark, viewport, 0.5);
    const center = projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, camera, viewport);
    expect(center.x).toBeCloseTo(width / 2, 8);
    expect(center.y).toBeCloseTo(height / 2, 8);
    expect(camera.scale * mark.width).toBeCloseTo(Math.min(width, height) * 0.5, 8);
    expect(camera.rotation).toBeCloseTo(-mark.rotation);
  });

  it('includes the production photo bleed and rotated center', () => {
    const photo = { x: 50, y: 60, width: 180, height: 140, rotation: 10, zIndex: 12 };
    const window = photoWindow(photo, 'landscape');
    expect(window.width).toBeGreaterThan(0);
    expect(window.height).toBeGreaterThan(0);
    expect(window.rotation).toBe(10);
    const unrotated = photoWindow({ ...photo, rotation: 0 }, 'landscape');
    const angle = Math.PI / 18;
    const dx = unrotated.x + unrotated.width / 2 - 140;
    const dy = unrotated.y + unrotated.height / 2 - 130;
    expect(window.x + window.width / 2).toBeCloseTo(140 + dx * Math.cos(angle) - dy * Math.sin(angle));
  });

  it.each([[1600, 900], [900, 1600], [1000, 1000]])('keeps source aspect and covers the crop for %sx%s', (width, height) => {
    const target = { x: -40, y: 70, width: 390, height: 844 };
    const image = coverRect({ width, height }, target);
    expect(image.width / image.height).toBeCloseTo(width / height);
    expect(image.width).toBeGreaterThanOrEqual(target.width);
    expect(image.height).toBeGreaterThanOrEqual(target.height);
    expect(image.x + image.width / 2).toBeCloseTo(target.x + target.width / 2);
  });

  it('returns to the exact same board transform', () => {
    const scene = boardSizeForWidth(412);
    const viewport = { width: 412, height: 915 };
    const first = restCinematicCamera(scene, viewport);
    expect(projectPoint({ x: scene.width / 2, y: scene.height / 2 }, first, viewport)).toEqual({ x: 206, y: 457.5 });
    expect(first).toEqual(restCinematicCamera(scene, viewport));
  });
});
