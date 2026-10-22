import type { ViewInstance } from 'react-native';
import { PixelRatio, Platform, Share, type View } from 'react-native';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { requestPhotoLibrarySavePermission, savePngToPhotoLibrary } from './AnchorArtworkExportService';
import { ServiceError } from './ServiceErrors';
import { SHARE_ASPECT, SHARE_EXPORT_SIZE, type ShareLayoutId } from '@/components/share/shareTypes';

/**
 * Where a share export is rendered. The export node is laid out at
 * 1080 / pixelRatio dp, so its native bitmap is already 1080 px wide and the
 * capture is a 1:1 read, never an upscaled screenshot of the on-screen preview.
 */
export function resolveExportRenderSize(pixelRatio: number = PixelRatio.get()) {
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const width = SHARE_EXPORT_SIZE.width / ratio;
  return { width, height: width * SHARE_ASPECT };
}

/**
 * view-shot's width/height are pixels on Android and points on iOS (where the
 * device scale is applied on top), so the request is expressed per platform.
 */
export function resolveCaptureRequest(pixelRatio: number = PixelRatio.get(), os: string = Platform.OS) {
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const divisor = os === 'ios' ? ratio : 1;
  return {
    width: Math.round(SHARE_EXPORT_SIZE.width / divisor),
    height: Math.round(SHARE_EXPORT_SIZE.height / divisor),
  };
}

export async function captureShareExport(target: RefObject<ViewInstance | null>): Promise<string> {
  if (!target.current) {
    throw new ServiceError('artwork/export-failed', 'The export is not ready.');
  }
  const { width, height } = resolveCaptureRequest();
  try {
    return await captureRef(target, { format: 'png', quality: 1, result: 'tmpfile', width, height });
  } catch (error) {
    throw new ServiceError('artwork/export-failed', 'Unable to generate your anchor image right now.', error);
  }
}

export function shareExportFilename(layout: ShareLayoutId): string {
  return `anchor-${layout}-1080x1920.png`;
}

export type SaveExportResult = 'saved' | 'permission-denied';

/** Saves a rendered export to the photo library, asking for permission only when the OS needs it. */
export async function saveShareExport(uri: string, layout: ShareLayoutId): Promise<SaveExportResult> {
  let granted: boolean;
  try {
    granted = await requestPhotoLibrarySavePermission();
  } catch (error) {
    throw new ServiceError('artwork/permission-failed', 'Unable to request photo library access right now.', error);
  }
  if (!granted) return 'permission-denied';
  try {
    await savePngToPhotoLibrary(uri, shareExportFilename(layout));
  } catch (error) {
    throw new ServiceError('artwork/save-failed', 'Unable to save this image to your photo library.', error);
  }
  return 'saved';
}

/** Opens the native share sheet with the PNG. No in-app social buttons: the OS lists the installed apps. */
export async function sharePngViaSystemSheet(uri: string): Promise<void> {
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your Anchor' });
      return;
    }
    await Share.share({ url: uri });
  } catch (error) {
    throw new ServiceError('artwork/share-failed', 'Unable to open the share sheet right now.', error);
  }
}
