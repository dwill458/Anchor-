/** Hand-authored engraving on a 120-unit canvas; no rendering or animation dependencies. */
export type EmblemLayer = 'engraving' | 'metal' | 'focal';
export interface EmblemPath {
  id: string;
  d: string;
  length: number;
  layer: EmblemLayer;
  width: number;
  fill?: 'ink' | 'gold' | 'ivory';
}
export interface MasterAsset {
  family: 'strength' | 'commitment' | 'journey' | 'vision';
  paths: readonly EmblemPath[];
}

const point = (radius: number, angle: number, cx = 60, cy = 60) => {
  const a = angle * Math.PI / 180;
  return `${(cx + Math.cos(a) * radius).toFixed(3)} ${(cy + Math.sin(a) * radius).toFixed(3)}`;
};
const circle = (r: number, cx = 60, cy = 60) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
const path = (id: string, d: string, length: number, layer: EmblemLayer = 'engraving', width = 0.8, fill?: EmblemPath['fill']): EmblemPath => ({ id, d, length, layer, width, fill });
const ring = (r: number, layer: EmblemLayer = 'engraving', width = 0.8) => path(`ring-${r}`, circle(r), 2 * Math.PI * r, layer, width);
const focal = (r: number, cx = 60, cy = 60, id = 'focal') => path(id, circle(r, cx, cy), 2 * Math.PI * r, 'focal', 0.6, 'gold');
const star = (outer: number, inner: number, points: number, rotation = -90) =>
  Array.from({ length: points * 2 }, (_, i) => `${i ? 'L' : 'M'} ${point(i % 2 ? inner : outer, rotation + i * 180 / points)}`).join(' ') + ' Z';

const fullStrength: MasterAsset = {
  family: 'strength',
  paths: [
    ...[48, 44, 38, 32, 25, 18].map((r, i) => ring(r, i % 2 ? 'metal' : 'engraving', i % 2 ? 0.85 : 1.7)),
    ...[46, 40, 34, 27, 20].map(r => path(`bevel-${r}`, `M ${point(r, 205)} A ${r} ${r} 0 0 1 ${point(r, 325)}`, r * 2.1, 'metal', 0.35)),
    ...[0, 90, 180, 270].flatMap((angle, i) => {
      const a = angle * Math.PI / 180;
      const x = 60 + 48 * Math.cos(a), y = 60 + 48 * Math.sin(a);
      return [path(`axis-${i}`, `M ${point(33, angle)} L ${point(53, angle)}`, 20, 'metal', 0.5), focal(3.8, x, y, `orb-${i}`)];
    }),
    ring(12, 'metal', 0.65), focal(10),
  ],
};

const firstPractice: MasterAsset = {
  family: 'commitment',
  paths: [
    ring(47, 'metal', 0.65), ring(44, 'metal', 0.35),
    path('eight-point-outline', star(36, 10, 8), 440, 'engraving', 1.4, 'ivory'),
    ...Array.from({ length: 8 }, (_, i) => path(`star-facet-${i}`, `M 60 60 L ${point(36, -90 + i * 45)} L ${point(10, -67.5 + i * 45)} Z`, 80, i % 2 ? 'engraving' : 'metal', 0.35, i % 2 ? undefined : 'gold')),
    path('center-boundary', circle(5.2), 33, 'engraving', 0.7), focal(3.6),
  ],
};

const goalReached: MasterAsset = {
  family: 'journey',
  paths: [
    ring(47, 'metal', 0.65), ring(44.5, 'metal', 0.3),
    ...Array.from({ length: 11 }, (_, i) => {
      const angle = 195 + i * 15;
      return path(`sun-ray-${i}`, `M ${point(23, angle, 60, 67)} L ${point(i % 2 ? 32 : 36, angle, 60, 67)}`, 14, 'metal', 0.7);
    }),
    path('sun-disc', 'M 41 67 A 19 19 0 0 1 79 67 Z', 98, 'focal', 0.65, 'gold'),
    path('sun-rim', 'M 44 66 A 16 16 0 0 1 76 66', 51, 'metal', 0.8),
    path('horizon', 'M 19 69 Q 37 61 60 70 Q 83 61 101 69', 84, 'engraving', 1.3),
    path('foreground', 'M 18 72 Q 35 65 58 75 Q 82 62 102 72 Q 99 91 78 102 Q 60 111 40 101 Q 23 92 18 72 Z', 206, 'engraving', 0.8, 'ink'),
    ...Array.from({ length: 10 }, (_, i) => {
      const y = 73 + i * 2.65;
      const inset = i * 1.5;
      return path(`land-contour-${i}`, `M ${21 + inset} ${y} C 43 ${y - 9} 65 ${y + 13} ${99 - inset} ${y - 1}`, 83 - i * 2, 'metal', 0.4);
    }),
    path('route', 'M 43 101 C 78 88 33 85 63 74', 72, 'metal', 1.1),
  ],
};

const firstGlimpse: MasterAsset = {
  family: 'vision',
  paths: [
    ring(47, 'metal', 0.7), ring(43, 'metal', 0.3), ring(38, 'engraving', 0.35),
    path('lens-horizontal', 'M 17 60 L 103 60', 86, 'metal', 0.4),
    path('lens-vertical', 'M 60 17 L 60 103', 86, 'metal', 0.4),
    path('horizon-star', star(37, 7.8, 4), 298, 'engraving', 1, 'ink'),
    path('north-reflection', 'M 60 23 L 60 60 L 53 53 Z', 89, 'metal', 0.4, 'ivory'),
    path('west-reflection', 'M 23 60 L 60 60 L 53 67 Z', 89, 'metal', 0.4, 'ivory'),
    ring(10, 'metal', 0.5), focal(5.5),
  ],
};

export const MASTER_ASSETS: Readonly<Record<string, MasterAsset>> = {
  'strength.full': fullStrength,
  'commitment.practices.1': firstPractice,
  'journey.goal': goalReached,
  'vision.first': firstGlimpse,
};
export const getMasterAsset = (milestoneId: string): MasterAsset | undefined => MASTER_ASSETS[milestoneId];

/** Choreography addresses paths by purpose while leaving their geometry immutable. */
export function engravingStart(shape: EmblemPath, index: number, family: MasterAsset['family']): number {
  if (shape.layer === 'focal') return 0.68;
  if (shape.id.startsWith('ring-')) return family === 'strength' ? Math.min(0.3, index * 0.045) : 0;
  if (shape.id === 'route') return 0.5;
  if (shape.layer === 'metal') return 0.38;
  return (family === 'commitment' ? 0.18 : 0.06) + index % 5 * 0.035;
}
