import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useToast } from '@/components/ToastProvider';
import { ExportPreviewRenderer, EXPORT_DIMENSIONS } from '@/components/ExportPreviewRenderer';
import ShareCardRenderer, { type ShareCardRendererRef } from '@/components/ShareCardRenderer';
import { useShareCard } from '@/hooks/useShareCard';
import { useSessionStore } from '@/stores/sessionStore';
import { requestPhotoLibrarySavePermission, savePngToPhotoLibrary } from '@/services/AnchorArtworkExportService';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';

type ExportAnchor = Pick<Anchor, 'id' | 'localId' | 'intentionText' | 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl'>;

function localDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * The three things the Details options menu does with an Anchor's artwork:
 * share a card, save a wallpaper PNG, and copy the intention. Each reuses the
 * existing pipeline (share card capture, photo-library save + share sheet,
 * clipboard); this only moves their triggers out of the scrolling body.
 *
 * `hiddenNodes` holds the off-screen capture targets and must be rendered once
 * by the host screen.
 */
export function useAnchorExportActions(anchor: ExportAnchor | null) {
  const toast = useToast();
  const practiceHistory = useSessionStore((s) => s.practiceHistory);

  // The share card prints a "days" figure; count the distinct days this Anchor was practised.
  const daysPracticed = useMemo(() => {
    if (!anchor) return 0;
    const days = new Set<string>();
    for (const session of practiceHistory) {
      if (session.anchorId === anchor.id || session.anchorLocalId === (anchor.localId ?? anchor.id)) {
        days.add(localDayKey(session.completedAt));
      }
    }
    return days.size;
  }, [anchor, practiceHistory]);

  // ── Share card ──
  const shareCardRef = useRef<ShareCardRendererRef | null>(null);
  const shareCardRenderedRef = useRef(false);
  const shareCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const { captureAndShare, isLoading: isSharing, setIsRendered } = useShareCard(shareCardRef, shareCardRenderedRef);

  useEffect(() => () => {
    if (shareCardTimeoutRef.current) clearTimeout(shareCardTimeoutRef.current);
  }, []);

  const share = useCallback(() => {
    if (!anchor || isSharing) return;
    if (shareCardTimeoutRef.current) clearTimeout(shareCardTimeoutRef.current);
    shareCardRenderedRef.current = false;
    setIsRendered(false);
    setShowShareCard(true);
    shareCardTimeoutRef.current = setTimeout(async () => {
      try {
        await captureAndShare(anchor.intentionText, daysPracticed, 'square');
      } finally {
        setShowShareCard(false);
        shareCardRenderedRef.current = false;
        setIsRendered(false);
        shareCardTimeoutRef.current = null;
      }
    }, 250);
  }, [anchor, captureAndShare, daysPracticed, isSharing, setIsRendered]);

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
      {showShareCard ? (
        <ShareCardRenderer
          ref={shareCardRef}
          anchorSVG={anchorArtworkSvg(anchor)}
          artworkUri={anchor.enhancedImageUrl}
          intention={anchor.intentionText}
          daysPrimed={daysPracticed}
          format="square"
          onRenderReady={() => {
            shareCardRenderedRef.current = true;
            setIsRendered(true);
          }}
        />
      ) : null}
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

  return { share, saveWallpaper, copyIntention, isSharing, isSavingWallpaper: wallpaperPending, hiddenNodes };
}
