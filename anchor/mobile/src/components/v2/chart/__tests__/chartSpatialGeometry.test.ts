import {
  chartCameraTarget,
  chartCoverFrame,
  chartSpatialNodeProgress,
  projectChartPoint,
} from '../chartSpatialGeometry';

describe('cinematic Chart spatial geometry', () => {
  it('maps canonical points through a centered cover crop', () => {
    const frame = chartCoverFrame({ width: 720, height: 1280 }, { width: 393, height: 520 });

    expect(frame.scale).toBeCloseTo(393 / 720);
    expect(frame.cropX).toBeCloseTo(0);
    expect(frame.cropY).toBeLessThan(0);
    expect(projectChartPoint({ x: 0.5, y: 0.5 }, frame)).toEqual({
      x: expect.closeTo(196.5, 4),
      y: expect.closeTo(260, 4),
    });
  });

  it('targets a node at the focal region without exposing image bounds', () => {
    const frame = chartCoverFrame({ width: 720, height: 1280 }, { width: 393, height: 520 });
    const target = chartCameraTarget({
      frame,
      node: { x: 0.8, y: 0.25 },
      focalPoint: { x: 0.54, y: 0.43 },
      zoom: 1.4,
    });

    expect(target.scale).toBe(1.4);
    expect(target.translateX).toBeLessThan(0);
    expect(target.translateY).toBeGreaterThan(0);
    expect(target.translateX).toBeGreaterThanOrEqual(target.bounds.minX);
    expect(target.translateX).toBeLessThanOrEqual(target.bounds.maxX);
    expect(target.translateY).toBeGreaterThanOrEqual(target.bounds.minY);
    expect(target.translateY).toBeLessThanOrEqual(target.bounds.maxY);
  });

  it.each([1, 2, 4, 6, 8, 12])('supports %i server waypoints and keeps the destination last', (count) => {
    const progress = chartSpatialNodeProgress(count);

    expect(progress).toHaveLength(count);
    expect(progress.at(-1)).toBe(1);
    expect(progress.every((value, index) => index === 0 || value > progress[index - 1])).toBe(true);
  });

  it('returns literal identity values for the reverse endpoint', () => {
    const frame = chartCoverFrame({ width: 720, height: 1280 }, { width: 360, height: 500 });
    const target = chartCameraTarget({
      frame,
      node: { x: 0.4, y: 0.6 },
      focalPoint: { x: 0.5, y: 0.42 },
      zoom: 1,
    });

    expect(target).toMatchObject({ scale: 1, translateX: 0, translateY: 0 });
  });
});
