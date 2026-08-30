import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Circle, Flame, Focus, Minus } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import type { ReflectionMood } from '@/types/chart';

const moods: Array<{ value: ReflectionMood; label: string; Icon: typeof Circle }> = [
  { value: 'CALM', label: 'Calm', Icon: Circle },
  { value: 'FOCUSED', label: 'Focused', Icon: Focus },
  { value: 'ENERGIZED', label: 'Energized', Icon: Flame },
  { value: 'UNCHANGED', label: 'Unchanged', Icon: Minus },
  { value: 'DISTRACTED', label: 'Distracted', Icon: Circle },
];

export const ReflectionMoodPicker: React.FC<{
  value?: ReflectionMood;
  onChange: (value?: ReflectionMood) => void;
  label?: string;
}> = ({ value, onChange, label = 'How do you feel now? (optional)' }) => (
  <View accessibilityLabel={label}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      {moods.map(({ value: option, label: optionLabel, Icon }) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(selected ? undefined : option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${optionLabel}${selected ? ', selected' : ''}`}
            style={[styles.option, selected && styles.selected]}
          >
            {selected ? <Check size={16} color={colors.gold} /> : <Icon size={16} color={colors.text.secondary} />}
            <Text style={[styles.optionText, selected && styles.selectedText]}>{optionLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  label: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { minHeight: 44, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12 },
  selected: { borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.12)' },
  optionText: { ...typography.caption, color: colors.text.secondary },
  selectedText: { color: colors.gold },
});
