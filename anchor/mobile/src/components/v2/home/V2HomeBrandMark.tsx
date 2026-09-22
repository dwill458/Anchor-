import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useV2Responsive } from '@/hooks/v2';
import { V2_HOME_SPLICE_HEIGHT, V2_HOME_SPLICE_TIP_RATIO } from './V2HomeCreamSplice';
import { TODAY_ART_BLEED_TOP } from './V2HomeTodaySection';

/** Rendered height of the mark. Width follows the artwork's own ratio. */
export const V2_HOME_BRAND_MARK_HEIGHT = 29;
/** Tight-cropped light artwork is 134x174. */
export const V2_HOME_BRAND_MARK_WIDTH = Math.round(V2_HOME_BRAND_MARK_HEIGHT * (134 / 174));

/**
 * The splice's keel stops just short of its own frame; this much ink already
 * sits beneath the point before the mark's spacing starts.
 */
const KEEL_CLEARANCE = V2_HOME_SPLICE_HEIGHT * (1 - V2_HOME_SPLICE_TIP_RATIO);

/**
 * Vertical rhythm around the mark, as [tightest height, tall phone]. The space
 * above (keel → mark) is deliberately smaller than the space below (mark →
 * Today) so the mark reads as closing the cream world rather than floating in
 * the gap. The lower gap never drops below the Today artwork's upward bleed,
 * so that artwork can never run into the mark.
 */
const GAP_ABOVE: [number, number] = [12, 15];
const GAP_BELOW: [number, number] = [TODAY_ART_BLEED_TOP + 8, TODAY_ART_BLEED_TOP + 14];

export function brandMarkSpacing(vertical: (atShort: number, atTall: number) => number) {
  return {
    marginTop: Math.max(0, vertical(...GAP_ABOVE) - KEEL_CLEARANCE),
    marginBottom: vertical(...GAP_BELOW),
  };
}

/**
 * The Anchor product mark, signed into the top of the ink field beneath the
 * cream splice. It is the brand signature — the user's own Anchor above is the
 * personal symbol — so it is small, static and effect-free, and it lives in
 * normal flow: its position follows the splice on every screen size rather
 * than being pinned to a coordinate.
 */
function V2HomeBrandMarkComponent({ testID }: { testID?: string }) {
  const { vertical } = useV2Responsive();
  return (
    <View
      testID={testID}
      style={[styles.frame, brandMarkSpacing(vertical)]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={require('@/assets/home/anchor-brand-mark-light.png')} style={styles.artwork} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    width: V2_HOME_BRAND_MARK_WIDTH,
    height: V2_HOME_BRAND_MARK_HEIGHT,
  },
  artwork: { width: '100%', height: '100%' },
});

/** Memoised: it depends on nothing about the selected Anchor. */
export const V2HomeBrandMark = memo(V2HomeBrandMarkComponent);
