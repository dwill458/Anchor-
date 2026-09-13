import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';

type Props = {
  anchor: Anchor;
  threadValue?: number | null;
  onPress?: () => void;
  testID?: string;
};

export function BrushLine({ color = '#F28A2E', width = 102, height = 9 }: { color?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 12" preserveAspectRatio="none" accessibilityElementsHidden={true}>
      <Path d="M2 8 Q46 0 117 4 L106 6 Q54 4 3 11Z" fill={color} opacity={0.75} />
      <Path d="M10 6 Q58 0 108 3" stroke={color} strokeWidth={1} fill="none" />
    </Svg>
  );
}

function AnchorRays({ color = '#F28A2E' }: { color?: string }) {
  return (
    <Svg width={47} height={61} viewBox="0 0 50 65" fill={color} style={styles.rays} accessibilityElementsHidden={true}>
      <Path d="M5 32Q8 14 15 3Q22 -1 19 8L10 33Z M19 41Q29 24 39 22Q45 22 39 29L23 44Z M27 52Q43 44 48 47Q53 52 28 56Z" />
    </Svg>
  );
}

/**
 * The selected Anchor is the visual center of Home. Its intention leads, with
 * an authentic handmade brush-ring and large paper artwork field below.
 */
export function V2SelectedAnchorHero({ anchor, threadValue, onPress, testID }: Props) {
  const catColor = getCategoryColor(anchor.category);
  const catName = categoryLabel(anchor.category);
  const label =
    `${anchor.intentionText}. ${catName}.` +
    (threadValue !== undefined && threadValue !== null ? ` Thread Strength ${threadValue}.` : '') +
    ' View Anchor details.';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.container, pressed && onPress && styles.pressed]}
    >
      {/* ── Active Intention ── */}
      <View style={styles.intentionBlock}>
        <Text style={styles.intention}>{anchor.intentionText}</Text>
        <View style={styles.titleMark}>
          <BrushLine color="#F28A2E" width={102} height={9} />
        </View>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryDash, { backgroundColor: catColor }]} />
          <Text style={styles.categoryText}>{catName}</Text>
        </View>
      </View>

      {/* ── Anchor Hero with Handmade Brush Rings ── */}
      <View style={styles.heroContainer}>
        {/* Brush ring artwork behind the circle */}
        <Svg
          pointerEvents="none"
          width="100%"
          height={304}
          viewBox="0 0 354 304"
          style={styles.brushSvg}
          accessibilityElementsHidden={true}
        >
          <G strokeLinecap="round">
            <Ellipse
              cx="177"
              cy="152"
              rx="149"
              ry="143"
              stroke={catColor}
              strokeWidth="8"
              strokeDasharray="290 28 180 14 270 150"
              opacity={0.55}
              transform="rotate(-30 177 152)"
              fill="none"
            />
            <Ellipse
              cx="177"
              cy="152"
              rx="154"
              ry="148"
              stroke={catColor}
              strokeWidth="3"
              strokeDasharray="90 10 200 18 320 200"
              opacity={0.3}
              fill="none"
            />
            <Path
              d="M229 291C289 274 331 231 333 178"
              stroke="#7C5CFA"
              strokeWidth="8"
              opacity={0.46}
              fill="none"
            />
            <Path
              d="M317 88Q345 142 321 206"
              stroke="#53BDCC"
              strokeWidth="5"
              opacity={0.52}
              fill="none"
            />
          </G>
        </Svg>

        {/* 266px circular paper artwork */}
        <View style={styles.artworkCircle}>
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(anchor)}
            category={anchor.category}
            size="hero"
            accessibilityLabel={`${catName} Anchor artwork`}
          />
        </View>

        {/* Hand-drawn rays accent at top-right */}
        <AnchorRays color="#F28A2E" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 14,
  },
  pressed: {
    opacity: 0.88,
  },
  intentionBlock: {
    paddingHorizontal: 2,
  },
  intention: {
    fontFamily: typography.displayBold,
    fontSize: 38,
    lineHeight: 39,
    letterSpacing: -1.6,
    color: colors.text.primary,
  },
  titleMark: {
    marginTop: 5,
    marginBottom: 8,
    marginLeft: 68,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  categoryDash: {
    width: 24,
    height: 5,
    borderRadius: 3,
  },
  categoryText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.secondary,
  },
  heroContainer: {
    height: 304,
    position: 'relative',
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushSvg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    left: 0,
    top: 0,
  },
  artworkCircle: {
    width: 266,
    height: 266,
    borderRadius: 133,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FBF9F4',
    // 5px paper shadow / rim
    borderWidth: 4,
    borderColor: '#FBF9F4',
  },
  rays: {
    position: 'absolute',
    right: 8,
    top: 2,
    transform: [{ rotate: '10deg' }],
  },
});
