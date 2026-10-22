import { Image, type ImageSourcePropType } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getVisionShareBackground } from './visionShareBackgrounds';
import type { ShareExportData } from './shareTypes';
import { apiClient } from '@/services/ApiClient';
import { visionApiData } from '@/hooks/v2/vision/visionApi';
import type { VisionReadModel } from '@/adapters/v2/vision';

export const VISION_SHARE_DOWNLOAD_TIMEOUT_MS = 15000;

async function downloadImage(uri: string, destination: string) {
  const task = FileSystem.createDownloadResumable(uri, destination);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancellation: Promise<void> | undefined;
  try {
    return await Promise.race([
      task.downloadAsync(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          cancellation = task.cancelAsync().catch(() => undefined);
          reject(new Error('Vision image loading timed out. Please try again.'));
        }, VISION_SHARE_DOWNLOAD_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await cancellation;
  }
}

class VisionShareAssetError extends Error {
  constructor(message: string, readonly refreshable = false) {
    super(message);
  }
}

export type PreparedVisionShareAssets = {
  data: ShareExportData;
  backgroundSource: ImageSourcePropType;
  release: () => Promise<void>;
};

/** Stage the original bytes once. The capture tree never fetches remote images. */
async function stageVisionShareAssets(data: ShareExportData, backgroundId?: string | null, showMark = true): Promise<PreparedVisionShareAssets> {
  if (!FileSystem.cacheDirectory) throw new Error('Image export storage is unavailable.');
  const directory = `${FileSystem.cacheDirectory}vision-share-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const release = () => FileSystem.deleteAsync(directory, { idempotent: true });
  const downloads = new Map<string, Promise<string>>();
  const localImage = (uri: string): Promise<string> => {
    if (!/^https?:\/\//i.test(uri)) return Promise.resolve(uri);
    const existing = downloads.get(uri);
    if (existing) return existing;
    const destination = `${directory}image-${downloads.size}`;
    const pending = downloadImage(uri, destination).catch(error => {
      // Native download errors can include signed URLs; expose only a safe message.
      throw new Error(error instanceof Error && error.message === 'Vision image loading timed out. Please try again.'
        ? error.message : 'A Vision image could not be downloaded.');
    }).then(async result => {
      if (!result) throw new Error('Vision image loading was cancelled. Please try again.');
      if (result.status < 200 || result.status >= 300) throw new VisionShareAssetError('A Vision image could not be downloaded.', [401, 403, 404].includes(result.status));
      const file = await FileSystem.getInfoAsync(result.uri);
      if (!file.exists || file.isDirectory || file.size === 0) throw new Error('A Vision image download was empty.');
      return result.uri;
    });
    downloads.set(uri, pending);
    return pending;
  };
  try {
    const background = getVisionShareBackground(backgroundId);
    const backgroundUri = Image.resolveAssetSource(background.source)?.uri;
    if (!backgroundUri) throw new Error('The full-resolution Vision background is unavailable.');
    const tiles = data.visionTiles;
    if (tiles?.some(tile => !tile.imageUrl?.trim())) throw new VisionShareAssetError('A Vision photograph is missing. Refresh Vision and try again.', true);
    const [localBackground, localAnchor, legacyPhoto, localTiles] = await Promise.all([
      localImage(backgroundUri),
      showMark && data.imageUrl ? localImage(data.imageUrl) : data.imageUrl,
      !tiles?.length && data.visionImageUrl ? localImage(data.visionImageUrl) : null,
      tiles ? Promise.all(tiles.map(async tile => ({ ...tile, imageUrl: await localImage(tile.imageUrl!.trim()) }))) : tiles,
    ]);
    return {
      data: { ...data, imageUrl: localAnchor, visionImageUrl: legacyPhoto ?? localTiles?.[0]?.imageUrl ?? data.visionImageUrl,
        visionTiles: localTiles },
      backgroundSource: /^https?:\/\//i.test(backgroundUri) ? { uri: localBackground } : background.source,
      release,
    };
  } catch (error) {
    // Wait for sibling downloads before deleting this export's private folder.
    await Promise.allSettled(downloads.values());
    await release().catch(() => undefined);
    throw error;
  }
}

/** Recover expired signed photo links once, preserving the selected board's content and order. */
export async function prepareVisionShareAssets(data: ShareExportData, backgroundId?: string | null, showMark = true): Promise<PreparedVisionShareAssets> {
  try {
    return await stageVisionShareAssets(data, backgroundId, showMark);
  } catch (error) {
    if (!data.anchorId || !(error instanceof VisionShareAssetError) || !error.refreshable) throw error;
    let fresh: VisionReadModel | null;
    try {
      fresh = visionApiData<VisionReadModel | null>(await apiClient.get(`/api/v2/anchors/${encodeURIComponent(data.anchorId)}/vision`));
    } catch {
      throw new Error('Vision photos could not be refreshed. Reopen Vision and try again.');
    }
    if (!fresh || fresh.anchorId !== data.anchorId || fresh.status !== 'ACTIVE') throw error;
    const activeScenes = fresh.scenes.filter(scene => !scene.isArchived);
    const urls = new Map(activeScenes.map(scene => [scene.id, scene.resolvedImageUrl]));
    const tiles = data.visionTiles?.map(tile => ({ ...tile, imageUrl: urls.get(tile.sceneId) ?? null }));
    const legacyUrl = tiles?.length ? tiles[0].imageUrl : activeScenes.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]?.resolvedImageUrl;
    return stageVisionShareAssets({ ...data, visionTiles: tiles, visionImageUrl: legacyUrl ?? data.visionImageUrl }, backgroundId, showMark);
  }
}
