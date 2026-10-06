import { availableShareLayouts, SHARE_EXPORT_SIZE } from '../shareTypes';
import { buildShareExportData } from '../shareData';
import { resolveCaptureRequest, resolveExportRenderSize, shareExportFilename } from '@/services/anchorExportService';

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
