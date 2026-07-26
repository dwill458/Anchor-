import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Eye, Flame, Target, Zap } from 'lucide-react-native';

import { colors, typography } from '@/theme';
import type { PracticeMode } from '@/types/practice';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

const MODE_ICON = { deep_prime: Zap, visualize: Eye, focus: Target, release: Flame };

export const PracticeModeRow: React.FC<{
  mode: PracticeMode;
  title: string;
  description: string;
  duration: string;
  color: string;
  badge?: string;
  onPress: () => void;
}> = ({ mode, title, description, duration, color, badge, onPress }) => {
  const reduceMotion = useReduceMotionEnabled();
  const Icon = MODE_ICON[mode];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}. ${duration}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && !reduceMotion && styles.pressed]}
    >
      <View style={[styles.icon, { borderColor: `${color}61`, backgroundColor: `${color}1F` }]}>
        <Icon size={21} color={color} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        </View>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        <Text style={[styles.duration, { color }]}>{duration}</Text>
      </View>
      <ChevronRight size={15} color="rgba(245,240,232,0.32)" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  pressed: { transform: [{ scale: 0.98 }], borderColor: 'rgba(212,175,55,0.28)' },
  icon: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  title: { fontFamily: typography.fontFamily.serif, fontSize: 14, letterSpacing: 0.5, color: colors.bone },
  badge: { fontFamily: typography.fontFamily.sansBold, fontSize: 9, letterSpacing: 0.8, color: colors.gold, borderWidth: 1, borderColor: 'rgba(212,175,55,0.28)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  description: { fontFamily: typography.fontFamily.sans, fontSize: 12, lineHeight: 16, color: 'rgba(245,240,232,0.62)', marginBottom: 4 },
  duration: { fontFamily: typography.fontFamily.sansBold, fontSize: 10, letterSpacing: 0.8 },
});
