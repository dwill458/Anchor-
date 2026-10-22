import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { colors, getCategoryColor, typography } from '@/theme/v2';

type Props = {
  intention: string;
  category?: string | null;
  tone?: 'light' | 'dark';
};

/** A quiet editorial introduction to the board, with the complete real intention. */
export function VisionIntentionHeading({ intention, category, tone = 'light' }: Props) {
  const isDark = tone === 'dark';
  const fontSize = intention.length > 100 ? 22 : intention.length > 60 ? 24 : intention.length > 30 ? 26 : 30;
  return (
    <View testID="vision-intention-heading" style={styles.heading}>
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
          { fontSize, lineHeight: fontSize + 5 },
          isDark && styles.intentionDark,
        ]}
      >
        {intention}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', paddingBottom: 4, gap: 6 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  category: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.5, color: colors.text.secondary },
  categoryDark: { color: 'rgba(244, 246, 250, 0.72)' },
  intention: { fontFamily: 'EBGaramond-Regular', letterSpacing: -0.4, color: colors.text.primary, textAlign: 'center', width: '100%' },
  intentionDark: { color: '#F4F6FA' },
});
