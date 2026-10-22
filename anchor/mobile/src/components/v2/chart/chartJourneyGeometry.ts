/** Registered master coordinates. This module deliberately does not change Home's legacy route. */
export type WorldPoint = { x: number; y: number; depth: number };
export type RoadSample = WorldPoint & { distance: number };
export type WorldSize = { width: number; height: number };
export const ROUTE_START = .08;
export const WAYPOINT_ROUTE_END = .90;
export const UNCONFIRMED_ROUTE_END = .96;
export const MASTER = { width: 3240, height: 5760 };
export const WORLD_TEXTURE_BUDGET = 48 * 1024 * 1024;
export const WORLD_GPU_BUDGET = 96 * 1024 * 1024;

// Fixed registration corrects the supplied cutouts, which do not reconstruct 1.png at identity.
// Every source retains its complete 9:16 master coordinate system; no pixels are repainted.
export const WORLD_LAYERS = [
  { id: 'sky', width: 720, height: 1280, parallax: .05, rect: { x: -.3, y: -1.06, scale: 1.6 } },
  { id: 'city', width: 1080, height: 1920, parallax: .15, rect: { x: .1, y: .025, scale: .7 } },
  { id: 'midground', width: 1080, height: 1920, parallax: .30, rect: { x: -1.15, y: -1.19, scale: 3.3 } },
  { id: 'road', width: 1440, height: 2560, parallax: .65, rect: { x: .05, y: .21, scale: .8 } },
  { id: 'foreground', width: 1080, height: 1920, parallax: 1, rect: { x: -.36, y: .18, scale: 1.4 } },
] as const;
export type WorldLayer = typeof WORLD_LAYERS[number];
export function decodedWorldBytes(): number {
  return WORLD_LAYERS.reduce((sum, layer) => sum + layer.width * layer.height * 4, 0);
}

// Traced from the physical asphalt in 5.png, before fixed registration.
const ROAD_TRACE = [
  [0, .785], [.13, .756], [.28, .722], [.43, .683], [.57, .635],
  [.68, .588], [.73, .553], [.715, .528], [.65, .506], [.583, .486],
  [.567, .467], [.602, .449], [.70, .430], [.81, .409], [.90, .389],
  [.931, .369], [.902, .349], [.823, .332], [.750, .320], [.717, .306],
  [.747, .292], [.820, .279], [.866, .267], [.861, .259], [.785, .249],
  [.757, .244], [.787, .240], [.78, .235], [.681, .230],
] as const;
const roadRect = WORLD_LAYERS[3].rect;
export const ROAD_CENTERLINE: readonly WorldPoint[] = ROAD_TRACE.map(([x, y], i) => ({
  x: roadRect.x + x * roadRect.scale, y: roadRect.y + y * roadRect.scale,
  depth: 1 - .8 * i / (ROAD_TRACE.length - 1),
}));

export function clamp01(value: number): number {
  'worklet';
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function spline(a: number, b: number, c: number, d: number, t: number): number {
  return .5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
}
export function buildRoadGeometry(): readonly RoadSample[] {
  const samples: RoadSample[] = [];
  let length = 0;
  for (let i = 0; i < 512; i++) {
    const position = i / 511 * (ROAD_CENTERLINE.length - 1);
    const segment = Math.min(ROAD_CENTERLINE.length - 2, Math.floor(position));
    const t = position - segment;
    const a = ROAD_CENTERLINE[Math.max(0, segment - 1)], b = ROAD_CENTERLINE[segment];
    const c = ROAD_CENTERLINE[segment + 1], d = ROAD_CENTERLINE[Math.min(ROAD_CENTERLINE.length - 1, segment + 2)];
    const point = { x: spline(a.x,b.x,c.x,d.x,t), y: spline(a.y,b.y,c.y,d.y,t), depth: b.depth+(c.depth-b.depth)*t };
    if (i) length += Math.hypot((point.x-samples[i-1].x)*MASTER.width, (point.y-samples[i-1].y)*MASTER.height);
    samples.push({ ...point, distance: length });
  }
  return samples.map(point => ({ ...point, distance: point.distance / length }));
}
export const ROAD_TABLE = buildRoadGeometry();
export function getPointAtNormalizedDistance(progress: number, table: readonly RoadSample[] = ROAD_TABLE): WorldPoint {
  'worklet';
  const p = clamp01(progress);
  let low = 0, high = table.length - 1;
  while (high-low > 1) {
    const mid = (low+high) >> 1;
    if (table[mid].distance < p) low = mid; else high = mid;
  }
  const a = table[low], b = table[high];
  const t = (p-a.distance) / (b.distance-a.distance || 1);
  return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t, depth: a.depth+(b.depth-a.depth)*t };
}
export function getWaypointRoutePositions(count: number): number[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return Array.from({ length: n }, (_, i) => n === 1 ? ROUTE_START : ROUTE_START+i/(n-1)*(WAYPOINT_ROUTE_END-ROUTE_START));
}
export function getJourneyRouteProgress(count: number, currentIndex: number, fraction: number | null | undefined, confirmed: boolean): number {
  const positions = getWaypointRoutePositions(count);
  if (!positions.length) return 0;
  if (confirmed) return 1;
  // An unresolved current pointer cannot invent movement from a completion count.
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= count) return ROUTE_START;
  const start = positions[currentIndex], end = positions[currentIndex+1] ?? UNCONFIRMED_ROUTE_END;
  return Math.min(UNCONFIRMED_ROUTE_END, start+(end-start)*clamp01(fraction ?? 0));
}
export function getNodeVisualScale(depth: number): number {
  'worklet';
  return .35 + .65 * clamp01((depth-.2)/.8);
}
export type CameraTransform = { scale: number; left: number; top: number; width: number; height: number };
/** The registered sky supplies horizontal overscan, allowing more of the tall journey to remain visible. */
export function getWorldBaseSize(size: WorldSize): WorldSize {
  'worklet';
  const baseline = Math.max(size.width/(MASTER.width*1.5),size.height/MASTER.height);
  return { width:MASTER.width*baseline,height:MASTER.height*baseline };
}
const SCALE_KEYS = [0,.25,.5,.75,.9,1];
const SCALE_VALUES = [1,1.12,1.3,1.5,1.72,1.95];
export function getLayerParallax(progress: number, strength: number): { x: number; y: number } {
  'worklet';
  const p = clamp01(progress);
  // Master-relative translations are deliberately much smaller than global travel.
  return { x: Math.sin(p * Math.PI * 2) * .004 * strength, y: -p * .012 * strength };
}
export function getRoadParallax(progress: number): { x: number; y: number } {
  'worklet';
  return getLayerParallax(progress, .65);
}
export function getCameraTransform(progress: number, size: WorldSize, table: readonly RoadSample[] = ROAD_TABLE, focalY = .72): CameraTransform {
  'worklet';
  const p = clamp01(progress);
  let index = 1;
  while (index < SCALE_KEYS.length-1 && p > SCALE_KEYS[index]) index++;
  const t = (p-SCALE_KEYS[index-1])/(SCALE_KEYS[index]-SCALE_KEYS[index-1]);
  const scale = SCALE_VALUES[index-1]+t*(SCALE_VALUES[index]-SCALE_VALUES[index-1]);
  const base = getWorldBaseSize(size);
  const width = base.width*scale, height = base.height*scale;
  const point = getPointAtNormalizedDistance(p, table), offset = getRoadParallax(p);
  // Clamp to registered scenery coverage, with sky above and continuous water below.
  const left = Math.max(size.width-width*1.3, Math.min(width*.3, size.width*.5-(point.x+offset.x)*width));
  const top = Math.max(size.height-height*1.48, Math.min(height*.12, size.height*focalY-(point.y+offset.y)*height));
  return { scale, left, top, width, height };
}
export function worldToViewport(point: WorldPoint, camera: CameraTransform, offset = { x: 0, y: 0 }): { x: number; y: number } {
  'worklet';
  return { x: camera.left+(point.x+offset.x)*camera.width, y: camera.top+(point.y+offset.y)*camera.height };
}
export function pickWaypoint(x: number, y: number, nodes: readonly { id: string; x: number; y: number; current: boolean }[]): string | null {
  'worklet';
  let closest: string | null = null, distance = Infinity, current = false;
  for (const node of nodes) {
    if (Math.abs(x-node.x)>24 || Math.abs(y-node.y)>24) continue;
    const next = (x-node.x)**2+(y-node.y)**2;
    if (next < distance || (next === distance && node.current && !current)) {
      closest=node.id; distance=next; current=node.current;
    }
  }
  return closest;
}
