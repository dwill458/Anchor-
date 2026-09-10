import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { CircularAnchorRenderer, V2Badge } from '@/components/v2';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';

type Props = {
  anchor: Anchor;
  threadValue?: number;
  onPress?: () => void;
  testID?: string;
};

/**
 * The selected Anchor is the visual center of Home. Its intention leads, with
 * a large, paper-like artwork field below — matching the handmade Home study.
 */
export function V2SelectedAnchorHero({ anchor, threadValue, onPress, testID }: Props) {
  const label =
    `${anchor.intentionText}. ${categoryLabel(anchor.category)}.` +
    (threadValue !== undefined ? ` Thread Strength ${threadValue}.` : '') +
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
      <View style={styles.titleBlock}>
        <Text style={styles.intention}>{anchor.intentionText}</Text>
        <View style={[styles.brushMark, { backgroundColor: getCategoryColor(anchor.category) }]} />
      </View>
      <View style={styles.categoryRow}>
        <View style={[styles.categoryDash, { backgroundColor: getCategoryColor(anchor.category) }]} />
        <V2Badge label={categoryLabel(anchor.category)} tone="category" value={anchor.category} />
      </View>
      <View style={styles.artwork}>
        <Svg pointerEvents="none" width={286} height={286} viewBox="0 0 286 286" style={styles.heroMarks}>
          <Circle cx="143" cy="143" r="132" fill="none" stroke={getCategoryColor(anchor.category)} strokeOpacity={0.24} strokeWidth="2" strokeDasharray="9 7 28 5" />
          <Circle cx="143" cy="143" r="124" fill="none" stroke={getCategoryColor(anchor.category)} strokeOpacity={0.36} strokeWidth="2.5" strokeDasharray="62 5 17 11" />
          <Path d="M245 30l13-17M254 42l22-5M250 54l20 8M237 21l4-20" stroke="#F28A2E" strokeWidth="3" strokeLinecap="round" />
        </Svg>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          category={anchor.category}
          size="hero"
          accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[2], paddingTop: spacing[2] },
  pressed: { opacity: 0.82 },
  titleBlock: { alignSelf: 'stretch' },
  intention: {
    ...typography.displayMedium,
    color: colors.text.primary,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.4,
  },
  brushMark: { width: 94, height: 5, borderRadius: 4, marginTop: 7, marginLeft: 56, transform: [{ rotate: '-2deg' }], opacity: 0.82 },
  categoryRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryDash: { width: 24, height: 5, borderRadius: 3 },
  artwork: { height: 286, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing[2] },
  heroMarks: { position: 'absolute' },
});
