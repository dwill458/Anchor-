import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, practiceColors, spacing, typography } from '@/theme/v2';

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
      <View style={styles.topline}><Text style={styles.flag}>TODAY</Text>{todayStatus ? <Text style={styles.status}>✓ {todayStatus}</Text> : null}</View>
      <Text style={styles.title}>A little focus. A clear next step.</Text>
      <Text style={styles.copy}>Return to your intention before you begin.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Practice this Anchor"
        onPress={onStartPractice}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <View style={[styles.dot, { backgroundColor: practiceColors.focus }]} />
        <View style={styles.ctaCopy}><Text style={styles.ctaLabel}>30-second Focus</Text><View style={styles.underline} /></View>
        <ChevronRight size={18} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: spacing[4] },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  flag: { overflow: 'hidden', backgroundColor: '#7252C9', color: colors.text.inverse, paddingHorizontal: 11, paddingVertical: 5, fontFamily: typography.bodyMedium, fontSize: 10, letterSpacing: 1.5 },
  status: { ...typography.caption, color: colors.semantic.success, textAlign: 'right', flex: 1 },
  title: { ...typography.headingMD, color: colors.text.primary, marginTop: spacing[1] },
  copy: { ...typography.bodySM, color: colors.text.secondary },
  cta: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: 0,
    marginTop: spacing[1],
  },
  pressed: { opacity: 0.78 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ctaCopy: { flex: 1, gap: 3 },
  ctaLabel: { ...typography.labelLG, color: colors.text.primary },
  underline: { width: 130, height: 5, borderRadius: 3, backgroundColor: '#7391F2', transform: [{ rotate: '-2deg' }] },
});
