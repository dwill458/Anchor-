import React, { useCallback, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';
import { LEGAL_URLS } from '@/constants/legal';
import type { V2RestoreState } from '@/hooks/v2/paywall';

type Props = {
  restoreState: V2RestoreState;
  onRestore: () => void;
  onSignIn?: () => void;
  disabled?: boolean;
};

const RESTORE_FEEDBACK: Record<V2RestoreState, string | null> = {
  idle: null,
  restoring: 'Restoring…',
  success: 'Purchases restored.',
  no_purchases_found: 'No purchases found to restore.',
  error: 'Restore failed. Check your connection and try again.',
};

export function V2PaywallFooter({ restoreState, onRestore, onSignIn, disabled = false }: Props) {
  const lastTap = useRef(0);
  const restoreBusy = restoreState === 'restoring';

  const handleRestore = useCallback(() => {
    const now = Date.now();
    if (disabled || restoreBusy || now - lastTap.current < 600) return;
    lastTap.current = now;
    onRestore();
  }, [disabled, onRestore, restoreBusy]);

  const feedback = RESTORE_FEEDBACK[restoreState];

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchase"
          accessibilityState={{ disabled: disabled || restoreBusy, busy: restoreBusy }}
          disabled={disabled || restoreBusy}
          onPress={handleRestore}
          testID="v2-paywall-restore"
        >
          <Text style={styles.link}>{restoreBusy ? 'Restoring…' : 'Restore Purchase'}</Text>
        </Pressable>
        {onSignIn ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Already subscribed? Sign in" onPress={onSignIn}>
            <Text style={styles.link}>Already subscribed? Sign in</Text>
          </Pressable>
        ) : null}
      </View>
      {feedback ? (
        <Text accessibilityRole="text" style={styles.feedback} testID="v2-paywall-restore-feedback">
          {feedback}
        </Text>
      ) : null}
      <View style={styles.legal}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL_URLS.termsOfService)}>
          <Text style={styles.legalLink}>Terms</Text>
        </Pressable>
        <Text style={styles.legalDivider}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}>
          <Text style={styles.legalLink}>Privacy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[5], flexWrap: 'wrap', justifyContent: 'center' },
  link: { ...typography.labelMD, color: colors.text.secondary },
  feedback: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center' },
  legal: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  legalLink: { ...typography.caption, color: colors.text.disabled, textDecorationLine: 'underline' },
  legalDivider: { ...typography.caption, color: colors.text.disabled },
});
