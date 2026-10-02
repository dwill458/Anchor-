import React, { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SigilSvg } from '@/components/common/SigilSvg';
import type { AnchorExpression } from '@/constants/v2/creation';
import { colors, getCategoryColor, getCategoryFieldColor, radii } from '@/theme/v2';
import { AnchorMark } from './AnchorMark';
import { trace } from '@/utils/dev/creationTrace';

import type { StyleProp, ViewStyle } from 'react-native';

export type CircularAnchorSize = 'hero' | 'large' | 'medium' | 'thumbnail' | 'micro' | number;
const sizes: Record<'hero' | 'large' | 'medium' | 'thumbnail' | 'micro', number> = { hero: 266, large: 152, medium: 104, thumbnail: 64, micro: 44 };

/**
 * `paper` is the warm ivory artwork disc used where the Anchor is the hero.
 * `tinted` is the category-washed chip used where it is secondary.
 * `dark` is the subtle deep surface used in dark immersive practice environments.
 * `bare` is no surface at all: the artwork stands free on the page as a mark.
 *   It is what a context header wants, where a disc and a rim would read as a
 *   profile avatar rather than as the object the user is reinforcing.
 *
 * It must be stated explicitly whenever `size` is a number: a layout that owns
 * its own scale (the Home hero carousel) still needs the paper treatment, and
 * inferring it from the `'hero'` keyword alone would silently tint it.
 */
export type CircularAnchorAppearance = 'paper' | 'tinted' | 'dark' | 'bare';

type Props = {
  svg: string;
  /** The finished (AI-enhanced) artwork. It fills the disc; the SVG structure is the fallback if it is absent or fails to load. */
  imageUrl?: string | null;
  category?: string | null;
  /**
   * How the structure appears. When set, the mark is drawn through `AnchorMark` so the kept
   * expression shows here exactly as it did when it was chosen. Unset keeps the plain stored
   * SVG, which is what Anchors without a recorded expression have always shown.
   */
  expression?: AnchorExpression | null;
  /** A named step, or an exact diameter in dp when the layout owns the scale. */
  size?: CircularAnchorSize;
  appearance?: CircularAnchorAppearance;
  state?: 'active' | 'inactive';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Dev only: log first render and image load for this renderer on the creation trace. */
  traceLabel?: string;
  /** Fired once the finished artwork has loaded (not for the SVG fallback). */
  onImageLoad?: () => void;
};

/** A flat field + the existing stable SVG renderer. It deliberately has no rim, halo, or animation. */
export const CircularAnchorRenderer = memo(function CircularAnchorRenderer({ svg, imageUrl, category, expression, size = 'medium', appearance, state = 'active', accessibilityLabel, testID, style, traceLabel, onImageLoad }: Props) {
  const dimension = typeof size === 'number' ? size : (sizes[size] ?? 104);
  const color = getCategoryColor(category);
  const isBare = appearance === 'bare';
  const isDark = appearance === 'dark';
  const isPaper = !isBare && !isDark && (appearance ?? (size === 'hero' ? 'paper' : 'tinted')) === 'paper';
  const fieldColor = isBare
    ? 'transparent'
    : isDark
    ? 'rgba(255, 255, 255, 0.035)'
    : isPaper
    ? colors.frame
    : getCategoryFieldColor(category);
  const borderColor = isBare
    ? 'transparent'
    : isDark
    ? `${color}38`
    : isPaper
    ? colors.frameEdge
    : `${color}52`;
  const [imageFailed, setImageFailed] = useState(false);
  const tracedRef = useRef(false);
  if (traceLabel && !tracedRef.current) {
    tracedRef.current = true;
    trace(`${traceLabel} first render`, { imageUrlLength: typeof imageUrl === 'string' ? imageUrl.length : 0, size });
  }
  useEffect(() => setImageFailed(false), [imageUrl]);
  const showImage = typeof imageUrl === 'string' && imageUrl.length > 0 && !imageFailed;
  const resolvedAppearance: CircularAnchorAppearance = isBare ? 'bare' : isDark ? 'dark' : isPaper ? 'paper' : 'tinted';
  const imageSize = dimension * circularAnchorArtworkShare(resolvedAppearance, dimension, true);
  const hasArtwork = typeof svg === 'string' && svg.trim().length > 0;
  const artworkSize = dimension * circularAnchorArtworkShare(resolvedAppearance, dimension, false);
  return <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? `${category ?? 'Custom'} Anchor artwork`} style={[styles.field, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: fieldColor, borderColor, borderWidth: isBare ? 0 : StyleSheet.hairlineWidth, opacity: state === 'inactive' ? 0.48 : 1 }, style]}>
    {showImage ? (
      <View style={[styles.imageContainer, { width: imageSize, height: imageSize, borderRadius: imageSize / 2 }, isPaper && styles.paperImage]}>
        <Image accessible={false} source={{ uri: imageUrl as string }} resizeMode="cover" onLoad={traceLabel || onImageLoad ? () => {
          if (traceLabel) trace(`${traceLabel} image onLoad`);
          onImageLoad?.();
        } : undefined} onError={() => {
          // The finished artwork is preferred; the structure stands in only because this URL could not load (e.g. an expired signed link).
          if (__DEV__ && !process.env.JEST_WORKER_ID) console.warn('[Anchor] enhanced artwork failed to load; showing the base SVG instead', { host: String(imageUrl).split('/')[2] });
          setImageFailed(true);
        }} style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }} />
      </View>
    ) : <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.artwork, { width: artworkSize, height: artworkSize }, (isBare || expression) && styles.artworkUnclipped]}>{hasArtwork ? (expression ? <AnchorMark svg={svg} category={category} expression={expression} size={artworkSize} /> : <SigilSvg xml={svg} width="100%" height="100%" color={color} />) : <Text style={styles.artworkUnavailable}>Artwork unavailable</Text>}</View>}
  </View>;
});
export const circularAnchorSizes = sizes;

/**
 * Share of the disc's diameter the mark itself occupies. The Anchor transition
 * layer scales copies so this mark, not the disc around it, is what keeps its
 * size when one appearance hands over to another, so both read from here.
 */
export function circularAnchorArtworkShare(appearance: CircularAnchorAppearance, dimension: number, image: boolean): number {
  if (image) return appearance === 'bare' ? 1 : (dimension - (appearance === 'paper' ? 8 : 2)) / dimension;
  return appearance === 'bare' ? 0.94 : appearance === 'paper' ? 0.72 : appearance === 'dark' ? 0.70 : 0.66;
}
const styles = StyleSheet.create({
  field: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imageContainer: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  paperImage: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.frameEdge },
  artwork: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radii.round },
  artworkUnclipped: { overflow: 'visible', borderRadius: 0 },
  artworkUnavailable: { color: '#7B8189', textAlign: 'center', fontSize: 11 },
});
