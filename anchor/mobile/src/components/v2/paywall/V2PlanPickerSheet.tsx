import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { planForId, planPerMonthLabel, type V2PaywallPricing } from '@/adapters/v2/paywall';
import type { V2PaywallPlanId } from '@/constants/v2/paywall';

type Props = {
  visible: boolean;
  pricing: V2PaywallPricing;
  offersTrial: boolean;
  selected: V2PaywallPlanId;
  onSelect: (plan: V2PaywallPlanId) => void;
  onClose: () => void;
};

function PlanRow({
  pricing,
  planId,
  offersTrial,
  selected,
  onPress,
}: {
  pricing: V2PaywallPricing;
  planId: V2PaywallPlanId;
  offersTrial: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const plan = planForId(pricing, planId);
  const price = plan.priceLabel ?? 'Unavailable';
  const perMonth = planPerMonthLabel(plan);
  const detail =
    planId === 'annual'
      ? `${offersTrial ? '7 days free' : 'Cancel anytime'}${perMonth ? ` · ${perMonth} equivalent` : ''}`
      : offersTrial
        ? 'No free trial'
        : 'Cancel anytime';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !plan.purchasable }}
      accessibilityLabel={`${planId === 'annual' ? 'Annual' : 'Monthly'} plan, ${price}. ${detail}`}
      disabled={!plan.purchasable}
      onPress={onPress}
      testID={`v2-paywall-plan-${planId}`}
      style={[styles.row, selected && styles.rowSelected, !plan.purchasable && styles.rowDisabled]}
    >
      <View style={styles.rowCopy}>
        <View style={styles.rowHeadline}>
          <Text style={styles.rowTitle}>{planId === 'annual' ? 'Annual' : 'Monthly'}</Text>
          <Text style={styles.rowPrice}>{price}</Text>
          {planId === 'annual' && offersTrial ? (
            <View style={styles.badge}><Text style={styles.badgeText}>BEST VALUE</Text></View>
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

/** Restrained plan chooser. No dark glass, no pricing-card grid. */
export function V2PlanPickerSheet({ visible, pricing, offersTrial, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} accessibilityLabel="Close plan options" onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choose a plan</Text>
        <View accessibilityRole="radiogroup" style={styles.rows}>
          <PlanRow
            pricing={pricing}
            planId="annual"
            offersTrial={offersTrial}
            selected={selected === 'annual'}
            onPress={() => {
              onSelect('annual');
              onClose();
            }}
          />
          <PlanRow
            pricing={pricing}
            planId="monthly"
            offersTrial={offersTrial}
            selected={selected === 'monthly'}
            onPress={() => {
              onSelect('monthly');
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(23,23,20,0.32)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: spacing[4] },
  title: { ...typography.labelSM, textTransform: 'uppercase', color: colors.text.disabled, marginBottom: spacing[3] },
  rows: { gap: spacing[3] },
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
});
