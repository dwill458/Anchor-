import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, Compass, Flame, Eye, Sparkles } from 'lucide-react-native';
import { V2_RECOMMENDATION_WHY, V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { colors, radii, spacing, typography } from '@/theme/v2';

type Props = { mode: V2PracticeMode; onPress: () => void; testID?: string };

const Icon = ({ mode, color }: { mode: V2PracticeMode; color: string }) => {
  const common = { color, size: 18, strokeWidth: 1.8 };
  if (mode === 'release') return <Flame {...common} />;
  if (mode === 'visualize') return <Eye {...common} />;
  if (mode === 'deep_prime') return <Sparkles {...common} />;
  return <Compass {...common} />;
};

/** A compact editorial recommendation, intentionally distinct from a generic card. */
export function V2RecommendedTodayRibbon({ mode, onPress, testID }: Props) {
  const definition = V2_PRACTICE_MODE_BY_ID[mode];
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Recommended today: ${definition.title}. ${V2_RECOMMENDATION_WHY[mode]}`} onPress={onPress} style={({ pressed }) => [styles.ribbon, pressed && styles.pressed]}>
    <View style={[styles.todayTab, { backgroundColor: definition.accent }]}><Text style={styles.todayLabel}>TODAY</Text></View>
    <View style={[styles.icon, { backgroundColor: `${definition.accent}16` }]}><Icon mode={mode} color={definition.accent} /></View>
    <View style={styles.copy}><Text style={styles.eyebrow}>RECOMMENDED TODAY</Text><Text style={styles.title}>{definition.title}</Text><Text numberOfLines={1} style={styles.why}>{V2_RECOMMENDATION_WHY[mode]}</Text></View>
    <ArrowUpRight color={definition.accent} size={18} strokeWidth={1.8} />
  </Pressable>;
}

const styles = StyleSheet.create({
  ribbon: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4], paddingHorizontal: spacing[4], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.canvas },
  pressed: { opacity: 0.7 },
  todayTab: { position: 'absolute', top: -1, left: spacing[4], paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: radii.sm, borderBottomRightRadius: radii.sm, transform: [{ skewX: '-8deg' }] },
  todayLabel: { ...typography.labelSM, color: '#FFFFFF', fontSize: 9, transform: [{ skewX: '8deg' }] },
  icon: { width: 38, height: 38, borderRadius: radii.round, justifyContent: 'center', alignItems: 'center', marginTop: spacing[2] },
  copy: { flex: 1, gap: 1, paddingTop: spacing[2] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary, fontSize: 9 },
  title: { ...typography.headingMD, color: colors.text.primary },
  why: { ...typography.bodySM, color: colors.text.secondary },
});
