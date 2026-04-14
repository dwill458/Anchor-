/**
 * Anchor App - ProfileHeader Component
 *
 * Displays user profile information with avatar and membership badge.
 * Uses glassmorphic styling with user's initials in avatar.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';
import { SubscriptionStatus } from '@/types';

interface ProfileHeaderProps {
  displayName: string | null | undefined;
  subscriptionStatus: SubscriptionStatus;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayName,
  subscriptionStatus: _subscriptionStatus,
}) => {
  // DEFERRED: trial badge removed, surfaced in ProfileScreen subscription section

  // Get first letter of display name or default to 'S' for Seeker
  const avatarInitial = displayName?.[0]?.toUpperCase() || 'S';

  return (
    Platform.OS === 'ios' ? (
      <BlurView intensity={20} tint="dark" style={styles.container}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </View>

        <Text style={styles.displayName}>{displayName || 'Seeker'}</Text>
      </BlurView>
    ) : (
      <View style={[styles.container, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </View>

        <Text style={styles.displayName}>{displayName || 'Seeker'}</Text>
      </View>
    )
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 36,
    color: colors.gold,
  },
  displayName: {
    ...typography.h2,
    color: colors.bone,
    marginBottom: spacing.sm,
  },
  // DEFERRED: trial badge removed, surfaced in ProfileScreen subscription section
  // badge / badgeText styles deleted
});
