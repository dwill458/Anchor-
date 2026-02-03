/**
 * Anchor App - Mantra Voice Settings Screen
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SelectionList } from '@/components/settings';
import {
  MANTRA_VOICE_OPTIONS,
  useSettingsStore,
} from '@/stores/settingsStore';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export const MantraVoiceScreen: React.FC = () => {
  const { mantraVoice, setMantraVoice } = useSettingsStore();

  const handleSelect = (value: typeof mantraVoice) => {
    if (value === mantraVoice) return;
    setMantraVoice(value);
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mantra Voice</Text>
          <Text style={styles.subtitle}>
            Choose the voice used during mantra playback.
          </Text>
        </View>

        <SelectionList
          options={MANTRA_VOICE_OPTIONS}
          selectedValue={mantraVoice}
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
