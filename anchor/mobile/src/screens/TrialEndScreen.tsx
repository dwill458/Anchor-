import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { safeHaptics } from '@/utils/haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import revenueCatService from '@/services/RevenueCatService';
import { logger } from '@/utils/logger';
import type { RootNavigatorParamList } from '@/navigation/RootNavigator';

type PlanId = 'annual' | 'monthly' | 'lifetime';

type PlanConfig = {
  id: PlanId;
  label: string;
  amount: string;
  period: string;
  description: string;
  productId: string;
  featured?: boolean;
};

const PLANS: PlanConfig[] = [
  {
    id: 'lifetime',
    label: 'Lifetime',
    amount: '$149',
    period: 'one time',
    description: 'First 500 founders · limited',
    productId: '$rc_lifetime',
    featured: true,
  },
  {
    id: 'annual',
    label: 'Annual',
    amount: '$59.99',
    period: '/year',
    description: '$5/mo · best value',
    productId: '$rc_annual',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    amount: '$7.99',
    period: '/month',
    description: 'Pay as you go',
    productId: '$rc_monthly',
  },
];

function PlaceholderSigil() {
  return (
    <Svg width={100} height={100} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="45" fill="none" stroke={colors.gold} strokeWidth="1" opacity={0.3} />
      <Path d="M50 20 L80 80 L20 80 Z" fill="none" stroke={colors.gold} strokeWidth="2" />
      <Circle cx="50" cy="50" r="8" fill={colors.gold} opacity={0.8} />
      <Line x1="50" y1="30" x2="50" y2="70" stroke={colors.gold} strokeWidth="1.5" opacity={0.5} />
      <Line x1="30" y1="50" x2="70" y2="50" stroke={colors.gold} strokeWidth="1.5" opacity={0.5} />
    </Svg>
  );
}

export default function TrialEndScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootNavigatorParamList, 'TrialEndScreen'>>();
  const anchors = useAnchorStore((state) => state.anchors);
  const hapticIntensity = useSettingsStore((s) => s.hapticIntensity);
  const [selectedId, setSelectedId] = useState<PlanId>('lifetime');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const animations = useRef({
    fade: Array.from({ length: 5 }, () => new Animated.Value(0)),
    slide: Array.from({ length: 5 }, () => new Animated.Value(20)),
  }).current;

  const hapticsOn = hapticIntensity > 0;

  const triggerLight = () => {
    if (!hapticsOn) return;
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };
  const triggerMedium = () => {
    if (!hapticsOn) return;
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
  };
  const triggerSelection = () => {
    if (!hapticsOn) return;
    safeHaptics.selection();
  };

  useEffect(() => {
    triggerLight();
    logger.info('[Analytics] trial_end_screen_viewed');

    const DELAYS = [200, 400, 600, 800, 1000];
    DELAYS.forEach((delay, i) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(animations.fade[i], { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(animations.slide[i], { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, []);

  const latestAnchor = useMemo(() => {
    if (anchors.length === 0) return null;
    return (
      [...anchors].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
        const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
        return bTime - aTime;
      })[0] ?? null
    );
  }, [anchors]);

  const sigilSource = latestAnchor?.enhancedImageUrl ?? null;
  const sigilSvg = latestAnchor?.reinforcedSigilSvg ?? latestAnchor?.baseSigilSvg ?? null;

  const selectedPlan = PLANS.find((p) => p.id === selectedId) ?? PLANS[0];

  const handlePurchase = async () => {
    triggerMedium();
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      const { status, dismissed } = await revenueCatService.purchasePackageByIdentifier(
        selectedPlan.productId
      );
      if (!dismissed && status.hasActiveEntitlement) {
        if (hapticsOn) {
          await safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
        }
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (error: any) {
      Alert.alert('Purchase Failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const ctaLabel = isPurchasing
    ? 'Processing…'
    : selectedId === 'lifetime'
      ? 'Claim Lifetime Access'
      : selectedId === 'annual'
        ? 'Continue with Annual'
        : 'Continue with Monthly';

  const handleSeeAllOptions = () => {
    triggerLight();
    navigation.navigate('Paywall');
  };

  const handleTierPress = (id: PlanId) => {
    triggerSelection();
    setSelectedId(id);
    logger.info('[Analytics] trial_tier_selected', { tier: id });
  };

  const animatedStyle = (i: number) => ({
    opacity: animations.fade[i],
    transform: [{ translateY: animations.slide[i] }],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.navy, '#1a1f2e', colors.deepPurple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.82, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Sigil ── */}
          <Animated.View style={[styles.sigilSection, animatedStyle(0)]}>
            <View style={styles.sigilContainer}>
              {sigilSource ? (
                <Image
                  source={{ uri: sigilSource }}
                  style={styles.sigilImage}
                  resizeMode="contain"
                />
              ) : sigilSvg ? (
                <SvgXml xml={sigilSvg} width={100} height={100} />
              ) : (
                <PlaceholderSigil />
              )}
            </View>
            <View style={styles.statusText}>
              <Text style={styles.statusLabel}>YOUR ANCHOR</Text>
              <Text style={styles.statusTitle}>Seven Days Forged</Text>
            </View>
          </Animated.View>

          {/* ── Copy ── */}
          <Animated.View style={[styles.copySection, animatedStyle(1)]}>
            <Text style={styles.headline}>Your trial is complete.</Text>
            <Text style={styles.subheadline}>
              {"Here's what you've built. Keep your practice alive with unlimited sessions and multiple anchors."}
            </Text>
          </Animated.View>

          {/* ── Pricing ── */}
          <Animated.View style={[styles.pricingSection, animatedStyle(2)]}>
            <Text style={styles.pricingLabel}>CHOOSE YOUR PRACTICE</Text>
            {PLANS.map((plan) => {
              const isSelected = selectedId === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => handleTierPress(plan.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.label} plan, ${plan.amount} ${plan.period}`}
                  style={({ pressed }) => [
                    styles.tier,
                    isSelected && styles.tierSelected,
                    pressed && styles.tierPressed,
                  ]}
                >
                  {plan.featured && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                  <View style={styles.tierInfo}>
                    <Text style={styles.tierName}>{plan.label}</Text>
                    <Text style={styles.tierDescription}>{plan.description}</Text>
                  </View>
                  <View style={styles.tierPriceWrap}>
                    <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                      {plan.amount}
                    </Text>
                    <Text style={styles.tierPeriod}>{plan.period}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>

          {/* ── CTAs ── */}
          <Animated.View style={[styles.ctaSection, animatedStyle(3)]}>
            <Pressable
              onPress={handlePurchase}
              disabled={isPurchasing}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && styles.btnPrimaryPressed,
                isPurchasing && styles.btnDisabled,
              ]}
            >
              <Text style={styles.btnPrimaryText}>{ctaLabel}</Text>
            </Pressable>
            <Pressable
              onPress={handleSeeAllOptions}
              disabled={isPurchasing}
              accessibilityRole="button"
              accessibilityLabel="See all subscription options"
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnSecondaryPressed]}
            >
              <Text style={styles.btnSecondaryText}>See All Options</Text>
            </Pressable>
          </Animated.View>

          {/* ── Footer ── */}
          <Animated.View style={[styles.footer, animatedStyle(4)]}>
            <Text style={styles.footerText}>
              {'7-day free trial included. Cancel anytime.\nBilled to your device account.'}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 32,
  },

  // Sigil section
  sigilSection: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: withAlpha(colors.bone, 0.02),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.2),
    borderRadius: 8,
  },
  sigilContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 60,
    backgroundColor: withAlpha(colors.gold, 0.05),
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
  sigilImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  statusText: {
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: withAlpha(colors.gold, 0.8),
  },
  statusTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.bone,
    letterSpacing: 0.5,
  },

  // Copy section
  copySection: {
    alignItems: 'center',
    gap: 12,
  },
  headline: {
    fontFamily: typography.fonts.heading,
    fontSize: 26,
    fontWeight: '600',
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subheadline: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 26,
    color: withAlpha(colors.bone, 0.7),
    textAlign: 'center',
  },

  // Pricing section
  pricingSection: {
    gap: 12,
  },
  pricingLabel: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: withAlpha(colors.gold, 0.8),
    textAlign: 'center',
    marginBottom: 4,
  },
  tier: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: withAlpha(colors.bone, 0.04),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.15),
    borderRadius: 6,
    overflow: 'hidden',
  },
  tierSelected: {
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  tierPressed: {
    transform: [{ translateX: 2 }],
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -44 }],
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  recommendedText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.black,
    textTransform: 'uppercase',
  },
  tierInfo: {
    gap: 4,
    flex: 1,
  },
  tierName: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: colors.bone,
  },
  tierDescription: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    fontWeight: '300',
    color: withAlpha(colors.bone, 0.6),
  },
  tierPriceWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tierPrice: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 16,
    color: withAlpha(colors.bone, 0.85),
  },
  tierPriceSelected: {
    color: colors.gold,
  },
  tierPeriod: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: withAlpha(colors.bone, 0.45),
  },

  // CTAs
  ctaSection: {
    gap: 12,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  btnPrimaryPressed: {
    transform: [{ scale: 0.997 }],
    shadowOpacity: 0.45,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.black,
  },
  btnSecondary: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryPressed: {
    backgroundColor: withAlpha(colors.gold, 0.06),
    borderColor: colors.gold,
  },
  btnSecondaryText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.gold,
  },

  // Footer
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    lineHeight: 18,
    color: withAlpha(colors.bone, 0.45),
    textAlign: 'center',
  },
});
