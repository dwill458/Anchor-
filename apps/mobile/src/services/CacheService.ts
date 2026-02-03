/**
 * Anchor App - Cache Service
 *
 * Handles clearing non-essential cached files and image caches.
 */

import { Image as ExpoImage } from 'expo-image';
import * as FileSystem from 'expo-file-system';

const TEMP_DIR_NAMES = [
  'tmp',
  'temp',
  'cache',
  'ai-temp',
  'ai-output',
  'ai-cache',
];

const buildDocumentTargets = (): string[] => {
  const base = FileSystem.documentDirectory;
  if (!base) return [];
  return TEMP_DIR_NAMES.map((name) => `${base}${name}/`);
};

const clearExpoImageCaches = async (): Promise<void> => {
  const imageModule = ExpoImage as unknown as {
    clearDiskCache?: () => Promise<void>;
    clearMemoryCache?: () => Promise<void>;
  };

  if (typeof imageModule.clearMemoryCache === 'function') {
    await imageModule.clearMemoryCache();
  }

  if (typeof imageModule.clearDiskCache === 'function') {
    await imageModule.clearDiskCache();
  }
};

export interface CacheClearResult {
  cleared: string[];
  failed: string[];
}

export const CacheService = {
  async clearLocalCache(): Promise<CacheClearResult> {
    const targets = [FileSystem.cacheDirectory, ...buildDocumentTargets()];
    const cleared: string[] = [];
    const failed: string[] = [];

    for (const target of targets) {
      if (!target) continue;
      try {
        await FileSystem.deleteAsync(target, { idempotent: true });
        cleared.push(target);
      } catch {
        failed.push(target);
      }
    }

    try {
      await clearExpoImageCaches();
    } catch {
      // Ignore image cache failures to avoid blocking cache clear.
    }

    return { cleared, failed };
  },
};
