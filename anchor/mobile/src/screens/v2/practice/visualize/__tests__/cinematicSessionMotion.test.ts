import { buildCinematicTimeline } from '../prototype/cinematicTimeline';
import { cinematicSessionFrame, cinematicSessionGeometry } from '../cinematicSessionMotion';
import { projectPoint } from '../prototype/cinematicGeometry';

const scene = { width: 768, height: 900 };
const viewport = { width: 384, height: 832 };
const photo = { x: 175, y: 155, width: 390, height: 236, rotation: -4, zIndex: 1 };
const mark = { x: 340, y: 492, width: 86, height: 86, rotation: 0, zIndex: 2 };

describe('production cinematic spatial path', () => {
  it('never leaves the hero missing at the hand-off: the board photograph stays visible through the still arrival', () => {
    const timeline = buildCinematicTimeline(60, 3);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 3);
    const arrival = timeline.segments.find(segment => segment.kind === 'arrival')!;
    for (const ms of [0, arrival.endMs / 2, arrival.endMs - 1]) {
      expect(cinematicSessionFrame(ms, timeline, geometry, false).nativePhoto).toBe(1);
      expect(cinematicSessionFrame(ms, timeline, geometry, false).segment.kind).toBe('arrival');
    }
    const breakout = timeline.segments.find(segment => segment.kind === 'breakout')!;
    expect(cinematicSessionFrame(breakout.startMs + 1, timeline, geometry, false).nativePhoto).toBe(0);
  });

  it('holds the camera at the set-up frame for the whole arrival, so nothing moves at the hand-off', () => {
    const canvas = { x: 40, y: 201, width: 313, height: 488 };
    const timeline = buildCinematicTimeline(60, 3);
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, 3, canvas);
    const arrival = timeline.segments.find(segment => segment.kind === 'arrival')!;
    const first = cinematicSessionFrame(0, timeline, geometry, false).camera;
    const last = cinematicSessionFrame(arrival.endMs - 1, timeline, geometry, false).camera;
    expect(last.scale).toBeCloseTo(first.scale, 6);
    expect(last.x).toBeCloseTo(first.x, 6);
    expect(last.y).toBeCloseTo(first.y, 6);
  });

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

describe('guided frames: grade, breath and stillness follow the audio position', () => {
  const { buildGuidedPlan } = require('../guided/visualizeGuidedPlan') as typeof import('../guided/visualizeGuidedPlan');
  const { silenceSpans } = require('../guided/visualizeBeatMap') as typeof import('../guided/visualizeBeatMap');

  it('keeps the grade and breath identical under Reduce Motion, which only removes positional movement', () => {
    const plan = buildGuidedPlan({ durationSeconds: 600, guide: 'dominic', imageCount: 3 });
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, plan.imageCount);
    for (const ms of [5_000, 60_000, 150_000, 230_000, 420_000, 500_000, 530_000]) {
      const full = cinematicSessionFrame(ms, plan.timeline, geometry, false);
      const reduced = cinematicSessionFrame(ms, plan.timeline, geometry, true);
      expect(reduced.grade).toEqual(full.grade);
      expect(reduced.breath).toBe(full.breath);
    }
    const breakout = plan.timeline.segments.find(segment => segment.kind === 'breakout')!;
    const midway = (breakout.startMs + breakout.endMs) / 2;
    expect(cinematicSessionFrame(midway, plan.timeline, geometry, true).camera.scale)
      .toBe(cinematicSessionFrame(0, plan.timeline, geometry, true).camera.scale);
    expect(cinematicSessionFrame(midway, plan.timeline, geometry, false).camera.scale)
      .not.toBe(cinematicSessionFrame(0, plan.timeline, geometry, false).camera.scale);
  });

  it('holds every positional channel still through each long Embody silence', () => {
    const plan = buildGuidedPlan({ durationSeconds: 600, guide: 'lina', imageCount: 4 });
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, plan.imageCount);
    const longs = silenceSpans(plan.beatMap).filter(span => span.durationMs >= 5000);
    expect(longs.length).toBeGreaterThan(10);
    let checked = 0;
    for (const span of longs) {
      const from = span.startMs + 1500, to = span.endMs - 1500;
      if (to <= from) continue;
      // A chapter's lead may open a crossfade inside the silence before it; positional motion may not.
      const start = cinematicSessionFrame(from, plan.timeline, geometry, false);
      const end = cinematicSessionFrame(to, plan.timeline, geometry, false);
      if (start.segment.kind === 'transition' || end.segment.kind === 'transition') continue;
      expect(end.camera).toEqual(start.camera);
      expect(end.markCenter).toEqual(start.markCenter);
      expect(end.firstCenter).toEqual(start.firstCenter);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(8);
  });
});

describe('guided polish: no photo zoom and the held Anchor', () => {
  const { buildGuidedPlan } = require('../guided/visualizeGuidedPlan') as typeof import('../guided/visualizeGuidedPlan');

  it.each([60, 180, 600] as const)('never zooms into a face during the %s-second photo sequence', durationSeconds => {
    for (const guide of ['dominic', 'lina'] as const) {
      const plan = buildGuidedPlan({ durationSeconds, guide, imageCount: 6 });
      const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, plan.imageCount);
      expect(plan.timeline.push).toBeUndefined();
      for (const slot of plan.timeline.photoSlots!) for (const reduced of [false, true]) {
        expect(cinematicSessionFrame((slot.startMs + slot.endMs) / 2, plan.timeline, geometry, reduced).push).toBe(0);
      }
    }
  });

  it('breathes the held Anchor slowly and only while it is held', () => {
    const plan = buildGuidedPlan({ durationSeconds: 180, guide: 'dominic', imageCount: 2 });
    const geometry = cinematicSessionGeometry(scene, viewport, photo, mark, plan.imageCount);
    const hold = plan.timeline.segments.find(segment => segment.kind === 'recognition')!;
    const glow = (ms: number) => cinematicSessionFrame(ms, plan.timeline, geometry, false).anchorGlow;
    expect(glow(hold.startMs - 100)).toBe(0);
    expect(glow(hold.endMs + 100)).toBe(0);
    const peak = hold.startMs + 3500;
    expect(glow(peak)).toBeGreaterThan(0.9);
    expect(glow(hold.startMs + 7000)).toBeLessThan(0.05);
    expect(glow(peak + 100)).toBeCloseTo(glow(peak), 1);
  });
});
