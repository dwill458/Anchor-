import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Canvas, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';

import { colors } from '@/theme/colors';
import { swatchForLane } from '@/theme/creationStyleSwatches';
import type { RefineStyleOption } from '../../constants/refineStyles';
import type { Pt } from '../geometry';

export const CHIP_WIDTH = 80;
export const CHIP_HEIGHT = 104;
const CHIP_RADIUS = 12;

interface StyleChipProps {
  style: RefineStyleOption;
  selected: boolean;
  onPress: (style: RefineStyleOption) => void;
  /** The person's own anchor, drawn small on the swatch. */
  strokes: Pt[][];
  /** Real preview art, when it exists. Takes precedence over the generated swatch. */
  previewSource?: ImageSourcePropType;
  width?: number;
  height?: number;
  /** Extra label context for assistive tech. */
  accessibilityHint?: string;
}

/**
 * DECISION D6: no per-style preview images exist, so a chip is a gradient swatch taken from the
 * style's palette lane with the anchor's line drawn on it. `previewSource` is kept for the day
 * real previews arrive.
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

  // Fit the anchor into the swatch with a margin.
  const pathData = useMemo(() => {
    const all = strokes.flat();
    if (all.length === 0) return '';
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    const k = (Math.min(width, height) * 0.58) / extent;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return strokes
      .filter((stroke) => stroke.length >= 2)
      .map((stroke) =>
        stroke
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${width / 2 + (p.x - cx) * k} ${height / 2 + (p.y - cy) * k}`)
          .join(' ')
      )
      .join(' ');
  }, [strokes, width, height]);

  const lineColor = swatch.dark ? colors.creation.cream : colors.creation.ink;

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
        {previewSource ? (
          <Image source={previewSource} style={{ width, height }} resizeMode="cover" />
        ) : (
          <Canvas style={{ width, height }}>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[swatch.from, swatch.to]} />
            </Rect>
            {pathData ? (
              <Path path={pathData} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" color={lineColor} />
            ) : null}
          </Canvas>
        )}
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
