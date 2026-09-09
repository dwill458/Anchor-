import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';
import type { PaywallToneColors } from './paywallTone';

type Props = {
  tone: PaywallToneColors;
  /** Localised renewal price string from RevenueCat, e.g. "$59.99/year". */
  renewalLabel: string;
  testID?: string;
};

/**
 * TODAY → DAY 6 → DAY 7. Honest sequencing, no fake countdown and no urgency
 * manipulation: TODAY carries the accent, DAY 7 stays charcoal so the renewal
 * price reads as a financial fact rather than mode identity.
 */
export function V2TrialTimeline({ tone, renewalLabel, testID }: Props) {
  const rows = [
    { tag: 'TODAY', title: '$0 today', desc: 'Your 7-day trial starts when you confirm.' },
    { tag: 'DAY 6', title: 'We’ll remind you', desc: 'Before your trial ends.' },
    { tag: 'DAY 7', title: renewalLabel, desc: 'Unless cancelled beforehand.' },
  ];
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`7-day trial timeline. ${rows.map((r) => `${r.tag}: ${r.title}. ${r.desc}`).join(' ')}`}
      style={styles.list}
      testID={testID}
    >
      {rows.map((row, index) => {
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        return (
          <View key={row.tag} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  isFirst
                    ? { backgroundColor: tone.accent }
                    : { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: isLast ? colors.text.disabled : tone.accent },
                ]}
              />
              {!isLast ? <View style={[styles.connector, { backgroundColor: isFirst ? tone.accent : colors.border.default }]} /> : null}
            </View>
            <View style={[styles.copy, !isLast && styles.copyGap]}>
              <Text style={styles.tag}>{row.tag}</Text>
              <Text style={[styles.title, isFirst && { color: tone.deep }]}>{row.title}</Text>
              <Text style={styles.desc}>{row.desc}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing[4] },
  rail: { width: 10, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  connector: { width: 1.5, flex: 1, minHeight: 24, marginTop: 3 },
  copy: { flex: 1 },
  copyGap: { paddingBottom: spacing[4] },
  tag: { ...typography.labelSM, letterSpacing: 0.6, color: colors.text.disabled, textTransform: 'uppercase' },
  title: { ...typography.labelLG, color: colors.text.primary, marginTop: 2 },
  desc: { ...typography.bodySM, color: colors.text.secondary, marginTop: 1 },
});
