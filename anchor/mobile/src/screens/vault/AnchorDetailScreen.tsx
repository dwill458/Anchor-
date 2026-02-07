/**
 * Anchor App - Anchor Detail Screen (PREMIUM REFACTOR)
 *
 * Premium ritual-centric detailed view with:
 * - Animated breathing sigil with glow effects
 * - State-based visual intensity (dormant/charged/active/stale)
 * - Meaning-driven stats and copy
 * - Practice path tracker with activation history
 * - Reduce motion support
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '../../stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList, ActivationType } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { format } from 'date-fns';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';
import { safeHaptics } from '@/utils/haptics';

// New components
import { SigilHeroCard } from './components/SigilHeroCard';
import { PracticePathCard } from './components/PracticePathCard';
import { DistilledLettersModal } from './components/DistilledLettersModal';

// Helper utilities
import {
  getAnchorState,
  getMeaningCopy,
  getActivationsThisWeek,
} from './utils/anchorStateHelpers';

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
  const { reduceIntentionVisibility } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  // State
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [distilledModalVisible, setDistilledModalVisible] = useState(false);

  // Detect reduce motion setting
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    return () => subscription.remove();
  }, []);

  // Analytics tracking
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
      ErrorTrackingService.captureException(new Error('Anchor not found'), {
        screen: 'AnchorDetailScreen',
        anchor_id: anchorId,
      });
    }
  }, [anchor, anchorId]);

  // Derived state (memoized)
  const anchorState = useMemo(() => {
    if (!anchor) return 'dormant';
    return getAnchorState(anchor);
  }, [anchor]);

  const meaningCopy = useMemo(() => {
    if (!anchor) return {
      activationStatus: '',
      lastActivatedText: '',
      ctaLabel: '',
      ctaMicrocopy: '',
    };
    return getMeaningCopy(anchor, anchorState);
  }, [anchor, anchorState]);

  const activationsThisWeek = useMemo(() => {
    if (!anchor) return 0;
    return getActivationsThisWeek(anchor);
  }, [anchor]);

  // Handlers (memoized with haptics)
  const handleChargePress = useCallback((): void => {
    if (!anchor) return;

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

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

    navigation.navigate('ChargeSetup', {
      anchorId: anchor.id,
    });
  }, [anchor, navigation]);

  const handleActivatePress = useCallback((): void => {
    if (!anchor) return;

    if (!anchor.isCharged) {
      AnalyticsService.track(AnalyticsEvents.ACTIVATION_ATTEMPTED_UNCHARGED, {
        anchor_id: anchor.id,
      });
      return;
    }

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

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
  }, [anchor, navigation]);

  const handleBurnPress = useCallback((): void => {
    if (!anchor) return;

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

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
  }, [anchor, navigation]);

  // Error state
  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.intentionText}>
            {reduceIntentionVisibility
              ? `"${anchor.mantraText || 'Intention Obscured'}"`
              : `"${anchor.intentionText}"`}
          </Text>

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

        {/* NEW: Animated Sigil Hero Card */}
        <SigilHeroCard
          anchor={anchor}
          anchorState={anchorState}
          reduceMotionEnabled={reduceMotionEnabled}
        />

        {/* UPDATED: Meaning-driven stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.meaningText}>{meaningCopy.activationStatus}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Last activated</Text>
              <Text style={styles.statValue}>{meaningCopy.lastActivatedText}</Text>
            </View>
          </View>

          {/* Distilled letters with info icon */}
          <TouchableOpacity
            style={styles.distilledContainer}
            onPress={() => {
              safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
              setDistilledModalVisible(true);
            }}
          >
            <Text style={styles.distilledLabel}>
              Distilled: {anchor.distilledLetters.join(' ')} <Text style={styles.infoIcon}>ⓘ</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* UPDATED: CTA with haptics + microcopy */}
        <View style={styles.actionContainer}>
          {!anchor.isCharged ? (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleChargePress}>
                <Text style={styles.primaryButtonText}>{meaningCopy.ctaLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.microcopy}>{meaningCopy.ctaMicrocopy}</Text>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleActivatePress}>
                <Text style={styles.primaryButtonText}>
                  {anchorState === 'active' ? 'Activate Again' : 'Activate Anchor'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.microcopy}>{meaningCopy.ctaMicrocopy}</Text>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleChargePress}>
                <Text style={styles.secondaryButtonText}>Charge Again</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.burnButton} onPress={handleBurnPress}>
                <Text style={styles.burnButtonText}>🔥 Burn & Release</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* NEW: Practice Path Card */}
        <PracticePathCard
          anchor={anchor}
          anchorState={anchorState}
          activationsThisWeek={activationsThisWeek}
        />

        {/* Footer */}
        <Text style={styles.createdText}>
          Created {format(new Date(anchor.createdAt), 'MMMM d, yyyy')}
        </Text>
      </ScrollView>

      {/* NEW: Distilled Letters Modal */}
      <DistilledLettersModal
        visible={distilledModalVisible}
        onClose={() => setDistilledModalVisible(false)}
        distilledLetters={anchor.distilledLetters}
      />
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
    paddingBottom: spacing.md,
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
  statsContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${colors.gold}20`,
    alignItems: 'center',
  },
  meaningText: {
    fontSize: typography.sizes.lg,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statsRow: {
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: typography.sizes.md,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  distilledContainer: {
    paddingVertical: spacing.sm,
  },
  distilledLabel: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  infoIcon: {
    fontSize: 14,
    color: colors.gold,
  },
  actionContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.xs,
    width: '100%',
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.charcoal,
    fontWeight: '700',
  },
  microcopy: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  secondaryButton: {
    backgroundColor: colors.background.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    marginTop: spacing.sm,
    width: '100%',
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
    width: '100%',
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
    marginTop: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
