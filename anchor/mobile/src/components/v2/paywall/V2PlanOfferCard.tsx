import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { planForId, planPerMonthLabel, type V2PaywallPricing } from '@/adapters/v2/paywall';
import type { V2PaywallPlanId } from '@/constants/v2/paywall';
import type { PaywallToneColors } from './paywallTone';

type Props = {
  pricing: V2PaywallPricing;
  planId: V2PaywallPlanId;
  offersTrial: boolean;
  tone: PaywallToneColors;
  loading: boolean;
  testID?: string;
};

/** The single, already-selected offer. "View other plans" swaps the selection. */
export function V2PlanOfferCard({ pricing, planId, offersTrial, tone, loading, testID }: Props) {
  const plan = planForId(pricing, planId);
  const priceLabel = loading ? 'Loading…' : plan.priceLabel ?? 'Unavailable';
  const perMonth = planPerMonthLabel(plan);
  const showTrial = offersTrial && planId === 'annual';

  const detail = showTrial
    ? `Annual · $0 today, then ${priceLabel}${perMonth ? ` (${perMonth})` : ''}`
    : planId === 'annual'
      ? `Annual · ${priceLabel}${perMonth ? ` (${perMonth})` : ''} · cancel anytime`
      : `${priceLabel}/month · cancel anytime`;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={showTrial ? `Annual plan selected. 7-day free trial, then ${priceLabel}.` : `${planId} plan selected. ${priceLabel}.`}
      style={[styles.card, { backgroundColor: showTrial ? tone.wash : colors.grouped }]}
      testID={testID ?? 'v2-paywall-offer-card'}
    >
      <View style={styles.copy}>
        <View style={styles.headlineRow}>
          <Text style={[styles.headline, showTrial && { color: tone.deep }]}>
            {showTrial ? '7 DAYS FREE' : planId === 'annual' ? 'Annual' : 'Monthly'}
          </Text>
          {showTrial ? (
            <View style={[styles.badge, { backgroundColor: tone.wash, borderColor: tone.accent }]}>
              <Text style={[styles.badgeText, { color: tone.deep }]}>BEST VALUE</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={[styles.check, { backgroundColor: showTrial ? tone.deep : colors.text.primary }]}>
        <Check size={12} color={colors.text.inverse} strokeWidth={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.text.primary,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  copy: { flex: 1, minWidth: 0 },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  headline: { ...typography.headingSM, color: colors.text.primary },
  badge: { borderRadius: radii.round, borderWidth: 1, paddingHorizontal: spacing[2], paddingVertical: 1 },
  badgeText: { ...typography.labelSM, textTransform: 'none', letterSpacing: 0.4 },
  detail: { ...typography.bodySM, color: colors.text.secondary, marginTop: 3 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
