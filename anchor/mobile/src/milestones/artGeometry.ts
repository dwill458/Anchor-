import type { MilestoneMotif } from './registry';

/**
 * Pure vector geometry for milestone artwork on a 120 x 120 canvas. Colours are roles, resolved
 * by the component, so the same geometry serves earned, locked and category-tinted variants and
 * can be unit-tested without a renderer. See docs/progress-redesign/ASSET_SPEC.md.
 */
export type ArtRole = 'accent' | 'ink' | 'gold' | 'muted';

export type ArtPrimitive =
  | { kind: 'circle'; cx: number; cy: number; r: number; role: ArtRole; fill?: boolean; width?: number; dash?: string; opacity?: number }
  | { kind: 'path'; d: string; role: ArtRole; fill?: boolean; width?: number; dash?: string; opacity?: number };

export const ART_SIZE = 120;
const C = ART_SIZE / 2;

const round = (n: number) => Math.round(n * 100) / 100;

function polar(radius: number, angleDeg: number, cx = C, cy = C): [number, number] {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return [round(cx + radius * Math.cos(a)), round(cy + radius * Math.sin(a))];
}

function arc(radius: number, from: number, to: number): string {
  const [x1, y1] = polar(radius, from);
  const [x2, y2] = polar(radius, to);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Concentric broken rings: one per tier, the outermost the most open, so strength reads as energy, not a meter. */
function energyRings(tier: number): ArtPrimitive[] {
  const prims: ArtPrimitive[] = [{ kind: 'circle', cx: C, cy: C, r: 5, role: 'accent', fill: true }];
  for (let i = 0; i < tier; i += 1) {
    const radius = 14 + i * 9;
    const gap = 18 + i * 14;
    const start = i * 37;
    prims.push({ kind: 'path', d: arc(radius, start + gap / 2, start + 360 - gap / 2), role: 'accent', width: 3.2 - i * 0.3, opacity: 1 - i * 0.12 });
  }
  return prims;
}

function stones(tier: number): ArtPrimitive[] {
  const count = Math.min(5, tier + 1);
  const prims: ArtPrimitive[] = [{ kind: 'path', d: 'M 24 96 H 96', role: 'gold', width: 1.4 }];
  let y = 92;
  for (let i = 0; i < count; i += 1) {
    const width = 58 - i * 9;
    const height = 13 - i * 0.8;
    const x = C - width / 2 + (i % 2 === 0 ? -1.5 : 1.5);
    y -= height + 1.5;
    prims.push({
      kind: 'path',
      d: `M ${round(x + 6)} ${round(y)} H ${round(x + width - 6)} Q ${round(x + width)} ${round(y)} ${round(x + width)} ${round(y + height / 2)} Q ${round(x + width)} ${round(y + height)} ${round(x + width - 6)} ${round(y + height)} H ${round(x + 6)} Q ${round(x)} ${round(y + height)} ${round(x)} ${round(y + height / 2)} Q ${round(x)} ${round(y)} ${round(x + 6)} ${round(y)} Z`,
      role: 'ink',
      width: 2,
    });
  }
  return prims;
}

function star(points: number, outer: number, inner: number): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const [x, y] = polar(i % 2 === 0 ? outer : inner, (360 / (points * 2)) * i);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${parts.join(' ')} Z`;
}

const sealedStar = (): ArtPrimitive[] => [
  { kind: 'circle', cx: C, cy: C, r: 40, role: 'gold', width: 1.4 },
  { kind: 'path', d: star(8, 32, 14), role: 'ink', width: 2.2 },
  { kind: 'circle', cx: C, cy: C, r: 6, role: 'gold', fill: true },
];

function lotusStar(tier: number): ArtPrimitive[] {
  const petals = 4 + tier;
  const prims: ArtPrimitive[] = [{ kind: 'circle', cx: C, cy: C, r: 42, role: 'gold', width: 1.2, dash: '2 4' }];
  for (let i = 0; i < petals; i += 1) {
    const angle = (360 / petals) * i;
    const [tx, ty] = polar(34, angle);
    const [lx, ly] = polar(15, angle - 24);
    const [rx, ry] = polar(15, angle + 24);
    prims.push({ kind: 'path', d: `M ${C} ${C} Q ${lx} ${ly} ${tx} ${ty} Q ${rx} ${ry} ${C} ${C} Z`, role: 'ink', width: 1.8 });
  }
  prims.push({ kind: 'circle', cx: C, cy: C, r: 5, role: 'gold', fill: true });
  return prims;
}

function hourglass(tier: number): ArtPrimitive[] {
  // More sand has fallen with each tier. The lower bulb narrows linearly toward the neck.
  const sand = 0.2 + tier * 0.12;
  const surface = 92 - 26 * sand;
  const halfAtSurface = Math.max(0, (18 * (surface - 60)) / 38);
  return [
    { kind: 'path', d: 'M 36 22 H 84 M 36 98 H 84', role: 'gold', width: 2.4 },
    { kind: 'path', d: 'M 42 22 C 42 48 58 52 60 60 C 62 52 78 48 78 22 M 42 98 C 42 72 58 68 60 60 C 62 68 78 72 78 98', role: 'ink', width: 2.2 },
    { kind: 'path', d: `M ${round(60 - halfAtSurface)} ${round(surface)} H ${round(60 + halfAtSurface)} L 78 98 H 42 Z`, role: 'gold', fill: true, opacity: 0.55 },
    { kind: 'path', d: 'M 60 60 V 74', role: 'gold', width: 1.4 },
  ];
}

const waypoint = (): ArtPrimitive[] => [
  { kind: 'path', d: 'M 40 92 H 80', role: 'ink', width: 2 },
  { kind: 'path', d: 'M 60 92 V 34', role: 'ink', width: 2.4 },
  { kind: 'path', d: 'M 60 34 L 84 42 L 60 52 Z', role: 'gold', fill: true },
  { kind: 'circle', cx: 60, cy: 92, r: 4, role: 'ink', fill: true },
];

const ridge = (): ArtPrimitive[] => [
  { kind: 'path', d: 'M 14 92 L 42 56 L 56 72 L 80 36 L 106 92', role: 'ink', width: 2.2 },
  { kind: 'path', d: 'M 24 92 Q 44 80 58 84 T 92 78', role: 'gold', width: 1.6, dash: '3 4' },
  { kind: 'circle', cx: 42, cy: 56, r: 3.6, role: 'gold', fill: true },
  { kind: 'circle', cx: 80, cy: 36, r: 3.6, role: 'ink', width: 1.8 },
  { kind: 'path', d: 'M 14 100 H 106', role: 'ink', width: 1.2, opacity: 0.5 },
];

const summit = (): ArtPrimitive[] => [
  { kind: 'path', d: 'M 16 94 L 46 52 L 60 68 L 78 32 L 104 94 Z', role: 'ink', width: 2.2 },
  { kind: 'path', d: 'M 78 32 V 16', role: 'ink', width: 2.2 },
  { kind: 'path', d: 'M 78 16 L 96 22 L 78 30 Z', role: 'gold', fill: true },
  { kind: 'path', d: 'M 60 68 L 66 76 L 72 70', role: 'ink', width: 1.4, opacity: 0.6 },
];

function sunrise(): ArtPrimitive[] {
  const prims: ArtPrimitive[] = [
    { kind: 'path', d: 'M 20 82 H 100', role: 'ink', width: 2.2 },
    { kind: 'path', d: `M 40 82 A 20 20 0 0 1 80 82`, role: 'gold', width: 2.6 },
  ];
  for (let i = 0; i < 7; i += 1) {
    const angle = -90 + 30 * i;
    const [x1, y1] = polar(28, angle, C, 82);
    const [x2, y2] = polar(40, angle, C, 82);
    prims.push({ kind: 'path', d: `M ${x1} ${y1} L ${x2} ${y2}`, role: 'gold', width: 1.8, opacity: 0.85 });
  }
  return prims;
}

export function motifPrimitives(motif: MilestoneMotif, tier: number): ArtPrimitive[] {
  switch (motif) {
    case 'pictureFrame':
      return [
        { kind: 'path', d: 'M 22 32 L 89 22 L 96 86 L 29 94 Z M 34 38 H 98 V 98 H 34 Z M 40 44 H 92 V 91 H 40 Z', role: 'ink', width: 1.5 },
        { kind: 'path', d: 'M 42 88 L 56 65 L 68 77 L 79 62 L 90 88 Z', role: 'ink', fill: true },
        { kind: 'circle', cx: 55, cy: 56, r: 5, role: 'gold', fill: true },
      ];
    case 'opticalLens':
      return [
        ...[43, 35, 24, 13].map((r): ArtPrimitive => ({ kind: 'circle', cx: 60, cy: 60, r, role: r === 35 ? 'gold' : 'ink', width: 1 })),
        { kind: 'path', d: 'M 60 12 V 108 M 12 60 H 108', role: 'gold', width: 0.7 },
        { kind: 'circle', cx: 60, cy: 60, r: 6, role: 'gold', fill: true },
      ];
    case 'doorway':
      return [
        { kind: 'path', d: 'M 23 102 L 38 21 Q 60 7 82 21 L 97 102 Z M 36 88 L 45 29 Q 60 19 75 29 L 84 88 Z M 23 102 H 97 M 29 95 H 91 M 33 88 H 87 M 38 81 H 82 M 42 74 H 78', role: 'ink', width: 1.5 },
        { kind: 'circle', cx: 60, cy: 53, r: 9, role: 'gold', fill: true },
        { kind: 'path', d: 'M 60 27 V 39 M 40 39 L 49 46 M 80 39 L 71 46', role: 'gold', width: 1 },
      ];
    case 'energyRings':
      return energyRings(tier);
    case 'stones':
      return stones(tier);
    case 'sealedStar':
      return sealedStar();
    case 'hourglass':
      return hourglass(tier);
    case 'lotusStar':
      return lotusStar(tier);
    case 'waypoint':
      return waypoint();
    case 'ridge':
      return ridge();
    case 'summit':
      return summit();
    case 'sunrise':
      return sunrise();
  }
}
