import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
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
        isMeasured ? `, Thread Strength ${thread?.value}%` : ', baseline not yet established'
      }. Tap to switch Anchor.`}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <View style={styles.artworkWrapper}>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          category={anchor.category}
          size="thumbnail"
          accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
        />
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.intention}>
          {anchor.intentionText}
        </Text>

        <View style={styles.categoryRow}>
          <View style={[styles.dot, { backgroundColor: categoryColor }]} />
          <Text style={styles.categoryText}>{categoryLabel(anchor.category)}</Text>
        </View>

        <View style={styles.statusRow}>
          {isMeasured ? (
            <Text style={styles.strengthText}>
              Thread Strength{' '}
              <Text style={[styles.strengthValue, { color: categoryColor }]}>
                {thread?.value}%
              </Text>
            </Text>
          ) : (
            <Text numberOfLines={1} style={styles.baselineText}>
              Your first practice will establish your baseline.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.chevronWrapper}>
        <ChevronRight size={18} color={colors.text.secondary} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
  },
  artworkWrapper: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  intention: {
    ...typography.labelLG,
    fontWeight: '700',
    fontSize: 15.5,
    lineHeight: 20,
    color: colors.text.primary,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.round,
  },
  categoryText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  strengthValue: {
    ...typography.labelSM,
    fontWeight: '600',
    fontSize: 12,
  },
  baselineText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    flexShrink: 1,
  },
  chevronWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing[1],
  },
});
