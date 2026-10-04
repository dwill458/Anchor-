import { AlphaType, ClipOp, ColorType, PaintStyle, Skia, type SkImage } from '@shopify/react-native-skia';
import type { AnchorExpression } from '@/constants/v2/creation';
import { colors, getCategoryColor } from '@/theme/v2';
import { circularAnchorArtworkShare } from '@/components/v2/anchor/CircularAnchorRenderer';
import { parseAnchorStructure, type AnchorStructure } from '@/components/v2/anchor/anchorStructure';
import { FOIL_STOPS, expressionSpec, resolvePaint, specUsesFoil } from '@/components/v2/anchor/anchorExpressions';

/**
 * The burn texture is built inside Skia, never snapshotted from a native view
 * (`makeImageFromView` returns a blank image on Android). It reproduces the
 * `paper` CircularAnchorRenderer: cream disc, hairline edge, and either the
 * finished image (cover-cropped, inset 4dp, circle-masked) or the structure SVG
 * drawn through its expression.
 */

const THIN_MARK_PX = 1.35;
const FOIL_ID = 'release-foil';
/** colors.frame, the paper the disc is filled with; ink must differ from it to count as artwork. */
const PAPER_RGB: readonly [number, number, number] = [244, 237, 224];

export interface ReleaseArtworkSvgInput {
  svg: string;
  category?: string | null;
  expression?: AnchorExpression | null;
  /** Disc diameter in dp. */
  size: number;
  /** Width of the disc's edge line, in dp. */
  hairline?: number;
}

const num = (value: number) => Number(value.toFixed(3));

function frameEdgeStroke(): { stroke: string; opacity: number } {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i.exec(colors.frameEdge);
  if (!match) return { stroke: '#14162B', opacity: 0.08 };
  return { stroke: `rgb(${match[1]},${match[2]},${match[3]})`, opacity: match[4] === undefined ? 1 : Number(match[4]) };
}

function fit(viewBox: { minX: number; minY: number; width: number; height: number }, target: number, origin: number) {
  const scale = Math.min(target / viewBox.width, target / viewBox.height);
  return {
    scale,
    x: origin + (target - viewBox.width * scale) / 2 - viewBox.minX * scale,
    y: origin + (target - viewBox.height * scale) / 2 - viewBox.minY * scale,
  };
}

function structureMarkup(structure: AnchorStructure, expression: AnchorExpression, category: string | null | undefined, artworkSize: number): string {
  const spec = expressionSpec(expression);
  const color = getCategoryColor(category);
  const unitsToPx = artworkSize / structure.box.width;
  const boost = Math.min(3, Math.max(1, THIN_MARK_PX / (structure.markWidth * unitsToPx)));
  const { minX, minY, width, height } = structure.box;
  const foilRef = `url(#${FOIL_ID})`;
  const parts: string[] = [];
  if (specUsesFoil(spec)) {
    parts.push(`<defs><linearGradient id="${FOIL_ID}" x1="${minX}" y1="${minY}" x2="${minX + width}" y2="${minY + height}" gradientUnits="userSpaceOnUse">${
      FOIL_STOPS.map(stop => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join('')}</linearGradient></defs>`);
  }
  if (spec.construction) {
    const extend = spec.construction.extend;
    const segments: string[] = [];
    for (const stroke of structure.strokes) {
      if (stroke.role !== 'mark' || !stroke.vertices) continue;
      for (let i = 0; i < stroke.vertices.length - 1; i += 1) {
        const a = stroke.vertices[i];
        const b = stroke.vertices[i + 1];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 0.5) continue;
        const ux = (b.x - a.x) / length;
        const uy = (b.y - a.y) / length;
        segments.push(`M ${(a.x - ux * extend).toFixed(2)} ${(a.y - uy * extend).toFixed(2)} L ${(b.x + ux * extend).toFixed(2)} ${(b.y + uy * extend).toFixed(2)}`);
      }
    }
    if (segments.length) {
      parts.push(`<path d="${segments.join(' ')}" stroke="${resolvePaint(spec.construction.paint, color, foilRef)}" stroke-width="${num(structure.markWidth * spec.construction.widthScale * boost)}" stroke-opacity="${spec.construction.opacity}" stroke-linecap="butt" fill="none"/>`);
    }
  }
  for (const layer of spec.layers) {
    const transform = layer.dx || layer.dy ? ` transform="translate(${num((layer.dx ?? 0) * boost)} ${num((layer.dy ?? 0) * boost)})"` : '';
    const strokes = structure.strokes.map(stroke => `<path d="${stroke.d}" stroke="${resolvePaint(layer.paint, color, foilRef)}" stroke-width="${num(stroke.strokeWidth * layer.widthScale * boost)}" stroke-opacity="${num(layer.opacity * stroke.opacity)}" stroke-linecap="${layer.linecap ?? 'round'}" stroke-linejoin="${layer.linejoin ?? 'round'}" fill="none"/>`);
    parts.push(`<g${transform}>${strokes.join('')}</g>`);
  }
  if (spec.vertices) {
    const paint = resolvePaint(spec.vertices.paint, color, foilRef);
    const r = structure.markWidth * spec.vertices.radiusScale * boost;
    for (const stroke of structure.strokes) {
      if (stroke.role !== 'mark' || !stroke.vertices) continue;
      for (const vertex of stroke.vertices) {
        parts.push(spec.vertices.hollow
          ? `<circle cx="${vertex.x}" cy="${vertex.y}" r="${num(r)}" stroke="${paint}" stroke-width="${num(structure.markWidth * 0.2 * boost)}" stroke-opacity="${spec.vertices.opacity}" fill="none"/>`
          : `<circle cx="${vertex.x}" cy="${vertex.y}" r="${num(r)}" fill="${paint}" fill-opacity="${spec.vertices.opacity}"/>`);
      }
    }
  }
  return parts.join('');
}

/** A stored SVG that AnchorMark cannot parse is drawn as stored (what SigilSvg does), tinted by the category. */
function rawSvgMarkup(svg: string, color: string): { viewBox: { minX: number; minY: number; width: number; height: number }; inner: string } | null {
  const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>/i.exec(svg.trim());
  if (!root) return null;
  const box = /viewBox\s*=\s*"([^"]+)"/i.exec(root[1])?.[1].trim().split(/[\s,]+/).map(Number);
  const w = Number(/\bwidth\s*=\s*"([\d.]+)/i.exec(root[1])?.[1]);
  const h = Number(/\bheight\s*=\s*"([\d.]+)/i.exec(root[1])?.[1]);
  const viewBox = box && box.length === 4 && box.every(Number.isFinite)
    ? { minX: box[0], minY: box[1], width: box[2], height: box[3] }
    : Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { minX: 0, minY: 0, width: w, height: h } : null;
  if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return null;
  return { viewBox, inner: root[2].replace(/currentColor/gi, color) };
}

/**
 * Pure: the whole paper disc as one SVG document, for Skia.SVG. Null when the stored
 * artwork cannot be represented (the native artwork then stays and the fade is used).
 */
export function buildReleaseArtworkSvg({ svg, category, expression, size, hairline = 1 }: ReleaseArtworkSvgInput): string | null {
  if (!svg || !svg.trim() || size <= 0) return null;
  const artworkSize = size * circularAnchorArtworkShare('paper', size, false);
  const origin = (size - artworkSize) / 2;
  const structure = expression ? parseAnchorStructure(svg) : null;
  let mark: string;
  if (structure && expression) {
    const placed = fit(structure.box, artworkSize, origin);
    mark = `<g transform="translate(${num(placed.x)} ${num(placed.y)}) scale(${num(placed.scale)})">${structureMarkup(structure, expression, category, artworkSize)}</g>`;
  } else {
    const raw = rawSvgMarkup(svg, getCategoryColor(category));
    if (!raw) return null;
    const placed = fit(raw.viewBox, artworkSize, origin);
    mark = `<g transform="translate(${num(placed.x)} ${num(placed.y)}) scale(${num(placed.scale)})">${raw.inner}</g>`;
  }
  const edge = frameEdgeStroke();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(size)}" height="${num(size)}" viewBox="0 0 ${num(size)} ${num(size)}">`
    + `<circle cx="${num(size / 2)}" cy="${num(size / 2)}" r="${num(size / 2 - hairline / 2)}" fill="${colors.frame}" stroke="${edge.stroke}" stroke-opacity="${edge.opacity}" stroke-width="${num(hairline)}"/>`
    + `${mark}</svg>`;
}

/**
 * Pure: does an RGBA8888 pixel buffer contain artwork, not just an empty or paper-only disc?
 * A blank handoff (the Android failure) is fully transparent or uniformly paper.
 */
export function artworkHasInk(pixels: ArrayLike<number> | null | undefined, width: number, height: number): boolean {
  if (!pixels || width <= 0 || height <= 0 || pixels.length < width * height * 4) return false;
  let ink = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 200) continue;
      const diff = Math.max(Math.abs(pixels[i] - PAPER_RGB[0]), Math.abs(pixels[i + 1] - PAPER_RGB[1]), Math.abs(pixels[i + 2] - PAPER_RGB[2]));
      if (diff > 24 && (ink += 1) >= 8) return true;
    }
  }
  return false;
}

/** The decoded texture must exist, have real dimensions and visibly contain artwork. */
export function validateReleaseArtworkImage(image: SkImage | null | undefined): boolean {
  try {
    if (!image) return false;
    const width = image.width();
    const height = image.height();
    if (!(width > 0 && height > 0)) return false;
    const pixels = image.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    return artworkHasInk(pixels as ArrayLike<number> | null, width, height);
  } catch {
    return false;
  }
}

export interface ReleaseArtworkImageInput extends ReleaseArtworkSvgInput {
  pixelRatio: number;
  /** The decoded finished image; when `hasImageUrl` is true it stands in for the structure. */
  image?: SkImage | null;
  hasImageUrl?: boolean;
}

/**
 * Draws the disc into a CPU raster surface. A raster snapshot is thread-agnostic: the
 * canvas runs on the UI thread, so a GPU texture made on the JS thread cannot be trusted.
 */
export function createReleaseArtworkImage(input: ReleaseArtworkImageInput): SkImage | null {
  try {
    const { size, pixelRatio, image, hasImageUrl } = input;
    const px = Math.max(1, Math.round(size * pixelRatio));
    const surface = Skia.Surface.Make(px, px) ?? Skia.Surface.MakeOffscreen?.(px, px);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(px / size, px / size);
    if (hasImageUrl) {
      if (!image) return null;
      const hairline = input.hairline ?? 1;
      const edge = frameEdgeStroke();
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(colors.frame));
      canvas.drawCircle(size / 2, size / 2, size / 2 - hairline / 2, paint);
      const inner = size - 8;
      const iw = image.width();
      const ih = image.height();
      const cover = Math.max(inner / iw, inner / ih);
      const srcW = inner / cover;
      const srcH = inner / cover;
      const clip = Skia.Path.Make();
      clip.addCircle(size / 2, size / 2, inner / 2);
      canvas.save();
      canvas.clipPath(clip, ClipOp.Intersect, true);
      const imagePaint = Skia.Paint();
      imagePaint.setAntiAlias(true);
      canvas.drawImageRect(image, Skia.XYWHRect((iw - srcW) / 2, (ih - srcH) / 2, srcW, srcH), Skia.XYWHRect(4, 4, inner, inner), imagePaint);
      canvas.restore();
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(hairline);
      paint.setColor(Skia.Color(edge.stroke));
      paint.setAlphaf(edge.opacity);
      canvas.drawCircle(size / 2, size / 2, inner / 2 - hairline / 2, paint);
    } else {
      const markup = buildReleaseArtworkSvg(input);
      const dom = markup ? Skia.SVG.MakeFromString(markup) : null;
      if (!dom) return null;
      canvas.drawSvg(dom, size, size);
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    return snapshot.makeNonTextureImage?.() ?? snapshot;
  } catch {
    return null;
  }
}
