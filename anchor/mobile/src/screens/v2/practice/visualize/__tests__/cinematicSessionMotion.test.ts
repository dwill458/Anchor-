import { buildCinematicTimeline } from '../prototype/cinematicTimeline';
import { cinematicSessionFrame, cinematicSessionGeometry } from '../cinematicSessionMotion';
import { projectPoint } from '../prototype/cinematicGeometry';

const scene = { width: 768, height: 900 };
const viewport = { width: 384, height: 832 };
const photo = { x: 175, y: 155, width: 390, height: 236, rotation: -4, zIndex: 1 };
const mark = { x: 340, y: 492, width: 86, height: 86, rotation: 0, zIndex: 2 };

describe('production cinematic spatial path', () => {
  it('projects frame zero into the measured overview canvas, including a scrolled origin', () => {
    const canvas = { x: 20, y: -35, width: 344, height: 403.125 };
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 3, canvas);
    const frame = cinematicSessionFrame(0, buildCinematicTimeline(180, 3), geometry, false);
    const origin = projectPoint({ x: 0, y: 0 }, frame.camera, viewport);
    expect(origin.x).toBeCloseTo(canvas.x);
    expect(origin.y).toBeCloseTo(canvas.y);
    const corner = projectPoint({ x: scene.width, y: scene.height }, frame.camera, viewport);
    expect(corner.x).toBeCloseTo(canvas.x + canvas.width);
    expect(corner.y).toBeCloseTo(canvas.y + canvas.height);
  });

  it.each([60, 180, 300] as const)('keeps the opening and closing Anchor at the same board coordinate for %is', duration => {
    const timeline = buildCinematicTimeline(duration, 1);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 1);
    const opening = cinematicSessionFrame(0, timeline, geometry, false);
    const closing = cinematicSessionFrame(timeline.durationMs, timeline, geometry, false);
    expect(closing.markCenter.x).toBeCloseTo(opening.markCenter.x, 5);
    expect(closing.markCenter.y).toBeCloseTo(opening.markCenter.y, 5);
    expect(closing.markScale).toBeCloseTo(opening.markScale, 5);
    expect(closing.camera).toEqual(opening.camera);
  });

  it('holds the same one-image source transform into compression', () => {
    const timeline = buildCinematicTimeline(60, 1);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 1);
    const compression = timeline.segments.find(item => item.kind === 'compression')!;
    const before = cinematicSessionFrame(compression.startMs - 0.01, timeline, geometry, false);
    const after = cinematicSessionFrame(compression.startMs, timeline, geometry, false);
    expect(after.firstCenter).toEqual(before.firstCenter);
    expect(after.firstScale).toBeCloseTo(before.firstScale, 5);
    expect(after.firstRotation).toBeCloseTo(before.firstRotation, 5);
    expect(before.unmasked).toBe(1);
    expect(after.masked).toBe(1);
  });

  it('closes the peripheral aperture before resolving clean exact SVG strokes', () => {
    const timeline = buildCinematicTimeline(60, 2);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 2);
    const compression = timeline.segments.find(item => item.kind === 'compression')!;
    const closed = cinematicSessionFrame(compression.startMs + 2800, timeline, geometry, false);
    const clean = cinematicSessionFrame(compression.endMs, timeline, geometry, false);
    expect(closed.maskRadius).toBeCloseTo(0, 5);
    expect(closed.masked).toBe(1);
    expect(closed.markOpacity).toBe(0);
    const held = cinematicSessionFrame(compression.startMs + 3000, timeline, geometry, false);
    expect(held.masked).toBe(1);
    expect(held.markOpacity).toBe(0);
    expect(clean.masked).toBe(0);
    expect(clean.markOpacity).toBe(1);
  });

  it('uses a stationary crossfade for the reduced-motion Anchor return', () => {
    const timeline = buildCinematicTimeline(60, 2);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 2);
    const compression = timeline.segments.find(item => item.kind === 'compression')!;
    const midCompression = cinematicSessionFrame(compression.startMs + 2000, timeline, geometry, true);
    expect(midCompression.unmasked).toBe(0);
    expect(midCompression.masked).toBe(1);
    const pullback = timeline.segments.find(item => item.kind === 'return')!;
    const before = cinematicSessionFrame(pullback.startMs - 0.01, timeline, geometry, true);
    const middle = cinematicSessionFrame((pullback.startMs + pullback.endMs) / 2, timeline, geometry, true);
    const after = cinematicSessionFrame(pullback.endMs, timeline, geometry, true);
    expect(before.markCenter).toEqual(middle.markCenter);
    expect(after.markCenter).toEqual(middle.markCenter);
    expect(before.markScale).toBe(middle.markScale);
    expect(middle.camera).toEqual(geometry.rest);
    expect(middle.markOpacity).toBeCloseTo(0.5, 5);
    expect(middle.boardMarkOpacity).toBeCloseTo(0.5, 5);
    expect(after.boardMarkOpacity).toBe(1);
    expect(after.markOpacity).toBe(0);
  });

  it('keeps the Anchor center traceable through return', () => {
    const timeline = buildCinematicTimeline(180, 3);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 3);
    const pullback = timeline.segments.find(item => item.kind === 'return')!;
    const start = cinematicSessionFrame(pullback.startMs, timeline, geometry, false);
    const end = cinematicSessionFrame(pullback.endMs, timeline, geometry, false);
    expect(start.markCenter.x).toBeCloseTo(viewport.width / 2, 5);
    let previous = start.markCenter;
    for (let ms = pullback.startMs; ms <= pullback.endMs; ms += 1000 / 60) {
      const frame = cinematicSessionFrame(ms, timeline, geometry, false);
      expect(frame.markCenter).toEqual(projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, frame.camera, viewport));
      expect(Math.hypot(frame.markCenter.x - previous.x, frame.markCenter.y - previous.y)).toBeLessThan(5);
      previous = frame.markCenter;
    }
    expect(end.markCenter).toEqual(cinematicSessionFrame(timeline.durationMs, timeline, geometry, false).markCenter);
  });
});
