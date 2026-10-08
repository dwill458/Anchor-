import { newestVisionScene, projectTeachingSlot, visionTeachingBeats } from '../visionTeaching';
it('whispers only at one photo and spotlights at two or more', () => {
  expect(visionTeachingBeats(0)).toEqual([]);
  expect(visionTeachingBeats(1)).toEqual(['vision.first']);
  expect(visionTeachingBeats(2)).toEqual(['vision.second']);
  expect(visionTeachingBeats(6)).toEqual(['vision.second']);
});
it('chooses newest creation time rather than the leading or last sorted photo', () => {
  expect(newestVisionScene([
    { id: 'old', createdAt: '2026-01-01', isArchived: false },
    { id: 'new', createdAt: '2026-02-01', isArchived: false },
    { id: 'archived', createdAt: '2026-03-01', isArchived: true },
  ])).toBe('new');
});
it('projects the actual slot through the centered rest camera into window space', () => {
  expect(projectTeachingSlot({ x: 100, y: 200, width: 200, height: 100, rotation: 0, zIndex: 1 },
    { width: 1000, height: 1000 }, { width: 500, height: 500 }, { x: 0, y: 0, scale: 0.5 },
    { x: 20, y: 80, width: 500, height: 500 })).toEqual({ x: 70, y: 180, width: 100, height: 50 });
});
