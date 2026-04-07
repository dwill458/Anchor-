import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme';

interface UndertonLineProps {
  text: string;
  variant?: 'default' | 'emphasis';
}

export function UndertoneLine({ text, variant = 'default' }: UndertonLineProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="text">
      <View style={[styles.pin, variant === 'emphasis' && styles.pinEmphasis]} />
      <Text
        style={[
          styles.base,
          variant === 'emphasis' ? styles.emphasis : styles.default,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pin: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: colors.ritual.pin,  // rgba(212,175,55,0.55)
    flexShrink: 0,
  },
  pinEmphasis: {
    height: 11,
    backgroundColor: colors.ritual.border,  // rgba(212,175,55,0.24) — softer for nudge
  },
  base: {
    ...typography.body,
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 19,
    flexShrink: 1,
  },
  default: {
    color: colors.text.undertone,  // '#AAAAAA'
    fontStyle: 'italic',
  },
  emphasis: {
    fontSize: 14,
    color: colors.text.secondary,  // '#C0C0C0'
    fontStyle: 'italic',
  },
});
