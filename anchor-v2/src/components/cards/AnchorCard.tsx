/**
 * Anchor App - Anchor Card (Premium Redesign)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';

interface AnchorCardProps {
  anchor: Anchor;
  onPress: (anchor: Anchor) => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
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
      style={styles.container}
      onPress={() => onPress(anchor)}
      activeOpacity={0.8}
    >
      <View style={[styles.card, Platform.OS === 'android' && styles.androidCard]}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        )}

        <View style={styles.content}>
          <View style={styles.sigilContainer}>
            <View style={styles.sigilWrapper}>
              <SvgXml xml={anchor.baseSigilSvg} width="100%" height="100%" />
            </View>
            {anchor.isCharged && (
              <View style={styles.chargedIndicator}>
                <Text style={styles.chargedIcon}>⚡</Text>
              </View>
            )}
          </View>

          <Text style={styles.intentionText} numberOfLines={2}>
            {anchor.intentionText}
          </Text>

          <View style={styles.footer}>
            <View style={[styles.badge, { borderColor: categoryConfig.color }]}>
              <Text style={[styles.badgeText, { color: categoryConfig.color }]}>
                {categoryConfig.label}
              </Text>
            </View>
            {anchor.activationCount > 0 && (
              <Text style={styles.usesText}>{anchor.activationCount}⚡</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: 'transparent',
  },
  androidCard: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  content: {
    padding: 12,
  },
  sigilContainer: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sigilWrapper: {
    width: '100%',
    height: '100%',
  },
  chargedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  chargedIcon: { fontSize: 10, color: colors.gold },
  intentionText: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.bone,
    lineHeight: 18,
    marginBottom: 12,
    height: 36,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fonts.bodyBold,
    textTransform: 'uppercase',
  },
  usesText: {
    fontSize: 11,
    color: colors.silver,
    fontFamily: typography.fonts.body,
  },
});
