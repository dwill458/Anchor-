/**
 * Anchor App - StatPill Component
 *
 * Individual stat display with glassmorphic styling.
 * Shows a value with label and optional unit.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';

interface StatPillProps {
  label: string;
  value: number;
  unit?: string;
  highlight?: boolean;
  style?: ViewStyle;
}

export const StatPill: React.FC<StatPillProps> = ({
  label,
  value,
  unit,
  highlight = false,
  style,
}) => {
  return (
    Platform.OS === 'ios' ? (
      <BlurView
        intensity={20}
        tint="dark"
        style={[styles.container, highlight && styles.highlighted, style]}
      >
        <Text style={styles.value}>
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
        <Text style={styles.label}>{label}</Text>
      </BlurView>
    ) : (
      <View style={[styles.container, highlight && styles.highlighted, style, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
        <Text style={styles.value}>
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    )
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  highlighted: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  value: {
    ...typography.h2,
    color: colors.bone,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.silver,
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
