import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useToast } from '@/components/ToastProvider';
import { ExportPreviewRenderer, EXPORT_DIMENSIONS } from '@/components/ExportPreviewRenderer';
import { buildShareExportData } from '@/components/share/shareData';
import { useShareExportRenderer } from '@/components/share/useShareExportRenderer';
import { requestPhotoLibrarySavePermission, savePngToPhotoLibrary } from '@/services/AnchorArtworkExportService';
import { saveShareExport } from '@/services/anchorExportService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { v2Haptics } from '@/hooks/v2/haptics';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';

type ExportAnchor = Pick<
  Anchor,
  'id' | 'localId' | 'intentionText' | 'category' | 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl' | 'classifierMeta' | 'enhancementMetadata'
>;

export type ShareExtras = {
  /** The Anchor's actual Vision image, if it has one. Without it the Vision layout is not offered. */
  visionImageUrl?: string | null;
  /** The Anchor's current state word ("Building"), if it has an established thread. */
  stateLabel?: string | null;
};

/**
 * What the Details options menu does with an Anchor's artwork:
 * - `shareData` feeds Share Studio (the host opens it from "Share anchor");
 * - `downloadPng` renders the Minimal layout at 1080 x 1920 and saves it directly;
 * - `saveWallpaper` and `copyIntention` are unchanged.
 *
 * `hiddenNodes` holds the off-screen capture targets and must be rendered once
 * by the host screen.
 */
export function useAnchorExportActions(anchor: ExportAnchor | null, extras: ShareExtras = {}) {
  const toast = useToast();
  const { visionImageUrl, stateLabel } = extras;

  const shareData = useMemo(
    () => (anchor ? buildShareExportData(anchor, { visionImageUrl, stateLabel }) : null),
    [anchor, visionImageUrl, stateLabel],
  );

  // ── Download PNG: Minimal, straight to Photos ──
  const { renderPng, exportNode: downloadNode } = useShareExportRenderer(shareData);
  const [downloadPending, setDownloadPending] = useState(false);

  /** Resolves to true when the PNG reached the photo library. */
  const downloadPng = useCallback(async (): Promise<boolean> => {
    if (!anchor || downloadPending) return false;
    setDownloadPending(true);
    try {
      const uri = await renderPng('minimal', true);
      const result = await saveShareExport(uri, 'minimal');
      if (result === 'permission-denied') {
        void v2Haptics.warning();
        toast.warning('Allow photo library access to save your anchor');
        return false;
      }
      void v2Haptics.confirmation();
      AnalyticsService.track(AnalyticsEvents.ANCHOR_EXPORT_SAVED, { layout: 'minimal', source: 'download_png' });
      return true;
    } catch (error) {
      logger.warn('[AnchorDetails] download PNG failed', error);
      toast.error('Could not save the image');
      return false;
    } finally {
      setDownloadPending(false);
    }
  }, [anchor, downloadPending, renderPng, toast]);

  // ── Wallpaper ──
  const wallpaperRef = useRef<View | null>(null);
  const [wallpaperPending, setWallpaperPending] = useState(false);

  const saveWallpaper = useCallback(async () => {
    if (!anchor || wallpaperPending) return;
    try {
      const granted = await requestPhotoLibrarySavePermission();
      if (!granted) {
        toast.warning('Allow photo library access to share your anchor');
        return;
      }
    } catch {
      toast.warning('Allow photo library access to share your anchor');
      return;
    }
    setWallpaperPending(true);
  }, [anchor, toast, wallpaperPending]);

  useEffect(() => {
    if (!wallpaperPending) return undefined;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (cancelled) return;
          try {
            if (!wallpaperRef.current) throw new Error('Wallpaper target is not mounted.');
            const uri = await captureRef(wallpaperRef, { format: 'png', quality: 1, result: 'tmpfile', width: EXPORT_DIMENSIONS.wallpaper.standard.w, height: EXPORT_DIMENSIONS.wallpaper.standard.h });
            const savedUri = await savePngToPhotoLibrary(uri, 'anchor-wallpaper.png');
            await Share.share({ url: savedUri });
            toast.info('Save the image, then set it as your wallpaper in Settings');
          } catch (error) {
            logger.warn('[AnchorDetails] wallpaper export failed', error);
            toast.error('Could not open share sheet');
          } finally {
            if (!cancelled) setWallpaperPending(false);
          }
        });
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [toast, wallpaperPending]);

  // ── Copy ──
  const copyIntention = useCallback(async (): Promise<boolean> => {
    const text = anchor?.intentionText?.trim();
    if (!text) return false;
    try {
      // Required lazily: a dev client built before expo-clipboard was added throws on import.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      return true;
    } catch (error) {
      // An older dev client was built before expo-clipboard was added.
      logger.warn('[AnchorDetails] copy intention failed', error);
      toast.error('Could not copy the intention');
      return false;
    }
  }, [anchor?.intentionText, toast]);

  const hiddenNodes = anchor ? (
    <>
      {downloadNode}
      {wallpaperPending ? (
        <ExportPreviewRenderer
          ref={wallpaperRef}
          format="wallpaper"
          resolution="standard"
          background="card"
          showIntention
          sigilSvg={anchorArtworkSvg(anchor)}
          sigilUri={anchor.enhancedImageUrl ?? undefined}
          intention={anchor.intentionText}
        />
      ) : null}
    </>
  ) : null;

  return {
    shareData,
    downloadPng,
    saveWallpaper,
    copyIntention,
    isDownloading: downloadPending,
    isSavingWallpaper: wallpaperPending,
    hiddenNodes,
  };
}
