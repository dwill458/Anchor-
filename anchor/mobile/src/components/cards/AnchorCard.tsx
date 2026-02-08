/**
 * Anchor App - Anchor Card (Premium Redesign)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Easing, Dimensions } from 'react-native';
import { SvgXml, Svg, Circle, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useSettingsStore } from '@/stores/settingsStore';

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

// Simple Sacred Geometry Component for the Ring
const SacredRing: React.FC<{ size: number }> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <Circle cx="50" cy="50" r="45" stroke={colors.gold} strokeWidth="0.5" strokeOpacity="0.4" />
    <Circle cx="50" cy="50" r="35" stroke={colors.gold} strokeWidth="0.3" strokeOpacity="0.2" />
    <Path
      d="M50 5L63 38L95 50L63 62L50 95L37 62L5 50L37 38L50 5Z"
      stroke={colors.gold}
      strokeWidth="0.5"
      strokeOpacity="0.3"
    />
    <Path
      d="M20 20L80 80M80 20L20 80"
      stroke={colors.gold}
      strokeWidth="0.2"
      strokeOpacity="0.1"
    />
  </Svg>
);

export const AnchorCard: React.FC<AnchorCardProps> = ({ anchor, onPress }) => {
  const { reduceIntentionVisibility } = useSettingsStore();
  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;

  // Animation for the sacred ring
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (anchor.isCharged) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 20000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [anchor.isCharged, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const accessibilityLabel = `${anchor.intentionText}. ${categoryConfig.label} anchor. ${anchor.isCharged ? 'Charged. ' : ''
    }${anchor.activationCount > 0 ? `Activated ${anchor.activationCount} times.` : ''}`;

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
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={anchor.isCharged ? 30 : 15}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}

        <View style={styles.content}>
          <View style={[
            styles.sigilContainer,
            anchor.isCharged && styles.chargedSigilContainer
          ]}>
            {/* Soft Gold Halo Glow (Behind) */}
            {anchor.isCharged && <View style={styles.haloGlow} />}

            {/* Animated Sacred Ring */}
            {anchor.isCharged && (
              <Animated.View style={[styles.ringWrapper, { transform: [{ rotate: spin }] }]}>
                <SacredRing size={CARD_WIDTH * 0.8} />
              </Animated.View>
            )}

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
                  {Platform.OS === 'ios' && <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />}
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
  haloGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 100,
    backgroundColor: colors.gold,
    opacity: 0.1,
    transform: [{ scale: 1.2 }],
    filter: Platform.OS === 'ios' ? 'blur(20px)' : undefined, // Native blur not easy on Android View without special lib
  },
  ringWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  sigilWrapper: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  sigilImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
