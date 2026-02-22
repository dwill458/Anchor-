/**
 * Anchor App - Anchor Card (Premium Redesign)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ChargedGlowCanvas, OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';

interface AnchorCardProps {
  anchor: Anchor;
  onPress: (anchor: Anchor) => void;
  reduceMotionEnabled?: boolean;
  variant?: 'default' | 'sanctuary';
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  career: { label: 'Career', color: colors.gold },
  health: { label: 'Health', color: colors.success },
  wealth: { label: 'Wealth', color: colors.bronze },
  relationships: { label: 'Love', color: colors.deepPurple },
  personal_growth: { label: 'Growth', color: colors.silver },
  desire: { label: 'Desire', color: colors.coral },
  experience: { label: 'Experience', color: colors.cyan },
  custom: { label: 'Custom', color: colors.text.tertiary },
};

export const AnchorCard: React.FC<AnchorCardProps> = ({
  anchor,
  onPress,
  reduceMotionEnabled = false,
  variant = 'default',
}) => {
  const { reduceIntentionVisibility } = useSettingsStore();
  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;
  const isSanctuary = variant === 'sanctuary';

  // Sparkle spin: ✧ icon rotates + scales + fades on charged cards
  const sparkleAnim = useSharedValue(0);

  useEffect(() => {
    if (anchor.isCharged && !reduceMotionEnabled) {
      sparkleAnim.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(sparkleAnim);
      sparkleAnim.value = 0;
    }
  }, [anchor.isCharged, reduceMotionEnabled, sparkleAnim]);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(sparkleAnim.value, [0, 1], [0, 180])}deg` },
      { scale: interpolate(sparkleAnim.value, [0, 1], [1.0, 1.35]) },
    ],
    opacity: interpolate(sparkleAnim.value, [0, 1], [1.0, 0.55]),
  }));

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
        isSanctuary && styles.sanctuaryCard,
        anchor.isCharged ? styles.chargedCard : styles.unchargedCard,
        isSanctuary && (anchor.isCharged ? styles.sanctuaryChargedCard : styles.sanctuaryUnchargedCard),
        Platform.OS === 'android' && styles.androidCard,
      ]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isSanctuary ? (anchor.isCharged ? 24 : 18) : (anchor.isCharged ? 30 : 20)}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: anchor.isCharged ? 'rgba(12, 17, 24, 0.92)' : 'rgba(25, 25, 30, 0.55)' }]} />
        )}

        {/* Dark amber-black fill for charged cards */}
        {anchor.isCharged && (
          <View style={[StyleSheet.absoluteFill, styles.chargedInnerOverlay, isSanctuary && styles.sanctuaryChargedInnerOverlay]} />
        )}

        <View style={styles.content}>
          <View style={[
            styles.sigilContainer,
            anchor.isCharged && styles.chargedSigilContainer,
          ]}>

            {/* Android keeps the richer charged glow; other paths stay lightweight. */}
            {anchor.isCharged && Platform.OS === 'android' && !reduceMotionEnabled ? (
              <ChargedGlowCanvas
                size={CARD_WIDTH * 0.72}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            ) : (
              <PremiumAnchorGlow
                size={CARD_WIDTH * 0.72}
                variant="card"
                state={anchor.isCharged ? 'charged' : 'dormant'}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            )}

            {/* ── Purple sigil backdrop (charged only) ───────────────────── */}
            {anchor.isCharged && (
              <View style={styles.sigilCircleBg} />
            )}

            <View style={[
              styles.sigilWrapper,
              anchor.isCharged && styles.chargedSigilWrapper,
            ]}>
              {/* Stone Texture Depth Overlay for Uncharged */}
              {!anchor.isCharged && (
                <View style={[StyleSheet.absoluteFill, styles.unchargedInnerShadow]} pointerEvents="none" />
              )}

              <View style={[styles.sigilImageContainer, !anchor.isCharged && styles.unchargedSigilOpacity]}>
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

                {/* Cold/Desaturation Overlay for Uncharged */}
                {!anchor.isCharged && (
                  <View style={[StyleSheet.absoluteFill, styles.unchargedDesaturationOverlay]} pointerEvents="none" />
                )}
              </View>
            </View>

            {/* ── CHARGED status pill ────────────────────────────────────── */}
            {anchor.isCharged && (
              <View style={[styles.chargedPill, isSanctuary && styles.sanctuaryChargedPill]}>
                <View style={[styles.pillGlass, isSanctuary && styles.sanctuaryPillGlass]}>
                  <Text style={styles.pillText}>CHARGED</Text>
                  <Animated.View style={sparkleStyle}>
                    <Text style={[styles.pillIcon, isSanctuary && styles.sanctuaryPillIcon]}>✧</Text>
                  </Animated.View>
                </View>
              </View>
            )}
          </View>

          <Text
            style={[
              styles.intentionText,
              isSanctuary && styles.sanctuaryIntentionText,
              anchor.isCharged && styles.chargedIntentionText,
              isSanctuary && anchor.isCharged && styles.sanctuaryChargedIntentionText,
            ]}
            numberOfLines={2}
          >
            {reduceIntentionVisibility
              ? (anchor.mantraText || `Anchor · ${categoryConfig.label}`)
              : anchor.intentionText
            }
          </Text>

          <View style={styles.footer}>
            <View style={[
              styles.badge,
              isSanctuary && styles.sanctuaryBadge,
              { borderColor: anchor.isCharged ? colors.gold : categoryConfig.color },
            ]}>
              <Text style={[
                styles.badgeText,
                isSanctuary && styles.sanctuaryBadgeText,
                { color: anchor.isCharged ? colors.gold : categoryConfig.color },
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
  sanctuaryCard: {
    borderRadius: 22,
    shadowColor: '#2B1640',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 7,
  },
  unchargedCard: {
    borderColor: 'rgba(140, 140, 155, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 1,
  },
  sanctuaryUnchargedCard: {
    borderColor: 'rgba(201,168,76,0.22)',
    backgroundColor: 'rgba(12, 18, 34, 0.54)',
  },
  chargedCard: {
    borderColor: 'rgba(212, 175, 55, 0.7)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 20,
  },
  sanctuaryChargedCard: {
    borderColor: 'rgba(212,175,55,0.34)',
    shadowColor: 'rgba(201,168,76,0.95)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  androidCard: {
    backgroundColor: 'rgba(26, 26, 29, 0.92)',
  },
  chargedInnerOverlay: {
    backgroundColor: 'rgba(212, 140, 0, 0.04)',
  },
  sanctuaryChargedInnerOverlay: {
    backgroundColor: 'rgba(212, 175, 55, 0.045)',
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
    backgroundColor: 'transparent',
    borderColor: 'rgba(212, 175, 55, 0.25)',
    padding: 0,
  },
  sigilWrapper: {
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  chargedSigilWrapper: {
    width: '72%',
    height: '72%',
    position: 'absolute',
    top: '14%',
    left: '14%',
    zIndex: 3,
  },
  sigilCircleBg: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    top: '14%',
    left: '14%',
    borderRadius: 999,
    backgroundColor: 'rgba(10, 6, 36, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 160, 40, 0.55)',
    zIndex: 2,
  },
  sigilImageContainer: {
    width: '100%',
    height: '100%',
  },
  unchargedSigilOpacity: {
    opacity: 0.65,
  },
  unchargedDesaturationOverlay: {
    backgroundColor: 'rgba(20, 25, 35, 0.4)',
    borderRadius: 100,
  },
  unchargedInnerShadow: {
    backgroundColor: 'rgba(15, 15, 20, 0.3)',
    borderRadius: 16,
    zIndex: 1,
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
  sanctuaryChargedPill: {
    top: 9,
    left: 9,
    borderRadius: 7,
  },
  pillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(160, 110, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 80, 0.7)',
    borderRadius: 8,
  },
  sanctuaryPillGlass: {
    backgroundColor: 'rgba(120, 82, 0, 0.74)',
    borderColor: 'rgba(255, 210, 80, 0.5)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
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
  sanctuaryPillIcon: {
    fontSize: 9,
  },
  intentionText: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
    height: 36,
  },
  sanctuaryIntentionText: {
    fontFamily: typography.fonts.bodyBold,
    color: 'rgba(236,226,205,0.94)',
    fontSize: 13,
    lineHeight: 18,
  },
  chargedIntentionText: {
    color: colors.bone,
    fontFamily: typography.fonts.bodyBold,
  },
  sanctuaryChargedIntentionText: {
    color: colors.bone,
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
  sanctuaryBadge: {
    borderRadius: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(12, 8, 22, 0.45)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fonts.bodyBold,
    textTransform: 'uppercase',
  },
  sanctuaryBadgeText: {
    letterSpacing: 0.4,
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
