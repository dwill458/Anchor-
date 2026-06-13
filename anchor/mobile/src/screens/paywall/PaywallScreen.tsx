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
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  REVENUECAT_ANNUAL_PACKAGE_ID,
  REVENUECAT_MONTHLY_PACKAGE_ID,
} from '@/config';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProgressionData } from '@/hooks/useProgressionData';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import revenueCatService, {
  type RevenueCatOfferingDisplayMetadata,
  type RevenueCatPlanId,
} from '@/services/RevenueCatService';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';
import type { RootNavigatorParamList } from '@/navigation/RootNavigator';

type PaywallSource = 'post_trial' | 'gated_feature';
type PlanId = RevenueCatPlanId;
type HeadlineId = 'loss' | 'momentum' | 'direct';

type PlanDisplay = {
  id: PlanId;
  tier: string;
  packageId: string;
  fallbackPrice: string;
  fallbackPriceValue: number;
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
    titleA: 'Your practice is',
    titleB: 'still',
    titleEm: 'here.',
    sub: "Seven days in, the thread is forming. Don't let it go slack now.",
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

const FALLBACK_PLAN_VALUES = {
  monthly: {
    tier: 'Monthly',
    packageId: REVENUECAT_MONTHLY_PACKAGE_ID,
    fallbackPrice: '$7.99',
    fallbackPriceValue: 7.99,
    per: 'per month',
  },
  annual: {
    tier: 'Annual',
    packageId: REVENUECAT_ANNUAL_PACKAGE_ID,
    fallbackPrice: '$59.99',
    fallbackPriceValue: 59.99,
    per: 'per year',
  },
} satisfies Record<PlanId, {
  tier: string;
  packageId: string;
  fallbackPrice: string;
  fallbackPriceValue: number;
  per: string;
}>;

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
  const fallback = FALLBACK_PLAN_VALUES[id];
  const live = metadata[id];
  const priceValue = live?.price ?? fallback.fallbackPriceValue;
  const priceLabel = live?.priceString ?? fallback.fallbackPrice;
  const currencyCode = live?.currencyCode ?? 'USD';

  return {
    id,
    tier: fallback.tier,
    packageId: fallback.packageId,
    fallbackPrice: fallback.fallbackPrice,
    fallbackPriceValue: fallback.fallbackPriceValue,
    per: fallback.per,
    priceLabel,
    priceValue,
    currencyCode,
    unitLabel:
      id === 'annual'
        ? `${live?.pricePerMonthString ?? formatCurrency(priceValue / 12, currencyCode)}/mo`
        : null,
    strikeLabel: null,
    badge: null,
  };
}

function buildPlans(metadata: RevenueCatOfferingDisplayMetadata): Record<PlanId, PlanDisplay> {
  const monthly = buildPlanDisplay('monthly', metadata);
  const annual = buildPlanDisplay('annual', metadata);
  const monthlyYear = monthly.priceValue != null ? monthly.priceValue * 12 : null;
  const savings =
    monthlyYear != null && annual.priceValue != null && monthlyYear > annual.priceValue
      ? Math.round(((monthlyYear - annual.priceValue) / monthlyYear) * 100)
      : 37;

  return {
    monthly,
    annual: {
      ...annual,
      strikeLabel: monthlyYear ? formatCurrency(monthlyYear, annual.currencyCode) : '$95.88',
      badge: `Best value · save ${savings}%`,
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
  const sigilXml = anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || null;
  const reduceMotion = useReduceMotionEnabled();

  return (
    <View style={styles.sigilOuter}>
      <View style={styles.sigilHalo} />
      <OrbitRing reduceMotion={reduceMotion} />
      <View style={styles.sigilCore} testID="paywall-primary-anchor">
        {sigilXml ? (
          <SvgXml xml={sigilXml} width={46} height={46} testID="paywall-primary-anchor-svg" />
        ) : (
          <FallbackAnchorMark size={46} />
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
  onPress,
}: {
  plan: PlanDisplay;
  selected: boolean;
  onPress: (plan: PlanId) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(plan.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.tier} plan ${plan.priceLabel}`}
      testID={`paywall-plan-${plan.id}`}
      style={({ pressed }) => [
        styles.plan,
        selected && styles.planSelected,
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
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{plan.priceLabel}</Text>
      <Text style={styles.planPer}>{plan.per}</Text>
      <Text style={styles.planStrike}>
        {plan.strikeLabel && plan.unitLabel ? `${plan.strikeLabel} · ${plan.unitLabel}` : ' '}
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

  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(PAYWALL_EXPERIMENT.defaultPlan);
  const [offeringMetadata, setOfferingMetadata] = useState<RevenueCatOfferingDisplayMetadata>({});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const introOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const introTranslate = useRef(new Animated.Value(reduceMotion ? 0 : 16)).current;

  const primaryAnchor = useMemo(() => selectPrimaryAnchor(anchors), [anchors]);
  const plans = useMemo(() => buildPlans(offeringMetadata), [offeringMetadata]);
  const selectedPlan = plans[selectedPlanId];
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
    });
  }, [source]);

  useEffect(() => {
    let mounted = true;
    revenueCatService.getOfferingDisplayMetadata().then((metadata) => {
      if (mounted) setOfferingMetadata(metadata);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
    navigation.goBack();
  }, [navigation, source]);

  const handleSelectPlan = useCallback((plan: PlanId) => {
    setSelectedPlanId(plan);
    AnalyticsService.track('paywall_plan_selected', { plan });
  }, []);

  const handleSignIn = useCallback(() => {
    navigation.navigate('Settings', {
      screen: 'Login',
      params: { initialTab: 'signin', context: 'paywall' },
    });
  }, [navigation]);

  const handlePurchase = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    setIsPurchasing(true);
    AnalyticsService.track('paywall_cta_tapped', {
      plan: selectedPlanId,
      productId: selectedPlan.packageId,
    });

    try {
      const { status, dismissed } = await revenueCatService.purchasePackageByIdentifier(selectedPlan.packageId);
      if (!dismissed) {
        // The SDK only returns (without throwing) when the purchase was confirmed
        // by the store. Navigate regardless of hasActiveEntitlement so a misconfigured
        // entitlement ID can't leave a paying user stranded on the paywall.
        if (status.hasActiveEntitlement) {
          AnalyticsService.track('paywall_converted', {
            source,
            plan: selectedPlanId,
            productId: selectedPlan.packageId,
          });
        }
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (error: any) {
      Alert.alert('Purchase could not be completed', error?.message ?? 'Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, isRestoring, navigation, selectedPlan.packageId, selectedPlanId, source]);

  const handleRestorePurchase = useCallback(async () => {
    if (isPurchasing || isRestoring) return;
    setIsRestoring(true);
    AnalyticsService.track('paywall_restore_tapped', { source });

    try {
      const status = await revenueCatService.restorePurchases();
      if (status.hasActiveEntitlement) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Alert.alert('No subscription found', 'No active subscription was found for this account.');
      }
    } catch (error: any) {
      Alert.alert('Restore failed', error?.message ?? 'Could not restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  }, [isPurchasing, isRestoring, navigation, source]);

  const ctaSub = PAYWALL_EXPERIMENT.perDayPrice && selectedPlan.priceValue
    ? selectedPlanId === 'annual'
      ? `less than ${formatCurrency(selectedPlan.priceValue / 365, selectedPlan.currencyCode)} / day · cancel anytime`
      : `about ${formatCurrency(selectedPlan.priceValue / 30, selectedPlan.currencyCode)} / day · cancel anytime`
    : `then ${selectedPlan.priceLabel} / ${selectedPlanId === 'annual' ? 'year' : 'month'} · cancel anytime`;

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

            <Text style={styles.eyebrow}>{headline.eyebrow}</Text>
            <Text style={styles.title}>
              {headline.titleA}
              {'\n'}
              {headline.titleB ? `${headline.titleB} ` : ''}
              <Text style={styles.titleEm}>{headline.titleEm}</Text>
            </Text>
            <Text style={styles.sub}>{headline.sub}</Text>

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
                  All of it stays the moment you <Text style={styles.recapFootStrong}>continue.</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.plansLabel}>Choose your plan</Text>
            <View style={styles.plans}>
              <PlanCard plan={plans.monthly} selected={selectedPlanId === 'monthly'} onPress={handleSelectPlan} />
              <PlanCard plan={plans.annual} selected={selectedPlanId === 'annual'} onPress={handleSelectPlan} />
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
              accessibilityLabel={`Continue my practice, ${selectedPlan.tier} selected`}
              disabled={isPurchasing || isRestoring}
              style={({ pressed }) => [styles.ctaPressable, pressed && styles.ctaPressed]}
            >
              <LinearGradient
                colors={['#F0CB6A', '#C9A84C', '#A8892E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, (isPurchasing || isRestoring) && styles.disabled]}
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#100C04" />
                ) : (
                  <Text style={styles.ctaLabel}>Continue my practice</Text>
                )}
              </LinearGradient>
            </Pressable>
            <Text style={styles.ctaSub}>{ctaSub}</Text>
            <Text style={styles.trust}>Cancel anytime · Your anchors stay · Secure</Text>
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
    top: 8,
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
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sigilHalo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: withAlpha(colors.gold, 0.1),
  },
  sigilRing: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.22),
  },
  sigilDot: {
    position: 'absolute',
    top: -3,
    left: 47,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sanctuary.goldBright,
  },
  sigilCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    gap: 10,
    width: '100%',
  },
  plan: {
    flex: 1,
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
  planSelected: {
    borderColor: withAlpha(colors.gold, 0.65),
    backgroundColor: withAlpha(colors.gold, 0.08),
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 5,
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
    borderWidth: 1,
    borderColor: withAlpha(colors.bone, 0.16),
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
});

export default PaywallScreen;
