import React, { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SigilSvg } from '@/components/common/SigilSvg';
import type { AnchorExpression } from '@/constants/v2/creation';
import { colors, getCategoryColor, getCategoryFieldColor, radii } from '@/theme/v2';
import { AnchorMark } from './AnchorMark';
import { trace } from '@/utils/dev/creationTrace';
import { classifyPerfUri, perfLog } from '@/utils/perfDiagnostics';
import { ThreadAura, type ThreadAuraProps } from './ThreadAura';

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

/**
 * A coin arriving on screen. `ground` (0 → 1) fades the paper in and, for a finished image or a
 * mark without a recorded expression, settles the artwork up to size with it. `draw` (0 → 1)
 * traces the line itself and only applies to a structure rendered through an expression.
 */
export type CircularAnchorEntrance = {
  ground: SharedValue<number>;
  draw: SharedValue<number>;
  /** True only while the line is being traced; the coin keeps its entrance props afterwards so its layers never remount. */
  drawing: boolean;
};

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
  performanceLabel?: string;
  /** Home's first-load entrance. Absent everywhere else, where the coin simply is. */
  entrance?: CircularAnchorEntrance;
  /** Present only on Home and Details; all other renderers keep their current behavior. */
  aura?: Pick<ThreadAuraProps, 'anchorId' | 'threadStrength' | 'variant' | 'active' | 'reducedMotion'>;
};

/** A flat field + the existing stable SVG renderer. It deliberately has no rim, halo, or animation. */
export const CircularAnchorRenderer = memo(function CircularAnchorRenderer({ svg, imageUrl, category, expression, size = 'medium', appearance, state = 'active', accessibilityLabel, testID, style, traceLabel, onImageLoad, performanceLabel, entrance, aura }: Props) {
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
  const idle = useSharedValue(1);
  const ground = entrance?.ground ?? idle;
  // The paper is its own layer during an entrance so it can fade while the line is still being drawn.
  const groundStyle = useAnimatedStyle(() => ({ opacity: ground.value }));
  const developStyle = useAnimatedStyle(() => ({
    opacity: ground.value,
    transform: [{ scale: 0.965 + 0.035 * ground.value }],
  }));
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
  const handleImageLoad = (event: { nativeEvent: { source: { width: number; height: number } } }) => {
    if (traceLabel) trace(`${traceLabel} image onLoad`);
    if (performanceLabel) perfLog('grid-image-load', {
      label: performanceLabel,
      uriType: classifyPerfUri(imageUrl),
      url: imageUrl,
      intrinsicWidth: event.nativeEvent.source.width,
      intrinsicHeight: event.nativeEvent.source.height,
      renderedWidth: imageSize,
      renderedHeight: imageSize,
    });
    onImageLoad?.();
  };
  const entering = Boolean(entrance);
  const drawLine = Boolean(entrance?.drawing) && !showImage && hasArtwork && Boolean(expression);
  // Keep one component type here: Reanimated's animated style handle is valid
  // on Animated.View but not on the union of Animated.View and View.
  const Artwork = Animated.View;
  const artworkEntrance = entering && !drawLine ? developStyle : undefined;
  return <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? `${category ?? 'Custom'} Anchor artwork`} style={[styles.field, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: entering ? 'transparent' : fieldColor, borderColor: entering ? 'transparent' : borderColor, borderWidth: isBare ? 0 : StyleSheet.hairlineWidth, opacity: state === 'inactive' ? 0.48 : 1 }, aura && styles.auraField, style]}>
    {entering ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: dimension / 2, backgroundColor: fieldColor, borderColor, borderWidth: isBare ? 0 : StyleSheet.hairlineWidth }, groundStyle]} /> : null}
    {aura && hasArtwork && !entrance?.drawing ? <ThreadAura key={aura.anchorId ?? svg} {...aura} svg={svg} categoryColor={color} size={dimension} artworkSize={showImage ? imageSize : artworkSize} /> : null}
    {showImage ? (
      <Artwork style={[styles.imageContainer, { width: imageSize, height: imageSize, borderRadius: imageSize / 2 }, isPaper && styles.paperImage, artworkEntrance]}>
        <Image accessible={false} source={{ uri: imageUrl as string }} resizeMode="cover" onLoad={traceLabel || onImageLoad || performanceLabel ? handleImageLoad : undefined} onError={() => {
          // The finished artwork is preferred; the structure stands in only because this URL could not load (e.g. an expired signed link).
          if (__DEV__ && !process.env.JEST_WORKER_ID) console.warn('[Anchor] enhanced artwork failed to load; showing the base SVG instead', { host: String(imageUrl).split('/')[2] });
          setImageFailed(true);
        }} style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }} />
      </Artwork>
    ) : <Artwork accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.artwork, { width: artworkSize, height: artworkSize }, (isBare || expression) && styles.artworkUnclipped, artworkEntrance]}>{hasArtwork ? (expression ? <AnchorMark svg={svg} category={category} expression={expression} size={artworkSize} drawProgress={drawLine ? entrance?.draw : undefined} /> : <SigilSvg xml={svg} width="100%" height="100%" color={color} />) : <Text style={styles.artworkUnavailable}>Artwork unavailable</Text>}</Artwork>}
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
  auraField: { overflow: 'visible' },
  imageContainer: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  paperImage: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.frameEdge },
  artwork: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radii.round },
  artworkUnclipped: { overflow: 'visible', borderRadius: 0 },
  artworkUnavailable: { color: '#7B8189', textAlign: 'center', fontSize: 11 },
});
