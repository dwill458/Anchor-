/**
 * Anchor App - Anchor Detail Screen
 *
 * Detailed view of a single anchor with charge/activate actions
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList, ChargeType, ActivationType } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { format } from 'date-fns';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';

const { width } = Dimensions.get('window');
const ANCHOR_SIZE = width * 0.6;

type AnchorDetailRouteProp = RouteProp<RootStackParamList, 'AnchorDetail'>;
type AnchorDetailNavigationProp = StackNavigationProp<
  RootStackParamList,
  'AnchorDetail'
>;

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  career: { label: 'Career', color: colors.gold, emoji: '💼' },
  health: { label: 'Health', color: colors.success, emoji: '💪' },
  wealth: { label: 'Wealth', color: colors.bronze, emoji: '💰' },
  relationships: { label: 'Love', color: colors.deepPurple, emoji: '💜' },
  personal_growth: { label: 'Growth', color: colors.silver, emoji: '🌱' },
  custom: { label: 'Custom', color: colors.text.secondary, emoji: '✨' },
};

export const AnchorDetailScreen: React.FC = () => {
  const navigation = useNavigation<AnchorDetailNavigationProp>();
  const route = useRoute<AnchorDetailRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  useEffect(() => {
    if (anchor) {
      AnalyticsService.track(AnalyticsEvents.ANCHOR_DETAIL_VIEWED, {
        anchor_id: anchor.id,
        category: anchor.category,
        is_charged: anchor.isCharged,
        activation_count: anchor.activationCount,
      });

      ErrorTrackingService.addBreadcrumb('Anchor detail viewed', 'navigation', {
        anchor_id: anchor.id,
      });
    } else {
      ErrorTrackingService.captureException(
        new Error('Anchor not found'),
        {
          screen: 'AnchorDetailScreen',
          anchor_id: anchorId,
        }
      );
    }
  }, [anchor, anchorId]);

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;

  const handleChargePress = (): void => {
    const chargeType = anchor.isCharged ? 'recharge' : 'initial_quick';

    AnalyticsService.track(AnalyticsEvents.CHARGE_STARTED, {
      anchor_id: anchor.id,
      charge_type: chargeType,
      source: 'anchor_detail',
    });

    ErrorTrackingService.addBreadcrumb('Charge initiated', 'navigation', {
      anchor_id: anchor.id,
      charge_type: chargeType,
    });

    // Navigate to new redesigned ritual flow
    navigation.navigate('ChargeSetup', {
      anchorId: anchor.id,
    });
  };

  const handleActivatePress = (): void => {
    if (!anchor.isCharged) {
      AnalyticsService.track(AnalyticsEvents.ACTIVATION_ATTEMPTED_UNCHARGED, {
        anchor_id: anchor.id,
      });
      return;
    }

    AnalyticsService.track(AnalyticsEvents.ACTIVATION_STARTED, {
      anchor_id: anchor.id,
      activation_type: 'visual',
      source: 'anchor_detail',
      activation_count: anchor.activationCount,
    });

    ErrorTrackingService.addBreadcrumb('Activation initiated', 'navigation', {
      anchor_id: anchor.id,
    });

    navigation.navigate('ActivationRitual', {
      anchorId: anchor.id,
      activationType: 'visual' as ActivationType,
    });
  };

  const handleBurnPress = (): void => {
    AnalyticsService.track(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: anchor.id,
      activation_count: anchor.activationCount,
      days_since_created: Math.floor(
        (Date.now() - new Date(anchor.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    });

    ErrorTrackingService.addBreadcrumb('Burn ritual initiated', 'navigation', {
      anchor_id: anchor.id,
    });

    navigation.navigate('ConfirmBurn', {
      anchorId: anchor.id,
      intention: anchor.intentionText,
      sigilSvg: anchor.baseSigilSvg,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.intentionText}>"{anchor.intentionText}"</Text>

          {/* Category Badge */}
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: categoryConfig.color + '20' },
            ]}
          >
            <Text style={styles.categoryEmoji}>{categoryConfig.emoji}</Text>
            <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
              {categoryConfig.label}
            </Text>
          </View>

          {/* Charged Badge */}
          {anchor.isCharged && (
            <View style={styles.chargedBadge}>
              <Text style={styles.chargedEmoji}>⚡</Text>
              <Text style={styles.chargedText}>Charged</Text>
              {anchor.chargedAt && (
                <Text style={styles.chargedDate}>
                  {format(new Date(anchor.chargedAt), 'MMM d, yyyy')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Anchor Display */}
        <View style={styles.anchorContainer}>
          {anchor.baseSigilSvg ? (
            <SvgXml
              xml={anchor.baseSigilSvg}
              width={ANCHOR_SIZE}
              height={ANCHOR_SIZE}
            />
          ) : (
            <View style={{ width: ANCHOR_SIZE, height: ANCHOR_SIZE, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 72, color: 'rgba(212, 175, 55, 0.3)' }}>◈</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{anchor.activationCount}</Text>
            <Text style={styles.statLabel}>Activations</Text>
          </View>

          {anchor.lastActivatedAt && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {format(new Date(anchor.lastActivatedAt), 'MMM d')}
              </Text>
              <Text style={styles.statLabel}>Last Activated</Text>
            </View>
          )}

          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {anchor.distilledLetters.join('')}
            </Text>
            <Text style={styles.statLabel}>Distilled Letters</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!anchor.isCharged ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleChargePress}
            >
              <Text style={styles.primaryButtonText}>Charge Anchor</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleActivatePress}
              >
                <Text style={styles.primaryButtonText}>Activate Anchor</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleChargePress}
              >
                <Text style={styles.secondaryButtonText}>Charge Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.burnButton}
                onPress={handleBurnPress}
              >
                <Text style={styles.burnButtonText}>🔥 Burn & Release</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Created Date */}
        <Text style={styles.createdText}>
          Created {format(new Date(anchor.createdAt), 'MMMM d, yyyy')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  intentionText: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeights.h3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  chargedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  chargedEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  chargedText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  chargedDate: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },
  anchorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.background.card,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  actionContainer: {
    paddingVertical: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.charcoal,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.background.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
  },
  burnButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    marginTop: spacing.md,
  },
  burnButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    fontWeight: '600',
  },
  createdText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
