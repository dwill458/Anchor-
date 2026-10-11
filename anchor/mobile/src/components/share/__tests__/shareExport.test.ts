import { availableShareLayouts, SHARE_EXPORT_SIZE } from '../shareTypes';
import { buildShareExportData } from '../shareData';
import { resolveCaptureRequest, resolveExportRenderSize, shareExportFilename } from '@/services/anchorExportService';
import { detailBoardSizeForWidth, selectDetailBoardLayout } from '@/components/v2/vision/board/visionBoardLayouts';
import { visionBoardExportFrame } from '../visionBoardExportFrame';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/services/AnchorArtworkExportService', () => ({
  requestPhotoLibrarySavePermission: jest.fn(),
  savePngToPhotoLibrary: jest.fn(),
}));

const anchor = {
  intentionText: '  I am financially free ',
  category: 'abundance',
  baseSigilSvg: '<svg/>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: 'https://img/enhanced.png',
  classifierMeta: undefined,
} as any;

describe('share layouts', () => {
  it('offers Vision only when a real Vision image exists', () => {
    expect(availableShareLayouts({ visionImageUrl: null })).toEqual(['minimal', 'style', 'editorial']);
    expect(availableShareLayouts({ visionImageUrl: 'https://img/vision.jpg' })).toEqual(['minimal', 'style', 'editorial', 'vision']);
  });

  it('builds export data from the anchor only', () => {
    const data = buildShareExportData(anchor, { stateLabel: 'Building' });
    expect(data.intention).toBe('I am financially free');
    expect(data.categoryLabel).toBe('Abundance');
    expect(data.imageUrl).toBe('https://img/enhanced.png');
    expect(data.stateLabel).toBe('Building');
    expect(data.visionImageUrl).toBeNull();
  });

  it('carries the actual ordered board payload and derives the layout gate from it', () => {
    const tiles = [{ id: 'tile-1', sceneId: 'photo-1', imageUrl: 'https://img/board.jpg', prompt: null, sortOrder: 0, isHero: true }];
    const notes = [{ id: 'note-1', visionId: 'vision-1', content: { text: 'Home by the sea' }, presentation: {
      styleId: 'sticky_blush_pink' as const, x: 0.4, y: 0.6, width: 0.3, height: 0.2, rotation: -7, scale: 1.1, layerOrder: 24,
    }, createdAt: '', updatedAt: '' }];
    const data = buildShareExportData(anchor, { visionTiles: tiles, visionNotes: notes, visionAnnotation: 'A quiet life' });
    expect(data.visionTiles).toBe(tiles);
    expect(data.visionNotes).toBe(notes);
    expect(data.visionAnnotation).toBe('A quiet life');
    expect(data.visionImageUrl).toBe('https://img/board.jpg');
    expect(availableShareLayouts(data)).toContain('vision');
    expect(availableShareLayouts({ visionImageUrl: null, visionTiles: [], visionNotes: [] })).not.toContain('vision');
  });

  it('offers a meaningful notes-only board and ignores archived/blank notes', () => {
    const note = { id: 'note-1', visionId: 'vision-1', content: { text: 'Remember this' }, presentation: {
      styleId: 'sticky_blush_pink' as const, x: 0.5, y: 0.5, width: 0.3, height: 0.2, rotation: 0, scale: 1, layerOrder: 1,
    }, createdAt: '', updatedAt: '' };
    expect(availableShareLayouts({ visionImageUrl: null, visionTiles: [], visionNotes: [note] })).toContain('vision');
    expect(availableShareLayouts({ visionImageUrl: null, visionTiles: [], visionNotes: [{ ...note, isArchived: true }] })).not.toContain('vision');
    expect(availableShareLayouts({ visionImageUrl: null, visionTiles: [], visionNotes: [{ ...note, content: { text: '  ' } }] })).not.toContain('vision');
  });
});

describe('Vision board export framing', () => {
  it('fits the existing detail-board object bounds for every supported photo count', () => {
    const width = 360;
    const viewport = { width, height: width * 16 / 9 };
    const margin = width * 0.055;
    for (let count = 1; count <= 8; count += 1) {
      const scene = detailBoardSizeForWidth(width * 1.7, count);
      const layout = selectDetailBoardLayout(count);
      const frame = visionBoardExportFrame(scene, layout, [], viewport, margin);
      const left = frame.bounds.left * frame.scale + frame.left;
      const right = frame.bounds.right * frame.scale + frame.left;
      const top = frame.bounds.top * frame.scale + frame.top;
      const bottom = frame.bounds.bottom * frame.scale + frame.top;
      expect(left).toBeGreaterThanOrEqual(margin - 0.001);
      expect(right).toBeLessThanOrEqual(width - margin + 0.001);
      expect(top).toBeGreaterThanOrEqual(margin - 0.001);
      expect(bottom).toBeLessThanOrEqual(viewport.height - margin + 0.001);
    }
  });

  it('expands the frame for a rotated, scaled, high-layer note without moving its board coordinates', () => {
    const width = 360;
    const scene = detailBoardSizeForWidth(width * 1.7, 3);
    const layout = selectDetailBoardLayout(3);
    const viewport = { width, height: width * 16 / 9 };
    const base = visionBoardExportFrame(scene, layout, [], viewport);
    const note = { id: 'note-1', visionId: 'vision-1', content: { text: 'A note' }, presentation: {
      styleId: 'sticky_blush_pink' as const, x: 0, y: -0.2, width: 0.3, height: 0.2, rotation: 35, scale: 1.2, layerOrder: 24,
    }, createdAt: '', updatedAt: '' };
    const withNote = visionBoardExportFrame(scene, layout, [note], viewport);
    expect(withNote.bounds.left).toBeLessThan(base.bounds.left);
    expect(withNote.bounds.top).toBeLessThan(base.bounds.top);
    expect(withNote.scale).toBeLessThan(base.scale);
  });
});

describe('1080 x 1920 export sizing', () => {
  it('renders the export node at 1080 native pixels on any density', () => {
    for (const ratio of [1, 2, 2.625, 3, 3.5]) {
      const { width, height } = resolveExportRenderSize(ratio);
      expect(width * ratio).toBeCloseTo(SHARE_EXPORT_SIZE.width, 5);
      expect(height * ratio).toBeCloseTo(SHARE_EXPORT_SIZE.height, 5);
    }
  });

  it('asks view-shot for pixels on Android and points on iOS', () => {
    expect(resolveCaptureRequest(3, 'android')).toEqual({ width: 1080, height: 1920 });
    expect(resolveCaptureRequest(3, 'ios')).toEqual({ width: 360, height: 640 });
  });

  it('names exports by layout and size', () => {
    expect(shareExportFilename('editorial')).toBe('anchor-editorial-1080x1920.png');
  });
});
