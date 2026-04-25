import { useCallback, useState, type RefObject } from 'react';
import { Share } from 'react-native';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { ShareCardRendererRef } from '@/components/ShareCardRenderer';

type ShareCardFormat = 'square' | 'story';

interface CaptureAndShareOptions {
  intention?: string;
  daysPrimed?: number;
  format?: ShareCardFormat;
}

export function useShareCard(shareCardRef: RefObject<ShareCardRendererRef | null>) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const captureAndShare = useCallback(async (options?: CaptureAndShareOptions) => {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      const uri = await shareCardRef.current?.capture();
      if (!uri) {
        throw new Error('Unable to capture share card.');
      }

      const format = options?.format ?? 'square';
      const intention = options?.intention?.trim() || 'My Anchor';
      const daysPrimed = Math.max(0, options?.daysPrimed ?? 0);
      const message = `${intention} · ${daysPrimed} days primed`;

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
  }, [isLoading, shareCardRef, toast]);

  return { captureAndShare, isLoading };
}
