import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2ThreadPresentation } from '@/adapters/v2/home/threadAdapter';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';

type Props = {
  anchor: Anchor;
  thread?: V2ThreadPresentation | null;
  onPress?: () => void;
  testID?: string;
};

export function V2PracticeAnchorHeader({
  anchor,
  thread,
  onPress,
  testID = 'v2-practice-anchor-header',
}: Props) {
  const categoryColor = getCategoryColor(anchor.category);
  const isMeasured = Boolean(thread && !thread.unmeasured && typeof thread.value === 'number');

  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Active Anchor: ${anchor.intentionText}, category ${categoryLabel(anchor.category)}${
        isMeasured ? `, Thread Strength ${thread?.value}%` : ', baseline not established'
      }. Tap to switch Anchor.`}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
    >
      <View style={styles.artworkWrapper}>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          imageUrl={anchor.enhancedImageUrl}
          category={anchor.category}
          size="thumbnail"
          accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
        />
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.intention}>
          {anchor.intentionText}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: categoryColor }]} />
          <Text style={styles.metaCategory}>{categoryLabel(anchor.category)}</Text>
          <Text style={styles.metaSeparator}>·</Text>
          {isMeasured ? (
            <Text style={styles.metaStatus}>
              Thread Strength{' '}
              <Text style={[styles.strengthValue, { color: categoryColor }]}>
                {thread?.value}%
              </Text>
            </Text>
          ) : (
            <Text numberOfLines={1} style={styles.metaStatus}>
              Baseline not established
            </Text>
          )}
        </View>
      </View>

      <View style={styles.chevronWrapper}>
        <ChevronDown size={16} color={colors.text.secondary} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.72,
  },
  artworkWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
    minWidth: 0,
    justifyContent: 'center',
  },
  intention: {
    ...typography.labelLG,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 19,
    color: colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
  },
  metaCategory: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12.5,
    fontWeight: '500',
  },
  metaSeparator: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
  },
  metaStatus: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12.5,
    flexShrink: 1,
  },
  strengthValue: {
    ...typography.labelSM,
    fontWeight: '600',
    fontSize: 12.5,
  },
  chevronWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing[1],
  },
});
