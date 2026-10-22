import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useShareExportRenderer } from '../useShareExportRenderer';
import type { ShareExportData } from '../shareTypes';

const mockCapture = jest.fn().mockResolvedValue('file:///complete-export.png');
jest.mock('@/services/anchorExportService', () => ({
  resolveExportRenderSize: () => ({ width: 288, height: 512 }),
  captureShareExport: (...args: unknown[]) => mockCapture(...args),
}));
const mockRelease = jest.fn().mockResolvedValue(undefined);
const staged: ShareExportData = { svg: '<svg/>', category: 'desire', categoryLabel: 'Desire', intention: 'My home',
  visionImageUrl: 'file:///ready-photo.png' };
jest.mock('../prepareVisionShareAssets', () => ({
  prepareVisionShareAssets: jest.fn(async () => ({ data: staged, backgroundSource: { uri: 'file:///full-background.png' }, release: mockRelease })),
}));
const data = { ...staged, visionImageUrl: 'https://assets.test/photo.png' };
beforeEach(() => jest.clearAllMocks());

it('does not capture a failed export and cleans up its staged files', async () => {
  const { result } = renderHook(() => useShareExportRenderer(data));
  let pending!: Promise<string>;
  act(() => { pending = result.current.renderPng('vision', true); });
  const rejected = expect(pending).rejects.toThrow('decode failed');
  await waitFor(() => expect(result.current.isMounted).toBe(true));
  const template = (result.current.exportNode as any).props.children;
  expect(template.props.data.visionImageUrl).toBe('file:///ready-photo.png');
  expect(template.props.visionBackgroundSource).toEqual({ uri: 'file:///full-background.png' });
  await act(async () => { template.props.onAssetsError(new Error('decode failed')); await rejected; });
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockRelease).toHaveBeenCalledTimes(1);
  expect(result.current.isMounted).toBe(false);
});

it('captures only after the staged full-resolution composition is ready', async () => {
  const { result } = renderHook(() => useShareExportRenderer(data));
  const pendingFrames: FrameRequestCallback[] = [];
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  }) as typeof global.requestAnimationFrame;
  const flushFrame = async () => {
    for (let attempt = 0; attempt < 10 && pendingFrames.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    const frame = pendingFrames.shift();
    if (!frame) throw new Error('Expected the export renderer to schedule its next frame.');
    frame(16);
  };
  let pending!: Promise<string>;
  try {
    act(() => { pending = result.current.renderPng('vision', true); });
    await waitFor(() => expect(result.current.isMounted).toBe(true));
    expect(mockCapture).not.toHaveBeenCalled();
    await act(async () => {
      (result.current.exportNode as any).props.children.props.onAssetsReady();
      await flushFrame();
      await flushFrame();
      await expect(pending).resolves.toBe('file:///complete-export.png');
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(result.current.isMounted).toBe(false);
  } finally {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  }
});
