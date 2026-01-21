/**
 * Anchor App - Profile Screen
 *
 * User profile with stats, settings, and subscription management
 * Currently a placeholder for Phase 1 MVP
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ToastProvider';
import { colors, spacing, typography } from '@/theme';

export const ProfileScreen: React.FC = () => {
  const { setHasCompletedOnboarding } = useAuthStore();
  const toast = useToast();

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will restart the onboarding flow. The app will reload.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setHasCompletedOnboarding(false);
            toast.success('Onboarding reset! Reloading...');
            // Navigation will automatically reset due to RootNavigator watching hasCompletedOnboarding
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.description}>
          Coming soon: View your stats, manage subscription, and customize
          settings.
        </Text>
        <Text style={styles.emoji}>⚙️</Text>

        {/* Dev Helper - Remove in production */}
        <View style={styles.devSection}>
          <Text style={styles.devLabel}>Dev Tools</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetOnboarding}
            activeOpacity={0.7}
          >
            <Text style={styles.resetButtonText}>Reset Onboarding</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 64,
  },
  devSection: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    width: '100%',
  },
  devLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  resetButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    textAlign: 'center',
    fontWeight: '600',
  },
});
