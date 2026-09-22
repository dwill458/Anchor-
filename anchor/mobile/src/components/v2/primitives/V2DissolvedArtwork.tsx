import React, { memo, useId } from 'react';
import { Image, StyleSheet, View, type ImageResizeMode, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

type Edges = { left?: number; right?: number; top?: number; bottom?: number };

type Props = {
  source: ImageSourcePropType;
  /**
   * The solid colour directly behind the artwork. The dissolve resolves into
   * exactly this colour, so on a flat surface it is indistinguishable from an
   * alpha mask — and it must match, or the frame reappears as a tinted box.
   */
  surface: string;
  /** The artwork's focal point as a fraction of the frame. It stays clearest. */
  focus?: { x: number; y: number };
  /** How far each edge's dissolve reaches into the frame, as a fraction of it. */
  fade?: Edges;
  /**
   * Radius of the clear region around the focus, as a fraction of the frame.
   * Beyond it the artwork falls off elliptically into the surface.
   */
  clearRadius?: number;
  /**
   * Radius of the elliptical falloff as a fraction of the frame on each axis;
   * past it the artwork is fully dissolved.
   */
  radius?: number;
  /** Preserve the source composition when a cropped frame would lose artwork. */
  resizeMode?: ImageResizeMode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Samples of an ease-in-out curve. A two-stop gradient ends in a visible
 * ridge (the eye reads the point where its slope changes as a line); an eased
 * ramp has no such point, so the edge of the dissolve cannot be located.
 */
const RAMP = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1];
const ease = (t: number) => t * t * (3 - 2 * t);

/** Fully the surface at the frame edge, easing to clear at the fade depth. */
const EDGE_STOPS = RAMP.map((t) => ({ offset: t, opacity: 1 - ease(t) }));

/**
 * Artwork that emerges from and dissolves back into a dark surface, with no
 * perceptible rectangle. The treatment lives in the UI rather than in the
 * source files, so every practice/category illustration gets the same edge.
 *
 * Layers (one native image + one SVG, no per-frame work):
 *   1. the artwork, `cover`-fitted
 *   2. an elliptical falloff centred on the focal point
 *   3. eased linear dissolves on each edge
 *
 * Overlapping dissolves multiply — (1-a)(1-b) — exactly as nested alpha masks
 * would, so corners fall off smoothly instead of forming a lighter notch.
 */
function V2DissolvedArtworkComponent({
  source,
  surface,
  focus = { x: 0.5, y: 0.5 },
  fade = {},
  clearRadius = 0.42,
  radius = 0.66,
  resizeMode = 'cover',
  style,
  testID,
}: Props) {
  const id = useId().replace(/:/g, '');
  const edges: Array<[keyof Edges, number]> = (['left', 'right', 'top', 'bottom'] as const)
    .map((edge) => [edge, fade[edge] ?? 0] as [keyof Edges, number])
    .filter(([, depth]) => depth > 0);
  const radialStops = [
    { offset: 0, opacity: 0 },
    ...RAMP.map((t) => ({ offset: clearRadius + (1 - clearRadius) * t, opacity: ease(t) })),
  ];

  return (
    <View testID={testID} style={[styles.frame, style]} pointerEvents="none">
      <Image source={source} style={styles.image} resizeMode={resizeMode} fadeDuration={0} accessibilityIgnoresInvertColors />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          {/*
            rx/ry, not r: react-native-svg on Android sizes radial gradients
            from rx/ry (defaulting to 50%) and ignores r, which shrank the
            clear region to a small blob on device.
          */}
          <RadialGradient id={`${id}-focus`} cx={focus.x} cy={focus.y} r={radius} rx={radius} ry={radius} fx={focus.x} fy={focus.y} gradientUnits="objectBoundingBox">
            {radialStops.map((stop) => <Stop key={stop.offset} offset={stop.offset} stopColor={surface} stopOpacity={stop.opacity} />)}
          </RadialGradient>
          {edges.map(([edge, depth]) => {
            const horizontal = edge === 'left' || edge === 'right';
            const start = edge === 'left' || edge === 'top' ? 0 : 1;
            const end = start === 0 ? depth : 1 - depth;
            return (
              <LinearGradient
                key={edge}
                id={`${id}-${edge}`}
                x1={horizontal ? start : 0}
                x2={horizontal ? end : 0}
                y1={horizontal ? 0 : start}
                y2={horizontal ? 0 : end}
                gradientUnits="objectBoundingBox"
              >
                {EDGE_STOPS.map((stop) => <Stop key={stop.offset} offset={stop.offset} stopColor={surface} stopOpacity={stop.opacity} />)}
              </LinearGradient>
            );
          })}
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${id}-focus)`} />
        {edges.map(([edge]) => <Rect key={edge} x={0} y={0} width={100} height={100} fill={`url(#${id}-${edge})`} />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});

export const V2DissolvedArtwork = memo(V2DissolvedArtworkComponent);
