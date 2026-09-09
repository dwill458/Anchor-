import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Crown, Eye, Flame, Focus, Sparkles } from 'lucide-react-native';
import { V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { colors, radii, spacing, typography } from '@/theme/v2';

type Props = { mode: V2PracticeMode; entitled: boolean; onPress: () => void; testID?: string };
const ModeIcon = ({ mode, color }: { mode: V2PracticeMode; color: string }) => {
  const common = { color, size: 19, strokeWidth: 1.8 };
  if (mode === 'deep_prime') return <Sparkles {...common} />;
  if (mode === 'visualize') return <Eye {...common} />;
  if (mode === 'release') return <Flame {...common} />;
  return <Focus {...common} />;
};

export function V2PracticeModeRow({ mode, entitled, onPress, testID }: Props) {
  const item = V2_PRACTICE_MODE_BY_ID[mode];
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.purpose}. ${item.duration}.${!entitled ? ' Premium required.' : ''}`} onPress={onPress} style={({ pressed }) => [styles.row, mode === 'release' && styles.release, pressed && styles.pressed]}>
    <View style={[styles.icon, { backgroundColor: `${item.accent}16` }]}><ModeIcon mode={mode} color={item.accent} /></View>
    <View style={styles.copy}><View style={styles.titleRow}><Text style={styles.title}>{item.title}</Text>{!entitled ? <View style={styles.lock}><Crown size={12} color={colors.text.secondary} /><Text style={styles.lockText}>PRO</Text></View> : null}</View><Text numberOfLines={1} style={styles.purpose}>{item.purpose}</Text><Text style={styles.duration}>{item.duration}</Text></View>
    <ArrowRight size={18} color={colors.text.secondary} strokeWidth={1.7} />
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  release: { marginTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  pressed: { opacity: 0.68 },
  icon: { width: 42, height: 42, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  copy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { ...typography.headingSM, color: colors.text.primary },
  purpose: { ...typography.bodySM, color: colors.text.secondary },
  duration: { ...typography.caption, color: colors.text.disabled },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lockText: { ...typography.labelSM, color: colors.text.secondary, fontSize: 9 },
});
