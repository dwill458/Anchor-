/**
 * Anchor App - ProfileErrorState Component
 *
 * Shows when profile fetch fails and no cached data exists.
 * Displays error message and retry button.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';

interface ProfileErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const ProfileErrorState: React.FC<ProfileErrorStateProps> = ({ error, onRetry }) => {
  return (
    Platform.OS === 'ios' ? (
      <BlurView intensity={20} tint="dark" style={styles.container}>
        <Text style={styles.title}>Connection Lost</Text>
        <Text style={styles.message}>
          {error || 'Unable to load your profile. Please try again.'}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </BlurView>
    ) : (
      <View style={[styles.container, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
        <Text style={styles.title}>Connection Lost</Text>
        <Text style={styles.message}>
          {error || 'Unable to load your profile. Please try again.'}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(192, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  title: {
    ...typography.h2,
    color: colors.bone,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.silver,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.navy,
    fontWeight: '600',
  },
});
