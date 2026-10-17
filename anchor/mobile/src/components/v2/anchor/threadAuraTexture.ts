import { ClipOp, Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { THREAD_AURA_BLUR_SIGMAS } from './threadAuraModel';

const cache = new Map<string, SkImage>();
/** Bounded cache: at most eight five-tile atlases, each tile <=384px. */
export function threadAuraTexture(svg: string, size: number, artworkSize: number): SkImage | null {
  const span = Math.min(384, Math.ceil(size * 1.6));
  const key = `${size}:${artworkSize}:${svg}`;
  const cached = cache.get(key);
  if (cached) return cached;
  // External resources and SVG features not supported by Skia keep the native SVG fallback.
  if (/<(?:image|foreignObject|text|filter)\b|(?:href|xlink:href)\s*=/i.test(svg)) return null;
  try {
    const source = Skia.SVG.MakeFromString(svg);
    if (!source) return null;
    const surface = Skia.Surface.MakeOffscreen(span * 5, span);
    if (!surface) { source.dispose(); return null; }
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    const scale = span / (size * 1.6);
    const mark = artworkSize * scale;
    const inset = (span - mark) / 2;
    THREAD_AURA_BLUR_SIGMAS.forEach((sigma, tile) => {
      const paint = Skia.Paint();
      const blur = Skia.ImageFilter.MakeBlur(mark * sigma, mark * sigma, TileMode.Decal);
      paint.setImageFilter(blur);
      canvas.save();
      canvas.translate(tile * span, 0);
      canvas.clipRect(Skia.XYWHRect(0, 0, span, span), ClipOp.Intersect, false);
      canvas.saveLayer(paint, Skia.XYWHRect(0, 0, span, span));
      canvas.translate(inset, inset);
      canvas.drawSvg(source, mark, mark);
      canvas.restore();
      canvas.restore();
      paint.dispose();
      blur.dispose();
    });
    surface.flush();
    const image = surface.makeImageSnapshot();
    surface.dispose();
    source.dispose();
    // Evicted images may still be displayed; let the JSI host object release them when unreferenced.
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(key, image);
    return image;
  } catch {
    return null;
  }
}
