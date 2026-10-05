import { Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { subjectFocusFromPixels, type PhotoFocus } from './cinematicPhotoMotion';

const cache = new WeakMap<SkImage, PhotoFocus | null>();
const backdrops = new WeakMap<SkImage, SkImage | null>();

/** Small static texture: Gaussian blur is paid once before Begin, never each animation frame. */
export function preparePhotoBackdrop(image: SkImage): SkImage | null {
  if (backdrops.has(image)) return backdrops.get(image) ?? null;
  let result: SkImage | null = null;
  try {
    const scale = Math.min(1, 384 / Math.max(image.width(), image.height()));
    const width = Math.max(1, Math.round(image.width() * scale)), height = Math.max(1, Math.round(image.height() * scale));
    const surface = Skia.Surface.Make(width, height);
    if (surface) {
      try {
        const paint = Skia.Paint();
        paint.setImageFilter(Skia.ImageFilter.MakeBlur(8, 8, TileMode.Clamp));
        surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(0, 0, width, height), paint);
        surface.flush();
        result = surface.makeImageSnapshot();
        paint.dispose();
      } finally { surface.dispose(); }
    }
  } catch { /* A solid navy surround is the inexpensive fallback. */ }
  backdrops.set(image, result);
  return result;
}

/** Runs once during asset preparation, reading just 48x48 pixels locally. */
export function preparePhotoFocus(image: SkImage): PhotoFocus | null {
  if (cache.has(image)) return cache.get(image) ?? null;
  let focus: PhotoFocus | null = null;
  try {
    // Preparation runs on JS; use a CPU surface rather than relying on a GPU context there.
    const surface = Skia.Surface.Make(48, 48);
    if (surface) {
      try {
        surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(0, 0, 48, 48), Skia.Paint());
        surface.flush();
        const snapshot = surface.makeImageSnapshot();
        try { const pixels = snapshot.readPixels(); if (pixels) focus = subjectFocusFromPixels(pixels, 48, 48); }
        finally { snapshot.dispose(); }
      } finally { surface.dispose(); }
    }
  } catch { /* Full-image framing remains safe when pixel reads are unavailable. */ }
  cache.set(image, focus);
  return focus;
}
