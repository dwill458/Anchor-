/**
 * Anchor App - Anchor Card Component
 *
 * Displays a single anchor in the Vault grid.
 * Shows sigil, intention text, category badge, and charged status.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';

interface AnchorCardProps {
  anchor: Anchor;
  onPress: (anchor: Anchor) => void;
}

/**
 * Category display names and colors
 */
const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  career: { label: 'Career', color: colors.gold },
  health: { label: 'Health', color: colors.success },
  wealth: { label: 'Wealth', color: colors.bronze },
  relationships: { label: 'Love', color: colors.deepPurple },
  personal_growth: { label: 'Growth', color: colors.silver },
  custom: { label: 'Custom', color: colors.text.tertiary },
};

export const AnchorCard: React.FC<AnchorCardProps> = ({ anchor, onPress }) => {
  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(anchor)}
      activeOpacity={0.7}
    >
      {/* Charged Badge */}
      {anchor.isCharged && (
        <View style={styles.chargedBadge}>
          <Text style={styles.chargedText}>⚡</Text>
        </View>
      )}

      {/* Sigil Display */}
      <View style={styles.sigilContainer}>
        <SvgXml
          xml={anchor.baseSigilSvg}
          width="100%"
          height="100%"
        />
      </View>

      {/* Intention Text */}
      <View style={styles.textContainer}>
        <Text style={styles.intentionText} numberOfLines={2}>
          {anchor.intentionText}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { borderColor: categoryConfig.color }]}>
          <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
            {categoryConfig.label}
          </Text>
        </View>

        {/* Activation Count */}
        {anchor.activationCount > 0 && (
          <Text style={styles.activationCount}>
            {anchor.activationCount} {anchor.activationCount === 1 ? 'use' : 'uses'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.navy,
    position: 'relative',
  },
  chargedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chargedText: {
    fontSize: 12,
  },
  sigilContainer: {
    aspectRatio: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  textContainer: {
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  intentionText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    lineHeight: typography.lineHeights.body2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  categoryText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
  },
  activationCount: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },
});
