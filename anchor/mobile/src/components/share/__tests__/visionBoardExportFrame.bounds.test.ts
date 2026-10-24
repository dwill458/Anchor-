import { boardCaptionRect, boardPrintRect, toSceneRect, type BoardLayout, type BoardSlot, type SceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { fitVisualizePhotoFrame } from '@/screens/v2/practice/visualize/visualizePhotoFrame';
import { visionBoardExportFrame } from '../visionBoardExportFrame';

const scene = { width: 360, height: 600 };
const caption = {
  key: 'measured-caption', text: 'My complete caption', fontSize: .04, lineHeight: .05,
  width: .5, height: .3, left: -.45, top: .42, extra: .2, fontFamily: 'Caveat-SemiBold', kind: 'band' as const,
};
function corners(rect: SceneRect) {
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2, angle = rect.rotation * Math.PI / 180;
  return [[-rect.width / 2, -rect.height / 2], [rect.width / 2, -rect.height / 2], [rect.width / 2, rect.height / 2], [-rect.width / 2, rect.height / 2]]
    .map(([x, y]) => ({ x: cx + x * Math.cos(angle) - y * Math.sin(angle), y: cy + x * Math.sin(angle) + y * Math.cos(angle) }));
}
function photo(rotation: number): BoardSlot {
  return { x: .5, y: .22, width: .4, aspectRatio: 1, rotation, zIndex: 12, frame: 'square', treatment: 'polaroid', caption };
}

describe('shared export and Visualize bounds preserve the real rotated print footprint', () => {
  it.each([-15, 0, 12])('keeps the original print pivot when its caption paper grows at %s degrees', rotation => {
    const slot = photo(rotation), original = toSceneRect(slot, scene), grown = boardPrintRect(slot, scene);
    const extra = caption.extra * scene.width, angle = rotation * Math.PI / 180;
    const pivot = { x: original.x + original.width / 2, y: original.y + original.height / 2 };
    const expected = [[0, 0], [original.width, 0], [original.width, original.height + extra], [0, original.height + extra]]
      .map(([x, y]) => ({
        x: pivot.x + (x - original.width / 2) * Math.cos(angle) - (y - original.height / 2) * Math.sin(angle),
        y: pivot.y + (x - original.width / 2) * Math.sin(angle) + (y - original.height / 2) * Math.cos(angle),
      }));
    corners(grown).forEach((point, i) => {
      expect(point.x).toBeCloseTo(expected[i].x, 8);
      expect(point.y).toBeCloseTo(expected[i].y, 8);
    });
    expect(grown.height).toBeCloseTo(original.height + extra);
    expect(grown.width).toBe(original.width);
  });

  it.each(['band', 'label'] as const)('fits the entire rotated %s caption and growing print inside both preview and finished export', kind => {
    const slot: BoardSlot = { ...photo(12), caption: { ...caption, kind, extra: kind === 'band' ? .2 : 0 } };
    const layout: BoardLayout = { count: 1, photos: [slot],
      card: { x: .7, y: .6, width: .2, aspectRatio: 1, rotation: 0, zIndex: 40 }, decor: [] };
    const frame = fitVisualizePhotoFrame(scene.width, 1, 320, 420, scene.height, { anchor: true, layout, order: ['p1'] });
    const exported = visionBoardExportFrame(scene, layout, [], { width: 320, height: 420 }, 18, [], [], ['p1']);
    const rectangles = [boardPrintRect(slot, scene), boardCaptionRect(slot, scene)!];
    expect(rectangles[1].x).toBeLessThan(rectangles[0].x);
    for (const rect of rectangles) for (const point of corners(rect)) {
      expect(point.x * frame.scale + frame.sceneOriginX).toBeGreaterThanOrEqual(-1e-6);
      expect(point.x * frame.scale + frame.sceneOriginX).toBeLessThanOrEqual(frame.width + 1e-6);
      expect(point.y * frame.scale + frame.sceneOriginY).toBeGreaterThanOrEqual(-1e-6);
      expect(point.y * frame.scale + frame.sceneOriginY).toBeLessThanOrEqual(frame.height + 1e-6);
      expect(point.x * exported.scale + exported.left).toBeGreaterThanOrEqual(18 - 1e-6);
      expect(point.x * exported.scale + exported.left).toBeLessThanOrEqual(320 - 18 + 1e-6);
      expect(point.y * exported.scale + exported.top).toBeGreaterThanOrEqual(18 - 1e-6);
      expect(point.y * exported.scale + exported.top).toBeLessThanOrEqual(420 - 18 + 1e-6);
    }
  });
});
