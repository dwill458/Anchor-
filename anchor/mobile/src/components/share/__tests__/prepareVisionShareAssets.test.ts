import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { prepareVisionShareAssets, VISION_SHARE_DOWNLOAD_TIMEOUT_MS } from '../prepareVisionShareAssets';
import type { ShareExportData } from '../shareTypes';
import { apiClient } from '@/services/ApiClient';
import { getVisionShareBackground } from '../visionShareBackgrounds';

jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({ ...jest.requireMock('expo-file-system'), createDownloadResumable: jest.fn() }));
const mockCancelDownload = jest.fn().mockResolvedValue(undefined);

const tile = { id: 'one', sceneId: 'one', imageUrl: 'https://assets.test/photo.png?signature=original', prompt: null, sortOrder: 0, isHero: true };
const data: ShareExportData = { svg: '<svg/>', category: 'desire', categoryLabel: 'Desire', intention: 'My home',
  imageUrl: 'https://assets.test/anchor.png', visionImageUrl: tile.imageUrl, visionTiles: [tile], visionNotes: [], visionAnnotation: 'Home' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({ uri: 'https://metro.test/full-background.png', width: 1080, height: 1920, scale: 1 });
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (_url, uri) => ({ uri, status: 200 }));
  (FileSystem.createDownloadResumable as jest.Mock).mockImplementation((url, uri) => ({
    downloadAsync: () => FileSystem.downloadAsync(url, uri), cancelAsync: mockCancelDownload,
  }));
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false, size: 500000 });
});
afterEach(() => jest.restoreAllMocks());

it('stages full background, Anchor and photos locally without changing content or signed URLs', async () => {
  const result = await prepareVisionShareAssets(data, 'scrapbook');
  expect(result.backgroundSource).toEqual({ uri: expect.stringMatching(/^file:\/\/\/cache\/vision-share-/) });
  expect(result.data.visionTiles?.[0].imageUrl).toMatch(/^file:\/\/\/cache\/vision-share-/);
  expect(result.data.visionTiles?.[0].sceneId).toBe(tile.sceneId);
  expect(result.data.visionNotes).toBe(data.visionNotes);
  expect(result.data.visionAnnotation).toBe('Home');
  expect(FileSystem.downloadAsync).toHaveBeenCalledWith(tile.imageUrl, expect.any(String));
  expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(3);
  expect(data.visionTiles?.[0].imageUrl).toBe(tile.imageUrl);
  await result.release();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/vision-share-/), { idempotent: true });
});

it('preserves native bundled assets and local photographs without fetching them', async () => {
  (Image.resolveAssetSource as jest.Mock).mockReturnValue({ uri: 'asset:/full-background.png' });
  const localData = { ...data, imageUrl: null, visionTiles: [{ ...tile, imageUrl: 'file:///photo.png' }] };
  const result = await prepareVisionShareAssets(localData);
  expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
  expect(result.backgroundSource).toBe(getVisionShareBackground().source);
  expect(result.data.visionTiles?.[0].imageUrl).toBe('file:///photo.png');
});

it('does not download artwork when the Anchor mark is hidden', async () => {
  await prepareVisionShareAssets(data, 'canvas', false);
  expect(FileSystem.downloadAsync).not.toHaveBeenCalledWith(data.imageUrl, expect.anything());
});

it('refreshes expired photo links once and retries the same saved scenes', async () => {
  const freshUrl = 'https://assets.test/photo.png?signature=fresh';
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (url, uri) => ({ uri, status: url === tile.imageUrl ? 403 : 200 }));
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: {
    anchorId: 'anchor-one', status: 'ACTIVE', scenes: [{ id: tile.sceneId, resolvedImageUrl: freshUrl, isArchived: false }],
  } } });
  const prepared = await prepareVisionShareAssets({ ...data, anchorId: 'anchor-one' });
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith('/api/v2/anchors/anchor-one/vision');
  expect(FileSystem.downloadAsync).toHaveBeenCalledWith(freshUrl, expect.any(String));
  expect(prepared.data.visionTiles?.[0].sceneId).toBe(tile.sceneId);
  expect(prepared.data.visionNotes).toBe(data.visionNotes);
  expect(prepared.data.visionAnnotation).toBe(data.visionAnnotation);
});

it('does not refresh a different Anchor or loop on a permanently unavailable image', async () => {
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (_url, uri) => ({ uri, status: 403 }));
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { anchorId: 'someone-else', status: 'ACTIVE', scenes: [] } });
  await expect(prepareVisionShareAssets({ ...data, anchorId: 'anchor-one' })).rejects.toThrow();
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

it('stops after one refresh if the current photo link is still denied', async () => {
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (url, uri) => ({ uri, status: url === tile.imageUrl ? 403 : 200 }));
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { anchorId: 'anchor-one', status: 'ACTIVE',
    scenes: [{ id: tile.sceneId, resolvedImageUrl: tile.imageUrl, isArchived: false }] } });
  await expect(prepareVisionShareAssets({ ...data, anchorId: 'anchor-one' })).rejects.toThrow('could not be downloaded');
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
});

it.each([403, 404, 500])('rejects HTTP %i instead of supplying a broken file to the export', async status => {
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (_url, uri) => ({ uri, status }));
  await expect(prepareVisionShareAssets(data)).rejects.toThrow('could not be downloaded');
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
});

it('rejects empty downloads and missing photographs', async () => {
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false, size: 0 });
  await expect(prepareVisionShareAssets(data)).rejects.toThrow('empty');
  await expect(prepareVisionShareAssets({ ...data, visionTiles: [{ ...tile, imageUrl: null }] })).rejects.toThrow('photograph is missing');
});

it('does not expose signed image URLs from native download errors', async () => {
  (FileSystem.downloadAsync as jest.Mock).mockRejectedValue(new Error(`Failed URL ${tile.imageUrl}`));
  await expect(prepareVisionShareAssets(data)).rejects.toThrow('A Vision image could not be downloaded.');
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
});

it('cancels stalled downloads and releases the export instead of stranding both buttons', async () => {
  jest.useFakeTimers();
  try {
    (FileSystem.downloadAsync as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const pending = prepareVisionShareAssets(data);
    const rejected = expect(pending).rejects.toThrow('loading timed out');
    await jest.advanceTimersByTimeAsync(VISION_SHARE_DOWNLOAD_TIMEOUT_MS);
    await rejected;
    expect(mockCancelDownload).toHaveBeenCalledTimes(3);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
