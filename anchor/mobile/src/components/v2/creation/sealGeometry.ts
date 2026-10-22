import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
export type SealPath = { points: AnchorPoint[]; cumulative: number[]; total: number };
export const SEAL_TOLERANCE = 28;
export function sealPath(points: AnchorPoint[], size: number, artShare: number): SealPath {
  const inset = size * (1 - artShare) / 2;
  const mapped = points.map((p) => ({ x: inset + p.x * size * artShare / 100, y: inset + p.y * size * artShare / 100 }));
  const cumulative = [0];
  for (let i = 1; i < mapped.length; i += 1) cumulative.push(cumulative[i - 1] + Math.hypot(mapped[i].x - mapped[i - 1].x, mapped[i].y - mapped[i - 1].y));
  return { points: mapped, cumulative, total: cumulative[cumulative.length - 1] ?? 0 };
}
export function nearSealStart(path: SealPath, touch: AnchorPoint): boolean {
  const first = path.points[0];
  return Boolean(first && Math.hypot(touch.x - first.x, touch.y - first.y) <= SEAL_TOLERANCE);
}
/** Only the current segment can advance. Crossing the line never jumps ahead in path order. */
export function advanceSeal(path: SealPath, distance: number, touch: AnchorPoint): number {
  if (path.total <= 0) return distance;
  let index = 1;
  while (index < path.cumulative.length - 1 && path.cumulative[index] <= distance + 0.001) index += 1;
  const a = path.points[index - 1]; const b = path.points[index];
  const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy);
  if (length < 0.001) return path.cumulative[index];
  const t = Math.max(0, Math.min(1, ((touch.x - a.x) * dx + (touch.y - a.y) * dy) / (length * length)));
  if (Math.hypot(touch.x - a.x - dx * t, touch.y - a.y - dy * t) > SEAL_TOLERANCE) return distance;
  let next = path.cumulative[index - 1] + length * t;
  // Forgiving endpoint snap; the following sample must still follow the next segment.
  if (t >= 0.85 && Math.hypot(touch.x - b.x, touch.y - b.y) <= 12) next = path.cumulative[index];
  // A teleported touch cannot seal a long segment in a single sample.
  if (next - distance > SEAL_TOLERANCE * 2) return distance;
  return Math.max(distance, next);
}
