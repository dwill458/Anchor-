import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2PurchaseState } from '@/hooks/v2/paywall';

type Props = {
  label: string;
  sub: string;
  state: V2PurchaseState;
  onPress: () => void;
  disabled?: boolean;
  /** Thin contextual edge on the (otherwise charcoal) button. */
  accentEdge?: string | null;
  testID?: string;
};

const RESOLVED_LABEL: Partial<Record<V2PurchaseState, string>> = {
  submitting: 'Processing…',
  success: 'Confirmed',
};

/**
 * Primary purchase / trial action. Double-submission is prevented three ways:
 * the button is disabled whenever a submission is in flight, a synchronous ref
 * guard drops repeat taps within the same tick, and the owning hook holds its
 * own in-flight lock.
 */
export function V2PaywallCTA({ label, sub, state, onPress, disabled = false, accentEdge, testID }: Props) {
  const lastTap = useRef(0);
  const inactive = disabled || state === 'submitting' || state === 'success';

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (inactive || now - lastTap.current < 600) return;
    lastTap.current = now;
    onPress();
  }, [inactive, onPress]);

  const resolvedLabel = RESOLVED_LABEL[state] ?? label;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state === 'submitting' ? 'Processing your request' : label}
        accessibilityState={{ disabled: inactive, busy: state === 'submitting' }}
        disabled={inactive}
        onPress={handlePress}
        testID={testID ?? 'v2-paywall-cta'}
        style={({ pressed }) => [
          styles.button,
          accentEdge ? { borderTopColor: accentEdge, borderTopWidth: 2 } : null,
          disabled && styles.disabled,
          pressed && !inactive && styles.pressed,
        ]}
      >
        <View style={styles.content}>
          {state === 'submitting' ? <ActivityIndicator size="small" color={colors.text.inverse} testID="v2-paywall-cta-spinner" /> : null}
          {state === 'success' ? <Check size={16} color={colors.text.inverse} strokeWidth={3} /> : null}
          <Text style={styles.label}>{resolvedLabel}</Text>
        </View>
      </Pressable>
      <Text accessibilityRole="text" style={[styles.sub, state === 'cancelled' && styles.subEmphasis]}>
        {state === 'cancelled' ? 'Purchase not completed. Nothing was charged.' : sub}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.82 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { ...typography.labelLG, color: colors.text.inverse },
  sub: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[2], minHeight: 16 },
  subEmphasis: { color: colors.text.primary },
});
