import { useCallback, useState, type RefObject } from 'react';
import { Share } from 'react-native';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { ShareCardFormat, ShareCardRendererRef } from '@/components/ShareCardRenderer';

const CAPTURE_OPTIONS: Record<ShareCardFormat, { width: number; height: number; quality: number }> = {
  square: { width: 1080, height: 1080, quality: 0.95 },
  stories: { width: 1170, height: 2532, quality: 0.82 },
};

export function useShareCard(
  shareCardRef: RefObject<ShareCardRendererRef | null>,
  isRenderedRef?: RefObject<boolean | null>
) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  const captureAndShare = useCallback(
    async (
      intention?: string,
      daysPrimed?: number,
      format: ShareCardFormat = 'square'
    ) => {
      if (isLoading) {
        return;
      }

      try {
        setIsLoading(true);

        const hasRendered = isRenderedRef?.current ?? isRendered;
        if (!hasRendered) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        if (!shareCardRef.current) {
          throw new Error('Share card is not mounted.');
        }

        const captureOptions = CAPTURE_OPTIONS[format];
        const uri = await shareCardRef.current?.capture({
          format: 'png',
          width: captureOptions.width,
          height: captureOptions.height,
          quality: captureOptions.quality,
        });
        if (!uri) {
          throw new Error('Unable to capture share card.');
        }

        const normalizedIntention = intention?.trim() || 'My Anchor';
        const normalizedDaysPrimed = Math.max(0, daysPrimed ?? 0);
        const message = `${normalizedIntention} · ${normalizedDaysPrimed} days primed`;

        AnalyticsService.track('shareCard_initiated', { format });

        const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;

        try {
          const Sharing = await import('expo-sharing');
          const canShareFiles = await Sharing.isAvailableAsync();

          if (canShareFiles) {
            await Sharing.shareAsync(normalizedUri, {
              dialogTitle: 'Share My Anchor',
              mimeType: 'image/png',
              UTI: 'public.png',
            });
            return;
          }
        } catch (sharingError) {
          console.warn('[useShareCard] expo-sharing unavailable, falling back to Share.share', sharingError);
        }

        await Share.share({
          title: 'Share My Anchor',
          message,
          url: normalizedUri,
        });
      } catch (error) {
        console.error('[useShareCard] Failed to capture/share anchor card', error);
        toast.error('Unable to create share card. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, shareCardRef, toast]
  );

  return { captureAndShare, isLoading, isRendered, setIsRendered };
}
