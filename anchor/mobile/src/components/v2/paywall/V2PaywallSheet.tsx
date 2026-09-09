import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { planForId, planPerMonthLabel } from '@/adapters/v2/paywall';
import { V2_PAYWALL_BENEFITS, V2_PAYWALL_PRICING_FALLBACK } from '@/constants/v2/paywall';
import type { V2PaywallController } from '@/hooks/v2/paywall';
import { paywallTone } from './paywallTone';
import { V2PaywallArtifact } from './V2PaywallArtifact';
import { V2CompactBenefit } from './V2CompactBenefit';
import { V2TrialTimeline } from './V2TrialTimeline';
import { V2PlanOfferCard } from './V2PlanOfferCard';
import { V2PaywallCTA } from './V2PaywallCTA';
import { V2PaywallFooter } from './V2PaywallFooter';

type Props = {
  controller: V2PaywallController;
  onDismiss: () => void;
  onViewOtherPlans: () => void;
  onSignIn?: () => void;
};

function renewalLabel(priceLabel: string | null): string {
  return priceLabel ? `${priceLabel}/year` : 'the annual price';
}

function ctaSubCopy(controller: V2PaywallController): string {
  const { pricing, pricingStatus, offersTrial, selectedPlan } = controller;
  if (pricingStatus === 'loading') return V2_PAYWALL_PRICING_FALLBACK.loading;
  if (pricingStatus === 'unavailable') return V2_PAYWALL_PRICING_FALLBACK.unavailable;
  const plan = planForId(pricing, selectedPlan);
  const price = plan.priceLabel ?? '';
  if (offersTrial && selectedPlan === 'annual') {
    return `${price}/year after your 7-day trial · cancel anytime`;
  }
  if (selectedPlan === 'annual') {
    const perMonth = planPerMonthLabel(plan);
    return `${price}/year${perMonth ? ` (${perMonth})` : ''} · cancel anytime`;
  }
  return `${price}/month · cancel anytime`;
}

/**
 * The contextual paywall body. One shell for every non-expired context; the
 * practice/vision tone only tints the top wash, the benefit checks, the trial
 * timeline and the selected-offer edge. Utility surface — near-zero brush
 * density, no decorative background.
 */
export function V2PaywallSheet({ controller, onDismiss, onViewOtherPlans, onSignIn }: Props) {
  const { copy, artifact, pricing, pricingStatus, offersTrial, selectedPlan } = controller;
  const tone = paywallTone(copy.tone);
  const loadingPrice = pricingStatus === 'loading';
  const primaryLabel = offersTrial && selectedPlan === 'annual' ? copy.trialCta : copy.paidCta;
  const purchaseUnavailable = pricingStatus === 'unavailable';

  return (
    <View style={styles.root} testID={`v2-paywall-sheet-${controller.context}`}>
      <View style={[styles.mist, { backgroundColor: tone.mist }]} pointerEvents="none" />
      <View style={styles.grabberRow}>
        <View style={styles.grabber} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDismiss}
          style={styles.close}
          testID="v2-paywall-close"
        >
          <X size={16} color={colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.artifactSlot}>
          <V2PaywallArtifact artifact={artifact} tone={tone} />
        </View>

        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.benefits}>
          {V2_PAYWALL_BENEFITS.map((benefit) => (
            <V2CompactBenefit key={benefit} label={benefit} accent={tone.accent} />
          ))}
        </View>

        {offersTrial && selectedPlan === 'annual' ? (
          <View style={styles.timeline}>
            <Text style={styles.sectionLabel}>Your 7-day trial</Text>
            <V2TrialTimeline tone={tone} renewalLabel={renewalLabel(pricing.annual.priceLabel)} />
          </View>
        ) : null}

        <View style={styles.offer}>
          <V2PlanOfferCard
            pricing={pricing}
            planId={selectedPlan}
            offersTrial={offersTrial}
            tone={tone}
            loading={loadingPrice}
          />
        </View>

        {purchaseUnavailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading store pricing"
            onPress={controller.retryPricing}
            style={styles.retry}
            testID="v2-paywall-pricing-retry"
          >
            <Text style={styles.retryText}>{V2_PAYWALL_PRICING_FALLBACK.unavailable} Tap to retry.</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <V2PaywallCTA
          label={primaryLabel}
          sub={ctaSubCopy(controller)}
          state={controller.purchaseState}
          onPress={controller.submitPrimary}
          disabled={controller.busy || purchaseUnavailable || loadingPrice}
          accentEdge={offersTrial && selectedPlan === 'annual' ? tone.accent : null}
        />
        {controller.errorMessage ? (
          <Text accessibilityRole="alert" style={styles.error} testID="v2-paywall-error">
            {controller.errorMessage}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View other plans"
          onPress={onViewOtherPlans}
          style={styles.otherPlans}
          testID="v2-paywall-view-plans"
        >
          <Text style={styles.otherPlansText}>View other plans</Text>
        </Pressable>
        <V2PaywallFooter
          restoreState={controller.restoreState}
          onRestore={controller.restore}
          onSignIn={onSignIn}
          disabled={controller.busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, overflow: 'hidden' },
  mist: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  grabberRow: { alignItems: 'center', paddingTop: spacing[2], paddingBottom: spacing[1] },
  grabber: { width: 36, height: 4, borderRadius: 99, backgroundColor: colors.border.default },
  close: {
    position: 'absolute',
    right: spacing[3],
    top: spacing[1],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing[6], paddingTop: spacing[3], paddingBottom: spacing[5] },
  artifactSlot: { marginBottom: spacing[4] },
  eyebrow: { ...typography.labelSM, textTransform: 'uppercase', color: colors.text.disabled },
  headline: { ...typography.headingLG, color: colors.text.primary, marginTop: spacing[2] },
  body: { ...typography.bodyMD, color: colors.text.secondary, marginTop: spacing[2] },
  benefits: { marginTop: spacing[4], gap: spacing[3] },
  timeline: { marginTop: spacing[6] },
  sectionLabel: { ...typography.labelSM, textTransform: 'uppercase', color: colors.text.disabled, marginBottom: spacing[3] },
  offer: { marginTop: spacing[5] },
  retry: { marginTop: spacing[3], paddingVertical: spacing[2] },
  retryText: { ...typography.bodySM, color: colors.semantic.warning, textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.surface,
  },
  error: { ...typography.bodySM, color: colors.semantic.error, textAlign: 'center', marginTop: spacing[2] },
  otherPlans: { alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[3], marginTop: spacing[2] },
  otherPlansText: { ...typography.labelMD, color: colors.text.secondary },
});
