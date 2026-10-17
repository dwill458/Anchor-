import sharp from 'sharp';
import { VISION_IMAGE_HEIGHT, VISION_IMAGE_WIDTH } from './visionScenePlanning';

/**
 * Expand with AI for a person's own photograph. The model is asked to fill ONLY the blank bands
 * around the photo on a 9:16 canvas; the original pixels are then composited back over the result (inside a 6px seam feather),
 * so the photograph itself is never regenerated. Mirrors `visionPhotoFit.ts` on the device.
 */
const TARGET = 9 / 16;
const TOLERANCE = 0.06;
const MAX_INVENTED = 0.6;
/** Longest edge of the working image; bounds provider payload and cost. */
const WORK_MAX_EDGE = 1600;
/** Inner feather (px) on the original's edges that touch generated area, hiding the seam without changing the photo's interior. */
const FEATHER_PX = 6;
const GRAY = { r: 128, g: 128, b: 128 };

export type ExpandGeometry = { canvas: { width: number; height: number }; offset: { x: number; y: number } };

/** Null when the photo already fits, or when more than 60% of the frame would be invented. */
export function planPhotoExpansion(width: number, height: number): ExpandGeometry | null {
  if (!(width > 0) || !(height > 0)) return null;
  const aspect = width / height;
  if (Math.abs(aspect - TARGET) / TARGET <= TOLERANCE) return null;
  if (1 - Math.min(aspect / TARGET, TARGET / aspect) > MAX_INVENTED) return null;
  const canvas = aspect > TARGET
    ? { width, height: Math.round(width / TARGET) }
    : { width: Math.round(height * TARGET), height };
  return { canvas, offset: { x: Math.round((canvas.width - width) / 2), y: Math.round((canvas.height - height) / 2) } };
}

export const VISION_EXPAND_PROMPT = [
  'This image is a real photograph centred on a flat gray canvas. Extend the photograph outward so it fills the whole canvas.',
  'Paint ONLY the flat gray areas. Continue the existing scene naturally: same place, perspective, lighting, colour grade and film grain.',
  'Do NOT alter, redraw, move, resize, sharpen or restyle anything inside the photograph. Do not change any faces, clothing or objects.',
  'Do not add people, text, logos, borders, frames or watermarks. The result must be one seamless photograph with no gray left.',
].join(' ');

export type ExpandProvider = {
  extendVisionPhoto(prompt: string, canvas: { buffer: Buffer; mimeType: string }): Promise<Buffer>;
};

export class PhotoExpandError extends Error {
  constructor(public readonly code: 'NOT_NEEDED' | 'TOO_WIDE' | 'UNREADABLE', message: string) { super(message); }
}

/** Alpha mask for the original: opaque, with a short ramp on the sides that touch generated area. */
function featherMask(width: number, height: number, sides: { left: boolean; right: boolean; top: boolean; bottom: boolean }): Buffer {
  const mask = Buffer.alloc(width * height, 255);
  const ramp = (distance: number) => Math.min(255, Math.round(((distance + 1) / (FEATHER_PX + 1)) * 255));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let alpha = 255;
      if (sides.left && x < FEATHER_PX) alpha = Math.min(alpha, ramp(x));
      if (sides.right && width - 1 - x < FEATHER_PX) alpha = Math.min(alpha, ramp(width - 1 - x));
      if (sides.top && y < FEATHER_PX) alpha = Math.min(alpha, ramp(y));
      if (sides.bottom && height - 1 - y < FEATHER_PX) alpha = Math.min(alpha, ramp(height - 1 - y));
      mask[y * width + x] = alpha;
    }
  }
  return mask;
}

/**
 * Returns the expanded photograph as a 9:16 JPEG (at most 1080x1920). Nothing is stored: the caller shows it as a
 * preview and the person decides.
 */
export async function expandPhotoToVision(original: Buffer, provider: ExpandProvider): Promise<{ image: Buffer; width: number; height: number }> {
  let oriented: Buffer;
  let info: sharp.OutputInfo;
  try {
    ({ data: oriented, info } = await sharp(original).rotate()
      .resize({ width: WORK_MAX_EDGE, height: WORK_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .removeAlpha().png().toBuffer({ resolveWithObject: true }));
  } catch {
    throw new PhotoExpandError('UNREADABLE', 'The photo could not be read.');
  }
  const plan = planPhotoExpansion(info.width, info.height);
  if (!plan) {
    const aspect = info.width / info.height;
    throw Math.abs(aspect - TARGET) / TARGET <= TOLERANCE
      ? new PhotoExpandError('NOT_NEEDED', 'This photo already fits.')
      : new PhotoExpandError('TOO_WIDE', 'This photo is too far from the Vision frame to expand naturally.');
  }
  const { canvas, offset } = plan;
  const grayCanvas = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 3, background: GRAY } })
    .composite([{ input: oriented, left: offset.x, top: offset.y }]).png().toBuffer();

  const generated = await provider.extendVisionPhoto(VISION_EXPAND_PROMPT, { buffer: grayCanvas, mimeType: 'image/png' });
  const filled = await sharp(generated).rotate().resize({ width: canvas.width, height: canvas.height, fit: 'fill' }).removeAlpha().toBuffer();

  const sides = {
    left: offset.x > 0, right: offset.x + info.width < canvas.width,
    top: offset.y > 0, bottom: offset.y + info.height < canvas.height,
  };
  const rgb = await sharp(oriented).removeAlpha().raw().toBuffer();
  const mask = featherMask(info.width, info.height, sides);
  const withAlpha = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    withAlpha[i * 4] = rgb[i * 3];
    withAlpha[i * 4 + 1] = rgb[i * 3 + 1];
    withAlpha[i * 4 + 2] = rgb[i * 3 + 2];
    withAlpha[i * 4 + 3] = mask[i];
  }
  const restored = await sharp(withAlpha, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const composed = await sharp(filled).composite([{ input: restored, left: offset.x, top: offset.y }]).raw().toBuffer({ resolveWithObject: true });
  // Scaled down to the stored Vision size when larger; never upscaled.
  const shrink = canvas.height > VISION_IMAGE_HEIGHT;
  const width = shrink ? VISION_IMAGE_WIDTH : canvas.width;
  const height = shrink ? VISION_IMAGE_HEIGHT : canvas.height;
  const image = await sharp(composed.data, { raw: composed.info })
    .resize({ width, height, fit: 'fill' })
    .jpeg({ quality: 88 }).toBuffer();
  return { image, width, height };
}
