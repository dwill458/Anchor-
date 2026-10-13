import { Image, type ImageSourcePropType } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getVisionShareBackground } from './visionShareBackgrounds';
import type { ShareExportData } from './shareTypes';

export type PreparedVisionShareAssets = {
  data: ShareExportData;
  backgroundSource: ImageSourcePropType;
  release: () => Promise<void>;
};

/** Stage the original bytes once. The capture tree never fetches remote images. */
export async function prepareVisionShareAssets(data: ShareExportData, backgroundId?: string | null): Promise<PreparedVisionShareAssets> {
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
    const pending = FileSystem.downloadAsync(uri, destination).catch(() => {
      // Native download errors can include signed URLs; expose only a safe message.
      throw new Error('A Vision image could not be downloaded.');
    }).then(async result => {
      if (result.status < 200 || result.status >= 300) throw new Error('A Vision image could not be downloaded.');
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
    if (tiles?.some(tile => !tile.imageUrl?.trim())) throw new Error('A Vision photograph is missing. Refresh Vision and try again.');
    const [localBackground, localAnchor, legacyPhoto, localTiles] = await Promise.all([
      localImage(backgroundUri),
      data.imageUrl ? localImage(data.imageUrl) : null,
      !tiles?.length && data.visionImageUrl ? localImage(data.visionImageUrl) : null,
      tiles ? Promise.all(tiles.map(async tile => ({ ...tile, imageUrl: await localImage(tile.imageUrl!.trim()) }))) : tiles,
    ]);
    return {
      data: { ...data, imageUrl: localAnchor, visionImageUrl: legacyPhoto ?? localTiles?.[0]?.imageUrl ?? data.visionImageUrl,
        visionTiles: localTiles },
      backgroundSource: { uri: localBackground },
      release,
    };
  } catch (error) {
    // Wait for sibling downloads before deleting this export's private folder.
    await Promise.allSettled(downloads.values());
    await release().catch(() => undefined);
    throw error;
  }
}
