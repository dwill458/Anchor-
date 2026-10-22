// @ts-nocheck
import { useCallback, useState } from 'react';
import { captureRef } from 'react-native-view-shot';
import { EXPORT_DIMENSIONS } from '@/components/ExportPreviewRenderer';
import {
  requestPhotoLibrarySavePermission,
  savePngToPhotoLibrary,
} from '@/services/AnchorArtworkExportService';

const SIZE_ESTIMATES = {
  square:    { standard: 350_000,   high: 2_800_000 },
  wallpaper: { standard: 600_000,   high: 4_800_000 },
  print:     { standard: 1_200_000, high: 9_600_000 },
};

export function useDownloadAnchor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Captures the (off-screen) export view and saves it to the photo library.
   * What the view contains is decided by `ExportPreviewRenderer`:
   * `background` ('card' | 'clear') and `showIntention` are passed to it, and
   * only select the filename here: a 'clear' export keeps its alpha channel
   * because `captureRef` is asked for PNG.
   */
  const downloadAnchor = useCallback(
    async (viewRef, format, resolution, background = 'card', showIntention = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const hasPermission = await requestPhotoLibrarySavePermission();
        if (!hasPermission) {
          setError('Photos permission required. Enable in Settings.');
          return null;
        }

        // Exact pixel size: without width/height the capture scales with the device density.
        const target = EXPORT_DIMENSIONS[format][resolution];
        const uri = await new Promise((resolve, reject) => {
          requestAnimationFrame(() => {
            captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile', width: target.w, height: target.h })
              .then(resolve)
              .catch(reject);
          });
        });

        const suffix = [background === 'clear' ? 'clear' : null, showIntention ? null : 'mark']
          .filter(Boolean)
          .join('-');
        const savedUri = await savePngToPhotoLibrary(
          uri,
          `anchor-${format}${suffix ? `-${suffix}` : ''}.png`,
        );

        const size = SIZE_ESTIMATES[format]?.[resolution] ?? 500_000;
        return { uri: savedUri, size };
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
