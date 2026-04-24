/**
 * Anchor App - ProfileHeader Component
 *
 * Displays user profile information with avatar and membership badge.
 * Uses glassmorphic styling with user's initials in avatar.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, Image, type ImageSourcePropType } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarByIndex, getDefaultAvatar } from '@/utils/avatarUtils';
import { SubscriptionStatus } from '@/types';
import { useNotificationController } from '../../hooks/useNotificationController';

interface ProfileHeaderProps {
  displayName: string | null | undefined;
  subscriptionStatus: SubscriptionStatus;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayName,
  subscriptionStatus: _subscriptionStatus,
}) => {
  // DEFERRED: trial badge removed, surfaced in ProfileScreen subscription section
  const { notifState } = useNotificationController();
  const user = useAuthStore((state) => state.user);
  const photo = useProfileStore((state) => state.photo);
  const mono = useProfileStore((state) => state.mono);

  // Get first letter of display name or default to 'S' for Seeker
  const avatarInitial = displayName?.[0]?.toUpperCase() || 'S';
  const trimmedPhoto = photo?.trim();
  const selectedAvatarSource = mono.startsWith('avatar_')
    ? getAvatarByIndex(Number.parseInt(mono.replace('avatar_', ''), 10) || 0)
    : null;
  const avatarSource: ImageSourcePropType | null = trimmedPhoto
    ? { uri: trimmedPhoto }
    : selectedAvatarSource ?? (
      user?.id
        ? getDefaultAvatar(user.id)
        : null
    );

  return (
    Platform.OS === 'ios' ? (
      <BlurView intensity={20} tint="dark" style={styles.container}>
        <View style={styles.avatarPlaceholder}>
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={{ width: '100%', height: '100%', borderRadius: 40 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          )}
        </View>

        <Text style={styles.displayName}>{displayName || 'Seeker'}</Text>
        {notifState?.sovereign_rank ? (
          <View style={styles.sovereignBadge}>
            <Text style={styles.sovereignLabel}>Sovereign</Text>
          </View>
        ) : null}
      </BlurView>
    ) : (
      <View style={[styles.container, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
        <View style={styles.avatarPlaceholder}>
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={{ width: '100%', height: '100%', borderRadius: 40 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          )}
        </View>

        <Text style={styles.displayName}>{displayName || 'Seeker'}</Text>
        {notifState?.sovereign_rank ? (
          <View style={styles.sovereignBadge}>
            <Text style={styles.sovereignLabel}>Sovereign</Text>
          </View>
        ) : null}
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
  sovereignBadge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4AF37',
    alignSelf: 'flex-start',
  },
  sovereignLabel: {
    fontFamily: 'Cinzel',
    fontSize: 11,
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  // DEFERRED: trial badge removed, surfaced in ProfileScreen subscription section
  // badge / badgeText styles deleted
});
