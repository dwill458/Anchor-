import React from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';
import { APPROVED_MILESTONE_ASSETS, type SvgNode } from './approvedAssets';

export const SVG_COMPONENTS: Record<string, React.ElementType> = {
  svg: Svg, g: G, defs: Defs, circle: Circle, clipPath: ClipPath, ellipse: Ellipse,
  line: Line, linearGradient: LinearGradient, path: Path, polygon: Polygon,
  polyline: Polyline, radialGradient: RadialGradient, rect: Rect, stop: Stop,
};

/** Avoid gradient/clip collisions when the same milestone appears more than once. */
export function namespaceSvgAttrs(attrs: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key,
    key === 'id' ? `${prefix}-${value}` : value.replace(/url\(#([^)]*)\)/g, `url(#${prefix}-$1)`),
  ]));
}

export interface ApprovedMilestoneSvgProps {
  definitionId: string;
  state: 'earned' | 'locked';
  size: number;
  testID?: string;
}

/** Exact static primitives from the supplied package; no web effects or raster fallback. */
export function ApprovedMilestoneSvg({ definitionId, state, size, testID }: ApprovedMilestoneSvgProps) {
  const prefix = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const asset = APPROVED_MILESTONE_ASSETS[definitionId];
  if (!asset) return null;
  const render = (node: SvgNode, index: number): React.ReactNode => {
    const Component = SVG_COMPONENTS[node.tag];
    const attrs = namespaceSvgAttrs(node.attrs, prefix);
    return React.createElement(Component, {
      ...attrs, key: `${node.attrs.id ?? node.tag}-${index}`,
      ...(node.tag === 'svg' ? { width: size, height: size, testID, accessible: false } : {}),
    }, ...node.children.map(render));
  };
  return render(asset[state], 0);
}
