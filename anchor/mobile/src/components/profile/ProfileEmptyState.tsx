/**
 * Anchor App - ProfileEmptyState Component
 *
 * Shows when user has created no anchors yet.
 * Encourages user to create their first anchor.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';

interface ProfileEmptyStateProps {
  onCreateAnchor: () => void;
}

export const ProfileEmptyState: React.FC<ProfileEmptyStateProps> = ({ onCreateAnchor }) => {
  return (
    Platform.OS === 'ios' ? (
      <BlurView intensity={20} tint="dark" style={styles.container}>
        <Text style={styles.title}>Begin Your Journey</Text>
        <Text style={styles.message}>
          Create your first Anchor to start building your practice.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onCreateAnchor}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Create Anchor</Text>
        </TouchableOpacity>
      </BlurView>
    ) : (
      <View style={[styles.container, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
        <Text style={styles.title}>Begin Your Journey</Text>
        <Text style={styles.message}>
          Create your first Anchor to start building your practice.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={onCreateAnchor}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Create Anchor</Text>
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
