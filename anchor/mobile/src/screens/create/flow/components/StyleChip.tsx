import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Canvas, DashPathEffect, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';

import { colors } from '@/theme/colors';
import { swatchForLane } from '@/theme/creationStyleSwatches';
import { STYLE_ASSETS } from '@/assets/styles';
import type { RefineStyleOption } from '../../constants/refineStyles';
import type { Pt } from '../geometry';
import { strokeTreatmentFor, treatmentForLightField } from '../scenes/styleStrokes';

export const CHIP_WIDTH = 80;
export const CHIP_HEIGHT = 104;
const CHIP_RADIUS = 12;

interface StyleChipProps {
  style: RefineStyleOption;
  selected: boolean;
  onPress: (style: RefineStyleOption) => void;
  /** The person's own anchor, drawn small on the swatch. */
  strokes: Pt[][];
  /** Real preview art, when it exists. Takes precedence over the style thumbnail asset. */
  previewSource?: ImageSourcePropType;
  width?: number;
  height?: number;
  /** Extra label context for assistive tech. */
  accessibilityHint?: string;
}

const DEFAULT_ANCHOR_STROKES: Pt[][] = [
  [{ x: 50, y: 22 }, { x: 50, y: 78 }],
  [{ x: 32, y: 46 }, { x: 68, y: 46 }],
  [{ x: 26, y: 62 }, { x: 50, y: 78 }, { x: 74, y: 62 }],
];

/**
 * Anchor 2.0 style card: displays the style artwork thumbnail as the background
 * with the person's Anchor glyph preview overlaid cleanly on top with adaptive contrast.
 */
export function StyleChip({
  style,
  selected,
  onPress,
  strokes,
  previewSource,
  width = CHIP_WIDTH,
  height = CHIP_HEIGHT,
  accessibilityHint,
}: StyleChipProps) {
  const swatch = useMemo(() => swatchForLane(style.paletteLane), [style.paletteLane]);

  const resolvedPreview =
    previewSource ??
    STYLE_ASSETS[style.id] ??
    STYLE_ASSETS[style.generationStyle] ??
    STYLE_ASSETS[style.name];

  const effectiveStrokes = strokes.length > 0 && strokes.flat().length > 0 ? strokes : DEFAULT_ANCHOR_STROKES;

  // Fit the anchor into the swatch with a margin.
  const pathData = useMemo(() => {
    const all = effectiveStrokes.flat();
    if (all.length === 0) return '';
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    const k = (Math.min(width, height) * 0.58) / extent;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return effectiveStrokes
      .filter((stroke) => stroke.length >= 2)
      .map((stroke) =>
        stroke
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${width / 2 + (p.x - cx) * k} ${height / 2 + (p.y - cy) * k}`)
          .join(' ')
      )
      .join(' ');
  }, [effectiveStrokes, width, height]);

  // Contrast handling: dark fields use light/cream anchor; light fields use dark-ink anchor
  const isLightGlyph = style.glyphTreatment
    ? style.glyphTreatment === 'light'
    : swatch.dark;
  // The line takes the style's material (stitched, glazed, felt, leaf…) rather than a flat tint.
  const strokeLayers = useMemo(() => {
    const base = strokeTreatmentFor(style.id);
    return (isLightGlyph ? base : treatmentForLightField(base)).layers;
  }, [isLightGlyph, style.id]);
  const layerUnit = (Math.min(width, height) / CHIP_HEIGHT) * 0.72;

  return (
    <Pressable
      onPress={() => onPress(style)}
      accessibilityRole="button"
      accessibilityLabel={style.displayName}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={[
        styles.frame,
        { width: width + 6, height: height + 6 },
        selected ? styles.frameSelected : styles.frameIdle,
      ]}
    >
      <View style={[styles.clip, { width, height }]}>
        {resolvedPreview ? (
          <Image source={resolvedPreview} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
        ) : (
          <Canvas style={{ width, height }}>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[swatch.from, swatch.to]} />
            </Rect>
          </Canvas>
        )}
        {pathData ? (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            {strokeLayers.map((layer, index) => (
              <Path
                key={index}
                path={pathData}
                style="stroke"
                strokeWidth={layer.width * layerUnit}
                strokeCap="round"
                strokeJoin="round"
                color={layer.color}
                opacity={layer.alpha}
              >
                {layer.dash ? <DashPathEffect intervals={[layer.dash[0] * layerUnit, layer.dash[1] * layerUnit]} /> : null}
              </Path>
            ))}
          </Canvas>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CHIP_RADIUS + 3,
  },
  frameSelected: { borderWidth: 2, borderColor: colors.creation.gold },
  // Others: a hairline of cream at ~22%.
  frameIdle: { borderWidth: 1, borderColor: 'rgba(244, 237, 224, 0.22)' },
  clip: { borderRadius: CHIP_RADIUS, overflow: 'hidden' },
});
