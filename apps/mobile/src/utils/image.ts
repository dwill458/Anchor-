import { Image as ExpoImage } from 'expo-image';

const prefetched = new Set<string>();

type PrefetchOptions = {
  limit?: number;
  cachePolicy?: 'disk' | 'memory-disk' | 'memory';
  headers?: Record<string, string>;
};

export const prefetchImages = async (
  uris: Array<string | null | undefined>,
  options: number | PrefetchOptions = 6
): Promise<void> => {
  const resolvedOptions: PrefetchOptions = typeof options === 'number' ? { limit: options } : options;
  const limit = resolvedOptions.limit ?? 6;

  const uniqueUris = uris
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0 && !prefetched.has(uri));

  if (uniqueUris.length === 0) return;

  const targets = uniqueUris.slice(0, limit);
  await Promise.all(
    targets.map(async (uri) => {
      prefetched.add(uri);
      try {
        await ExpoImage.prefetch(uri, {
          cachePolicy: resolvedOptions.cachePolicy ?? 'memory-disk',
          headers: resolvedOptions.headers,
        });
      } catch {
        // Avoid retry storms on flaky networks.
      }
    })
  );
};
