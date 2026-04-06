import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

interface PillSelectorProps {
  options: { label: string; value: string | number }[];
  selected: string | number;
  onSelect: (value: string | number) => void;
}

export const PillSelector: React.FC<PillSelectorProps> = ({
  options,
  selected,
  onSelect,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.container}
  >
    {options.map((option) => {
      const isSelected = option.value === selected;
      return (
        <Pressable
          key={String(option.value)}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [
            styles.pill,
            isSelected ? styles.pillSelected : null,
            pressed && !isSelected ? styles.pillPressed : null,
          ]}
        >
          <Text style={[styles.label, isSelected ? styles.labelSelected : null]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  pillPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    color: colors.silver,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  labelSelected: {
    color: colors.gold,
  },
});
