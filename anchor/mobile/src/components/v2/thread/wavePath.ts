/**
 * wavePath.ts
 *
 * Helper to generate smooth, gentle sine wave paths using cubic Bézier segments.
 * Designed for rendering Anchor's "Thread Strength" visualization — both the active
 * colored strand and the loose, unwoven gray background tangle.
 *
 * Scales dynamically to any trackWidth with uniform curvature.
 */

export interface WaveOptions {
  /** Number of sine wave cycles across the total width (default: 2.5). */
  cycles?: number;
  /** Peak vertical wave amplitude in pixels (default: 7). */
  amplitude?: number;
  /** Phase offset in radians (default: 0). */
  phase?: number;
  /** Vertical center offset in pixels from height / 2 (default: 0). */
  verticalOffset?: number;
  /** Number of Bézier curve subdivisions across the track (default: 24). */
  segments?: number;
}

/** Preset wave configurations for the interwoven colored strands */
export const DEFAULT_COLORED_WAVE: WaveOptions = {
  cycles: 1.85,
  amplitude: 8.0,
  phase: 0,
  verticalOffset: 0,
  segments: 28,
};

export const COLORED_STRAND_2: WaveOptions = {
  cycles: 2.15,
  amplitude: 7.0,
  phase: 1.8,
  verticalOffset: -1.8,
  segments: 28,
};

export const COLORED_STRAND_3: WaveOptions = {
  cycles: 2.35,
  amplitude: 6.5,
  phase: 3.5,
  verticalOffset: 1.5,
  segments: 28,
};

export const COLORED_STRAND_4: WaveOptions = {
  cycles: 2.6,
  amplitude: 5.5,
  phase: 5.0,
  verticalOffset: -0.8,
  segments: 28,
};

/** Preset wave configurations for the loose, unwoven gray tangle */
export const GRAY_STRAND_1: WaveOptions = {
  cycles: 1.85,
  amplitude: 8.0,
  phase: 0,
  verticalOffset: 0,
  segments: 28,
};

export const GRAY_STRAND_2: WaveOptions = {
  cycles: 1.6,
  amplitude: 9.0,
  phase: 0.8,
  verticalOffset: -4.5,
  segments: 28,
};

export const GRAY_STRAND_3: WaveOptions = {
  cycles: 2.0,
  amplitude: 8.5,
  phase: 2.2,
  verticalOffset: 4.5,
  segments: 28,
};

export const GRAY_STRAND_4: WaveOptions = {
  cycles: 2.4,
  amplitude: 6.0,
  phase: 3.8,
  verticalOffset: -2.0,
  segments: 28,
};

export const GRAY_STRAND_5: WaveOptions = {
  cycles: 2.8,
  amplitude: 5.0,
  phase: 4.8,
  verticalOffset: 2.5,
  segments: 28,
};

/**
 * Generates an SVG path data string (`d` attribute) for a sine wave using cubic Bézier curves.
 * The Bézier control points match the exact derivative of the sine wave at each knot for C1 continuity.
 */
export function generateWavePath(
  width: number,
  height: number,
  options: WaveOptions = {}
): string {
  if (width <= 0 || height <= 0) return '';

  const cycles = options.cycles ?? 2.5;
  const amplitude = options.amplitude ?? 7;
  const phase = options.phase ?? 0;
  const verticalOffset = options.verticalOffset ?? 0;
  const segments = options.segments ?? 28;

  const midY = height / 2 + verticalOffset;
  const k = (cycles * 2 * Math.PI) / width;
  const dx = width / segments;

  const getY = (x: number): number => midY + amplitude * Math.sin(k * x + phase);
  const getSlope = (x: number): number => amplitude * k * Math.cos(k * x + phase);

  let path = `M 0 ${getY(0).toFixed(2)}`;

  for (let i = 0; i < segments; i++) {
    const x0 = i * dx;
    const x1 = (i + 1) * dx;
    const y0 = getY(x0);
    const y1 = getY(x1);
    const s0 = getSlope(x0);
    const s1 = getSlope(x1);

    const cx1 = x0 + dx / 3;
    const cy1 = y0 + (s0 * dx) / 3;
    const cx2 = x1 - dx / 3;
    const cy2 = y1 - (s1 * dx) / 3;

    path += ` C ${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  return path;
}

/**
 * Calculates the accurate total arc length of a wave path.
 * Used for SVG strokeDasharray and strokeDashoffset animations.
 */
export function getWaveLength(
  width: number,
  height: number,
  options: WaveOptions = {}
): number {
  if (width <= 0 || height <= 0) return 0;

  const cycles = options.cycles ?? 2.5;
  const amplitude = options.amplitude ?? 7;
  const phase = options.phase ?? 0;
  const segments = options.segments ?? 28;

  const k = (cycles * 2 * Math.PI) / width;
  const dx = width / segments;
  const getY = (x: number): number => amplitude * Math.sin(k * x + phase);

  let length = 0;
  let prevY = getY(0);

  for (let i = 1; i <= segments; i++) {
    const x = i * dx;
    const y = getY(x);
    const segDx = dx;
    const segDy = y - prevY;
    length += Math.sqrt(segDx * segDx + segDy * segDy);
    prevY = y;
  }

  // Add slight buffer to ensure strokeDasharray covers the full stroke with no rounding gaps
  return Math.ceil(length + 2);
}

/**
 * Calculates the y-coordinate of a wave at a given x position.
 * Worklet-safe for use in Reanimated animatedProps to track leading tip coordinates.
 */
export function getWaveY(
  x: number,
  width: number,
  height: number,
  options: WaveOptions = {}
): number {
  'worklet';
  if (width <= 0) return height / 2;

  const cycles = options.cycles ?? 2.5;
  const amplitude = options.amplitude ?? 7;
  const phase = options.phase ?? 0;
  const verticalOffset = options.verticalOffset ?? 0;

  const midY = height / 2 + verticalOffset;
  const k = (cycles * 2 * Math.PI) / width;
  return midY + amplitude * Math.sin(k * x + phase);
}
