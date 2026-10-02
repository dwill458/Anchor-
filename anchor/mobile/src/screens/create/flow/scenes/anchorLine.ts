import type { Painter } from '../painter';
import type { HeroShape } from './sceneTypes';

/**
 * The raw anchor line at a given centre and scale. Each pen stroke is its own polyline, so a
 * drawn anchor never gains a connecting segment between two strokes.
 */
export function drawAnchorLine(
  p: Painter,
  hero: HeroShape,
  color: string,
  cx: number,
  cy: number,
  k: number,
  width: number,
  alpha: number
): void {
  if (alpha <= 0.003) return;
  const stroke = { color, width: width * Math.max(0.55, k), alpha };

  hero.strokes.forEach((points) => {
    if (points.length < 2) return;
    p.polyline(
      points.map((pt) => ({ x: cx + pt.x * k, y: cy + pt.y * k })),
      stroke
    );
  });
}
