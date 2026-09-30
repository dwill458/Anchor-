import { ROAD_TABLE, ROUTE_START, WAYPOINT_ROUTE_END, getPointAtNormalizedDistance, getWaypointRoutePositions, getJourneyRouteProgress, getCameraTransform, worldToViewport, getRoadParallax, pickWaypoint, decodedWorldBytes } from '../chartJourneyGeometry';

describe('universal road journey', () => {
  it.each([0, 1, 2, 3, 5, 8, 12, 24])('maps %i logical waypoints without count-specific geometry', count => {
    const positions = getWaypointRoutePositions(count);
    expect(positions).toHaveLength(count);
    if (!count) return;
    expect(positions[0]).toBe(ROUTE_START);
    if (count > 1) expect(positions[count - 1]).toBe(WAYPOINT_ROUTE_END);
    positions.forEach((p, i) => {
      if (i) expect(p).toBeGreaterThan(positions[i - 1]);
      const point = getPointAtNormalizedDistance(p);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    });
  });
  it('samples the physical road once with aspect-correct arc lengths', () => {
    expect(ROAD_TABLE).toHaveLength(512);
    expect(ROAD_TABLE[0].distance).toBe(0);
    expect(ROAD_TABLE[511].distance).toBe(1);
    ROAD_TABLE.forEach((p, i) => {
      if (!i) return;
      expect(p.distance).toBeGreaterThan(ROAD_TABLE[i - 1].distance);
      expect(p.depth).toBeLessThanOrEqual(ROAD_TABLE[i - 1].depth);
    });
    expect(getPointAtNormalizedDistance(-1)).toEqual(getPointAtNormalizedDistance(0));
    expect(getPointAtNormalizedDistance(Infinity)).toEqual(getPointAtNormalizedDistance(0));
  });
  it('moves within the current segment and reserves confirmed arrival', () => {
    expect(getJourneyRouteProgress(5, 1, .5, false)).toBeCloseTo(.3875);
    expect(getJourneyRouteProgress(5, 4, 1, false)).toBe(.96);
    expect(getJourneyRouteProgress(5, 4, 5, false)).toBe(.96);
    expect(getJourneyRouteProgress(1, 0, 1, false)).toBe(.96);
    expect(getJourneyRouteProgress(5, 4, 0, true)).toBe(1);
    expect(getJourneyRouteProgress(0, -1, null, false)).toBe(0);
    expect(getJourneyRouteProgress(5, -1, 1, false)).toBe(ROUTE_START);
    expect(getJourneyRouteProgress(5, 2, NaN, false)).toBeCloseTo(.49);
  });
  it.each([{ width: 393, height: 480 }, { width: 360, height: 450 }])('projects nodes using the exact road camera and offset', size => {
    for (const progress of [0, .25, .5, .75, .9, .96, 1]) {
      const camera = getCameraTransform(progress, size);
      const point = getPointAtNormalizedDistance(progress);
      const offset = getRoadParallax(progress);
      const projected = worldToViewport(point, camera, offset);
      expect(Number.isFinite(projected.x)).toBe(true);
      expect(Number.isFinite(projected.y)).toBe(true);
      expect(camera.scale).toBeGreaterThanOrEqual(1);
      expect(camera.left-camera.width*.3).toBeLessThanOrEqual(0);
      expect(camera.top-camera.height*.12).toBeLessThanOrEqual(0);
      expect(camera.left + camera.width*1.3).toBeGreaterThanOrEqual(size.width);
      expect(camera.top + camera.height*1.48).toBeGreaterThanOrEqual(size.height);
    }
  });
  it('selects nearest touch targets and prioritizes current only on ties', () => {
    const nodes = [{ id: 'a', x: 20, y: 20, current: false }, { id: 'b', x: 24, y: 20, current: true }];
    expect(pickWaypoint(20, 20, nodes)).toBe('a');
    expect(pickWaypoint(22, 20, nodes)).toBe('b');
    expect(pickWaypoint(100, 100, nodes)).toBeNull();
  });
  it('keeps runtime decoded textures below 48 MiB', () => {
    expect(decodedWorldBytes()).toBeLessThanOrEqual(48 * 1024 * 1024);
  });
});
