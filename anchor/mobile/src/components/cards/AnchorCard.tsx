/**
 * Anchor App - Anchor Card (Premium Redesign)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';

interface AnchorCardProps {
  anchor: Anchor;
  onPress: (anchor: Anchor) => void;
  reduceMotionEnabled?: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  career: { label: 'Career', color: colors.gold },
  health: { label: 'Health', color: colors.success },
  wealth: { label: 'Wealth', color: colors.bronze },
  relationships: { label: 'Love', color: colors.deepPurple },
  personal_growth: { label: 'Growth', color: colors.silver },
  custom: { label: 'Custom', color: colors.text.tertiary },
};

export const AnchorCard: React.FC<AnchorCardProps> = ({
  anchor,
  onPress,
  reduceMotionEnabled = false,
}) => {
  const { reduceIntentionVisibility } = useSettingsStore();
  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;

  const accessibilityLabel = `${anchor.intentionText}, ${anchor.activationCount} activations`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(anchor)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to view anchor details"
    >
      <View style={[
        styles.card,
        anchor.isCharged ? styles.chargedCard : styles.unchargedCard,
        Platform.OS === 'android' && styles.androidCard
      ]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={anchor.isCharged ? 30 : 15}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
        )}

        <View style={styles.content}>
          <View style={[
            styles.sigilContainer,
            anchor.isCharged && styles.chargedSigilContainer
          ]}>
            <PremiumAnchorGlow
              size={CARD_WIDTH * 0.72}
              variant="card"
              state={anchor.isCharged ? 'charged' : 'dormant'}
              reduceMotionEnabled={reduceMotionEnabled}
            />

            <View style={styles.sigilWrapper}>
              {anchor.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={styles.sigilImage}
                  resizeMode="cover"
                />
              ) : anchor.baseSigilSvg ? (
                <SvgXml xml={anchor.baseSigilSvg} width="100%" height="100%" />
              ) : (
                <View style={styles.placeholderSigil}>
                  <Text style={styles.placeholderText}>◈</Text>
                </View>
              )}
            </View>

            {/* CHARGED Status Pill */}
            {anchor.isCharged && (
              <View style={styles.chargedPill}>
                <View style={styles.pillGlass}>
                  {Platform.OS === 'ios' ? (
                    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]} />
                  )}
                  <Text style={styles.pillText}>CHARGED</Text>
                  <Text style={styles.pillIcon}>✧</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={[
            styles.intentionText,
            anchor.isCharged && styles.chargedIntentionText
          ]} numberOfLines={2}>
            {reduceIntentionVisibility
              ? (anchor.mantraText || `Anchor · ${categoryConfig.label}`)
              : anchor.intentionText
            }
          </Text>

          <View style={styles.footer}>
            <View style={[
              styles.badge,
              { borderColor: anchor.isCharged ? colors.gold : categoryConfig.color }
            ]}>
              <Text style={[
                styles.badgeText,
                { color: anchor.isCharged ? colors.gold : categoryConfig.color }
              ]}>
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

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  unchargedCard: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chargedCard: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  androidCard: {
    backgroundColor: 'rgba(26, 26, 29, 0.92)',
  },
  content: {
    padding: 14,
  },
  sigilContainer: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  chargedSigilContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  sigilWrapper: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  sigilImage: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
  chargedPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    borderRadius: 8,
  },
  pillText: {
    fontSize: 8,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  pillIcon: {
    fontSize: 10,
    color: colors.gold,
    marginLeft: 3,
  },
  intentionText: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
    height: 36,
  },
  chargedIntentionText: {
    color: colors.bone,
    fontFamily: typography.fonts.bodyBold,
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
  placeholderSigil: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    color: 'rgba(212, 175, 55, 0.3)',
  },
});
