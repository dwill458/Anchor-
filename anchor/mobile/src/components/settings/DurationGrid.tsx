import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface DurationGridOption {
  label: string;
  value: number;
  fullWidth?: boolean;
}

interface DurationGridProps {
  options: DurationGridOption[];
  selected: number;
  onSelect: (value: number) => void;
}

export const DurationGrid: React.FC<DurationGridProps> = ({
  options,
  selected,
  onSelect,
}) => (
  <View style={styles.grid}>
    {options.map((option) => {
      const isSelected = option.value === selected;
      return (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [
            styles.button,
            option.fullWidth ? styles.buttonWide : null,
            isSelected ? styles.buttonSelected : null,
            pressed && !isSelected ? styles.buttonPressed : null,
          ]}
        >
          <Text style={[styles.label, isSelected ? styles.labelSelected : null]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    width: '48.5%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
  },
  buttonWide: {
    width: '100%',
  },
  buttonSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    color: colors.silver,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  labelSelected: {
    color: colors.gold,
  },
});
