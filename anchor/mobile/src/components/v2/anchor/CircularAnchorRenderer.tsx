import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SigilSvg } from '@/components/common/SigilSvg';
import { getCategoryColor, getCategoryFieldColor, radii } from '@/theme/v2';

export type CircularAnchorSize = 'hero' | 'large' | 'medium' | 'thumbnail' | 'micro';
const sizes: Record<CircularAnchorSize, number> = { hero: 232, large: 152, medium: 104, thumbnail: 64, micro: 44 };
type Props = { svg: string; category?: string | null; size?: CircularAnchorSize; state?: 'active' | 'inactive'; accessibilityLabel?: string; testID?: string };

/** A flat field + the existing stable SVG renderer. It deliberately has no rim, halo, or animation. */
export const CircularAnchorRenderer = memo(function CircularAnchorRenderer({ svg, category, size = 'medium', state = 'active', accessibilityLabel, testID }: Props) {
  const dimension = sizes[size];
  const color = getCategoryColor(category);
  const fieldColor = getCategoryFieldColor(category);
  return <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? `${category ?? 'Custom'} Anchor artwork`} style={[styles.field, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: fieldColor, borderColor: `${color}52`, opacity: state === 'inactive' ? 0.48 : 1 }]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.artwork, { width: dimension * 0.66, height: dimension * 0.66 }]}><SigilSvg xml={svg} width="100%" height="100%" color={color} /></View>
  </View>;
});
export const circularAnchorSizes = sizes;
const styles = StyleSheet.create({ field: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, artwork: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radii.round } });
