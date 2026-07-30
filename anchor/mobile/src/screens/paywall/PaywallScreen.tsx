/**
 * PaywallScreen
 *
 * Full-screen post-trial paywall. Purchases are still executed through
 * RevenueCat package identifiers and unlock only after entitlement confirmation.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { refreshServerEntitlement } from '@/services/BillingService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { getAnchorCreationLimitCopy, getPracticeLimitCopy } from '@/utils/entitlements';
import { LEGAL_URLS } from '@/constants/legal';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useProgressionData } from '@/hooks/useProgressionData';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import revenueCatService, {
  type RevenueCatOfferingDisplayMetadata,
  type RevenueCatPlanId,
} from '@/services/RevenueCatService';
import { logger } from '@/utils/logger';
import type { Anchor, PaywallSource } from '@/types';
import { useNavigationResumeStore } from '@/stores/navigationResumeStore';
import type { RootNavigatorParamList } from '@/navigation/RootNavigator';

type PlanId = RevenueCatPlanId;
type HeadlineId = 'loss' | 'momentum' | 'direct';
type StoreAvailability = 'loading' | 'available' | 'unavailable';

function getPaywallSourceCopy(source: PaywallSource) {
  switch (source) {
    case 'create_anchor_free_locked':
    case 'trial_anchor_cap_reached':
      return getAnchorCreationLimitCopy(source);
    case 'free_weekly_sessions_used':
    case 'premium_practice_locked':
      return getPracticeLimitCopy(source);
    default:
      return null;
  }
}

type PlanDisplay = {
  id: PlanId;
  tier: string;
  packageId: string | null;
  isAvailable: boolean;
  per: string;
  priceLabel: string;
  priceValue: number | null;
  currencyCode: string | null;
  unitLabel: string | null;
  strikeLabel: string | null;
  badge: string | null;
};

const PAYWALL_EXPERIMENT = {
  defaultPlan: 'annual' as PlanId,
  headline: 'loss' as HeadlineId,
  showRecap: true,
  perDayPrice: false,
  showScarcity: false,
};

const HEADLINES: Record<HeadlineId, { eyebrow: string; titleA: string; titleB: string; titleEm: string; sub: string }> = {
  loss: {
    eyebrow: 'Your free trial has ended',
    titleA: "Don't lose access",
    titleB: 'to what you',
    titleEm: 'built.',
    sub: 'Your anchors and progress are safe. Continue to keep your practice within reach when you need it.',
  },
  momentum: {
    eyebrow: 'Seven days complete',
    titleA: "You've built",
    titleB: 'something',
    titleEm: 'real.',
    sub: 'The hardest part is starting, and you already did. Keep the momentum.',
  },
  direct: {
    eyebrow: 'Trial ended',
    titleA: 'Keep your full',
    titleB: '',
    titleEm: 'Anchor.',
    sub: 'Continue with unlimited forging, priming, and lock-screen export.',
  },
};

const PLAN_DESCRIPTORS = {
  monthly: {
    tier: 'Monthly',
    per: 'per month',
  },
  annual: {
    tier: 'Annual',
    per: 'per year',
  },
  lifetime: {
    tier: 'Lifetime',
    per: 'one-time purchase',
  },
} satisfies Record<PlanId, {
  tier: string;
  per: string;
}>;

const PURCHASE_UNAVAILABLE_TITLE = 'Purchases unavailable';
const PURCHASE_UNAVAILABLE_MESSAGE =
  'Purchases are temporarily unavailable. Please try again later or restore an existing subscription.';

function hasAvailableStorePlan(metadata: RevenueCatOfferingDisplayMetadata): boolean {
  return (['monthly', 'annual', 'lifetime'] as const).some((planId) => {
    const plan = metadata[planId];
    return Boolean(plan?.packageId && plan.price != null);
  });
}

function getSafePurchaseErrorMessage(error: unknown): string {
  const rawMessage =
    typeof error === 'object' && error != null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : '';

  const isStoreConfigurationError =
    rawMessage.includes('configuration') ||
    rawMessage.includes('offering') ||
    rawMessage.includes('dashboard') ||
    rawMessage.includes('app store product') ||
    rawMessage.includes('registered') ||
    rawMessage.includes('package');

  if (isStoreConfigurationError) {
    return PURCHASE_UNAVAILABLE_MESSAGE;
  }

  return 'We could not complete the purchase. Please try again.';
}

function toTime(value?: Date | string): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function selectPrimaryAnchor(anchors: Anchor[]): Anchor | null {
  const activeAnchors = anchors.filter((anchor) => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt);
  if (activeAnchors.length === 0) return null;

  return [...activeAnchors].sort((left, right) => {
    const activationDelta = (right.activationCount ?? 0) - (left.activationCount ?? 0);
    if (activationDelta !== 0) return activationDelta;

    const leftRecent = Math.max(toTime(left.lastActivatedAt), toTime(left.updatedAt), toTime(left.createdAt));
    const rightRecent = Math.max(toTime(right.lastActivatedAt), toTime(right.updatedAt), toTime(right.createdAt));
    return rightRecent - leftRecent;
  })[0] ?? null;
}

function formatCurrency(value: number, currencyCode: string | null): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode ?? 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function buildPlanDisplay(
  id: PlanId,
  metadata: RevenueCatOfferingDisplayMetadata
): PlanDisplay {
  const descriptor = PLAN_DESCRIPTORS[id];
  const live = metadata[id];
  const priceValue = live?.price ?? null;
  const priceLabel = live?.priceString ?? 'Loading…';
  const currencyCode = live?.currencyCode ?? null;

  return {
    id,
    tier: descriptor.tier,
    packageId: live?.packageId ?? null,
    isAvailable: Boolean(live?.packageId && priceValue != null),
    per: descriptor.per,
    priceLabel,
    priceValue,
    currencyCode,
    unitLabel:
      id === 'annual' && priceValue != null
        ? `${live?.pricePerMonthString ?? formatCurrency(priceValue / 12, currencyCode)}/mo`
        : null,
    strikeLabel: null,
    badge: null,
  };
}

function buildPlans(metadata: RevenueCatOfferingDisplayMetadata): Record<PlanId, PlanDisplay> {
  const monthly = buildPlanDisplay('monthly', metadata);
  const annual = buildPlanDisplay('annual', metadata);
  const lifetime = buildPlanDisplay('lifetime', metadata);
  const monthlyYear = monthly.priceValue != null ? monthly.priceValue * 12 : null;
  const hasComparableLivePrices =
    monthly.isAvailable &&
    annual.isAvailable &&
    monthlyYear != null &&
    annual.priceValue != null &&
    monthly.currencyCode != null &&
    monthly.currencyCode === annual.currencyCode &&
    monthlyYear > annual.priceValue;
  const savings = hasComparableLivePrices && annual.priceValue != null && monthlyYear != null
    ? Math.round(((monthlyYear - annual.priceValue) / monthlyYear) * 100)
    : null;

  return {
    monthly,
    annual: {
      ...annual,
      strikeLabel: hasComparableLivePrices && monthlyYear != null
        ? formatCurrency(monthlyYear, annual.currencyCode)
        : null,
      badge: savings != null ? `Best value · save ${savings}%` : null,
    },
    lifetime: {
      ...lifetime,
      badge: lifetime.isAvailable ? 'One payment · yours for life' : null,
    },
  };
}

function FallbackAnchorMark({ size = 46 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" testID="fallback-anchor-mark">
      <Circle cx="50" cy="50" r="39" fill="none" stroke={colors.gold} strokeWidth="2" opacity={0.35} />
      <Path
        d="M50 18 L76 76 L50 64 L24 76 Z"
        fill="none"
        stroke={colors.gold}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="50" cy="50" r="7" fill={colors.sanctuary.goldBright} opacity={0.9} />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M1 1l12 12M13 1L1 13" stroke={colors.silver} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="M2.4 6.1l2.3 2.4 4.9-5" stroke="#1A1208" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function OrbitRing({ reduceMotion }: { reduceMotion: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      rotation.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.sigilRing, { transform: [{ rotate }] }]}>
      <View style={styles.sigilDot} />
    </Animated.View>
  );
}

function HeroSigil({ anchor }: { anchor: Anchor | null }) {
  const enhancedUrl = anchor?.enhancedImageUrl ?? null;
  const sigilXml = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || null;
  const reduceMotion = useReduceMotionEnabled();

  return (
    <View style={styles.sigilOuter}>
      <View style={styles.sigilHalo} />
      <OrbitRing reduceMotion={reduceMotion} />
      <View style={styles.sigilCore} testID="paywall-primary-anchor">
        {enhancedUrl ? (
          <Image source={{ uri: enhancedUrl }} style={styles.sigilImage} resizeMode="contain" testID="paywall-primary-anchor-img" />
        ) : sigilXml ? (
          <SvgXml xml={sigilXml} width={96} height={96} testID="paywall-primary-anchor-svg" />
        ) : (
          <FallbackAnchorMark size={96} />
        )}
      </View>
    </View>
  );
}

function RecapStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.recapCell}>
      <Text style={styles.recapNum}>{value}</Text>
      <Text style={styles.recapLbl}>{label}</Text>
    </View>
  );
}

function PlanCard({
  plan,
  selected,
  storeAvailability,
  onPress,
}: {
  plan: PlanDisplay;
  selected: boolean;
  storeAvailability: StoreAvailability;
  onPress: (plan: PlanId) => void;
}) {
  const isLoading = storeAvailability === 'loading';
  const isPlanUnavailable = storeAvailability !== 'available' || !plan.isAvailable;
  const priceLabel = isLoading ? 'Loading…' : isPlanUnavailable ? 'Unavailable' : plan.priceLabel;
  const perLabel = isLoading
    ? 'Current App Store pricing'
    : isPlanUnavailable
      ? 'App Store plan not loaded'
      : plan.per;

  return (
    <Pressable
      onPress={() => onPress(plan.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.tier} plan ${priceLabel}`}
      disabled={isPlanUnavailable}
      testID={`paywall-plan-${plan.id}`}
      style={({ pressed }) => [
        styles.plan,
        plan.id === 'lifetime' && styles.lifetimePlan,
        selected && styles.planSelected,
        isPlanUnavailable && styles.planUnavailable,
        pressed && styles.planPressed,
      ]}
    >
      {plan.badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{plan.badge}</Text>
        </View>
      ) : null}

      <View
        style={[styles.planCheck, selected && styles.planCheckSelected]}
        testID={`paywall-plan-check-${plan.id}`}
      >
        {selected ? <CheckIcon /> : null}
      </View>
      <Text style={[styles.planTier, selected && styles.planTierSelected]}>{plan.tier}</Text>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{priceLabel}</Text>
      <Text style={styles.planPer}>{perLabel}</Text>
      <Text style={styles.planStrike}>
        {!isPlanUnavailable && plan.strikeLabel && plan.unitLabel ? `${plan.strikeLabel} · ${plan.unitLabel}` : ' '}
      </Text>
    </Pressable>
  );
}

export const PaywallScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootNavigatorParamList, 'Paywall'>>();
  const route = useRoute<RouteProp<RootNavigatorParamList, 'Paywall'>>();
  const source: PaywallSource = route.params?.source ?? 'post_trial';
  const anchors = useAnchorStore((state) => state.anchors);
  const primeStreak = useAnchorStore((state) => state.primeStreak);
  const { forgedCount, totalPrimes } = useProgressionData();
  const reduceMotion = useReduceMotionEnabled();
  const { daysRemaining, subscriptionStatus } = useTrialStatus();

  const preferredPlanId = useSubscriptionStore((state) => state.preferredPlanId);
  const setPreferredPlanId = useSubscriptionStore((state) => state.setPreferredPlanId);
  const applyServerEntitlement = useSubscriptionStore((state) => state.applyServerEntitlement);
  const initialPlanId = route.params?.preferredPlanId ?? preferredPlanId ?? PAYWALL_EXPERIMENT.defaultPlan;
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(initialPlanId);
  const [offeringMetadata, setOfferingMetadata] = useState<RevenueCatOfferingDisplayMetadata>({});
  const [storeAvailability, setStoreAvailability] = useState<StoreAvailability>('loading');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const introOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const introTranslate = useRef(new Animated.Value(reduceMotion ? 0 : 16)).current;

  const primaryAnchor = useMemo(() => selectPrimaryAnchor(anchors), [anchors]);
  const plans = useMemo(() => buildPlans(offeringMetadata), [offeringMetadata]);
  const selectedPlan = plans[selectedPlanId];
  const isStoreLoading = storeAvailability === 'loading';
  const isPurchaseUnavailable =
    storeAvailability !== 'available' || !selectedPlan.isAvailable || !selectedPlan.packageId;
  const sourceCopy = getPaywallSourceCopy(source);
  const headline = HEADLINES[PAYWALL_EXPERIMENT.headline];
  const showRecap = PAYWALL_EXPERIMENT.showRecap && (source === 'post_trial' || forgedCount + totalPrimes + primeStreak > 0);

  useEffect(() => {
    if (!primaryAnchor) {
      logger.warn('[PaywallScreen] No primary anchor available for post-trial paywall');
    }
  }, [primaryAnchor]);

  useEffect(() => {
    AnalyticsService.track('paywall_viewed', {
      source,
      defaultPlan: PAYWALL_EXPERIMENT.defaultPlan,
      headline: PAYWALL_EXPERIMENT.headline,
      trial_days_remaining: daysRemaining,
      trial_status: subscriptionStatus,
    });
    FrictionAnalytics.stepViewed('paywall', 'paywall', {
      source,
      default_plan: PAYWALL_EXPERIMENT.defaultPlan,
      headline: PAYWALL_EXPERIMENT.headline,
      trial_days_remaining: daysRemaining,
      trial_status: subscriptionStatus,
    });
  }, [source, daysRemaining, subscriptionStatus]);

  useEffect(() => {
    let mounted = true;
    revenueCatService
      .getOfferingDisplayMetadata()
      .then((metadata) => {
        if (!mounted) return;
        setOfferingMetadata(metadata);
        setStoreAvailability(hasAvailableStorePlan(metadata) ? 'available' : 'unavailable');
      })
      .catch((error) => {
        logger.warn('[PaywallScreen] Failed to resolve RevenueCat offering metadata', error);
        if (mounted) {
          setStoreAvailability('unavailable');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (storeAvailability !== 'available' || plans[selectedPlanId].isAvailable) {
      return;
    }

    const availablePlanId = plans.annual.isAvailable
      ? 'annual'
      : plans.monthly.isAvailable
        ? 'monthly'
        : plans.lifetime.isAvailable
          ? 'lifetime'
          : null;
    if (availablePlanId) {
      setSelectedPlanId(availablePlanId);
      setPreferredPlanId(availablePlanId);
    }
  }, [plans, selectedPlanId, setPreferredPlanId, storeAvailability]);

  useEffect(() => {
    if (route.params?.preferredPlanId) {
      setSelectedPlanId(route.params.preferredPlanId);
      setPreferredPlanId(route.params.preferredPlanId);
    }
  }, [route.params?.preferredPlanId, setPreferredPlanId]);

  useEffect(() => {
    if (reduceMotion) {
      introOpacity.setValue(1);
      introTranslate.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(introTranslate, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [introOpacity, introTranslate, reduceMotion]);

  const handleDismiss = useCallback(() => {
    AnalyticsService.track('paywall_dismissed', { source });
    FrictionAnalytics.stepAbandoned('paywall', 'paywall', 'dismissed', { source });
    navigation.goBack();
  }, [navigation, source]);

  const handleSelectPlan = useCallback((plan: PlanId) => {
    if (storeAvailability !== 'available' || !plans[plan].isAvailable) {
      return;
    }

    setSelectedPlanId(plan);
    setPreferredPlanId(plan);
    AnalyticsService.track('paywall_plan_selected', { plan });
    FrictionAnalytics.stepCompleted('paywall', 'plan_selection', { plan });
  }, [plans, setPreferredPlanId, storeAvailability]);

  const handleSignIn = useCallback(() => {
    navigation.navigate('Settings', {
      screen: 'Login',
      params: { initialTab: 'signin', context: 'paywall', preferredPlanId: selectedPlanId },
    });
  }, [navigation, selectedPlanId]);

  const handlePurchase = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    if (isStoreLoading) {
      Alert.alert('Loading purchase options', 'Please wait a moment while App Store pricing loads.');
      return;
    }
    if (isPurchaseUnavailable) {
      Alert.alert(PURCHASE_UNAVAILABLE_TITLE, PURCHASE_UNAVAILABLE_MESSAGE);
      return;
    }

    const packageId = selectedPlan.packageId;
    if (!packageId) {
      Alert.alert(PURCHASE_UNAVAILABLE_TITLE, PURCHASE_UNAVAILABLE_MESSAGE);
      return;
    }

    setIsPurchasing(true);
    AnalyticsService.track('paywall_cta_tapped', {
      source,
      plan: selectedPlanId,
      productId: packageId,
    });
    FrictionAnalytics.stepCompleted('paywall', 'purchase_cta', {
      source,
      plan: selectedPlanId,
      product_id: packageId,
    });

    try {
      const { dismissed } = await revenueCatService.purchasePackageByIdentifier(packageId, {
        syncStatus: false,
      });
      if (dismissed) {
        FrictionAnalytics.stepAbandoned('paywall', 'store_purchase', 'store_sheet_dismissed', {
          source,
          plan: selectedPlanId,
          product_id: packageId,
        });
        setIsPurchasing(false);
        return;
      }
    } catch (error: any) {
      FrictionAnalytics.flowError('paywall', 'purchase', 'purchase_failed', {
        source,
        plan: selectedPlanId,
        product_id: packageId,
      });
      logger.error('[PaywallScreen] Purchase failed', error);
      Alert.alert('Purchase could not be completed', getSafePurchaseErrorMessage(error));
      setIsPurchasing(false);
      return;
    }

    try {
      const access = await refreshServerEntitlement();
      if (!access.hasActiveEntitlement) {
        FrictionAnalytics.flowBlocked('paywall', 'purchase_confirmation', 'server_entitlement_inactive', {
          source,
          plan: selectedPlanId,
          product_id: packageId,
        });
        Alert.alert(
          'Purchase is still being confirmed',
          'Your purchase was completed, but access is still being confirmed. Your receipt is safe. Try again in a moment, or restore purchases.'
        );
        return;
      }

      applyServerEntitlement(true);
      AnalyticsService.track('paywall_converted', {
        source,
        plan: selectedPlanId,
        productId: packageId,
      });
      // Canonical trial-funnel exit (mirrors paywall_converted with trial context).
      AnalyticsService.track(AnalyticsEvents.TRIAL_CONVERTED, {
        source,
        plan: selectedPlanId,
        productId: packageId,
      });
      FrictionAnalytics.completeFlow('paywall', {
        source,
        plan: selectedPlanId,
        product_id: packageId,
      });
      useNavigationResumeStore.getState().setTarget(route.params?.resumeTarget ?? null);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      FrictionAnalytics.flowError('paywall', 'purchase_confirmation', 'billing_confirmation_failed', {
        source,
        plan: selectedPlanId,
        product_id: packageId,
      });
      logger.error('[PaywallScreen] Billing confirmation failed after purchase', error);
      Alert.alert(
        'Purchase is still being confirmed',
        'Your purchase was completed, but we could not confirm access yet. Your receipt is safe. Try again in a moment, or restore purchases.'
      );
    } finally {
      setIsPurchasing(false);
    }
  }, [
    applyServerEntitlement,
    isPurchaseUnavailable,
    isPurchasing,
    isRestoring,
    isStoreLoading,
    navigation,
    selectedPlan.packageId,
    selectedPlanId,
    source,
  ]);

  const handleRestorePurchase = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    setIsRestoring(true);
    AnalyticsService.track('paywall_restore_tapped', { source });
    FrictionAnalytics.stepCompleted('paywall', 'restore_cta', { source });

    try {
      await revenueCatService.restorePurchases({ syncStatus: false });
    } catch (error: any) {
      FrictionAnalytics.flowError('paywall', 'restore', 'restore_failed', {
        source,
      });
      logger.error('[PaywallScreen] Restore failed', error);
      Alert.alert(
        'Restore failed',
        'We could not restore purchases right now. Check your connection and try again.'
      );
      setIsRestoring(false);
      return;
    }

    try {
      const access = await refreshServerEntitlement();
      if (!access.hasActiveEntitlement) {
        FrictionAnalytics.flowBlocked('paywall', 'restore', 'no_subscription_found', { source });
        Alert.alert('No subscription found', 'No active subscription was found for this account.');
        return;
      }

      applyServerEntitlement(true);
      FrictionAnalytics.completeFlow('paywall', {
        source,
        reason: 'restore_success',
      });
      useNavigationResumeStore.getState().setTarget(route.params?.resumeTarget ?? null);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      FrictionAnalytics.flowError('paywall', 'restore_confirmation', 'billing_confirmation_failed', {
        source,
      });
      logger.error('[PaywallScreen] Billing confirmation failed after restore', error);
      Alert.alert(
        'Restore is still being confirmed',
        'Your restore was completed, but we could not confirm access yet. Try again in a moment.'
      );
    } finally {
      setIsRestoring(false);
    }
  }, [applyServerEntitlement, isPurchasing, isRestoring, navigation, source]);

  const ctaSub = isStoreLoading
    ? 'Loading current App Store pricing...'
    : isPurchaseUnavailable
      ? 'Purchases are temporarily unavailable. Restore is still available.'
      : PAYWALL_EXPERIMENT.perDayPrice && selectedPlan.priceValue
        ? selectedPlanId === 'annual'
          ? `less than ${formatCurrency(selectedPlan.priceValue / 365, selectedPlan.currencyCode)} / day · cancel anytime`
          : selectedPlanId === 'monthly'
            ? `about ${formatCurrency(selectedPlan.priceValue / 30, selectedPlan.currencyCode)} / day · cancel anytime`
            : `${selectedPlan.priceLabel} once · yours for life`
        : selectedPlanId === 'lifetime'
          ? `${selectedPlan.priceLabel} once · yours for life`
          : `then ${selectedPlan.priceLabel} / ${selectedPlanId === 'annual' ? 'year' : 'month'} · cancel anytime`;
  const ctaLabel = isStoreLoading
    ? 'Loading plans...'
    : isPurchaseUnavailable
      ? 'Purchases unavailable'
      : selectedPlanId === 'lifetime'
        ? 'Unlock for life'
        : sourceCopy?.cta ?? 'Continue my practice';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#07040C', '#100820', colors.black]}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss paywall"
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <CloseIcon />
        </Pressable>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: introOpacity,
              transform: [{ translateY: introTranslate }],
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <HeroSigil anchor={primaryAnchor} />
            <Text style={styles.anchorCap}>Your anchor</Text>

            <Text style={styles.eyebrow}>{sourceCopy ? 'Anchor Pro' : headline.eyebrow}</Text>
            {sourceCopy ? (
              <Text style={styles.title}>{sourceCopy.title}</Text>
            ) : (
              <Text style={styles.title}>
                {headline.titleA}
                {'\n'}
                {headline.titleB ? `${headline.titleB} ` : ''}
                <Text style={styles.titleEm}>{headline.titleEm}</Text>
              </Text>
            )}
            <Text style={styles.sub}>{sourceCopy?.body ?? headline.sub}</Text>

            {showRecap ? (
              <View testID="paywall-recap">
                <View style={styles.recap}>
                  <RecapStat value={forgedCount} label="Anchors forged" />
                  <View style={styles.recapDivider} />
                  <RecapStat value={totalPrimes} label="Sessions primed" />
                  <View style={styles.recapDivider} />
                  <RecapStat value={primeStreak} label="Prime record" />
                </View>
                <Text style={styles.recapFoot}>
                  Keep it within reach as you <Text style={styles.recapFootStrong}>continue.</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.plansLabel}>Choose your plan</Text>
            {plans.annual.strikeLabel ? (
              <Text style={styles.priceComparison} testID="paywall-price-comparison">
                Paying monthly totals {plans.annual.strikeLabel} each year.
              </Text>
            ) : null}
            <View style={styles.plans}>
              <PlanCard
                plan={plans.monthly}
                selected={selectedPlanId === 'monthly'}
                storeAvailability={storeAvailability}
                onPress={handleSelectPlan}
              />
              <PlanCard
                plan={plans.annual}
                selected={selectedPlanId === 'annual'}
                storeAvailability={storeAvailability}
                onPress={handleSelectPlan}
              />
              <PlanCard
                plan={plans.lifetime}
                selected={selectedPlanId === 'lifetime'}
                storeAvailability={storeAvailability}
                onPress={handleSelectPlan}
              />
            </View>

            {PAYWALL_EXPERIMENT.showScarcity ? (
              <Text style={styles.scarcity}>Founding rate · locked for life if you continue now</Text>
            ) : null}
          </ScrollView>

          <LinearGradient
            colors={['rgba(8,12,16,0)', colors.black, colors.black]}
            locations={[0, 0.28, 1]}
            style={styles.footer}
          >
            <Pressable
              onPress={handlePurchase}
              accessibilityRole="button"
              accessibilityLabel={
                isPurchasing
                  ? 'Completing purchase and confirming access'
                  : isPurchaseUnavailable || isStoreLoading
                  ? ctaLabel
                  : `Continue my practice, ${selectedPlan.tier} selected`
              }
              disabled={isPurchasing || isRestoring || isPurchaseUnavailable}
              style={({ pressed }) => [styles.ctaPressable, pressed && styles.ctaPressed]}
            >
              <LinearGradient
                colors={['#F0CB6A', '#C9A84C', '#A8892E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, (isPurchasing || isRestoring || isPurchaseUnavailable) && styles.disabled]}
              >
                {isPurchasing ? (
                  <View style={styles.ctaLoading}>
                    <ActivityIndicator color="#100C04" />
                    <Text style={styles.ctaLoadingLabel}>Completing purchase…</Text>
                  </View>
                ) : (
                  <Text style={styles.ctaLabel}>{ctaLabel}</Text>
                )}
              </LinearGradient>
            </Pressable>
            <Text style={styles.ctaSub}>{ctaSub}</Text>
            <Text style={styles.trust}>
              {selectedPlanId === 'lifetime'
                ? 'One-time purchase · Your anchors stay · Secure'
                : 'Cancel anytime · Your anchors stay · Secure'}
            </Text>
            <View style={styles.links}>
              <Pressable
                onPress={handleRestorePurchase}
                accessibilityRole="button"
                accessibilityLabel="Restore purchase"
                disabled={isPurchasing || isRestoring}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.linkText}>{isRestoring ? 'Restoring...' : 'Restore purchase'}</Text>
              </Pressable>
              <Pressable
                onPress={handleSignIn}
                accessibilityRole="button"
                accessibilityLabel="Already subscribed? Sign in"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.linkText}>Already subscribed? <Text style={styles.linkStrong}>Sign in</Text></Text>
              </Pressable>
            </View>
            <View style={styles.legalLinks}>
              <Pressable
                onPress={() => void Linking.openURL(LEGAL_URLS.termsOfService)}
                accessibilityRole="link"
                accessibilityLabel="Terms of Use"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.legalLinkText}>Terms of Use</Text>
              </Pressable>
              <Text style={styles.legalDivider}>·</Text>
              <Pressable
                onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safeArea: {
    flex: 1,
  },
  bgOrbTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: 80,
    left: -110,
    backgroundColor: withAlpha(colors.deepPurple, 0.24),
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -90,
    bottom: 180,
    backgroundColor: withAlpha(colors.gold, 0.06),
  },
  closeButton: {
    position: 'absolute',
    top: 36,
    right: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  pressed: {
    opacity: 0.65,
  },
  content: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 42,
    paddingHorizontal: 24,
    paddingBottom: 204,
    alignItems: 'center',
  },
  sigilOuter: {
    width: 172,
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sigilHalo: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: withAlpha(colors.gold, 0.1),
  },
  sigilRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.22),
  },
  sigilDot: {
    position: 'absolute',
    top: -3,
    left: 72,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sanctuary.goldBright,
  },
  sigilCore: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#100820',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 6,
  },
  sigilImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  anchorCap: {
    fontFamily: typography.fonts.mono,
    fontSize: 8,
    letterSpacing: 2.4,
    color: withAlpha(colors.bone, 0.34),
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 6,
  },
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 3.2,
    color: colors.gold,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 16,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 30,
    lineHeight: 34,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0,
  },
  titleEm: {
    color: colors.sanctuary.goldBright,
  },
  sub: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 16,
    lineHeight: 23,
    color: withAlpha(colors.bone, 0.62),
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 310,
  },
  recap: {
    flexDirection: 'row',
    marginTop: 18,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.28),
    backgroundColor: withAlpha(colors.gold, 0.04),
    width: '100%',
  },
  recapCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 2,
  },
  recapDivider: {
    width: 1,
    backgroundColor: withAlpha(colors.gold, 0.28),
    marginVertical: 8,
  },
  recapNum: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 26,
    color: colors.sanctuary.goldBright,
    lineHeight: 26,
  },
  recapLbl: {
    fontFamily: typography.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.1,
    color: withAlpha(colors.bone, 0.34),
    textTransform: 'uppercase',
    marginTop: 6,
    textAlign: 'center',
  },
  recapFoot: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: withAlpha(colors.bone, 0.55),
    textAlign: 'center',
    marginTop: 8,
  },
  recapFootStrong: {
    color: colors.bone,
  },
  plansLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.6,
    color: withAlpha(colors.bone, 0.45),
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  plans: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  plan: {
    flex: 1,
    flexBasis: '46%',
    minHeight: 132,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.1),
    backgroundColor: withAlpha(colors.bone, 0.025),
    overflow: 'hidden',
  },
  lifetimePlan: {
    flexBasis: '100%',
  },
  planSelected: {
    borderColor: withAlpha(colors.gold, 0.65),
    backgroundColor: withAlpha(colors.gold, 0.08),
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 5,
  },
  planUnavailable: {
    opacity: 0.5,
  },
  planPressed: {
    transform: [{ scale: 0.99 }],
  },
  planBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: withAlpha(colors.gold, 0.92),
    paddingVertical: 4,
  },
  planBadgeText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 7,
    letterSpacing: 0.8,
    color: '#1A1208',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  planCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCheckSelected: {
    backgroundColor: colors.sanctuary.goldBright,
    borderColor: colors.sanctuary.goldBright,
  },
  planTier: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2.2,
    color: withAlpha(colors.bone, 0.62),
    textTransform: 'uppercase',
    marginTop: 15,
    marginBottom: 12,
  },
  planTierSelected: {
    color: colors.gold,
  },
  planPrice: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 27,
    color: colors.bone,
    lineHeight: 30,
    textAlign: 'center',
  },
  planPriceSelected: {
    color: colors.sanctuary.goldBright,
  },
  planPer: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: withAlpha(colors.bone, 0.34),
    textTransform: 'uppercase',
    marginTop: 7,
  },
  planStrike: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: withAlpha(colors.bone, 0.45),
    marginTop: 8,
    textAlign: 'center',
  },
  priceComparison: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: withAlpha(colors.bone, 0.54),
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 12,
  },
  scarcity: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.1,
    color: withAlpha(colors.gold, 0.72),
    marginTop: 14,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 12,
  },
  ctaPressable: {
    borderRadius: 999,
  },
  ctaPressed: {
    transform: [{ scale: 0.995 }],
  },
  cta: {
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  disabled: {
    opacity: 0.62,
  },
  ctaLabel: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 14,
    letterSpacing: 2.8,
    color: '#100C04',
    textTransform: 'uppercase',
  },
  ctaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaLoadingLabel: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 12,
    letterSpacing: 1.7,
    color: '#100C04',
    textTransform: 'uppercase',
  },
  ctaSub: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13.5,
    color: withAlpha(colors.bone, 0.62),
    textAlign: 'center',
    marginTop: 12,
  },
  trust: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: withAlpha(colors.bone, 0.28),
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 10,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  linkText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    color: withAlpha(colors.bone, 0.48),
  },
  linkStrong: {
    color: colors.gold,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  legalLinkText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    color: withAlpha(colors.bone, 0.4),
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    color: withAlpha(colors.bone, 0.3),
  },
});

export default PaywallScreen;
