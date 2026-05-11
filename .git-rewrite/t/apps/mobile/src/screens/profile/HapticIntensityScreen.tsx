/**
 * Anchor App - Haptic Intensity Screen
 *
 * Adjust the strength of physical feedback throughout the app.
 * Range: 0-100 (Light, Medium, Strong).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';

const IS_ANDROID = Platform.OS === 'android';
const CardWrapper = IS_ANDROID ? View : BlurView;

const getIntensityLabel = (value: number): string => {
  if (value < 34) return 'Light';
  if (value < 67) return 'Medium';
  return 'Strong';
};

const getIntensityDescription = (value: number): string => {
  if (value < 34) return 'Subtle vibrations for minimal distraction.';
  if (value < 67) return 'Balanced feedback for most interactions.';
  return 'Pronounced vibrations for maximum presence.';
};

export const HapticIntensityScreen: React.FC = () => {
  const { hapticIntensity, setHapticIntensity } = useSettingsStore();
  const [localValue, setLocalValue] = useState(hapticIntensity);

  const handleValueChange = (value: number) => {
    setLocalValue(Math.round(value));
  };

  const handleSlidingComplete = (value: number) => {
    const roundedValue = Math.round(value);
    setLocalValue(roundedValue);
    setHapticIntensity(roundedValue);

    // Trigger haptic feedback at the selected intensity
    if (roundedValue < 34) {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    } else if (roundedValue < 67) {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Haptic Feedback</Text>
            <Text style={styles.subtitle}>
              Adjust the strength of physical feedback.
            </Text>
          </View>

          {/* Slider Card */}
          <View style={styles.sliderContainer}>
            <CardWrapper {...cardProps} style={styles.sliderCard}>
              {/* Current Value Display */}
              <View style={styles.valueDisplay}>
                <Text style={styles.intensityLabel}>
                  {getIntensityLabel(localValue)}
                </Text>
                <Text style={styles.intensityValue}>{localValue}%</Text>
              </View>

              {/* Slider */}
              <View style={styles.sliderWrapper}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={localValue}
                  onValueChange={handleValueChange}
                  onSlidingComplete={handleSlidingComplete}
                  minimumTrackTintColor={colors.gold}
                  maximumTrackTintColor="rgba(192, 192, 192, 0.2)"
                  thumbTintColor={colors.gold}
                />
              </View>

              {/* Range Labels */}
              <View style={styles.rangeLabels}>
                <Text style={styles.rangeLabel}>0%</Text>
                <Text style={styles.rangeLabel}>50%</Text>
                <Text style={styles.rangeLabel}>100%</Text>
              </View>

              {/* Description */}
              <Text style={styles.description}>
                {getIntensityDescription(localValue)}
              </Text>
            </CardWrapper>
          </View>

          {/* Presets */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsTitle}>Quick Presets</Text>
            <View style={styles.presetsRow}>
              {[
                { label: 'Light', value: 25 },
                { label: 'Medium', value: 50 },
                { label: 'Strong', value: 85 },
              ].map((preset) => (
                <CardWrapper
                  key={preset.label}
                  {...cardProps}
                  style={[
                    styles.presetButton,
                    localValue >= preset.value - 15 &&
                      localValue <= preset.value + 15 &&
                      styles.presetButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetLabel,
                      localValue >= preset.value - 15 &&
                        localValue <= preset.value + 15 &&
                        styles.presetLabelActive,
                    ]}
                    onPress={() => handleSlidingComplete(preset.value)}
                  >
                    {preset.label}
                  </Text>
                </CardWrapper>
              ))}
            </View>
          </View>

          {/* Info Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Haptic feedback is used during anchor charging, activation, and key interactions.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  sliderContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sliderCard: {
    backgroundColor: IS_ANDROID
      ? 'rgba(26, 26, 29, 0.9)'
      : 'rgba(26, 26, 29, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    padding: spacing.xl,
  },
  valueDisplay: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  intensityLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  intensityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.silver,
    opacity: 0.8,
  },
  sliderWrapper: {
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  rangeLabel: {
    fontSize: 12,
    color: colors.silver,
    opacity: 0.6,
  },
  description: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.8,
  },
  presetsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: spacing.md,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    backgroundColor: IS_ANDROID
      ? 'rgba(26, 26, 29, 0.9)'
      : 'rgba(26, 26, 29, 0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  presetButtonActive: {
    borderColor: colors.gold,
    borderWidth: 2,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
  },
  presetLabelActive: {
    color: colors.gold,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.silver,
    textAlign: 'center',
    opacity: 0.6,
    fontStyle: 'italic',
  },
});
