import { useState } from 'react';
import type React from 'react';
import { Share } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

export function useWeeklyShare(viewShotRef: React.RefObject<ViewShot | null>) {
  const [isCapturing, setIsCapturing] = useState(false);

  const shareWeek = async () => {
    if (isCapturing || !viewShotRef.current) {
      return;
    }

    setIsCapturing(true);

    try {
      const uri = await captureRef(viewShotRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        fileName: 'anchor-weekly-share-card',
        width: 1080,
        height: 1080,
      });
      if (!uri) {
        throw new Error('Unable to capture weekly share card.');
      }
      const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;

      try {
        const Sharing = await import('expo-sharing');
        const canShareFiles = await Sharing.isAvailableAsync();

        if (canShareFiles) {
          await Sharing.shareAsync(normalizedUri, {
            dialogTitle: 'Share This Week',
            mimeType: 'image/png',
            UTI: 'public.png',
          });
          return;
        }
      } catch (sharingError) {
        console.warn('[WeeklyShare] expo-sharing unavailable, falling back to Share.share', sharingError);
      }

      await Share.share({
        title: 'Share This Week',
        url: normalizedUri,
      });
    } catch (e) {
      console.warn('[WeeklyShare] capture failed', e);
    } finally {
      setIsCapturing(false);
    }
  };

  return { shareWeek, isCapturing };
}
