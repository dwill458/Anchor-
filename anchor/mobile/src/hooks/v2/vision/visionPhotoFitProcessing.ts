import { Image } from 'react-native';
import { FilterMode, ImageFormat, MipmapMode, Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { computeFitCanvas, VISION_FIT_PAPER } from '@/components/v2/vision/visionPhotoFit';
import { visionApiData } from './visionApi';

/** The processing half of Smart Photo Fit. The original file is never written to: every result is a new cache file. */
export type FitPhoto = { uri: string; mimeType: string; /** The picker's name for the file; only used to recognise screenshots. */ fileName?: string | null };
export type PhotoCrop = { originX: number; originY: number; width: number; height: number };

/** Longest edge sent for expansion: keeps the upload well under the server's 5 MB image limit. */
const EXPAND_UPLOAD_EDGE = 1600;
const SIZE_TIMEOUT_MS = 4000;
/** The expansion runs the image model synchronously on the server, so it needs more than the default 120s client budget. */
const EXPAND_TIMEOUT_MS = 180_000;

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
  /** `cancelled`: the person stopped it. Nothing failed, so nothing is reported. */
  | { ok: false; message: string; premiumRequired?: boolean; cancelled?: boolean };

const EXPAND_MESSAGES: Record<string, string> = {
  VISION_PHOTO_EXPAND_TOO_WIDE: 'This photo is too far from your Vision frame to expand naturally. Try cropping it instead.',
  VISION_PHOTO_EXPAND_NOT_NEEDED: 'This photo already fits your Vision frame.',
};

/**
 * Asks the server to extend the photo into the Vision's 9:16 frame. A preview only: nothing is stored
 * server-side, and the result is written to a cache file the caller deletes if the person declines it.
 */
export async function requestPhotoExpansion(photo: FitPhoto, size: { width: number; height: number }, signal?: AbortSignal): Promise<ExpandResult> {
  let scratch: string | null = null;
  const stopped = (): ExpandResult => ({ ok: false, message: 'Stopped.', cancelled: true });
  try {
    if (signal?.aborted) return stopped();
    const longEdge = Math.max(size.width, size.height);
    const prepared = await ImageManipulator.manipulateAsync(
      photo.uri,
      longEdge > EXPAND_UPLOAD_EDGE ? [{ resize: size.width >= size.height ? { width: EXPAND_UPLOAD_EDGE } : { height: EXPAND_UPLOAD_EDGE } }] : [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    scratch = prepared.uri;
    if (!prepared.base64) return { ok: false, message: 'The photo could not be prepared. Please try again.' };
    if (signal?.aborted) return stopped();
    const response = await apiClient.post('/api/v2/vision/photo-expand', { base64Image: `data:image/jpeg;base64,${prepared.base64}`, mimeType: 'image/jpeg' }, { signal, timeout: EXPAND_TIMEOUT_MS });
    const data = visionApiData<{ imageBase64?: string } | null>(response);
    const encoded = data?.imageBase64?.replace(/^data:image\/jpeg;base64,/, '');
    if (!encoded) return { ok: false, message: 'The expanded photo could not be created. You can keep or crop your original.' };
    // Stopped while the answer was on its way back: nothing is written.
    if (signal?.aborted) return stopped();
    const target = `${FileSystem.cacheDirectory}vision-expanded-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(target, encoded, { encoding: FileSystem.EncodingType.Base64 });
    return { ok: true, photo: { uri: target, mimeType: 'image/jpeg' } };
  } catch (cause) {
    if (signal?.aborted || (cause as { code?: string; name?: string } | null)?.code === 'ERR_CANCELED' || (cause as { name?: string } | null)?.name === 'CanceledError') return stopped();
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
  return /\/ImageManipulator\//.test(uri) || /\/vision-(expanded|fitted)-\d+\.jpg$/.test(uri);
}

/** Deletes a cache file this flow created. Anything else is left alone. */
export async function discardTemporaryPhoto(uri: string | null | undefined): Promise<void> {
  if (!uri || !isFitTemporaryFile(uri)) return;
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* a stale cache file is harmless */ }
}

/**
 * Fits the whole photograph onto neutral paper in the Vision's 9:16 frame, on the device and without AI: the photograph
 * is scaled to fit and centred, never cropped or stretched, and the rest is the Vision's cream. For screenshots and
 * anything with lettering, where a generated edge could invent or garble words. Like every result here it is a new cache
 * file; the original is never written to.
 */
export async function fitPhotoOnPaper(photo: FitPhoto): Promise<ExpandResult> {
  let normalised: string | null = null;
  try {
    // One pass through the manipulator applies the photograph's orientation, so Skia and the screen agree on its shape.
    const upright = await ImageManipulator.manipulateAsync(photo.uri, [], { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG });
    normalised = upright.uri;
    const data = await Skia.Data.fromURI(upright.uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    const plan = image ? computeFitCanvas({ width: image.width(), height: image.height() }) : null;
    if (!image || !plan) return { ok: false, message: 'The photo could not be prepared. You can keep or crop your original.' };
    const surface = Skia.Surface.Make(plan.canvas.width, plan.canvas.height) ?? Skia.Surface.MakeOffscreen?.(plan.canvas.width, plan.canvas.height);
    if (!surface) return { ok: false, message: 'The photo could not be prepared. You can keep or crop your original.' };
    const canvas = surface.getCanvas();
    canvas.drawColor(Skia.Color(VISION_FIT_PAPER));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRectOptions(
      image, Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(plan.draw.x, plan.draw.y, plan.draw.width, plan.draw.height), FilterMode.Linear, MipmapMode.Nearest, paint,
    );
    surface.flush?.();
    const encoded = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 92);
    if (!encoded) return { ok: false, message: 'The photo could not be prepared. You can keep or crop your original.' };
    const target = `${FileSystem.cacheDirectory}vision-fitted-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(target, encoded, { encoding: FileSystem.EncodingType.Base64 });
    return { ok: true, photo: { uri: target, mimeType: 'image/jpeg' } };
  } catch {
    return { ok: false, message: 'The photo could not be fitted. You can keep or crop your original.' };
  } finally {
    if (normalised && normalised !== photo.uri) void discardTemporaryPhoto(normalised);
  }
}
