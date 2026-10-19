import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing } from '@/theme/v2';
import { VISION_GOLD } from './VisionPaperChrome';
import { visionSceneSuggestions } from './visionSceneSuggestions';

type Props = {
  /** The person's own goal; shortcuts are derived from it, never a fixed list. */
  goal: string;
  /** What is already in the field, so a shortcut already used is not offered again. */
  text: string;
  onPick: (suggestion: string) => void;
  disabled?: boolean;
  /** The line above the chips. */
  label?: string;
};

/**
 * Shortcuts, not steps: tapping one fills the field and never generates. Chips wrap onto as many lines as the
 * screen needs, so none is clipped on a narrow phone. Renders nothing when the goal gives no clear theme.
 */
export function VisionSceneShortcuts({ goal, text, onPick, disabled = false, label = 'Quick ideas' }: Props) {
  const suggestions = useMemo(() => visionSceneSuggestions(goal, text), [goal, text]);
  if (!suggestions.length) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} testID="vision-scene-suggestions">
        {suggestions.map(item => (
          <Pressable key={item} accessibilityRole="button" accessibilityLabel={item} disabled={disabled}
            onPress={() => { v2Haptics.selection(); onPick(item); }}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[2] },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: VISION_GOLD },
  chipText: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.primary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
