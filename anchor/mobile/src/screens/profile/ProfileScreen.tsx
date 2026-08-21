import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';

import { EditProfileSheet } from '@/components/EditProfileSheet';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useToast } from '@/components/ToastProvider';
import { useProgressionData } from '@/hooks/useProgressionData';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { persistProfilePhoto } from '@/services/ProfileMediaService';
import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { EMPTY_AXIOM, useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, typography } from '@/theme';
import type { ApiResponse, User } from '@/types';
import { logger } from '@/utils/logger';
import { calculateThreadStrengthScore, selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import { localDateKey } from '@/utils/practiceTime';
import { getThreadStrengthState } from '@/utils/threadStrength';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const anchors = useAnchorStore((state) => state.anchors);
  const totalSessionsCount = useSessionStore((state) => state.totalSessionsCount);
  const practiceHistory = useSessionStore((state) => state.practiceHistory);
  const threadStrengthSensitivity = useSettingsStore((state) => state.threadStrengthSensitivity);
  const restDays = useSettingsStore((state) => state.restDays);
  const activeAnchors = useProgressionData().activeAnchors;
  const {
    name,
    axiom,
    timezone,
    mono,
    photo,
    memberSince,
    updateProfile,
    syncFromUser,
  } = useProfileStore();

  const [editSheetOpen, setEditSheetOpen] = useState(false);

  useEffect(() => {
    syncFromUser(user);
  }, [syncFromUser, user]);

  const resolvedName =
    name || user?.displayName || user?.email?.split('@')[0] || 'Practitioner';
  const resolvedAxiom = axiom.trim() || EMPTY_AXIOM;
  const memberSinceDate = memberSince
    ? new Date(memberSince)
    : user?.createdAt
      ? new Date(user.createdAt)
      : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : '—';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const threadStrengthScore = useMemo(() => {
    const events = selectCanonicalPracticeEvents(practiceHistory, user?.id ?? null);
    if (events.length === 0) {
      return null;
    }
    return calculateThreadStrengthScore(
      events,
      localDateKey(new Date()),
      threadStrengthSensitivity,
      restDays,
    );
  }, [practiceHistory, restDays, threadStrengthSensitivity, user?.id]);
  const threadStrengthState =
    threadStrengthScore !== null ? getThreadStrengthState(threadStrengthScore) : null;

  const handleClose = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.goBack();
      return;
    }
    navigation.goBack();
  };

  const handleSaveProfile = async (updates: {
    name: string;
    axiom: string;
    timezone: string;
    mono: typeof mono;
    photo: string | null;
  }) => {
    const persistedPhoto =
      user?.id != null
        ? await persistProfilePhoto({
            userId: user.id,
            photoUri: updates.photo,
            previousPhotoUri: photo,
          })
        : updates.photo;
    const nextUpdates = { ...updates, photo: persistedPhoto };

    updateProfile(nextUpdates);

    if (user) {
      const nextUser = { ...user, displayName: nextUpdates.name };
      setUser(nextUser);

      try {
        const body: Record<string, unknown> = {
          displayName: nextUpdates.name,
        };

        if (persistedPhoto) {
          const photoData = await FileSystem.readAsStringAsync(persistedPhoto, {
            encoding: 'base64',
          });
          const mimeType = persistedPhoto.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
          body.profilePictureBase64 = `data:${mimeType};base64,${photoData}`;
          body.profilePictureMimeType = mimeType;
        }

        const response = await apiClient.patch<ApiResponse<User>>(
          '/api/users/me',
          body,
        );

        if (response.data?.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        logger.warn('[ProfileScreen] Failed to sync profile remotely', error);
      }
    }

    setEditSheetOpen(false);
    toast.success('Profile updated');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.goldGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile"
            onPress={handleClose}
            hitSlop={10}
            style={styles.topButton}
          >
            <X color={colors.anchor15.ash} size={20} strokeWidth={1.5} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identityBlock}>
            <ProfileAvatar
              size={84}
              name={resolvedName}
              mono={mono}
              photoUri={photo}
              userId={user?.id}
              showCameraBadge={false}
            />
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{resolvedName}</Text>
              <Text style={styles.axiom}>{resolvedAxiom}</Text>
              <Text style={styles.memberSince}>{`Member since ${memberSinceLabel}`}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{activeAnchors}</Text>
              <Text style={styles.statLabel}>Active Anchors</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{totalSessionsCount}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
          </View>

          {threadStrengthState ? (
            <View
              style={styles.strengthBadge}
              accessibilityLabel={`Thread Strength ${threadStrengthScore} out of 100, ${threadStrengthState.label}`}
            >
              <View style={styles.strengthDot} />
              <Text style={styles.strengthLabel}>
                {`Thread Strength · ${threadStrengthState.label}`}
              </Text>
              <Text style={styles.strengthMeta}>{threadStrengthScore}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
            onPress={() => setEditSheetOpen(true)}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editLabel}>Edit Profile</Text>
          </Pressable>

          <View style={styles.rule} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Open practice, reminder, account, and privacy settings"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.settingsTitle}>Settings</Text>
              <Text style={styles.settingsValue}>Practice · Notifications · Account</Text>
            </View>
            <ChevronRight color={colors.anchor15.ash} size={19} strokeWidth={1.4} />
          </Pressable>

          <Text style={styles.versionText}>{`Version ${appVersion}`}</Text>
        </ScrollView>
      </SafeAreaView>

      <EditProfileSheet
        open={editSheetOpen}
        profile={{
          name: resolvedName,
          axiom: axiom.trim(),
          timezone,
          mono,
          photo,
        }}
        onClose={() => setEditSheetOpen(false)}
        onSave={handleSaveProfile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.ink,
  },
  safeArea: {
    flex: 1,
  },
  goldGlow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -170,
    left: -120,
    backgroundColor: 'rgba(217,179,108,0.07)',
  },
  topBar: {
    height: 48,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 34,
  },
  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 8,
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 21,
    letterSpacing: 0.4,
  },
  axiom: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 21,
    marginTop: 4,
  },
  memberSince: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    letterSpacing: 0.15,
    marginTop: 7,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  statBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: 'rgba(217,179,108,0.035)',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 23,
    lineHeight: 26,
  },
  statLabel: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 7,
  },
  strengthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 9,
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.anchor15.goldLine,
    backgroundColor: 'rgba(217,179,108,0.05)',
  },
  strengthDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.anchor15.gilt,
  },
  strengthLabel: {
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  strengthMeta: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.anchor15.goldHairline,
    paddingLeft: 9,
  },
  editButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginTop: 18,
  },
  editLabel: {
    color: colors.anchor15.gilt,
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 11,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.anchor15.hairlineGold,
    marginVertical: 26,
  },
  settingsRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingsTitle: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.ritual,
    fontSize: 13,
    letterSpacing: 0.9,
  },
  settingsValue: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    marginTop: 6,
  },
  versionText: {
    color: 'rgba(135,147,157,0.62)',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 42,
  },
  pressed: {
    opacity: 0.68,
  },
});
