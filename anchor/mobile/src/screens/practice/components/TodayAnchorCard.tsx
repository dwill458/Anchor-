/**
 * TodayAnchorCard — top-of-PracticeScreen glassmorphic card for the anchor
 * the user should be working with today.
 *
 * Shows:
 *  - Sigil/image thumbnail with charged aura (via PremiumAnchorGlow)
 *  - Truncated intention text + category label
 *  - Charge ring (today sessions / daily goal)
 *  - One-tap "Activate Ns" primary CTA
 *  - "Reinforce" secondary CTA
 *  - "Change anchor" link
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage, PremiumAnchorGlow } from '@/components/common';
import { ChargeRing } from './ChargeRing';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB = 48;

function formatActivationLabel(seconds: number): string {
  if (seconds < 60) return `Activate ${seconds}s`;
  const m = Math.round(seconds / 60);
  return `Activate ${m}m`;
}

function formatReinforceLabel(minutes: number): string {
  if (minutes <= 0) return 'Reinforce';
  return `Reinforce ${minutes}m`;
}

interface TodayAnchorCardProps {
  anchor: Anchor;
  todaySessionsCount: number;
  dailyGoal: number;
  defaultActivationSeconds: number;
  defaultReinforceMinutes: number;
  onActivate: () => void;
  onReinforce: () => void;
  onChangeAnchor: () => void;
}

const IS_ANDROID = Platform.OS === 'android';

export const TodayAnchorCard: React.FC<TodayAnchorCardProps> = ({
  anchor,
  todaySessionsCount,
  dailyGoal,
  defaultActivationSeconds,
  defaultReinforceMinutes,
  onActivate,
  onReinforce,
  onChangeAnchor,
}) => {
  const reduceMotion = useReduceMotionEnabled();

  const progress = dailyGoal > 0 ? Math.min(todaySessionsCount / dailyGoal, 1) : 0;
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;
  const glowState = anchor.isCharged ? 'charged' : 'dormant';

  const truncated =
    anchor.intentionText.length > 26
      ? anchor.intentionText.slice(0, 24) + '…'
      : anchor.intentionText;

  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID
    ? {}
    : ({ intensity: 16, tint: 'dark' } as any);

  return (
    <CardWrapper {...cardProps} style={styles.card}>
      {/* ── Top row: sigil + info + ring ── */}
      <View style={styles.topRow}>
        {/* Sigil thumbnail */}
        <View style={styles.thumbWrap}>
          <View style={styles.thumbGlowContainer}>
            <PremiumAnchorGlow
              size={THUMB}
              state={glowState}
              variant="card"
              reduceMotionEnabled={reduceMotion}
            />
          </View>
          <View style={styles.thumbContent}>
            {anchor.enhancedImageUrl ? (
              <OptimizedImage
                uri={anchor.enhancedImageUrl}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            ) : (
              <SvgXml xml={sigilSvg} width={THUMB} height={THUMB} />
            )}
          </View>
        </View>

        {/* Anchor info */}
        <View style={styles.infoBlock}>
          <Text style={styles.intentionText} numberOfLines={1}>
            {truncated}
          </Text>
          <Text style={styles.categoryLabel}>
            {anchor.category.replace(/_/g, ' ')}
          </Text>
        </View>

        {/* Charge ring + session count */}
        <View style={styles.ringBlock}>
          <ChargeRing progress={progress} size={44} strokeWidth={3} />
          <Text style={styles.ringLabel}>
            {todaySessionsCount}/{dailyGoal}
          </Text>
        </View>
      </View>

      {/* ── CTA row ── */}
      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={styles.activateButton}
          onPress={onActivate}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={formatActivationLabel(defaultActivationSeconds)}
        >
          <Text style={styles.activateButtonText}>
            {formatActivationLabel(defaultActivationSeconds)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reinforceButton}
          onPress={onReinforce}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={formatReinforceLabel(defaultReinforceMinutes)}
        >
          <Text style={styles.reinforceButtonText}>
            {formatReinforceLabel(defaultReinforceMinutes)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Change anchor ── */}
      <TouchableOpacity
        onPress={onChangeAnchor}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Change anchor"
        style={styles.changeRow}
      >
        <Text style={styles.changeText}>Change anchor</Text>
      </TouchableOpacity>
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: IS_ANDROID ? colors.ritual.glassStrong : undefined,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    maxWidth: SCREEN_WIDTH - spacing.lg * 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlowContainer: {
    position: 'absolute',
    width: THUMB * 1.5,
    height: THUMB * 1.5,
  },
  thumbContent: {
    width: THUMB,
    height: THUMB,
    zIndex: 2,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  infoBlock: {
    flex: 1,
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  ringBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 10,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  activateButton: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  activateButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.3,
  },
  reinforceButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reinforceButtonText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  changeRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  changeText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.text.tertiary,
  },
});
