import { boardSizeForWidth, selectBoardLayout, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { photoWindow, projectPoint, rotatedChild } from '../prototype/cinematicGeometry';
import { SIGNATURE_BEATS as B, controlAction, signatureFrame, signatureGeometry, signaturePlaybackRange } from '../prototype/signatureMotion';

function geometry(count: number, width = 390, height = 844) {
  const scene = boardSizeForWidth(width * 2);
  const layout = selectBoardLayout(count);
  const card = toSceneRect(layout.card, scene);
  const mark = rotatedChild(card, { x: card.width * 0.24, y: card.height * 0.2, width: card.width * 0.52, height: card.width * 0.52 });
  return signatureGeometry(scene, { width, height }, photoWindow(toSceneRect(layout.photos[0], scene), layout.photos[0].frame), mark);
}

describe('signature reel continuity', () => {
  it('does not pass Pressable events into zero-argument control actions', () => {
    const action = jest.fn();
    const onPress = controlAction(action);
    Reflect.apply(onPress, undefined, [{ nativeEvent: { pageX: 100, pageY: 200 } }]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith();
  });

  it.each([
    { requested: 0, start: 0, duration: B.end },
    { requested: B.compression, start: B.compression, duration: B.end - B.compression },
    { requested: B.end, start: B.end, duration: 0 },
    { requested: -10, start: 0, duration: B.end },
    { requested: B.end + 10, start: B.end, duration: 0 },
  ])('starts at $start ms with $duration ms remaining', ({ requested, start, duration }) => {
    expect(signaturePlaybackRange(requested)).toEqual({ start, duration });
  });

  it.each([1, 2, 3, 4, 5, 6])('returns to identical board and Anchor placement with %s images', count => {
    const g = geometry(count);
    const start = signatureFrame(2500, g);
    const finish = signatureFrame(B.end, g);
    expect(finish.camera).toEqual(start.camera);
    expect(finish.markCenter).toEqual(start.markCenter);
    expect(finish.markScale).toBe(start.markScale);
    expect(finish.markRotation).toBe(start.markRotation);
    expect(finish.environment).toBe(1);
    expect(finish.textured).toBe(0);
    expect(finish.markPresence).toBe(1);
  });

  it.each([B.immersed, B.compression, B.anchor, B.return, B.board])('has no visible image or mark jump at %sms', at => {
    const g = geometry(3);
    const left = signatureFrame(at - 0.01, g);
    const right = signatureFrame(at + 0.01, g);
    expect(Math.hypot(right.photoCenter.x - left.photoCenter.x, right.photoCenter.y - left.photoCenter.y)).toBeLessThan(0.01);
    expect(Math.abs(right.photoScale - left.photoScale)).toBeLessThan(0.001);
    if (right.markPresence > 0.01) {
      expect(Math.hypot(right.markCenter.x - left.markCenter.x, right.markCenter.y - left.markCenter.y)).toBeLessThan(0.01);
      expect(Math.abs(right.markScale - left.markScale)).toBeLessThan(0.001);
    }
  });

  it('holds the SVG-masked Vision texture before clean strokes resolve from 14 to 15s', () => {
    const textured = signatureFrame(13500, geometry(3));
    const resolving = signatureFrame(14500, geometry(3));
    const closed = signatureFrame(13800, geometry(3));
    expect(textured.markPresence).toBe(0);
    expect(textured.textured).toBe(1);
    expect(textured.boundary).toBe(1);
    expect(textured.aperture).toBeGreaterThan(0.95);
    expect(closed.aperture).toBe(1);
    expect(closed.textured).toBe(1);
    expect(closed.markPresence).toBe(0);
    expect(textured.compression).toBeGreaterThan(0);
    expect(textured.compression).toBeLessThan(1);
    expect(textured.photoCenter).toEqual(textured.markCenter);
    expect(resolving.markPresence).toBeGreaterThan(0);
    expect(resolving.textured).toBeGreaterThan(0);
    expect(resolving.boundary).toBe(1);
    expect(signatureFrame(B.anchor, geometry(3)).markPresence).toBe(1);
    expect(signatureFrame(B.anchor, geometry(3)).textured).toBe(0);
  });

  it('keeps the Anchor attached to its measured paper coordinate on every return frame', () => {
    const g = geometry(6, 412, 915);
    for (let time = B.return; time <= B.board; time += 1000 / 60) {
      const frame = signatureFrame(time, g);
      const point = projectPoint({ x: g.mark.x + g.mark.width / 2, y: g.mark.y + g.mark.height / 2 }, frame.camera, g.viewport);
      expect(frame.markCenter).toEqual(point);
      expect(frame.markScale).toBe(frame.camera.scale);
    }
  });

  it('holds a stationary camera throughout reduced motion', () => {
    const g = geometry(1);
    for (let time = 0; time <= B.end; time += 100) expect(signatureFrame(time, g, true).camera).toEqual(g.rest);
  });
});
