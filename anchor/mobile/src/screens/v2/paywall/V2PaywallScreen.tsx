import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, X } from 'lucide-react-native';
import { colors, V2_MIN_TOUCH_TARGET } from '@/theme/v2';
import {
  useV2Paywall,
  useV2PaywallRecap,
  type V2PaywallController,
  type V2PaywallEntitlementResult,
} from '@/hooks/v2/paywall';
import { useV2SelectedAnchor } from '@/hooks/v2/home/useV2SelectedAnchor';
import { useV2Vision } from '@/hooks/v2/vision';
import { useV2ReduceMotion } from '@/hooks/v2';
import { annualSavingsVsWeeklyPercent, planForId } from '@/adapters/v2/paywall';
import { resolveVisionHeroImage, toV2HomeVisionState } from '@/adapters/v2/home';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
// DEFERRED: the single-sheet body below is replaced by the two-step flow; V2PaywallSheet stays exported.
// import { V2PaywallSheet, V2PlanPickerSheet, V2TrialEndedPanel } from '@/components/v2/paywall';
import { V2PlanPickerSheet, V2TrialEndedPanel } from '@/components/v2/paywall';
import {
  PAYWALL_EASE_OUT,
  PAYWALL_LAYOUT as L,
  PAYWALL_STEP_EASE,
  PAYWALL_TIMING,
  PaywallBackdrop,
  PaywallChartPreviewTile,
  PaywallCta,
  PaywallFeatureRow,
  PaywallHero,
  PaywallLegalFooter,
  PaywallPracticeTile,
  PaywallRise,
  PaywallVisionTile,
  PlanCard,
  TrialTimeline,
  paywallType,
  type PaywallVisionPreview,
} from '@/components/v2/paywall/twoStep';
import { V2_PAYWALL_PRICING_FALLBACK, type V2PaywallContext, type V2PaywallPlanId } from '@/constants/v2/paywall';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import revenueCatService from '@/services/RevenueCatService';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { logger } from '@/utils/logger';
import { safeHaptics } from '@/utils/haptics';

/** Final paywall copy. Prices are always spliced in from RevenueCat. */
const COPY = {
  wordmark: 'ANCHOR',
  step1: {
    headline: 'Don’t let this become another goal you forget',
    sub: 'You’ve already turned this intention into something real. Anchor Pro helps you keep it visible and moving forward.',
    rows: {
      vision: { title: 'Vision', body: 'See what you’re building toward.' },
      practice: { title: 'Practice', body: 'Use short guided sessions to keep your Anchor active.' },
      chart: { title: 'Chart', body: 'Turn intention into your next move.' },
    },
    cta: 'Continue',
    later: 'Maybe later',
  },
  step2: {
    headline: 'Choose your plan',
    sub: 'Unlock Vision, Deep Focus, your Chart, unlimited Anchors, and more ways to practice.',
    bestValue: 'BEST VALUE',
    annual: 'Annual',
    weekly: 'Weekly',
    trialLine: '7 days free',
    weeklyDetail: 'Shortest commitment. Billed weekly.',
    otherPlans: 'Other plans',
    trialCta: 'Start my free trial',
    paidCta: 'Continue',
    noChargeToday: 'No charge today',
    timeline: (price: string) =>
      [
        { title: 'Today', sub: 'Start free trial' },
        { title: 'Day 5', sub: 'We’ll remind you' },
        { title: 'Day 7', sub: `Billed ${price}` },
      ] as const,
    loadingPrice: 'Loading price…',
    unavailablePrice: 'Unavailable right now',
    retry: 'Pricing is temporarily unavailable. Tap to retry.',
  },
} as const;

const PERIOD: Record<V2PaywallPlanId, { unit: string; adverb: string; every: string; name: string }> = {
  annual: { unit: 'year', adverb: 'yearly', every: 'every year', name: 'Annual' },
  weekly: { unit: 'week', adverb: 'weekly', every: 'every week', name: 'Weekly' },
  monthly: { unit: 'month', adverb: 'monthly', every: 'every month', name: 'Monthly' },
  lifetime: { unit: 'lifetime', adverb: 'once', every: 'once', name: 'Lifetime' },
};

/** "Other plans" lists what the two cards do not. */
const OTHER_PLAN_IDS: readonly V2PaywallPlanId[] = ['monthly', 'lifetime'];

/** CTA label, the line under it, and the note that stands in for the timeline. */
function selectionCopy(controller: V2PaywallController) {
  const { selectedPlan, offersTrial, pricing, pricingStatus } = controller;
  const price = planForId(pricing, selectedPlan).priceLabel;
  if (selectedPlan === 'annual' && offersTrial) {
    return { cta: COPY.step2.trialCta, below: COPY.step2.noChargeToday, note: null };
  }
  const period = PERIOD[selectedPlan];
  if (!price) {
    const pending = pricingStatus === 'loading' ? V2_PAYWALL_PRICING_FALLBACK.loading : V2_PAYWALL_PRICING_FALLBACK.unavailable;
    return { cta: COPY.step2.paidCta, below: pending, note: null };
  }
  if (selectedPlan === 'lifetime') {
    return { cta: COPY.step2.paidCta, below: `${price} billed today, one time`, note: `Lifetime is a single payment of ${price}. No subscription.` };
  }
  // Only a trial-eligible user is told a plan has no free trial; otherwise no trial language at all.
  const noTrial = offersTrial ? `${period.name} has no free trial. ` : '';
  return {
    cta: COPY.step2.paidCta,
    below: `${price} billed today, then ${period.adverb}`,
    note: `${noTrial}You’re billed ${price} today, then ${period.every}.`,
  };
}

function priceLine(controller: V2PaywallController, planId: V2PaywallPlanId): string {
  const plan = planForId(controller.pricing, planId);
  if (plan.priceLabel) return `${plan.priceLabel} / ${PERIOD[planId].unit}`;
  return controller.pricingStatus === 'loading' ? COPY.step2.loadingPrice : COPY.step2.unavailablePrice;
}

function annualDetail(controller: V2PaywallController, savings: number | null): string {
  const price = controller.pricing.annual.priceLabel;
  const save = savings ? `Save ${savings}% vs weekly` : null;
  if (controller.offersTrial && price) return save ? `${save}, then ${price}/year.` : `Then ${price}/year.`;
  return save ? `${save}. Billed yearly.` : 'Billed yearly.';
}

export type V2PaywallScreenProps = {
  /** Why the paywall is being shown. Drives copy, artifact and tone. */
  context: V2PaywallContext;
  /** Dismiss without entitlement (back / swipe-down / close). */
  onDismiss: () => void;
  /**
   * A real entitlement was granted. The host resumes the user's original
   * intent (e.g. open the practice they tapped, create the second Anchor).
   */
  onEntitled: (result: V2PaywallEntitlementResult) => void;
  /** Optional "Already subscribed? Sign in" hand-off. */
  onSignIn?: () => void;
};

/**
 * The Anchor 2.0 contextual paywall. It is a pure presentation surface over the
 * server trial lifecycle and RevenueCat — it starts nothing implicitly and
 * owns no navigation. Present it however the host prefers (route or modal); it
 * fills its container and reports back through `onDismiss` / `onEntitled`.
 */
export function V2PaywallScreen({ context, onDismiss, onEntitled, onSignIn }: V2PaywallScreenProps) {
  const [planPickerOpen, setPlanPickerOpen] = React.useState(false);
  const controller = useV2Paywall({ context, onEntitled });
  const recap = useV2PaywallRecap();

  const openPlanPicker = useCallback(() => setPlanPickerOpen(true), []);
  const closePlanPicker = useCallback(() => setPlanPickerOpen(false), []);

  // Funnel entry, once per presentation, after store pricing settles (as the legacy paywall does).
  const { subscriptionStatus } = useTrialStatus();
  const viewed = useRef(false);
  const { pricingStatus, pricing, daysRemaining } = controller;
  useEffect(() => {
    if (pricingStatus === 'loading' || viewed.current) return;
    viewed.current = true;
    AnalyticsService.track(AnalyticsEvents.PAYWALL_VIEWED, {
      source: context,
      context,
      defaultPlan: 'annual',
      headline: context === 'TRIAL_ENDED' ? 'trial_ended' : 'two_step',
      trial_days_remaining: daysRemaining,
      trial_status: subscriptionStatus,
    });
    if (typeof revenueCatService.trackCustomPaywallImpression === 'function') {
      void revenueCatService.trackCustomPaywallImpression(pricing.offeringId).catch((error) => {
        logger.warn('[v2/paywall] RevenueCat custom impression tracking failed', error);
      });
    }
  }, [context, daysRemaining, pricing.offeringId, pricingStatus, subscriptionStatus]);

  const handleDismiss = useCallback(
    (step: Step) => {
      AnalyticsService.track(AnalyticsEvents.PAYWALL_DISMISSED, { source: context, context, step });
      onDismiss();
    },
    [context, onDismiss],
  );

  if (context === 'TRIAL_ENDED') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe} testID="v2-paywall-screen">
        <V2TrialEndedPanel controller={controller} recap={recap} onSignIn={onSignIn} />
      </SafeAreaView>
    );
  }

  // DEFERRED: single-sheet paywall body, replaced by the two-step offer → plans flow.
  // return (
  //   <View style={styles.root} testID="v2-paywall-screen">
  //     <SafeAreaView edges={['bottom']} style={styles.sheetHost}>
  //       <V2PaywallSheet
  //         controller={controller}
  //         onDismiss={onDismiss}
  //         onViewOtherPlans={openPlanPicker}
  //         onSignIn={onSignIn}
  //       />
  //     </SafeAreaView>
  //     <V2PlanPickerSheet
  //       visible={planPickerOpen}
  //       pricing={controller.pricing}
  //       offersTrial={controller.offersTrial}
  //       selected={controller.selectedPlan}
  //       onSelect={controller.setSelectedPlan}
  //       onClose={closePlanPicker}
  //     />
  //   </View>
  // );

  return (
    <View style={styles.root} testID="v2-paywall-screen">
      <TwoStepPaywall controller={controller} onDismiss={handleDismiss} onViewOtherPlans={openPlanPicker} />
      <V2PlanPickerSheet
        visible={planPickerOpen}
        pricing={controller.pricing}
        offersTrial={controller.offersTrial}
        selected={controller.selectedPlan}
        onSelect={controller.setSelectedPlan}
        onClose={closePlanPicker}
        planIds={OTHER_PLAN_IDS}
      />
    </View>
  );
}

type Step = 1 | 2;

/**
 * Offer (step 1) → plans (step 2) on one screen. The medallion and the cream
 * header are single persistent layers that travel between the steps by
 * transform; each step's copy rises in and fades out around them.
 */
function TwoStepPaywall({
  controller,
  onDismiss,
  onViewOtherPlans,
}: {
  controller: V2PaywallController;
  onDismiss: (step: Step) => void;
  onViewOtherPlans: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const W = Math.min(screenW, L.maxDesignWidth);
  const columnLeft = (screenW - W) / 2;
  const gutter = L.gutter * W;
  // Map the prototype's status-bar band onto the real inset without tucking copy under the top bar.
  const offset = Math.max(insets.top - L.prototypeStatusBar * W, insets.top + 40 - L.headlineTop * W);
  const topBarTop = Math.max(insets.top, offset + 0.16 * W - V2_MIN_TOUCH_TARGET / 2);

  const [step, setStep] = useState<Step>(1);
  const [stepChanges, setStepChanges] = useState(0);
  const progress = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);

  // Large system text can push the copy past the medallion; the shared frames then move down with it.
  const [copyBottom, setCopyBottom] = useState<[number, number]>([0, 0]);
  const [lowerBottom, setLowerBottom] = useState<[number, number]>([0, 0]);
  const frames = useMemo(() => {
    const pick = (i: 0 | 1) => {
      const medTop = L.medallionTop[i] * W + offset;
      const extra = Math.max(0, copyBottom[i] + L.copyToMedallionGap * W - medTop);
      const edge = L.creamEdge[i] * W + offset + extra;
      return { medTop: medTop + extra, edge, lowerTop: edge + L.afterCreamGap * W };
    };
    return [pick(0), pick(1)] as const;
  }, [W, copyBottom, offset]);
  const contentHeight = Math.max(screenH, lowerBottom[step - 1] + insets.bottom + 0.04 * W);

  const measureInto = (setter: React.Dispatch<React.SetStateAction<[number, number]>>, index: 0 | 1) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const bottom = Math.ceil(y + height);
    setter((prev) => {
      if (prev[index] === bottom) return prev;
      return index === 0 ? [bottom, prev[1]] : [prev[0], bottom];
    });
  };

  const goToStep = useCallback(
    (next: Step) => {
      setStep(next);
      setStepChanges((n) => n + 1);
      progress.value = withTiming(next === 2 ? 1 : 0, { duration: reduceMotion ? 0 : PAYWALL_TIMING.stepMs, easing: PAYWALL_STEP_EASE });
      scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      if (next === 2) {
        AnalyticsService.track(AnalyticsEvents.PAYWALL_STEP2_VIEWED, { source: controller.context, context: controller.context });
      }
    },
    [controller.context, progress, reduceMotion],
  );

  const handleContinue = useCallback(() => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    goToStep(2);
  }, [goToStep]);

  // Hardware back on the plans step returns to the offer rather than leaving.
  useEffect(() => {
    if (step !== 2) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToStep(1);
      return true;
    });
    return () => sub.remove();
  }, [goToStep, step]);

  const { setSelectedPlan, selectedPlan, restore } = controller;
  const selectPlan = useCallback(
    (plan: V2PaywallPlanId) => {
      if (plan === selectedPlan) return;
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      AnalyticsService.track(AnalyticsEvents.PAYWALL_PLAN_SELECTED, { plan, source: controller.context, context: controller.context });
      setSelectedPlan(plan);
    },
    [controller.context, selectedPlan, setSelectedPlan],
  );

  const handleRestore = useCallback(() => {
    AnalyticsService.track(AnalyticsEvents.PAYWALL_RESTORE_TAPPED, { source: controller.context, context: controller.context });
    void restore();
  }, [controller.context, restore]);

  // Real data: the user's own Anchor and Vision.
  const { selectedAnchor } = useV2SelectedAnchor();
  const art = useMemo(() => (selectedAnchor ? anchorRenderProps(selectedAnchor) : null), [selectedAnchor]);
  const visionModel = useV2Vision(selectedAnchor?.id ?? '');
  const vision = useMemo<PaywallVisionPreview | null>(() => {
    if (!selectedAnchor) return null;
    const state = toV2HomeVisionState(visionModel.state);
    if (state.state !== 'ready') return null;
    return { imageUri: resolveVisionHeroImage(state), title: state.title?.trim() || state.previewText.trim() || null };
  }, [selectedAnchor, visionModel.state]);

  // Top bar: X on step 1, back arrow on step 2, cross-faded with the step.
  const closeStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const backStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const underline = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      underline.value = 1;
      return;
    }
    underline.value = withDelay(PAYWALL_TIMING.underlineDelayMs, withTiming(1, { duration: PAYWALL_TIMING.underlineMs, easing: PAYWALL_EASE_OUT }));
  }, [reduceMotion, underline]);
  const underlineStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: underline.value }] }));

  const rise = L.rise * W;
  const savings = annualSavingsVsWeeklyPercent(controller.pricing);
  const selection = selectionCopy(controller);
  const selectedPurchasable = planForId(controller.pricing, controller.selectedPlan).purchasable;
  const purchasing = controller.purchaseState === 'submitting';
  const otherPlansAvailable = OTHER_PLAN_IDS.some((id) => planForId(controller.pricing, id).purchasable);
  const annualPrice = controller.pricing.annual.priceLabel;
  const trialOnOffer = controller.offersTrial && Boolean(annualPrice);
  const showTimeline = step === 2 && controller.selectedPlan === 'annual' && trialOnOffer;
  const annualDetailLine = annualDetail(controller, savings);
  const step1 = step === 1;
  const step2 = step === 2;

  const layerProps = (index: 0 | 1, active: boolean) => ({
    pointerEvents: active ? ('box-none' as const) : ('none' as const),
    accessibilityElementsHidden: !active,
    importantForAccessibility: active ? ('auto' as const) : ('no-hide-descendants' as const),
    style: [styles.layer, { left: columnLeft, width: W }],
    testID: `v2-paywall-step-${index + 1}`,
  });

  const header = (index: 0 | 1, active: boolean, headline: string, sub: string) => (
    <View onLayout={measureInto(setCopyBottom, index)} style={[styles.header, { top: L.headlineTop * W + offset, paddingHorizontal: gutter }]}>
      <PaywallRise active={active} order={0} distance={rise} reduceMotion={reduceMotion}>
        <Text accessibilityRole="header" style={paywallType.headline(W, L.headlineSize[index])}>{headline}</Text>
      </PaywallRise>
      <PaywallRise active={active} order={1} distance={rise} reduceMotion={reduceMotion} style={{ maxWidth: L.subMaxWidth * W, marginTop: W * 0.03 }}>
        <Text style={paywallType.sub(W)}>{sub}</Text>
      </PaywallRise>
    </View>
  );

  const dots = (current: Step) => (
    <View style={[styles.dots, { gap: W * 0.022, marginTop: W * 0.035 }]} accessible accessibilityLabel={`Step ${current} of 2`}>
      {[1, 2].map((n) => (
        <View
          key={n}
          style={{ width: W * 0.022, height: W * 0.022, borderRadius: W * 0.011, backgroundColor: n === current ? colors.paywall.gold : colors.paywall.hairlineStrong }}
        />
      ))}
    </View>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={{ height: contentHeight }}
      showsVerticalScrollIndicator={false}
      testID="v2-paywall-two-step"
    >
      <PaywallBackdrop screenWidth={screenW} designWidth={W} contentHeight={contentHeight} edgeY={[frames[0].edge, frames[1].edge]} step={progress} />

      {/* Step 1 — the offer */}
      <View {...layerProps(0, step1)}>
        {header(0, step1, COPY.step1.headline, COPY.step1.sub)}
        <View style={{ height: frames[0].lowerTop }} />
        <View onLayout={measureInto(setLowerBottom, 0)} style={{ paddingHorizontal: gutter }}>
          <View style={{ gap: W * 0.04 }}>
            <PaywallRise active={step1} order={2} distance={rise} reduceMotion={reduceMotion}>
              <PaywallFeatureRow
                W={W}
                title={COPY.step1.rows.vision.title}
                body={COPY.step1.rows.vision.body}
                testID="v2-paywall-row-vision"
                renderTile={(t) => <PaywallVisionTile {...t} W={W} vision={vision} />}
              />
            </PaywallRise>
            <PaywallRise active={step1} order={3} distance={rise} reduceMotion={reduceMotion}>
              <PaywallFeatureRow
                W={W}
                title={COPY.step1.rows.practice.title}
                body={COPY.step1.rows.practice.body}
                testID="v2-paywall-row-practice"
                renderTile={(t) => <PaywallPracticeTile {...t} W={W} art={art} reduceMotion={reduceMotion} />}
              />
            </PaywallRise>
            <PaywallRise active={step1} order={4} distance={rise} reduceMotion={reduceMotion}>
              <PaywallFeatureRow
                W={W}
                title={COPY.step1.rows.chart.title}
                body={COPY.step1.rows.chart.body}
                testID="v2-paywall-row-chart"
                // DEFERRED: inline tile with a screen-width eyebrow that scaled with system font.
                // renderTile={(t) => (
                //   <View style={[styles.chartTile, { width: t.width, height: t.height, padding: W * 0.035 }]}>
                //     <PaywallChartTile width={t.width} height={t.height} reduceMotion={reduceMotion} />
                //     <Text style={paywallType.eyebrow(W)}>MY PATH</Text>
                //   </View>
                // )}
                renderTile={(t) => <PaywallChartPreviewTile {...t} W={W} reduceMotion={reduceMotion} />}
              />
            </PaywallRise>
          </View>
          <PaywallRise active={step1} order={5} distance={rise} reduceMotion={reduceMotion} style={{ marginTop: W * 0.07 }}>
            <PaywallCta W={W} label={COPY.step1.cta} onPress={handleContinue} visible={step1} reduceMotion={reduceMotion} testID="v2-paywall-continue" />
          </PaywallRise>
          <PaywallRise active={step1} order={6} distance={rise} reduceMotion={reduceMotion} style={{ marginTop: W * 0.015 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={COPY.step1.later} onPress={() => onDismiss(1)} style={styles.textButton} testID="v2-paywall-maybe-later">
              <Text style={paywallType.quiet(W)}>{COPY.step1.later}</Text>
            </Pressable>
          </PaywallRise>
          <PaywallRise active={step1} order={7} distance={rise} reduceMotion={reduceMotion}>
            {dots(1)}
          </PaywallRise>
        </View>
      </View>

      {/* Step 2 — the plans */}
      <View {...layerProps(1, step2)}>
        {header(1, step2, COPY.step2.headline, COPY.step2.sub)}
        <View style={{ height: frames[1].lowerTop }} />
        <View onLayout={measureInto(setLowerBottom, 1)} style={{ paddingHorizontal: gutter }}>
          <View accessibilityRole="radiogroup" style={{ gap: W * 0.03 }}>
            <PaywallRise active={step2} order={2} distance={rise} reduceMotion={reduceMotion}>
              <PlanCard
                W={W}
                title={COPY.step2.annual}
                priceLine={priceLine(controller, 'annual')}
                trialLine={trialOnOffer ? COPY.step2.trialLine : null}
                detailLines={[annualDetailLine]}
                badge={COPY.step2.bestValue}
                badgeDimmed={controller.selectedPlan !== 'annual'}
                selected={controller.selectedPlan === 'annual'}
                disabled={controller.pricingStatus === 'ready' && !controller.pricing.annual.purchasable}
                accessibilityLabel={`Annual plan, ${priceLine(controller, 'annual')}.${trialOnOffer ? ` ${COPY.step2.trialLine}.` : ''} ${annualDetailLine} Best value.`}
                onPress={() => selectPlan('annual')}
                reduceMotion={reduceMotion}
                testID="v2-paywall-plan-annual"
              />
            </PaywallRise>
            <PaywallRise active={step2} order={3} distance={rise} reduceMotion={reduceMotion}>
              <PlanCard
                W={W}
                title={COPY.step2.weekly}
                priceLine={priceLine(controller, 'weekly')}
                detailLines={[COPY.step2.weeklyDetail]}
                selected={controller.selectedPlan === 'weekly'}
                disabled={controller.pricingStatus === 'ready' && !controller.pricing.weekly.purchasable}
                accessibilityLabel={`Weekly plan, ${priceLine(controller, 'weekly')}. ${COPY.step2.weeklyDetail}`}
                onPress={() => selectPlan('weekly')}
                reduceMotion={reduceMotion}
                testID="v2-paywall-plan-weekly"
              />
            </PaywallRise>
          </View>

          {otherPlansAvailable ? (
            <PaywallRise active={step2} order={4} distance={rise} reduceMotion={reduceMotion} style={{ marginTop: W * 0.015 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={COPY.step2.otherPlans} onPress={onViewOtherPlans} style={styles.textButton} testID="v2-paywall-view-plans">
                <Text style={paywallType.link(W)}>{COPY.step2.otherPlans}</Text>
              </Pressable>
            </PaywallRise>
          ) : null}

          <PaywallRise active={step2} order={5} distance={rise} reduceMotion={reduceMotion} style={{ marginTop: W * 0.035 }}>
            <TimelineSlot W={W} showTimeline={showTimeline} offersTrial={trialOnOffer} timelinePrice={annualPrice ?? ''} note={selection.note} reduceMotion={reduceMotion} />
          </PaywallRise>

          <PaywallRise active={step2} order={6} distance={rise} reduceMotion={reduceMotion} style={{ marginTop: W * 0.06 }}>
            <PaywallCta
              W={W}
              label={selection.cta}
              onPress={() => void controller.submitPrimary()}
              busy={purchasing}
              disabled={controller.busy || controller.pricingStatus !== 'ready' || !selectedPurchasable}
              visible={step2}
              reduceMotion={reduceMotion}
              accessibilityHint={selection.below}
              testID="v2-paywall-cta"
            />
            <Text style={[paywallType.ctaSub(W), { marginTop: W * 0.025 }]} testID="v2-paywall-cta-sub">{selection.below}</Text>
            {controller.errorMessage ? (
              <Text accessibilityRole="alert" style={[paywallType.error(W), { marginTop: W * 0.015 }]} testID="v2-paywall-error">
                {controller.errorMessage}
              </Text>
            ) : null}
            {controller.pricingStatus === 'unavailable' ? (
              <Pressable accessibilityRole="button" onPress={controller.retryPricing} style={styles.textButton} testID="v2-paywall-pricing-retry">
                <Text style={paywallType.note(W)}>{COPY.step2.retry}</Text>
              </Pressable>
            ) : null}
          </PaywallRise>

          <PaywallRise active={step2} order={7} distance={rise} reduceMotion={reduceMotion}>
            {dots(2)}
            <View style={{ marginTop: W * 0.02 }}>
              <PaywallLegalFooter W={W} restoreState={controller.restoreState} onRestore={handleRestore} disabled={controller.busy} />
            </View>
          </PaywallRise>
        </View>
      </View>

      <PaywallHero
        art={art}
        columnLeft={columnLeft}
        designWidth={W}
        top={[frames[0].medTop, frames[1].medTop]}
        step={progress}
        stepChanges={stepChanges}
        reduceMotion={reduceMotion}
      />

      {/* Top bar: close / back and the wordmark */}
      <View pointerEvents="box-none" style={[styles.topBar, { top: topBarTop, left: columnLeft + gutter * 0.5, width: W - gutter }]}>
        <Animated.View pointerEvents={step1 ? 'auto' : 'none'} style={[styles.topButton, closeStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityElementsHidden={!step1}
            importantForAccessibility={step1 ? 'auto' : 'no-hide-descendants'}
            onPress={() => onDismiss(1)}
            style={styles.topHit}
            testID="v2-paywall-close"
          >
            <X size={W * 0.06} color={colors.paywall.inkText} strokeWidth={1.5} />
          </Pressable>
        </Animated.View>
        <Animated.View pointerEvents={step2 ? 'auto' : 'none'} style={[styles.topButton, backStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityElementsHidden={!step2}
            importantForAccessibility={step2 ? 'auto' : 'no-hide-descendants'}
            onPress={() => goToStep(1)}
            style={styles.topHit}
            testID="v2-paywall-back"
          >
            <ArrowLeft size={W * 0.06} color={colors.paywall.inkText} strokeWidth={1.5} />
          </Pressable>
        </Animated.View>
        <View pointerEvents="none" style={styles.wordmark}>
          <Text accessibilityLabel="Anchor" style={paywallType.wordmark(W)}>{COPY.wordmark}</Text>
          <Animated.View style={[styles.underline, { width: L.wordmarkUnderline * W, marginTop: W * 0.012 }, underlineStyle]} />
        </View>
      </View>
    </ScrollView>
  );
}

/** Trial timeline (Annual, trial-eligible) cross-faded with the plain billing note for every other choice. */
function TimelineSlot({
  W,
  showTimeline,
  offersTrial,
  timelinePrice,
  note,
  reduceMotion,
}: {
  W: number;
  showTimeline: boolean;
  offersTrial: boolean;
  timelinePrice: string;
  note: string | null;
  reduceMotion: boolean;
}) {
  // Hold the last note while it fades out behind the timeline.
  const lastNote = useRef(note);
  if (note) lastNote.current = note;
  const shown = useSharedValue(showTimeline ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(showTimeline ? 1 : 0, { duration: reduceMotion ? 0 : PAYWALL_TIMING.planSelectMs, easing: PAYWALL_EASE_OUT });
  }, [reduceMotion, showTimeline, shown]);
  const timelineStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: 1 - shown.value }));

  return (
    <View>
      {offersTrial ? (
        <Animated.View
          style={[!showTimeline && styles.overlay, timelineStyle]}
          pointerEvents="none"
          accessibilityElementsHidden={!showTimeline}
          importantForAccessibility={showTimeline ? 'auto' : 'no-hide-descendants'}
        >
          <TrialTimeline W={W} stops={COPY.step2.timeline(timelinePrice)} play={showTimeline} reduceMotion={reduceMotion} />
        </Animated.View>
      ) : null}
      {lastNote.current ? (
        <Animated.View
          style={[showTimeline && styles.overlay, noteStyle]}
          accessibilityElementsHidden={showTimeline}
          importantForAccessibility={showTimeline ? 'no-hide-descendants' : 'auto'}
        >
          <Text style={paywallType.note(W)} testID="v2-paywall-billing-note">{lastNote.current}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paywall.ink },
  // DEFERRED: host for the replaced single-sheet body.
  // sheetHost: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1, backgroundColor: colors.paywall.ink },
  layer: { position: 'absolute', top: 0 },
  header: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  textButton: { minHeight: V2_MIN_TOUCH_TARGET, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  // DEFERRED: frame for the inline Chart tile above; now owned by PaywallChartPreviewTile.
  // chartTile: {
  //   borderRadius: 14,
  //   overflow: 'hidden',
  //   borderWidth: StyleSheet.hairlineWidth,
  //   borderColor: colors.paywall.hairlineStrong,
  //   backgroundColor: colors.paywall.inkRaised,
  // },
  topBar: { position: 'absolute', height: V2_MIN_TOUCH_TARGET, justifyContent: 'center' },
  topButton: { position: 'absolute', left: 0, top: 0 },
  topHit: { width: V2_MIN_TOUCH_TARGET, height: V2_MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  wordmark: { alignSelf: 'center', alignItems: 'center' },
  underline: { height: 1, backgroundColor: colors.paywall.gold },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});

export default V2PaywallScreen;
