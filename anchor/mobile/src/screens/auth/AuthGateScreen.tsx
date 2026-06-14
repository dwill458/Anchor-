import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import type { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZenBackground } from '@/components/common';
import {
  REVENUECAT_ANNUAL_PACKAGE_ID,
  REVENUECAT_MONTHLY_PACKAGE_ID,
} from '@/config';
import revenueCatService, {
  type RevenueCatOfferingDisplayMetadata,
  type RevenueCatPlanId,
} from '@/services/RevenueCatService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type { RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';

type AuthGateNavigationProp = StackNavigationProp<RootStackParamList, 'AuthGate'>;
type PlanId = RevenueCatPlanId;

type PlanDisplay = {
  id: PlanId;
  label: string;
  amount: string;
  subtitle: string;
  badge?: string;
};

const PREVIEW_FADE_ID = 'auth-gate-preview-fade';
const VOID_GLOW_ID = 'auth-gate-void-glow';
const DEFAULT_PLAN_ID: PlanId = 'annual';

const FALLBACK_PLAN_VALUES = {
  monthly: {
    label: 'Monthly',
    amount: '$7.99',
    subtitle: 'per month',
    packageId: REVENUECAT_MONTHLY_PACKAGE_ID,
  },
  annual: {
    label: 'Annual',
    amount: '$59.99',
    subtitle: '$5/mo · best value',
    packageId: REVENUECAT_ANNUAL_PACKAGE_ID,
  },
} satisfies Record<PlanId, {
  label: string;
  amount: string;
  subtitle: string;
  packageId: string;
}>;

function buildPlanOptions(metadata: RevenueCatOfferingDisplayMetadata): PlanDisplay[] {
  return (Object.keys(FALLBACK_PLAN_VALUES) as PlanId[]).map((id) => {
    const fallback = FALLBACK_PLAN_VALUES[id];
    const livePlan = metadata[id];

    if (id === 'annual') {
      return {
        id,
        label: fallback.label,
        amount: livePlan?.priceString ?? fallback.amount,
        subtitle: livePlan?.pricePerMonthString
          ? `${livePlan.pricePerMonthString}/mo · best value`
          : fallback.subtitle,
        badge: 'BEST VALUE',
      };
    }

    return {
      id,
      label: fallback.label,
      amount: livePlan?.priceString ?? fallback.amount,
      subtitle: fallback.subtitle,
    };
  });
}

const VoidGlowBackdrop = React.memo(function VoidGlowBackdrop() {
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
});

const PreviewFadeOverlay = React.memo(function PreviewFadeOverlay() {
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
});

const LockBadgeIcon = React.memo(function LockBadgeIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke={colors.gold}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11"
        stroke={colors.gold}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="15.5" r="1.5" fill={colors.gold} />
    </Svg>
  );
});

export default function AuthGateScreen() {
  const navigation = useNavigation<AuthGateNavigationProp>();
  const { height } = useWindowDimensions();
  const anchors = useAnchorStore((state) => state.anchors);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(DEFAULT_PLAN_ID);
  const [offeringMetadata, setOfferingMetadata] = useState<RevenueCatOfferingDisplayMetadata>({});
  const clearPendingForgeIntent = useAuthStore((state) => state.clearPendingForgeIntent);
  const pendingForgeResumeTarget = useAuthStore((state) => state.pendingForgeResumeTarget);
  const clearPendingForgeResumeTarget = useAuthStore((state) => state.clearPendingForgeResumeTarget);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const setPreferredPlanId = useSubscriptionStore((state) => state.setPreferredPlanId);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    let mounted = true;
    revenueCatService.getOfferingDisplayMetadata().then((metadata) => {
      if (mounted) {
        setOfferingMetadata(metadata);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const planOptions = useMemo(() => buildPlanOptions(offeringMetadata), [offeringMetadata]);
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.id === selectedPlanId) ?? planOptions[0],
    [planOptions, selectedPlanId]
  );

  const handleDismiss = useCallback(() => {
    clearPendingForgeIntent();
    clearPendingForgeResumeTarget();

    if (pendingForgeResumeTarget && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('Vault');
  }, [
    clearPendingForgeIntent,
    clearPendingForgeResumeTarget,
    navigation,
    pendingForgeResumeTarget,
  ]);

  const handleCreateAccount = useCallback(() => {
    setPreferredPlanId(selectedPlanId);
    navigation.navigate('Login', {
      initialTab: 'signup',
      context: pendingFirstAnchorDraft ? 'first_anchor_gate' : undefined,
      preferredPlanId: selectedPlanId,
    });
  }, [navigation, pendingFirstAnchorDraft, selectedPlanId, setPreferredPlanId]);

  const handleSignIn = useCallback(() => {
    setPreferredPlanId(selectedPlanId);
    navigation.navigate('Login', {
      context: pendingFirstAnchorDraft ? 'first_anchor_gate' : undefined,
      preferredPlanId: selectedPlanId,
    });
  }, [navigation, pendingFirstAnchorDraft, selectedPlanId, setPreferredPlanId]);

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

  const sigilSource = latestAnchor?.enhancedImageUrl ?? null;
  const sigilSvg = latestAnchor?.reinforcedSigilSvg ?? latestAnchor?.baseSigilSvg ?? null;
  const previewHeight = Math.round(height * 0.48);

  return (
    <View style={styles.root}>
      <ZenBackground variant="creation" showOrbs showGrain showVignette />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <AnimatedScreen
          opacity={fadeAnim}
          translateY={slideAnim}
          previewHeight={previewHeight}
          sigilSource={sigilSource}
          sigilSvg={sigilSvg}
          planOptions={planOptions}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={setSelectedPlanId}
          selectedPlan={selectedPlan}
          onDismiss={handleDismiss}
          onCreateAccount={handleCreateAccount}
          onSignIn={handleSignIn}
        />
      </SafeAreaView>
    </View>
  );
}

type AnimatedScreenProps = {
  opacity: Animated.Value;
  translateY: Animated.Value;
  previewHeight: number;
  sigilSource: string | null;
  sigilSvg: string | null;
  planOptions: PlanDisplay[];
  selectedPlanId: PlanId;
  setSelectedPlanId: (id: PlanId) => void;
  selectedPlan: PlanDisplay | undefined;
  onDismiss: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
};

const AnimatedScreen = React.memo(function AnimatedScreen({
  opacity,
  translateY,
  previewHeight,
  sigilSource,
  sigilSvg,
  planOptions,
  selectedPlanId,
  setSelectedPlanId,
  selectedPlan,
  onDismiss,
  onCreateAccount,
  onSignIn,
}: AnimatedScreenProps) {
  const selectedPlanSummary = selectedPlan
    ? `${selectedPlan.label} · ${selectedPlan.amount} ${selectedPlan.subtitle}`
    : null;

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.animatedShell,
          {
            opacity,
            transform: [{ translateY }],
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
              <View style={styles.previewArtFrame}>
                <Image
                  source={{ uri: sigilSource }}
                  style={styles.previewImage}
                  blurRadius={2}
                  resizeMode="contain"
                />
              </View>
            ) : sigilSvg ? (
              <View style={styles.previewArtFrame}>
                <View style={styles.previewSvgWrap}>
                  <SvgXml xml={sigilSvg} width="100%" height="100%" />
                </View>
              </View>
            ) : (
              <View style={styles.previewArtFrame}>
                <View style={styles.previewVoidWrap}>
                  <VoidGlowBackdrop />
                </View>
              </View>
            )}

            <View style={styles.previewDesaturateWash} />
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
          </View>

          <View style={styles.closeRow}>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.lockBadge}>
            <LockBadgeIcon />
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
              ready to <Text style={styles.headlineForge}>continue.</Text>
            </Text>

            <Text style={styles.bodyCopy}>
              Create an account to save your work and pick the plan you want before anything is
              charged.
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
              {planOptions.map((plan) => {
                const isSelected = selectedPlanId === plan.id;

                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlanId(plan.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${plan.label} plan ${plan.amount}`}
                    style={({ pressed }) => [
                      styles.planCard,
                      isSelected ? styles.planCardSelected : styles.planCardUnselected,
                      pressed && styles.planCardPressed,
                    ]}
                    testID={`auth-gate-plan-${plan.id}`}
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

            {selectedPlanSummary ? (
              <Text style={styles.planHint}>
                Selected: <Text style={styles.planHintGold}>{selectedPlanSummary}</Text>
              </Text>
            ) : null}

            <Pressable
              onPress={onCreateAccount}
              accessibilityRole="button"
              accessibilityLabel={`Create account to continue, ${selectedPlan?.label ?? 'Annual'} selected`}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            >
              <Text style={styles.ctaText}>Create account to continue</Text>
            </Pressable>

            <Text style={styles.trialNote}>You will confirm pricing after sign in</Text>

            <Pressable
              onPress={onSignIn}
              accessibilityRole="button"
              accessibilityLabel="Already forging? Sign in"
              style={({ pressed }) => [styles.signInButton, pressed && styles.signInPressed]}
            >
              <View style={styles.signInRow}>
                <Text style={styles.signInText}>Already forging? </Text>
                <View style={styles.signInLinkWrap}>
                  <Text style={styles.signInLink}>Sign in</Text>
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  animatedShell: {
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
    transform: [{ translateY: 20 }],
  },
  previewArtFrame: {
    width: '88%',
    height: '88%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  previewSvgWrap: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  previewVoidWrap: {
    width: '100%',
    height: '100%',
  },
  previewDesaturateWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.black, 0.28),
  },
  previewFadeSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  voidGlowSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  closeRow: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 6,
  },
  closeText: {
    fontFamily: typography.fonts.body,
    fontSize: 15,
    color: colors.silver,
  },
  lockBadge: {
    position: 'absolute',
    top: '56%',
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
    marginBottom: 16,
  },
  headline: {
    fontFamily: typography.fonts.heading,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '400',
    color: colors.bone,
    marginBottom: 14,
    letterSpacing: 0,
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
    marginBottom: 16,
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
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingTop: 12,
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
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  planBadgeText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 7,
    color: colors.black,
    letterSpacing: 1,
  },
  planLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    letterSpacing: 2,
    color: withAlpha(colors.bone, 0.4),
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  planPriceWrap: {
    gap: 2,
  },
  planAmount: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: 3,
  },
  planAmountSelected: {
    color: colors.gold,
  },
  planSubtitle: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '300',
    color: withAlpha(colors.bone, 0.4),
    textAlign: 'center',
  },
  planHint: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    lineHeight: 16,
    color: withAlpha(colors.bone, 0.42),
    marginBottom: 12,
  },
  planHintGold: {
    color: colors.gold,
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
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    color: withAlpha(colors.bone, 0.45),
  },
  signInLink: {
    color: colors.gold,
  },
  signInLinkWrap: {
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(colors.gold, 0.3),
    paddingBottom: 1,
  },
});
