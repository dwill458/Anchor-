import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { prepareVisionShareAssets } from '../prepareVisionShareAssets';
import type { ShareExportData } from '../shareTypes';

const tile = { id: 'one', sceneId: 'one', imageUrl: 'https://assets.test/photo.png?signature=original', prompt: null, sortOrder: 0, isHero: true };
const data: ShareExportData = { svg: '<svg/>', category: 'desire', categoryLabel: 'Desire', intention: 'My home',
  imageUrl: 'https://assets.test/anchor.png', visionImageUrl: tile.imageUrl, visionTiles: [tile], visionNotes: [], visionAnnotation: 'Home' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({ uri: 'https://metro.test/full-background.png', width: 1080, height: 1920, scale: 1 });
  (FileSystem.downloadAsync as jest.Mock).mockImplementation(async (_url, uri) => ({ uri, status: 200 }));
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
  expect(result.backgroundSource).toEqual({ uri: 'asset:/full-background.png' });
  expect(result.data.visionTiles?.[0].imageUrl).toBe('file:///photo.png');
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
