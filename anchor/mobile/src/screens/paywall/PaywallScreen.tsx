/**
 * PaywallScreen
 *
 * Shown when a user's 7-day free trial has expired and they have no active subscription.
 * Presented over the main app so the user can review membership options or return home.
 *
 * Note: Purchase buttons are UI-only placeholders. RevenueCat integration is deferred.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { LockIcon } from '@/components/icons';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { useAnchorStore } from '@/stores/anchorStore';
import { REVENUECAT_DEFAULT_PACKAGE_ID } from '@/config';
import type { RootNavigatorParamList } from '@/navigation/RootNavigator';

type PlanId = 'monthly' | 'annual' | 'lifetime';

type PlanConfig = {
  id: PlanId;
  label: string;
  amount: string;
  subtitle: string;
  productId: string;
  badge?: string;
};

const PLAN_OPTIONS: PlanConfig[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    amount: '$7.99',
    subtitle: 'per month',
    productId: REVENUECAT_DEFAULT_PACKAGE_ID,
  },
  {
    id: 'annual',
    label: 'Annual',
    amount: '$59.99',
    subtitle: '$5/mo · save 37%',
    productId: '$rc_annual',
    badge: 'BEST VALUE',
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    amount: '$149',
    subtitle: 'one time',
    productId: '$rc_lifetime',
  },
];

const PREVIEW_FADE_ID = 'paywall-preview-fade';
const VOID_GLOW_ID = 'paywall-void-glow';

function VoidGlowBackdrop() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.voidGlowSvg}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={VOID_GLOW_ID} cx="50%" cy="45%" rx="50%" ry="52%">
          <Stop offset="0%" stopColor={colors.gold} stopOpacity="0.12" />
          <Stop offset="42%" stopColor={colors.deepPurple} stopOpacity="0.22" />
          <Stop offset="100%" stopColor={colors.black} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${VOID_GLOW_ID})`} />
      <Circle cx="50" cy="46" r="22" fill={withAlpha(colors.gold, 0.03)} />
      <Circle cx="50" cy="46" r="14" fill={withAlpha(colors.deepPurple, 0.08)} />
    </Svg>
  );
}

function PreviewFadeOverlay() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.previewFadeSvg}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={PREVIEW_FADE_ID} cx="50%" cy="100%" rx="62%" ry="70%">
          <Stop offset="0%" stopColor={colors.black} stopOpacity="0" />
          <Stop offset="48%" stopColor={colors.deepPurple} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={colors.black} stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${PREVIEW_FADE_ID})`} />
    </Svg>
  );
}

// ─── Placeholder purchase handler ─────────────────────────────────────────────

function handlePurchase(productId: string) {
  // RevenueCat integration pending
  Alert.alert(
    'Coming Soon',
    `Subscription purchase for "${productId}" will be available when RevenueCat integration is complete.`,
    [{ text: 'OK' }]
  );
}

function handleRestorePurchase() {
  // RevenueCat integration pending
  Alert.alert(
    'Coming Soon',
    'Restore Purchase will be available when RevenueCat integration is complete.',
    [{ text: 'OK' }]
  );
}

// ─── PaywallScreen ─────────────────────────────────────────────────────────────

export const PaywallScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootNavigatorParamList, 'Paywall'>>();
  const { height } = useWindowDimensions();
  const anchors = useAnchorStore((state) => state.anchors);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('annual');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const latestAnchor = useMemo(() => {
    if (anchors.length === 0) {
      return null;
    }

    return [...anchors].sort((left, right) => {
      const leftTime = new Date(left.updatedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.updatedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    })[0] ?? null;
  }, [anchors]);

  const selectedPlan = useMemo(
    () => PLAN_OPTIONS.find((plan) => plan.id === selectedPlanId) ?? PLAN_OPTIONS[1],
    [selectedPlanId]
  );

  const sigilSource = latestAnchor?.enhancedImageUrl ?? null;
  const sigilSvg = latestAnchor?.reinforcedSigilSvg ?? latestAnchor?.baseSigilSvg ?? null;
  const previewHeight = Math.round(height * 0.48);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.screen,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.previewZone, { height: previewHeight }]}>
            <LinearGradient
              colors={[colors.navy, colors.deepPurple, colors.black]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.82, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.previewAmbientOrbLeft} />
            <View style={styles.previewAmbientOrbRight} />

            <View style={styles.previewContentWrap} pointerEvents="none">
              {sigilSource ? (
                <Image
                  source={{ uri: sigilSource }}
                  style={styles.previewImage}
                  blurRadius={2}
                  resizeMode="cover"
                />
              ) : sigilSvg ? (
                <View style={styles.previewSvgWrap}>
                  <SvgXml xml={sigilSvg} width="100%" height="100%" />
                </View>
              ) : (
                <View style={styles.previewVoidWrap}>
                  <VoidGlowBackdrop />
                </View>
              )}

              <View style={styles.previewDesaturateWash} />
              <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.lockBadge}>
              <LockIcon size={22} color={colors.gold} />
            </View>

            <PreviewFadeOverlay />
          </View>

          <View style={[styles.contentZone, { top: previewHeight - 4 }]}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.eyebrow}>SAVE YOUR ANCHOR</Text>

              <Text style={styles.headline}>
                Your anchor is{'\n'}
                ready to <Text style={styles.headlineForge}>forge.</Text>
              </Text>

              <Text style={styles.bodyCopy}>
                Create an account to save your work, track your practice, and build more anchors.
              </Text>

              <View style={styles.dividerRow}>
                <LinearGradient
                  colors={[
                    withAlpha(colors.gold, 0),
                    withAlpha(colors.gold, 0.25),
                    withAlpha(colors.gold, 0),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dividerLine}
                />
                <Text style={styles.dividerLabel}>CHOOSE PLAN</Text>
                <LinearGradient
                  colors={[
                    withAlpha(colors.gold, 0),
                    withAlpha(colors.gold, 0.25),
                    withAlpha(colors.gold, 0),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dividerLine}
                />
              </View>

              <View style={styles.planRow}>
                {PLAN_OPTIONS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;

                  return (
                    <Pressable
                      key={plan.id}
                      onPress={() => setSelectedPlanId(plan.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${plan.label} plan ${plan.amount}`}
                      style={({ pressed }) => [
                        styles.planCard,
                        isSelected ? styles.planCardSelected : styles.planCardUnselected,
                        pressed && styles.planCardPressed,
                      ]}
                    >
                      {plan.badge ? (
                        <View style={styles.planBadge}>
                          <Text style={styles.planBadgeText}>{plan.badge}</Text>
                        </View>
                      ) : null}

                      <Text style={styles.planLabel}>{plan.label}</Text>

                      <View style={styles.planPriceWrap}>
                        <Text style={[styles.planAmount, isSelected && styles.planAmountSelected]}>
                          {plan.amount}
                        </Text>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => handlePurchase(selectedPlan.productId)}
                accessibilityRole="button"
                accessibilityLabel="Forge Free for 7 Days"
                style={({ pressed }) => [
                  styles.ctaButton,
                  pressed && styles.ctaButtonPressed,
                ]}
              >
                <Text style={styles.ctaText}>Forge Free for 7 Days</Text>
              </Pressable>

              <Text style={styles.trialNote}>Cancel anytime</Text>

              <Pressable
                onPress={handleSignIn}
                accessibilityRole="button"
                accessibilityLabel="Already forging? Sign in"
                style={({ pressed }) => [styles.signInButton, pressed && styles.signInPressed]}
              >
                <Text style={styles.signInText}>
                  Already forging? <Text style={styles.signInLink}>Sign in</Text>
                </Text>
              </Pressable>

              {/*
                DEFERRED: Restore Purchases link moved below Sign In and commented out for now.
                <Pressable onPress={handleRestorePurchase} accessibilityRole="button">
                  <Text style={styles.restoreText}>Restore Purchases</Text>
                </Pressable>
              */}

              {/*
                DEFERRED: Back to home link removed from the approved layout.
                Keep the handler for now so the existing navigation path remains available.
              */}
            </ScrollView>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.black,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  previewZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  previewAmbientOrbLeft: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    left: -80,
    top: 24,
    backgroundColor: withAlpha(colors.deepPurple, 0.34),
  },
  previewAmbientOrbRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -70,
    top: 110,
    backgroundColor: withAlpha(colors.gold, 0.06),
  },
  previewContentWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  previewSvgWrap: {
    width: '84%',
    height: '84%',
    opacity: 0.55,
  },
  previewVoidWrap: {
    width: '88%',
    height: '88%',
  },
  previewDesaturateWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.black, 0.24),
  },
  previewFadeSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  voidGlowSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  lockBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 26,
    backgroundColor: 'rgba(8,12,16,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 5,
  },
  contentZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingBottom: 44,
    paddingTop: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gold,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  headline: {
    fontFamily: typography.fonts.heading,
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '400',
    color: colors.bone,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  headlineForge: {
    color: colors.gold,
  },
  bodyCopy: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 24,
    color: withAlpha(colors.bone, 0.6),
    marginBottom: 22,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 2.1,
    color: withAlpha(colors.gold, 0.45),
    textTransform: 'uppercase',
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  planCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  planCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  planCardSelected: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.1),
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  planCardUnselected: {
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.2),
    backgroundColor: withAlpha(colors.gold, 0.03),
  },
  planBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colors.gold,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  planBadgeText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 7,
    color: colors.black,
    letterSpacing: 0.8,
  },
  planLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.3,
    color: withAlpha(colors.bone, 0.7),
    textTransform: 'uppercase',
  },
  planPriceWrap: {
    gap: 2,
  },
  planAmount: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    lineHeight: 20,
    color: colors.bone,
  },
  planAmountSelected: {
    color: colors.gold,
  },
  planSubtitle: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    lineHeight: 15,
    color: withAlpha(colors.bone, 0.42),
  },
  ctaButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 14,
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.995 }],
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 13,
    color: colors.black,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
  trialNote: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: withAlpha(colors.bone, 0.3),
    marginBottom: 14,
  },
  signInButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signInPressed: {
    opacity: 0.85,
  },
  signInText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    color: withAlpha(colors.bone, 0.4),
  },
  signInLink: {
    color: colors.gold,
    textDecorationLine: 'underline',
    textDecorationColor: withAlpha(colors.gold, 0.36),
  },
});

export default PaywallScreen;
