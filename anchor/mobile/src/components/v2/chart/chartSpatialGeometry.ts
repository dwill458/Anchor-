import { waypointFractions, type RoutePoint } from './chartRouteGeometry';

export type ChartSize = { width: number; height: number };

export type ChartCoverFrame = {
  viewport: ChartSize;
  source: ChartSize;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  cropX: number;
  cropY: number;
};

export type ChartCameraTarget = {
  scale: number;
  translateX: number;
  translateY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/** Deterministic `cover` geometry shared by raster art, SVG and node targeting. */
export function chartCoverFrame(source: ChartSize, viewport: ChartSize): ChartCoverFrame {
  const scale = Math.max(viewport.width / source.width, viewport.height / source.height);
  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;
  return {
    source,
    viewport,
    scale,
    renderedWidth,
    renderedHeight,
    cropX: (viewport.width - renderedWidth) / 2,
    cropY: (viewport.height - renderedHeight) / 2,
  };
}

export function projectChartPoint(point: RoutePoint, frame: ChartCoverFrame): RoutePoint {
  return {
    x: frame.cropX + point.x * frame.renderedWidth,
    y: frame.cropY + point.y * frame.renderedHeight,
  };
}

/**
 * Camera translation for a centre-origin scale. Translation is clamped so the
 * opaque master continues to cover every viewport edge at the target zoom.
 */
export function chartCameraTarget({
  frame,
  node,
  focalPoint,
  zoom,
}: {
  frame: ChartCoverFrame;
  node: RoutePoint;
  focalPoint: RoutePoint;
  zoom: number;
}): ChartCameraTarget {
  const scale = Math.max(1, zoom);
  if (scale === 1) {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    };
  }

  const { width, height } = frame.viewport;
  const centre = { x: width / 2, y: height / 2 };
  const projected = projectChartPoint(node, frame);
  const focal = { x: focalPoint.x * width, y: focalPoint.y * height };
  const scaledNode = {
    x: centre.x + scale * (projected.x - centre.x),
    y: centre.y + scale * (projected.y - centre.y),
  };

  const rawLeft = centre.x + scale * (frame.cropX - centre.x);
  const rawRight = centre.x + scale * (frame.cropX + frame.renderedWidth - centre.x);
  const rawTop = centre.y + scale * (frame.cropY - centre.y);
  const rawBottom = centre.y + scale * (frame.cropY + frame.renderedHeight - centre.y);
  const bounds = {
    minX: width - rawRight,
    maxX: -rawLeft,
    minY: height - rawBottom,
    maxY: -rawTop,
  };

  return {
    scale,
    translateX: clamp(focal.x - scaledNode.x, bounds.minX, bounds.maxX),
    translateY: clamp(focal.y - scaledNode.y, bounds.minY, bounds.maxY),
    bounds,
  };
}

/** Route progress remains adaptive; the final server waypoint is destination. */
export function chartSpatialNodeProgress(count: number): number[] {
  return waypointFractions(count);
}
