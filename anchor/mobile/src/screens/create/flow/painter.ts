import type { FontSpec, MeasureText, Pt } from './geometry';

/**
 * The drawing surface the scenes paint on, in 390x844 design space. The app implements it over a
 * Skia canvas (skiaPainter.ts); tests implement it with a recorder, so scene logic — what is drawn,
 * in what order, with which values — is verifiable without native Skia.
 */

export interface StrokeStyle {
  color: string;
  width: number;
  alpha?: number;
  cap?: 'round' | 'butt';
  /** `[on, off]` dash lengths in design px. */
  dash?: [number, number];
}

export interface FillStyle {
  color: string;
  alpha?: number;
}

export interface TextStyle {
  font: FontSpec;
  color: string;
  alpha?: number;
  align?: 'left' | 'center' | 'right';
  /** Letter spacing in design px. */
  ls?: number;
}

export interface Painter {
  readonly measure: MeasureText;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(sx: number, sy?: number): void;
  clipRRect(x: number, y: number, w: number, h: number, r: number): void;

  fillRect(x: number, y: number, w: number, h: number, fill: FillStyle): void;
  fillRRect(x: number, y: number, w: number, h: number, r: number, fill: FillStyle): void;
  strokeRRect(x: number, y: number, w: number, h: number, r: number, stroke: StrokeStyle): void;
  line(x1: number, y1: number, x2: number, y2: number, stroke: StrokeStyle): void;
  /** One connected path through `points`. */
  polyline(points: Pt[], stroke: StrokeStyle): void;
  /** Several disjoint segments drawn as one path (no joins between them). */
  segments(pairs: Array<[Pt, Pt]>, stroke: StrokeStyle): void;
  /** A quadratic-midpoint smoothed stroke — display only, used for hand-drawn strokes. */
  smoothStroke(points: Pt[], stroke: StrokeStyle): void;
  circle(cx: number, cy: number, r: number, style: { fill?: FillStyle; stroke?: StrokeStyle }): void;
  /** Arc from `startRad`, sweeping `sweepRad` clockwise (screen space). */
  arc(cx: number, cy: number, r: number, startRad: number, sweepRad: number, stroke: StrokeStyle): void;
  /** A thin curve through the quadratic `a -> control -> b`, drawn `fraction` of the way. */
  quadCurve(a: Pt, control: Pt, b: Pt, fraction: number, stroke: StrokeStyle): void;
  text(value: string, x: number, y: number, style: TextStyle): void;
}
