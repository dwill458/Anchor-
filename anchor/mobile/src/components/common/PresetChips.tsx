/**
 * PresetChips — reusable horizontal row of selectable duration/preset chips.
 *
 * Extracted from the inline chip pattern in AnchorDetailScreen so it can be
 * used in multiple places (activation presets, reinforce presets, etc.).
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';

export interface PresetChip {
  key: string;
  label: string;
}

interface PresetChipsProps {
  chips: readonly PresetChip[];
  selectedKey: string;
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const PresetChips: React.FC<PresetChipsProps> = ({
  chips,
  selectedKey,
  onSelect,
  style,
}) => (
  <View style={[styles.row, style]}>
    {chips.map((chip) => {
      const isSelected = chip.key === selectedKey;
      return (
        <TouchableOpacity
          key={chip.key}
          style={[styles.chip, isSelected && styles.chipSelected]}
          onPress={() => onSelect(chip.key)}
          accessibilityRole="button"
          accessibilityLabel={chip.label}
          accessibilityState={{ selected: isSelected }}
        >
          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
            {chip.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colors.gold}40`,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}1A`,
  },
  chipText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  chipTextSelected: {
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
  },
});
