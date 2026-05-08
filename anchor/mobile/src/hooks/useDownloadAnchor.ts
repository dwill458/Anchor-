// @ts-nocheck
import { useCallback, useState } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

const SIZE_ESTIMATES = {
  square:    { standard: 350_000,   high: 2_800_000 },
  wallpaper: { standard: 600_000,   high: 4_800_000 },
  print:     { standard: 1_200_000, high: 9_600_000 },
};

export function useDownloadAnchor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const downloadAnchor = useCallback(
    async (viewRef, format, resolution, transparentBG) => {
      setIsLoading(true);
      setError(null);

      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.status !== 'granted') {
          setError('Photos permission required. Enable in Settings.');
          return null;
        }

        const uri = await new Promise((resolve, reject) => {
          requestAnimationFrame(() => {
            captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile', pixelRatio: 1 })
              .then(resolve)
              .catch(reject);
          });
        });

        await MediaLibrary.saveToLibraryAsync(uri);

        const size = SIZE_ESTIMATES[format]?.[resolution] ?? 500_000;
        return { uri, size };
      } catch {
        setError('Export failed. Please try again.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { downloadAnchor, isLoading, error };
}
