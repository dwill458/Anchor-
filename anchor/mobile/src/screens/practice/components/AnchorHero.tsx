import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';

interface AnchorHeroProps {
  anchor?: Anchor;
  onPress: () => void;
}

function getName(anchor?: Anchor): string {
  if (!anchor) return 'Select an anchor';
  const value = anchor.intentionText.trim();
  if (!value) return 'Select an anchor';
  return value.length > 42 ? `${value.slice(0, 41)}...` : value;
}

export const AnchorHero: React.FC<AnchorHeroProps> = ({ anchor, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.switcherPill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Change current anchor"
    >
      <Text style={styles.switcherLabel}>Current anchor</Text>
      <View style={styles.switcherValueWrap}>
        <Text style={styles.switcherValue} numberOfLines={1}>
          {getName(anchor)}
        </Text>
        <ChevronDown size={14} color={colors.text.secondary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  switcherPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.practice.heroSwitcherSurface,
    borderWidth: 1,
    borderColor: colors.practice.heroSwitcherBorder,
    alignItems: 'center',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  switcherLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  switcherValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  switcherValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14,
    color: colors.text.primary,
    maxWidth: 200,
  },
});
