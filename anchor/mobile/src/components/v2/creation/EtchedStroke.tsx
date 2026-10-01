import React, { useMemo } from 'react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { colors as legacyColors } from '@/theme';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';

/** Presentation only: pressure varies around the real centreline, never its geometry. */
export function EtchedStroke({ points, size, progress, color, activeTip = false, width = 2.2 }: {
  points: AnchorPoint[]; size: number; progress: SharedValue<number>; color: string; activeTip?: boolean; width?: number;
}) {
  const samples = useMemo(() => {
    const result: Array<{ x: number; y: number; nx: number; ny: number; distance: number; pressure: number }> = [];
    let distance = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]; const b = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 0.001) continue;
      for (let j = 0; j <= 16; j += 1) {
        const t = j / 16;
        result.push({ x: (a.x + (b.x - a.x) * t) * size / 100, y: (a.y + (b.y - a.y) * t) * size / 100,
          nx: -(b.y - a.y) / length, ny: (b.x - a.x) / length, distance: distance + length * t,
          pressure: 0.28 + 0.72 * Math.sin(Math.PI * t) * (0.94 + 0.06 * Math.sin(i * 3 + t * 11)) });
      }
      distance += length;
    }
    return { values: result, total: distance };
  }, [points, size]);
  const body = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const limit = Math.min(1, Math.max(0, progress.value)) * samples.total;
    const visible = [];
    for (let i = 0; i < samples.values.length; i += 1) {
      const point = samples.values[i];
      if (point.distance <= limit) visible.push(point);
      else {
        const previous = samples.values[i - 1];
        if (previous) {
          const t = (limit - previous.distance) / (point.distance - previous.distance || 1);
          visible.push({ ...point, x: previous.x + (point.x - previous.x) * t, y: previous.y + (point.y - previous.y) * t });
        }
        break;
      }
    }
    if (limit <= 0 || visible.length < 2) return path;
    visible.forEach((p, i) => {
      const x = p.x + p.nx * width * p.pressure / 2; const y = p.y + p.ny * width * p.pressure / 2;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    });
    for (let i = visible.length - 1; i >= 0; i -= 1) {
      const p = visible[i]; path.lineTo(p.x - p.nx * width * p.pressure / 2, p.y - p.ny * width * p.pressure / 2);
    }
    path.close(); return path;
  }, [samples, width]);
  const centreline = useMemo(() => {
    const path = Skia.Path.Make();
    points.forEach((p, i) => { if (i === 0) path.moveTo(p.x * size / 100, p.y * size / 100); else path.lineTo(p.x * size / 100, p.y * size / 100); });
    return path;
  }, [points, size]);
  const tipStart = useDerivedValue(() => Math.max(0, progress.value - 0.035));
  const tipOpacity = useDerivedValue(() => progress.value > 0 && progress.value < 1 ? 1 : 0);
  return <Canvas style={{ width: size, height: size }} pointerEvents="none">
    <Path path={body} color={color} />
    {activeTip ? <Path path={centreline} style="stroke" strokeWidth={0.9} color={legacyColors.gold} start={tipStart} end={progress} opacity={tipOpacity} /> : null}
  </Canvas>;
}
