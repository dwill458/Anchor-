import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { colors, getCategoryColor, typography } from '@/theme/v2';

type Props = {
  intention: string;
  category?: string | null;
  tone?: 'light' | 'dark';
  /** Left aligns the heading with the board and adds a short editorial rule beneath it. */
  align?: 'center' | 'left';
};

/** A quiet editorial introduction to the board, with the complete real intention. */
export function VisionIntentionHeading({ intention, category, tone = 'light', align = 'center' }: Props) {
  const isDark = tone === 'dark';
  const left = align === 'left';
  const fontSize = left
    ? (intention.length > 100 ? 26 : intention.length > 60 ? 29 : intention.length > 30 ? 32 : 36)
    : (intention.length > 100 ? 22 : intention.length > 60 ? 24 : intention.length > 30 ? 26 : 30);
  return (
    <View testID="vision-intention-heading" style={[styles.heading, left && styles.headingLeft]}>
      <View style={styles.categoryRow}>
        <View style={[styles.dot, { backgroundColor: getCategoryColor(category) }]} />
        <Text style={[styles.category, isDark && styles.categoryDark]}>
          {categoryLabel(category).toUpperCase()}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={[
          styles.intention,
          { fontSize, lineHeight: Math.round(fontSize * (left ? 1.16 : 1.17)) },
          left && styles.intentionLeft,
          isDark && styles.intentionDark,
        ]}
      >
        {intention}
      </Text>
      {left ? <View testID="vision-intention-rule" style={[styles.rule, isDark && styles.ruleDark]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', paddingBottom: 4, gap: 6 },
  headingLeft: { alignItems: 'flex-start', paddingBottom: 0, gap: 8 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  category: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.5, color: colors.text.secondary },
  categoryDark: { color: 'rgba(244, 246, 250, 0.72)' },
  intention: { fontFamily: 'EBGaramond-Regular', letterSpacing: -0.4, color: colors.text.primary, textAlign: 'center', width: '100%' },
  intentionLeft: { fontFamily: 'EBGaramond-Medium', textAlign: 'left', letterSpacing: -0.6 },
  intentionDark: { color: '#F4F6FA' },
  rule: { width: 56, height: StyleSheet.hairlineWidth * 2, marginTop: 4, backgroundColor: 'rgba(60, 50, 35, 0.22)' },
  ruleDark: { backgroundColor: 'rgba(244, 246, 250, 0.28)' },
});
