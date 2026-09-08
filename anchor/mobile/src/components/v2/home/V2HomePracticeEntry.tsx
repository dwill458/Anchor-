import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, practiceColors, radii, spacing, typography } from '@/theme/v2';

type Props = {
  /** Optional grounded status line, e.g. "Returned today". Never a recommendation. */
  todayStatus?: string | null;
  onStartPractice?: () => void;
};

/**
 * Home's Practice entry. It is a visual shell + navigation intent only. It does
 * NOT compute Recommended Today or choose between Focus / Deep Prime / Visualize
 * / Release.
 */
export function V2HomePracticeEntry({ todayStatus, onStartPractice }: Props) {
  return (
    <View style={styles.container}>
      {todayStatus ? (
        <View style={styles.statusRow}>
          <Text style={styles.eyebrow}>TODAY</Text>
          <Text style={styles.status}>{todayStatus}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Practice this Anchor"
        onPress={onStartPractice}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <View style={[styles.dot, { backgroundColor: practiceColors.focus }]} />
        <Text style={styles.ctaLabel}>Practice this Anchor</Text>
        <ChevronRight size={18} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[3] },
  statusRow: { gap: 2 },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary },
  status: { ...typography.bodyMD, color: colors.text.primary },
  cta: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.78 },
  dot: { width: 8, height: 8, borderRadius: radii.round },
  ctaLabel: { flex: 1, ...typography.labelLG, color: colors.text.primary },
});
