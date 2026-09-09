import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { planForId, planPerMonthLabel } from '@/adapters/v2/paywall';
import { V2_PAYWALL_PRICING_FALLBACK, type V2PaywallPlanId } from '@/constants/v2/paywall';
import type { V2PaywallController } from '@/hooks/v2/paywall';
import { V2PaywallCTA } from './V2PaywallCTA';
import { V2PaywallFooter } from './V2PaywallFooter';
import { V2PaywallRecapStrip, type V2PaywallRecap } from './V2PaywallRecapStrip';

type Props = {
  controller: V2PaywallController;
  recap: V2PaywallRecap;
  onSignIn?: () => void;
};

function PlanRadio({
  controller,
  planId,
}: {
  controller: V2PaywallController;
  planId: V2PaywallPlanId;
}) {
  const plan = planForId(controller.pricing, planId);
  const selected = controller.selectedPlan === planId;
  const price = plan.priceLabel ?? 'Unavailable';
  const perMonth = planPerMonthLabel(plan);
  const detail =
    planId === 'annual'
      ? `Cancel anytime${perMonth ? ` · ${perMonth} equivalent` : ''}`
      : 'Cancel anytime';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !plan.purchasable }}
      accessibilityLabel={`${planId === 'annual' ? 'Annual' : 'Monthly'} plan, ${price}. ${detail}`}
      disabled={!plan.purchasable}
      onPress={() => controller.setSelectedPlan(planId)}
      testID={`v2-paywall-plan-${planId}`}
      style={[styles.row, selected && styles.rowSelected, !plan.purchasable && styles.rowDisabled]}
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowHeadline}>
          <Text style={styles.rowTitle}>{planId === 'annual' ? 'Annual' : 'Monthly'}</Text>
          <Text style={styles.rowPrice}>{price}</Text>
          {planId === 'annual' ? (
            <View style={styles.badge}><Text style={styles.badgeText}>RECOMMENDED</Text></View>
          ) : null}
        </View>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check size={11} color={colors.text.inverse} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

function ctaSub(controller: V2PaywallController): string {
  const { pricingStatus, pricing, selectedPlan } = controller;
  if (pricingStatus === 'loading') return V2_PAYWALL_PRICING_FALLBACK.loading;
  if (pricingStatus === 'unavailable') return V2_PAYWALL_PRICING_FALLBACK.unavailable;
  const price = planForId(pricing, selectedPlan).priceLabel ?? '';
  return `${price}/${selectedPlan === 'annual' ? 'year' : 'month'} · cancel anytime`;
}

/**
 * The trial-ended state. Clear, non-fear explanation: the user's work is safe,
 * and there is an upgrade path plus Restore / Sign in. No free days are offered
 * — the trial cannot be restarted.
 */
export function V2TrialEndedPanel({ controller, recap, onSignIn }: Props) {
  const { copy } = controller;
  const loading = controller.pricingStatus === 'loading';
  const unavailable = controller.pricingStatus === 'unavailable';

  return (
    <View style={styles.root} testID="v2-paywall-trial-ended">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.recap}>
          <V2PaywallRecapStrip recap={recap} />
        </View>

        <View accessibilityRole="radiogroup" style={styles.plans}>
          <PlanRadio controller={controller} planId="annual" />
          <PlanRadio controller={controller} planId="monthly" />
        </View>

        {unavailable ? (
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
          label={`Continue with ${controller.selectedPlan === 'annual' ? 'Annual' : 'Monthly'}`}
          sub={ctaSub(controller)}
          state={controller.purchaseState}
          onPress={controller.purchaseSelectedPlan}
          disabled={controller.busy || unavailable || loading}
        />
        {controller.errorMessage ? (
          <Text accessibilityRole="alert" style={styles.error} testID="v2-paywall-error">
            {controller.errorMessage}
          </Text>
        ) : null}
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
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: spacing[6], paddingTop: spacing[8], paddingBottom: spacing[5] },
  eyebrow: { ...typography.labelSM, textTransform: 'uppercase', color: colors.text.disabled },
  headline: { ...typography.headingXL, color: colors.text.primary, marginTop: spacing[2] },
  body: { ...typography.bodyMD, color: colors.text.secondary, marginTop: spacing[2] },
  recap: { marginTop: spacing[6] },
  plans: { marginTop: spacing[6], gap: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowSelected: { borderColor: colors.text.primary, backgroundColor: colors.grouped },
  rowDisabled: { opacity: 0.5 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowHeadline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], flexWrap: 'wrap' },
  rowTitle: { ...typography.labelLG, color: colors.text.primary },
  rowPrice: { ...typography.headingSM, color: colors.text.primary },
  rowDetail: { ...typography.bodySM, color: colors.text.secondary, marginTop: 3 },
  badge: { borderRadius: radii.round, backgroundColor: colors.grouped, paddingHorizontal: spacing[2], paddingVertical: 1 },
  badgeText: { ...typography.labelSM, textTransform: 'none', letterSpacing: 0.4, color: colors.text.secondary },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
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
});
