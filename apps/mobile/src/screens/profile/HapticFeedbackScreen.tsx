/**
 * Anchor App - Haptic Feedback Settings Screen
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SelectionList } from '@/components/settings';
import {
  HAPTIC_STRENGTH_OPTIONS,
  useSettingsStore,
} from '@/stores/settingsStore';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export const HapticFeedbackScreen: React.FC = () => {
  const { hapticStrength, setHapticStrength } = useSettingsStore();

  const handleSelect = (value: typeof hapticStrength) => {
    if (value === hapticStrength) return;
    setHapticStrength(value);
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Haptic Feedback</Text>
          <Text style={styles.subtitle}>
            Adjust the strength of physical feedback.
          </Text>
        </View>

        <SelectionList
          options={HAPTIC_STRENGTH_OPTIONS}
          selectedValue={hapticStrength}
          onSelect={handleSelect}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
});
