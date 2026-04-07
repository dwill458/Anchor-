/**
 * Mode Selection Step
 *
 * First step in the charge selection flow.
 * Displays two large vertical glassmorphic cards:
 * - Focus Charge: brief, focused energy
 * - Ritual Charge: immersive, multi-phase experience
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { FocusChargeIcon, RitualChargeIcon } from '@/components/icons';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export interface ModeSelectionStepProps {
  onSelectMode: (mode: 'focus' | 'ritual') => void;
}

/**
 * ModeSelectionStep Component
 *
 * Premium meditation experience with two large mode selection cards.
 * Represents the entry point for the charge ritual.
 */
export const ModeSelectionStep: React.FC<ModeSelectionStepProps> = ({
  onSelectMode,
}) => {
  const handleFocusSelect = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onSelectMode('focus');
  };

  const handleRitualSelect = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onSelectMode('ritual');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Step header */}
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 1 OF 2</Text>
        <Text style={styles.title}>Charging Mode</Text>
        <Text style={styles.subtitle}>Choose how deeply you want to connect.</Text>
      </View>

      {/* Mode selection cards */}
      <View style={styles.cardsContainer}>
        {/* Focus Charge Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={handleFocusSelect}
          activeOpacity={0.8}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              <View style={[styles.cardContent, styles.focusCard]}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <FocusChargeIcon size={64} />
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>Focus Charge</Text>

                {/* Description */}
                <Text style={styles.cardDescription}>
                  A brief moment of alignment
                </Text>

                {/* Benefits */}
                <View style={styles.benefits}>
                  <Text style={styles.benefitItem}>30 sec, 2 min, or 5 min</Text>
                  <Text style={styles.benefitItem}>Single phase practice</Text>
                  <Text style={styles.benefitItem}>Quick energy boost</Text>
                </View>
              </View>
            </BlurView>
          ) : (
            <View style={[styles.cardBlur, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
              <View style={[styles.cardContent, styles.focusCard]}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <FocusChargeIcon size={64} />
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>Focus Charge</Text>

                {/* Description */}
                <Text style={styles.cardDescription}>
                  A brief moment of alignment
                </Text>

                {/* Benefits */}
                <View style={styles.benefits}>
                  <Text style={styles.benefitItem}>30 sec, 2 min, or 5 min</Text>
                  <Text style={styles.benefitItem}>Single phase practice</Text>
                  <Text style={styles.benefitItem}>Quick energy boost</Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Ritual Charge Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={handleRitualSelect}
          activeOpacity={0.8}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              <View style={[styles.cardContent, styles.ritualCard]}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <RitualChargeIcon size={64} />
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>Ritual Charge</Text>

                {/* Description */}
                <Text style={styles.cardDescription}>
                  A guided, immersive experience
                </Text>

                {/* Benefits */}
                <View style={styles.benefits}>
                  <Text style={styles.benefitItem}>5 min, 10 min, or custom</Text>
                  <Text style={styles.benefitItem}>Multi-phase ceremony</Text>
                  <Text style={styles.benefitItem}>Lasting transformation</Text>
                </View>
              </View>
            </BlurView>
          ) : (
            <View style={[styles.cardBlur, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
              <View style={[styles.cardContent, styles.ritualCard]}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <RitualChargeIcon size={64} />
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>Ritual Charge</Text>

                {/* Description */}
                <Text style={styles.cardDescription}>
                  A guided, immersive experience
                </Text>

                {/* Benefits */}
                <View style={styles.benefits}>
                  <Text style={styles.benefitItem}>5 min, 10 min, or custom</Text>
                  <Text style={styles.benefitItem}>Multi-phase ceremony</Text>
                  <Text style={styles.benefitItem}>Lasting transformation</Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  stepIndicator: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },

  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },

  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  cardsContainer: {
    gap: spacing.lg,
  },

  card: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },

  cardBlur: {
    overflow: 'hidden',
    borderRadius: 24,
  },

  cardContent: {
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 24,
    minHeight: 280,
    justifyContent: 'center',
  },

  focusCard: {
    borderColor: `${colors.gold}60`,
    backgroundColor: `rgba(255, 255, 255, 0.02)`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  ritualCard: {
    borderColor: `${colors.bronze}60`,
    backgroundColor: `rgba(255, 255, 255, 0.02)`,
    shadowColor: colors.bronze,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  iconContainer: {
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },

  cardDescription: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontWeight: '500',
  },

  benefits: {
    gap: spacing.sm,
    alignItems: 'center',
  },

  benefitItem: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
