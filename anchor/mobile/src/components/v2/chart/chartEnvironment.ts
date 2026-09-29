import type { ImageSourcePropType } from 'react-native';
import type { V2Category } from '@/theme/v2';
import { CHART_PACKS, CHART_ROUTE_CONTROL_POINTS, type ChartArt, type RoutePoint } from './chartRouteGeometry';

export type ChartDepthPlane = 'far' | 'mid' | 'foreground' | 'atmosphere' | 'occlusion';

export type ChartDepthLayer = {
  id: string;
  source: ImageSourcePropType;
  plane: ChartDepthPlane;
  depth: number;
  maximumOpacity: number;
  sourceRect?: { x: number; y: number; width: number; height: number };
};

export type ChartEnvironment = {
  category: Lowercase<V2Category>;
  master: ChartArt;
  layers: readonly ChartDepthLayer[];
  route: readonly RoutePoint[];
  camera: {
    focalPoint: RoutePoint;
    preferredZoom: number;
    maximumZoom: number;
  };
};

/**
 * Desire ships master-only until registered alpha layers pass alignment and
 * texture-budget review. The scene is intentionally complete at rest.
 */
export const DESIRE_CHART_ENVIRONMENT: ChartEnvironment = {
  category: 'desire',
  master: CHART_PACKS.desireCinematic,
  layers: [],
  route: CHART_ROUTE_CONTROL_POINTS,
  camera: { focalPoint: { x: 0.54, y: 0.42 }, preferredZoom: 1.4, maximumZoom: 1.5 },
};

export function chartEnvironmentFor(category?: string | null): ChartEnvironment | null {
  return category?.trim().toLowerCase() === 'desire' ? DESIRE_CHART_ENVIRONMENT : null;
}

/** Conservative RGBA decode estimate; compressed bytes are not the runtime cost. */
export function decodedTextureBytes(width: number, height: number): number {
  return Math.max(0, Math.round(width)) * Math.max(0, Math.round(height)) * 4;
}
