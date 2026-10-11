import { clampVisionNotePresentationForAspect, defaultVisionNoteOccupancy, nextVisionNotePresentation, visionBoardAspectForCount, visionNoteZIndex } from '../visionNotePlacement';
import type { VisionNote } from '@/adapters/v2/vision';
import { VISION_NOTE_STYLE_IDS, getVisionNotePreset } from '../visionNoteStyles';

const note = (x: number, y: number, id = 'one'): VisionNote => ({
  id, visionId: 'vision', content: { text: 'A note' },
  presentation: { styleId: 'sticky_blush_pink', x, y, width: 0.34, height: 0.34, rotation: 0, scale: 1, layerOrder: 0 },
  createdAt: '', updatedAt: '',
});

describe('nextVisionNotePresentation', () => {
  it('keeps every note above the photo stack and below the Anchor card', () => {
    expect(visionNoteZIndex(0)).toBe(20);
    expect(visionNoteZIndex(19)).toBe(39);
    expect(visionNoteZIndex(1000)).toBe(39);
    expect(visionNoteZIndex(0)).toBeGreaterThan(18);
    expect(visionNoteZIndex(1000)).toBeLessThan(40);
  });

  it('places a new note away from an existing note and increments layer order', () => {
    const placement = nextVisionNotePresentation('editorial_vintage_letter', [note(0.27, 0.25)]);
    expect(placement.styleId).toBe('editorial_vintage_letter');
    expect(placement).toMatchObject({ width: 0.26, height: 0.26, rotation: -1.2, scale: 1, layerOrder: 1 });
    expect(Math.hypot(placement.x - .27, placement.y - .25)).toBeGreaterThan(.15);
  });

  it('ignores archived notes when finding a clear position and next layer', () => {
    const archived = { ...note(0.27, 0.25), isArchived: true };
    expect(nextVisionNotePresentation('sticky_sky_blue', [archived])).toEqual(nextVisionNotePresentation('sticky_sky_blue', []));
  });

  it('avoids photo and Anchor occupancy rectangles using the current board layout', () => {
    const occupied = defaultVisionNoteOccupancy(2);
    const placement = nextVisionNotePresentation('paper_ivory_torn', [], occupied, visionBoardAspectForCount(2));
    expect(occupied).toHaveLength(3);
    const card = occupied[occupied.length - 1];
    expect(Math.abs(card.x - placement.x) >= (card.width + placement.width) / 2 || Math.abs(card.y - placement.y) >= (card.height + placement.height) / 2).toBe(true);
    // The paper may overlap a photograph's edge, but avoids its central subject.
    expect(occupied.slice(0, -1).some(rect => Math.abs(rect.x - placement.x) < rect.width * .2 && Math.abs(rect.y - placement.y) < rect.height * .2)).toBe(false);
  });

  it('clamps rotated note bounds in physical coordinates on a tall board', () => {
    const p = { styleId: 'sticky_blush_pink' as const, x: .02, y: .99, width: .3, height: .12, rotation: 45, scale: 1, layerOrder: 0 };
    const result = clampVisionNotePresentationForAspect(p, 2);
    const halfWidth = (p.width * Math.cos(Math.PI / 4) + p.height * 2.65 * Math.sin(Math.PI / 4)) / 2;
    const halfHeight = (p.height * Math.cos(Math.PI / 4) + p.width / .45 * Math.sin(Math.PI / 4)) / 2;
    expect(result.x).toBeGreaterThanOrEqual(halfWidth);
    expect(result.y).toBeLessThanOrEqual(1 - halfHeight);
  });

  it('keeps every style inside server bounds for every supported photo-count layout', () => {
    for (let photoCount = 0; photoCount <= 8; photoCount += 1) {
      const aspect = visionBoardAspectForCount(photoCount);
      for (const styleId of VISION_NOTE_STYLE_IDS) {
        const initial = nextVisionNotePresentation(styleId, [], defaultVisionNoteOccupancy(photoCount), aspect);
        const preset = getVisionNotePreset(styleId);
        const p = clampVisionNotePresentationForAspect({ ...initial, rotation: preset.rotation }, aspect);
        const angle = p.rotation * Math.PI / 180;
        const halfWidth = (Math.abs(p.width * p.scale * Math.cos(angle)) + Math.abs(p.height * 2.65 * p.scale * Math.sin(angle))) / 2;
        const halfHeight = (Math.abs(p.height * p.scale * Math.cos(angle)) + Math.abs(p.width / .45 * p.scale * Math.sin(angle))) / 2;
        expect(p.width).toBeGreaterThanOrEqual(.12);
        expect(p.height).toBeGreaterThanOrEqual(.12);
        expect(p.x).toBeGreaterThanOrEqual(halfWidth);
        expect(p.x).toBeLessThanOrEqual(1 - halfWidth);
        expect(p.y).toBeGreaterThanOrEqual(halfHeight);
        expect(p.y).toBeLessThanOrEqual(1 - halfHeight);
      }
    }
  });
});
