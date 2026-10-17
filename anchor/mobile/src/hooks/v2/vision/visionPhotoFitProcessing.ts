import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { visionApiData } from './visionApi';

/** The processing half of Smart Photo Fit. The original file is never written to: every result is a new cache file. */
export type FitPhoto = { uri: string; mimeType: string };
export type PhotoCrop = { originX: number; originY: number; width: number; height: number };

/** Longest edge sent for expansion: keeps the upload well under the server's 5 MB image limit. */
const EXPAND_UPLOAD_EDGE = 1600;
const SIZE_TIMEOUT_MS = 4000;

/** Real pixel dimensions of a picked photo, or null when they cannot be read in time (the photo is then used as before). */
export function readPhotoSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), SIZE_TIMEOUT_MS);
    try {
      Image.getSize(uri, (width, height) => { clearTimeout(timer); resolve(width > 0 && height > 0 ? { width, height } : null); },
        () => { clearTimeout(timer); resolve(null); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Crops locally to the chosen rectangle. Off the JS thread (native), and never stretches. */
export async function cropPhoto(uri: string, crop: PhotoCrop): Promise<FitPhoto> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: result.uri, mimeType: 'image/jpeg' };
}

export type ExpandResult =
  | { ok: true; photo: FitPhoto }
  | { ok: false; message: string; premiumRequired?: boolean };

const EXPAND_MESSAGES: Record<string, string> = {
  VISION_PHOTO_EXPAND_TOO_WIDE: 'This photo is too far from your Vision frame to expand naturally. Try cropping it instead.',
  VISION_PHOTO_EXPAND_NOT_NEEDED: 'This photo already fits your Vision frame.',
};

/**
 * Asks the server to extend the photo into the Vision's 9:16 frame. A preview only: nothing is stored
 * server-side, and the result is written to a cache file the caller deletes if the person declines it.
 */
export async function requestPhotoExpansion(photo: FitPhoto, size: { width: number; height: number }): Promise<ExpandResult> {
  let scratch: string | null = null;
  try {
    const longEdge = Math.max(size.width, size.height);
    const prepared = await ImageManipulator.manipulateAsync(
      photo.uri,
      longEdge > EXPAND_UPLOAD_EDGE ? [{ resize: size.width >= size.height ? { width: EXPAND_UPLOAD_EDGE } : { height: EXPAND_UPLOAD_EDGE } }] : [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    scratch = prepared.uri;
    if (!prepared.base64) return { ok: false, message: 'The photo could not be prepared. Please try again.' };
    const response = await apiClient.post('/api/v2/vision/photo-expand', { base64Image: `data:image/jpeg;base64,${prepared.base64}`, mimeType: 'image/jpeg' });
    const data = visionApiData<{ imageBase64?: string } | null>(response);
    const encoded = data?.imageBase64?.replace(/^data:image\/jpeg;base64,/, '');
    if (!encoded) return { ok: false, message: 'The expanded photo could not be created. You can keep or crop your original.' };
    const target = `${FileSystem.cacheDirectory}vision-expanded-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(target, encoded, { encoding: FileSystem.EncodingType.Base64 });
    return { ok: true, photo: { uri: target, mimeType: 'image/jpeg' } };
  } catch (cause) {
    if (cause instanceof ApiClientError) {
      if (cause.code === 'VISION_PREMIUM_REQUIRED') return { ok: false, message: 'Expanding with AI is part of Anchor Pro.', premiumRequired: true };
      if (cause.code && EXPAND_MESSAGES[cause.code]) return { ok: false, message: EXPAND_MESSAGES[cause.code] };
    }
    return { ok: false, message: 'Expanding with AI is unavailable right now. You can keep or crop your original.' };
  } finally {
    if (scratch && scratch !== photo.uri) void discardTemporaryPhoto(scratch);
  }
}

/** True only for files this flow writes (manipulator outputs and expansion previews), never the picker's copy or the original. */
export function isFitTemporaryFile(uri: string): boolean {
  return /\/ImageManipulator\//.test(uri) || /\/vision-expanded-\d+\.jpg$/.test(uri);
}

/** Deletes a cache file this flow created. Anything else is left alone. */
export async function discardTemporaryPhoto(uri: string | null | undefined): Promise<void> {
  if (!uri || !isFitTemporaryFile(uri)) return;
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* a stale cache file is harmless */ }
}
