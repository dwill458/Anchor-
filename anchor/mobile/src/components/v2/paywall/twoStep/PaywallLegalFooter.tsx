import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { V2_MIN_TOUCH_TARGET } from '@/theme/v2';
import { LEGAL_URLS } from '@/constants/legal';
import type { V2RestoreState } from '@/hooks/v2/paywall';
import { paywallType } from './paywallType';

type Props = {
  W: number;
  restoreState: V2RestoreState;
  onRestore: () => void;
  disabled?: boolean;
};

const RESTORE_FEEDBACK: Record<V2RestoreState, string | null> = {
  idle: null,
  restoring: null,
  success: 'Purchases restored.',
  no_purchases_found: 'No purchases found to restore.',
  error: 'Restore failed. Check your connection and try again.',
};

/** "Restore Purchases · Terms · Privacy", each a full 44 pt target. */
export function PaywallLegalFooter({ W, restoreState, onRestore, disabled = false }: Props) {
  const restoring = restoreState === 'restoring';
  const feedback = RESTORE_FEEDBACK[restoreState];
  const link = paywallType.legal(W);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore Purchases"
          accessibilityState={{ disabled: disabled || restoring, busy: restoring }}
          disabled={disabled || restoring}
          onPress={onRestore}
          hitSlop={4}
          style={styles.target}
          testID="v2-paywall-restore"
        >
          <Text style={link}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
        </Pressable>
        <Text style={link} importantForAccessibility="no">·</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Terms" onPress={() => void Linking.openURL(LEGAL_URLS.termsOfService)} style={styles.target}>
          <Text style={link}>Terms</Text>
        </Pressable>
        <Text style={link} importantForAccessibility="no">·</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Privacy" onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)} style={styles.target}>
          <Text style={link}>Privacy</Text>
        </Pressable>
      </View>
      {feedback ? (
        <Text accessibilityLiveRegion="polite" style={paywallType.note(W)} testID="v2-paywall-restore-feedback">
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 6 },
  target: { minHeight: V2_MIN_TOUCH_TARGET, minWidth: V2_MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
