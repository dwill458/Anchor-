/**
 * Anchor App - Selection List Component
 *
 * Glassmorphic card list with radio-style rows for single-select settings.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { SettingsRow } from './SettingsRow';
import { colors } from '@/theme';

interface SelectionOption<T extends string> {
  label: string;
  value: T;
  description?: string;
}

interface SelectionListProps<T extends string> {
  options: SelectionOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
}

export const SelectionList = <T extends string>({
  options,
  selectedValue,
  onSelect,
}: SelectionListProps<T>) => {
  return (
    <View style={styles.card}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.cardInner}>
        {options.map((option, index) => {
          const isSelected = option.value === selectedValue;
          return (
            <SettingsRow
              key={option.value}
              label={option.label}
              description={option.description}
              onPress={() => onSelect(option.value)}
              rightElement={<RadioIndicator selected={isSelected} />}
              showDivider={index < options.length - 1}
            />
          );
        })}
      </View>
    </View>
  );
};

const RadioIndicator = ({ selected }: { selected: boolean }) => (
  <View
    style={[
      styles.radioOuter,
      selected ? styles.radioOuterSelected : styles.radioOuterDefault,
    ]}
  >
    {selected && <View style={styles.radioInner} />}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(26, 26, 29, 0.9)' : 'transparent',
  },
  cardInner: {
    overflow: 'hidden',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterDefault: {
    borderColor: 'rgba(192, 192, 192, 0.4)',
  },
  radioOuterSelected: {
    borderColor: colors.gold,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
});
