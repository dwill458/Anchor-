import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { colors, spacing } from '@/theme/v2';

/** Restrained gold: an accent for kickers, rules and arrows, never a fill. */
export const VISION_GOLD = '#B08A4A';
export const VISION_SERIF = 'EBGaramond-Medium';
export const VISION_SERIF_REGULAR = 'EBGaramond-Regular';
export const VISION_SERIF_ITALIC = 'EBGaramond-Italic';

/** Round ink back button used on the creation screens (mockups 1-3). */
export function VisionBackButton({ onPress, label = 'Go back', style }: { onPress: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={[styles.back, style]}>
      <ArrowLeft size={22} color={VISION_GOLD} />
    </Pressable>
  );
}

/** CREATE YOUR VISION, with the short gold rule beneath it. */
export function VisionKicker({ children, flanked = false }: { children: string; flanked?: boolean }) {
  return (
    <View style={styles.kickerWrap} accessible accessibilityRole="header" accessibilityLabel={children}>
      <View style={styles.kickerLine}>
        {flanked ? <View style={styles.flank} /> : null}
        <Text style={styles.kicker} importantForAccessibility="no">{children}</Text>
        {flanked ? <View style={styles.flank} /> : null}
      </View>
      {flanked ? null : <View style={styles.rule}><View style={styles.ruleDot} /></View>}
    </View>
  );
}

/** The dark pill used for the single primary action on a Vision creation screen. */
export function VisionInkPill({ label, onPress, disabled, testID, accessibilityLabel, style }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, disabled && styles.pillDisabled, pressed && styles.pillPressed, style]}
    >
      <Text style={styles.pillLabel}>{label}</Text>
      <ArrowRight size={22} color={VISION_GOLD} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.ink.deep, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(176,138,74,0.45)',
  },
  kickerWrap: { alignItems: 'center', gap: 8 },
  kickerLine: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flank: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.7 },
  kicker: { fontFamily: 'Inter-SemiBold', fontSize: 13, lineHeight: 16, letterSpacing: 2.6, color: VISION_GOLD },
  rule: { width: 140, height: StyleSheet.hairlineWidth * 2, backgroundColor: VISION_GOLD, opacity: 0.6, alignItems: 'center', justifyContent: 'center' },
  ruleDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: VISION_GOLD },
  pill: {
    minHeight: 58, borderRadius: 29, paddingHorizontal: spacing[6], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: 'rgba(176,138,74,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5,
  },
  pillDisabled: { opacity: 0.45 },
  pillPressed: { transform: [{ scale: 0.99 }] },
  pillLabel: { flex: 1, textAlign: 'center', fontFamily: VISION_SERIF, fontSize: 22, lineHeight: 28, color: colors.ink.text.primary, marginLeft: spacing[5] },
});
