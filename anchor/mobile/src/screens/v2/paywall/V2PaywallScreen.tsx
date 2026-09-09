import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/v2';
import {
  useV2Paywall,
  useV2PaywallRecap,
  type V2PaywallEntitlementResult,
} from '@/hooks/v2/paywall';
import { V2PaywallSheet, V2PlanPickerSheet, V2TrialEndedPanel } from '@/components/v2/paywall';
import type { V2PaywallContext } from '@/constants/v2/paywall';

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

  if (context === 'TRIAL_ENDED') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe} testID="v2-paywall-screen">
        <V2TrialEndedPanel controller={controller} recap={recap} onSignIn={onSignIn} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root} testID="v2-paywall-screen">
      <SafeAreaView edges={['bottom']} style={styles.sheetHost}>
        <V2PaywallSheet
          controller={controller}
          onDismiss={onDismiss}
          onViewOtherPlans={openPlanPicker}
          onSignIn={onSignIn}
        />
      </SafeAreaView>
      <V2PlanPickerSheet
        visible={planPickerOpen}
        pricing={controller.pricing}
        offersTrial={controller.offersTrial}
        selected={controller.selectedPlan}
        onSelect={controller.setSelectedPlan}
        onClose={closePlanPicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheetHost: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, backgroundColor: colors.canvas },
});

export default V2PaywallScreen;
