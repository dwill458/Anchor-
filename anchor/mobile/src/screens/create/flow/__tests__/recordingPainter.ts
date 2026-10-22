import type { FontSpec, Pt } from '../geometry';
import type { FillStyle, Painter, StrokeStyle, TextStyle } from '../painter';

export type PaintOp =
  | { op: 'save' | 'restore' }
  | { op: 'translate'; x: number; y: number }
  | { op: 'scale'; sx: number; sy: number }
  | { op: 'clipRRect'; x: number; y: number; w: number; h: number; r: number }
  | { op: 'fillRect'; x: number; y: number; w: number; h: number; fill: FillStyle }
  | { op: 'fillRRect'; x: number; y: number; w: number; h: number; r: number; fill: FillStyle }
  | { op: 'strokeRRect'; x: number; y: number; w: number; h: number; r: number; stroke: StrokeStyle }
  | { op: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: StrokeStyle }
  | { op: 'polyline'; points: Pt[]; stroke: StrokeStyle }
  | { op: 'segments'; pairs: Array<[Pt, Pt]>; stroke: StrokeStyle }
  | { op: 'smoothStroke'; points: Pt[]; stroke: StrokeStyle }
  | { op: 'circle'; cx: number; cy: number; r: number; fill?: FillStyle; stroke?: StrokeStyle }
  | { op: 'arc'; cx: number; cy: number; r: number; startRad: number; sweepRad: number; stroke: StrokeStyle }
  | { op: 'quadCurve'; a: Pt; control: Pt; b: Pt; fraction: number; stroke: StrokeStyle }
  | { op: 'text'; value: string; x: number; y: number; style: TextStyle };

/** Deterministic stand-in metrics: every glyph is half the font size wide. */
export const fakeMeasure = (text: string, font: FontSpec): number => text.length * font.size * 0.5;

export class RecordingPainter implements Painter {
  readonly ops: PaintOp[] = [];
  readonly measure = fakeMeasure;

  save() { this.ops.push({ op: 'save' }); }
  restore() { this.ops.push({ op: 'restore' }); }
  translate(x: number, y: number) { this.ops.push({ op: 'translate', x, y }); }
  scale(sx: number, sy: number = sx) { this.ops.push({ op: 'scale', sx, sy }); }
  clipRRect(x: number, y: number, w: number, h: number, r: number) { this.ops.push({ op: 'clipRRect', x, y, w, h, r }); }
  fillRect(x: number, y: number, w: number, h: number, fill: FillStyle) { this.ops.push({ op: 'fillRect', x, y, w, h, fill }); }
  fillRRect(x: number, y: number, w: number, h: number, r: number, fill: FillStyle) { this.ops.push({ op: 'fillRRect', x, y, w, h, r, fill }); }
  strokeRRect(x: number, y: number, w: number, h: number, r: number, stroke: StrokeStyle) { this.ops.push({ op: 'strokeRRect', x, y, w, h, r, stroke }); }
  line(x1: number, y1: number, x2: number, y2: number, stroke: StrokeStyle) { this.ops.push({ op: 'line', x1, y1, x2, y2, stroke }); }
  polyline(points: Pt[], stroke: StrokeStyle) { this.ops.push({ op: 'polyline', points, stroke }); }
  segments(pairs: Array<[Pt, Pt]>, stroke: StrokeStyle) { this.ops.push({ op: 'segments', pairs, stroke }); }
  smoothStroke(points: Pt[], stroke: StrokeStyle) { this.ops.push({ op: 'smoothStroke', points, stroke }); }
  circle(cx: number, cy: number, r: number, style: { fill?: FillStyle; stroke?: StrokeStyle }) { this.ops.push({ op: 'circle', cx, cy, r, ...style }); }
  arc(cx: number, cy: number, r: number, startRad: number, sweepRad: number, stroke: StrokeStyle) { this.ops.push({ op: 'arc', cx, cy, r, startRad, sweepRad, stroke }); }
  quadCurve(a: Pt, control: Pt, b: Pt, fraction: number, stroke: StrokeStyle) { this.ops.push({ op: 'quadCurve', a, control, b, fraction, stroke }); }
  text(value: string, x: number, y: number, style: TextStyle) { this.ops.push({ op: 'text', value, x, y, style }); }

  of<T extends PaintOp['op']>(op: T): Array<Extract<PaintOp, { op: T }>> {
    return this.ops.filter((o): o is Extract<PaintOp, { op: T }> => o.op === op);
  }

  /** Text drawn with non-trivial alpha, in order. */
  visibleText(minAlpha = 0.02): string[] {
    return this.of('text')
      .filter((o) => (o.style.alpha ?? 1) > minAlpha)
      .map((o) => o.value);
  }
}
