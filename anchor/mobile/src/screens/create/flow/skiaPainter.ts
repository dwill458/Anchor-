import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkTypeface,
} from '@shopify/react-native-skia';

import type { FontSpec, MeasureText, Pt } from './geometry';
import type { FillStyle, Painter, StrokeStyle, TextStyle } from './painter';

/**
 * The Skia implementation of `Painter`. It paints onto the canvas of a `PictureRecorder` in
 * 390x844 design space; the caller applies the single device scale before handing it over.
 */

export interface FlowTypefaces {
  serif: SkTypeface;
  serifItalic: SkTypeface;
  sans400: SkTypeface;
  sans500: SkTypeface;
  sans600: SkTypeface;
}

const colorCache = new Map<string, Float32Array>();
function colorOf(value: string): Float32Array {
  let color = colorCache.get(value);
  if (!color) {
    color = Skia.Color(value);
    colorCache.set(value, color);
  }
  return color;
}

/** Caches one SkFont per (face, size). Sizes are quantised so the camera push stays bounded. */
export class FlowFontCache {
  private readonly fonts = new Map<string, SkFont>();

  constructor(private readonly faces: FlowTypefaces) {}

  private face(spec: FontSpec): SkTypeface {
    if (spec.family === 'serif') return spec.italic ? this.faces.serifItalic : this.faces.serif;
    if (spec.weight >= 600) return this.faces.sans600;
    if (spec.weight >= 500) return this.faces.sans500;
    return this.faces.sans400;
  }

  get(spec: FontSpec): SkFont {
    const size = Math.round(spec.size * 10) / 10;
    const key = `${spec.family}:${spec.weight}:${spec.italic ? 'i' : 'n'}:${size}`;
    let font = this.fonts.get(key);
    if (!font) {
      font = Skia.Font(this.face(spec), size);
      this.fonts.set(key, font);
    }
    return font;
  }

  /** Text width in design px — also the `measure` the layout uses, so layout and paint agree. */
  readonly measure: MeasureText = (text, spec) => (text ? this.get(spec).getTextWidth(text) : 0);
}

/** A lazily created, reusable paint pair so a frame allocates no per-op host objects. */
class PaintPool {
  readonly fill: SkPaint = Skia.Paint();
  readonly stroke: SkPaint = Skia.Paint();

  constructor() {
    this.fill.setAntiAlias(true);
    this.fill.setStyle(PaintStyle.Fill);
    this.stroke.setAntiAlias(true);
    this.stroke.setStyle(PaintStyle.Stroke);
  }
}

const dashCache = new Map<string, ReturnType<typeof Skia.PathEffect.MakeDash>>();
function dashEffect(on: number, off: number) {
  const key = `${on}:${off}`;
  let effect = dashCache.get(key);
  if (!effect) {
    effect = Skia.PathEffect.MakeDash([on, off], 0);
    dashCache.set(key, effect);
  }
  return effect;
}

export class SkiaPainter implements Painter {
  readonly measure: MeasureText;
  private readonly paints = new PaintPool();

  constructor(
    private readonly canvas: SkCanvas,
    private readonly fonts: FlowFontCache
  ) {
    this.measure = fonts.measure;
  }

  private strokePaint(style: StrokeStyle): SkPaint {
    const paint = this.paints.stroke;
    paint.setColor(colorOf(style.color));
    paint.setAlphaf(style.alpha ?? 1);
    paint.setStrokeWidth(style.width);
    paint.setStrokeCap(style.cap === 'butt' ? StrokeCap.Butt : StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setPathEffect(style.dash ? dashEffect(style.dash[0], style.dash[1]) : null);
    return paint;
  }

  private fillPaint(style: FillStyle): SkPaint {
    const paint = this.paints.fill;
    paint.setColor(colorOf(style.color));
    paint.setAlphaf(style.alpha ?? 1);
    return paint;
  }

  save() { this.canvas.save(); }
  restore() { this.canvas.restore(); }
  translate(x: number, y: number) { this.canvas.translate(x, y); }
  scale(sx: number, sy: number = sx) { this.canvas.scale(sx, sy); }

  clipRRect(x: number, y: number, w: number, h: number, r: number) {
    this.canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), ClipOp.Intersect, true);
  }

  fillRect(x: number, y: number, w: number, h: number, fill: FillStyle) {
    if ((fill.alpha ?? 1) <= 0.003) return;
    this.canvas.drawRect(Skia.XYWHRect(x, y, w, h), this.fillPaint(fill));
  }

  fillRRect(x: number, y: number, w: number, h: number, r: number, fill: FillStyle) {
    if ((fill.alpha ?? 1) <= 0.003) return;
    this.canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), this.fillPaint(fill));
  }

  strokeRRect(x: number, y: number, w: number, h: number, r: number, stroke: StrokeStyle) {
    if ((stroke.alpha ?? 1) <= 0.003) return;
    this.canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), this.strokePaint(stroke));
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: StrokeStyle) {
    if ((stroke.alpha ?? 1) <= 0.003) return;
    this.canvas.drawLine(x1, y1, x2, y2, this.strokePaint(stroke));
  }

  polyline(points: Pt[], stroke: StrokeStyle) {
    if (points.length < 2 || (stroke.alpha ?? 1) <= 0.003) return;
    const path = Skia.PathBuilder.Make();
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) path.lineTo(points[i].x, points[i].y);
    this.canvas.drawPath(path.detach(), this.strokePaint(stroke));
  }

  segments(pairs: Array<[Pt, Pt]>, stroke: StrokeStyle) {
    if (pairs.length === 0 || (stroke.alpha ?? 1) <= 0.003) return;
    const path = Skia.PathBuilder.Make();
    pairs.forEach(([a, b]) => {
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
    });
    this.canvas.drawPath(path.detach(), this.strokePaint(stroke));
  }

  smoothStroke(points: Pt[], stroke: StrokeStyle) {
    if (points.length < 2 || (stroke.alpha ?? 1) <= 0.003) return;
    const path = Skia.PathBuilder.Make();
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const q = points[i];
      const r = points[i + 1];
      path.quadTo(q.x, q.y, (q.x + r.x) / 2, (q.y + r.y) / 2);
    }
    const last = points[points.length - 1];
    path.lineTo(last.x, last.y);
    this.canvas.drawPath(path.detach(), this.strokePaint(stroke));
  }

  circle(cx: number, cy: number, r: number, style: { fill?: FillStyle; stroke?: StrokeStyle }) {
    if (r <= 0) return;
    if (style.fill && (style.fill.alpha ?? 1) > 0.003) {
      this.canvas.drawCircle(cx, cy, r, this.fillPaint(style.fill));
    }
    if (style.stroke && (style.stroke.alpha ?? 1) > 0.003) {
      this.canvas.drawCircle(cx, cy, r, this.strokePaint(style.stroke));
    }
  }

  arc(cx: number, cy: number, r: number, startRad: number, sweepRad: number, stroke: StrokeStyle) {
    if ((stroke.alpha ?? 1) <= 0.003 || Math.abs(sweepRad) < 0.001) return;
    const oval = Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2);
    const toDeg = 180 / Math.PI;
    this.canvas.drawArc(oval, startRad * toDeg, sweepRad * toDeg, false, this.strokePaint(stroke));
  }

  quadCurve(a: Pt, control: Pt, b: Pt, fraction: number, stroke: StrokeStyle) {
    if (fraction <= 0 || (stroke.alpha ?? 1) <= 0.003) return;
    const path = Skia.PathBuilder.Make();
    path.moveTo(a.x, a.y);
    const steps = 24;
    for (let k = 1; k <= steps; k += 1) {
      const s = (fraction * k) / steps;
      const m = 1 - s;
      path.lineTo(
        m * m * a.x + 2 * m * s * control.x + s * s * b.x,
        m * m * a.y + 2 * m * s * control.y + s * s * b.y
      );
    }
    this.canvas.drawPath(path.detach(), this.strokePaint(stroke));
  }

  text(value: string, x: number, y: number, style: TextStyle) {
    const alpha = style.alpha ?? 1;
    if (alpha <= 0.003 || !value) return;
    const font = this.fonts.get(style.font);
    const paint = this.fillPaint({ color: style.color, alpha });
    const ls = style.ls ?? 0;

    if (!ls) {
      const width = style.align === 'center' || style.align === 'right' ? font.getTextWidth(value) : 0;
      const left = style.align === 'center' ? x - width / 2 : style.align === 'right' ? x - width : x;
      this.canvas.drawText(value, left, y, paint, font);
      return;
    }

    // Skia has no letter-spacing: advance glyph by glyph.
    const widths = Array.from(value).map((ch) => font.getTextWidth(ch) + ls);
    const total = widths.reduce((sum, w) => sum + w, 0) - ls;
    let cursor = style.align === 'center' ? x - total / 2 : style.align === 'right' ? x - total : x;
    Array.from(value).forEach((ch, i) => {
      this.canvas.drawText(ch, cursor, y, paint, font);
      cursor += widths[i];
    });
  }
}
