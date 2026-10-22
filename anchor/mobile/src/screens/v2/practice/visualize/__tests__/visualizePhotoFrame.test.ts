import { boardSizeForWidth, detailBoardSizeForWidth, selectBoardLayout, selectDetailBoardLayout, toSceneRect } from '@/components/v2/vision/board/visionBoardLayouts';
import { fitVisualizePhotoFrame, preserveVisualizeAnchorLayout, visualizeEntrySceneTransform, visualizePhotoSceneTarget,
  availableVisualizePhotoHeight, VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION } from '../visualizePhotoFrame';

function rotatedBounds(rect: ReturnType<typeof toSceneRect>) {
  const radians = rect.rotation * Math.PI / 180;
  const width = Math.abs(rect.width * Math.cos(radians)) + Math.abs(rect.height * Math.sin(radians));
  const height = Math.abs(rect.height * Math.cos(radians)) + Math.abs(rect.width * Math.sin(radians));
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return { left: centerX - width / 2, right: centerX + width / 2, top: centerY - height / 2, bottom: centerY + height / 2 };
}

describe('fitVisualizePhotoFrame', () => {
  it('reserves the measured identity beneath the entrance collage', () => {
    const available = availableVisualizePhotoHeight({ viewportHeight: 600, headingHeight: 140, identityHeight: 90,
      topPadding: 4, bodyGap: 12, maximumHeight: 640 });
    expect(140 + 90 + available + 4 + 12 * 2).toBeLessThanOrEqual(600);
  });

  it('fits the finished one-photo medallion and saved note inside the entrance frame', () => {
    const note = { isArchived: false, presentation: { x: .92, y: .08, width: .2, height: .15, rotation: 0, scale: 1 } } as any;
    const frame = fitVisualizePhotoFrame(360, 1, 320, 420, undefined, { anchor: true, notes: [note] });
    const card = selectDetailBoardLayout(1).card;
    const actualRadius = card.width * 360 * (0.94 * 1.3) / 2;
    expect((card.y * frame.scene.height + actualRadius) * frame.scale + frame.sceneOriginY).toBeLessThanOrEqual(frame.height);
    expect((note.presentation.x + note.presentation.width / 2) * 360 * frame.scale + frame.sceneOriginX).toBeLessThanOrEqual(frame.width);
  });
  it.each([1, 3, 6, 8])('fits every photo in the existing %i-photo composition without cropping', imageCount => {
    const frame = fitVisualizePhotoFrame(360, imageCount, 320, 420);
    const layout = selectDetailBoardLayout(imageCount);

    expect(layout.photos).toHaveLength(imageCount);
    expect(frame.width).toBeLessThanOrEqual(320);
    expect(frame.height).toBeLessThanOrEqual(420 + 0.01);
    expect(frame.scale).toBeLessThanOrEqual(1);
    for (const photo of layout.photos) {
      const bounds = rotatedBounds(toSceneRect(photo, frame.scene));
      expect(bounds.left * frame.scale + frame.sceneOriginX).toBeGreaterThanOrEqual(-0.01);
      expect(bounds.top * frame.scale + frame.sceneOriginY).toBeGreaterThanOrEqual(-0.01);
      expect(bounds.right * frame.scale + frame.sceneOriginX).toBeLessThanOrEqual(frame.width + 0.01);
      expect(bounds.bottom * frame.scale + frame.sceneOriginY).toBeLessThanOrEqual(frame.height + 0.01);
    }
  });

  it('keeps the same deterministic frame when called repeatedly', () => {
    expect(fitVisualizePhotoFrame(360, 6, 320, 420)).toEqual(fitVisualizePhotoFrame(360, 6, 320, 420));
  });

  it('preserves the source board world dimensions while fitting into the ready frame', () => {
    const frame = fitVisualizePhotoFrame(612, 8, 360, 420, 1621.8);

    expect(frame.scene).toEqual({ width: 612, height: 1621.8 });
    expect(frame.width).toBeLessThanOrEqual(360);
    expect(frame.height).toBeLessThanOrEqual(420);
  });

  it.each([1, 3, 6, 8])('keeps a measured whole-scene source aligned through the photo-only target for %i photos', count => {
    const sourceScene = count > 3
      ? { width: 612, height: 612 * (count === 4 ? 1.8 : count > 6 ? 2.65 : 2) }
      : boardSizeForWidth(612, count);
    const photoFrame = fitVisualizePhotoFrame(sourceScene.width, count, 360, 420, sourceScene.height);
    const source = { x: 14, y: 52, width: photoFrame.scene.width / 1.7, height: photoFrame.scene.height / 1.7 };
    const initial = visualizeEntrySceneTransform(0, source, photoFrame);
    expect(initial.scale).toBeCloseTo(1 / 1.7);
    expect(initial.left + photoFrame.scene.width * (1 - initial.scale) / 2).toBeCloseTo(0);
    expect(initial.top + photoFrame.scene.height * (1 - initial.scale) / 2).toBeCloseTo(0);

    const target = visualizePhotoSceneTarget({ x: 20, y: 30, width: photoFrame.width, height: photoFrame.height }, photoFrame);
    const settled = visualizeEntrySceneTransform(1, source, photoFrame);
    expect(target).toEqual({ x: 20 + photoFrame.sceneOriginX, y: 30 + photoFrame.sceneOriginY,
      width: photoFrame.scene.width * photoFrame.scale, height: photoFrame.scene.height * photoFrame.scale });
    expect(settled.scale).toBeCloseTo(photoFrame.scale);
    expect(settled.left + photoFrame.scene.width * (1 - settled.scale) / 2).toBeCloseTo(0);
    expect(settled.top + photoFrame.scene.height * (1 - settled.scale) / 2).toBeCloseTo(0);
  });

  it('uses the ready screen’s recovered vertical space to widen the full eight-photo composition', () => {
    const width = 360;
    const height = 852;
    const previous = fitVisualizePhotoFrame(width, 8, 320, height * 0.54);
    const current = fitVisualizePhotoFrame(width, 8, 320, height * VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION);

    // Reach the requested growth or the available width, whichever is smaller.
    expect(current.width).toBeGreaterThanOrEqual(Math.min(320, previous.width * 1.2));
    expect(current.width).toBeLessThanOrEqual(320);
    expect(current.height).toBeLessThanOrEqual(height * VISUALIZE_PHOTO_MAX_HEIGHT_FRACTION + 0.01);
  });

  it('fits the photo frame after the measured heading while leaving identity and controls in the scroll flow', () => {
    const available = availableVisualizePhotoHeight({ viewportHeight: 640, headingHeight: 138,
      topPadding: 8, bodyGap: 20, maximumHeight: 528 });
    const frame = fitVisualizePhotoFrame(360, 8, 320, available);

    expect(available).toBe(470);
    expect(frame.height).toBeLessThanOrEqual(available + 0.01);
    expect(frame.width).toBeLessThanOrEqual(320);
    expect(frame.width).toBeGreaterThan(0);
  });

  it.each([4, 6, 8])('preserves the guided Anchor card geometry in the expanded %i-photo scene', imageCount => {
    const width = 720;
    const legacyScene = boardSizeForWidth(width, imageCount);
    const expandedScene = detailBoardSizeForWidth(width, imageCount);
    const expandedLayout = preserveVisualizeAnchorLayout(selectDetailBoardLayout(imageCount), imageCount, expandedScene);
    const legacyCard = toSceneRect(selectBoardLayout(imageCount).card, legacyScene);
    const expandedCard = toSceneRect(expandedLayout.card, expandedScene);

    expect(expandedCard.x).toBeCloseTo(legacyCard.x);
    expect(expandedCard.y).toBeCloseTo(legacyCard.y);
    expect(expandedCard.width).toBeCloseTo(legacyCard.width);
    expect(expandedCard.height).toBeCloseTo(legacyCard.height);
    expect(expandedCard.rotation).toBe(legacyCard.rotation);
  });
});
