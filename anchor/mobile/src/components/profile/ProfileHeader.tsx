/**
 * Anchor App - ProfileHeader Component
 *
 * Displays user profile information with avatar and membership badge.
 * Uses glassmorphic styling with user's initials in avatar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';
import { SubscriptionStatus } from '@/types';

interface ProfileHeaderProps {
  displayName: string | null | undefined;
  subscriptionStatus: SubscriptionStatus;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayName,
  subscriptionStatus,
}) => {
  const isPro = subscriptionStatus === 'pro' || subscriptionStatus === 'pro_annual';
  const membershipLabel = isPro ? 'PRO' : 'FREE';
  const badgeColor = isPro ? colors.gold : colors.silver;

  // Get first letter of display name or default to 'S' for Seeker
  const avatarInitial = displayName?.[0]?.toUpperCase() || 'S';

  return (
    <BlurView intensity={20} tint="dark" style={styles.container}>
      <View style={[styles.avatarPlaceholder, { borderColor: badgeColor }]}>
        <Text style={[styles.avatarText, { color: badgeColor }]}>{avatarInitial}</Text>
      </View>

      <Text style={styles.displayName}>{displayName || 'Seeker'}</Text>

      <View style={[styles.badge, { borderColor: badgeColor }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]}>{membershipLabel}</Text>
      </View>
    </BlurView>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 36,
  },
  displayName: {
    ...typography.h2,
    color: colors.bone,
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
