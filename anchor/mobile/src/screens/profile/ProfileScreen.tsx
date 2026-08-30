import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { colors, typography } from '@/theme';
import type { ApiResponse, User } from '@/types';
import { logger } from '@/utils/logger';

const EMPTY_AXIOM = 'A quiet return to what matters.';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const totalSessionsCount = useSessionStore((state) => state.totalSessionsCount);
  const activeAnchors = useProgressionData().activeAnchors;
  const { name, axiom, timezone, mono, photo, memberSince, updateProfile, syncFromUser } = useProfileStore();
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  useEffect(() => {
    syncFromUser(user);
  }, [syncFromUser, user]);

  const resolvedName = name || user?.displayName || user?.email?.split('@')[0] || 'Practitioner';
  const resolvedEmail = user?.email?.trim() || 'Account details unavailable';
  const resolvedAxiom = axiom.trim() || EMPTY_AXIOM;
  const createdAnchorCount = user?.totalAnchorsCreated ?? activeAnchors;
  const memberSinceDate = memberSince ? new Date(memberSince) : user?.createdAt ? new Date(user.createdAt) : null;
  const memberSinceLabel = memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
    ? memberSinceDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
    const persistedPhoto = user?.id != null
      ? await persistProfilePhoto({ userId: user.id, photoUri: updates.photo, previousPhotoUri: photo })
      : updates.photo;
    const nextUpdates = { ...updates, photo: persistedPhoto };
    updateProfile(nextUpdates);

    if (user) {
      setUser({ ...user, displayName: nextUpdates.name });
      try {
        const body: Record<string, unknown> = { displayName: nextUpdates.name };
        if (persistedPhoto) {
          const photoData = await FileSystem.readAsStringAsync(persistedPhoto, { encoding: 'base64' });
          const mimeType = persistedPhoto.endsWith('.png') ? 'image/png' : 'image/jpeg';
          body.profilePictureBase64 = `data:${mimeType};base64,${photoData}`;
          body.profilePictureMimeType = mimeType;
        }
        const response = await apiClient.patch<ApiResponse<User>>('/api/users/me', body);
        if (response.data?.success && response.data.data) setUser(response.data.data);
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
      <View pointerEvents="none" style={styles.goldAmbient} />
      <View pointerEvents="none" style={styles.topArc} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close profile" onPress={handleClose} style={styles.topButton}>
            <X color={colors.anchor15.ash} size={19} strokeWidth={1.35} />
          </Pressable>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.identityBlock}>
            <ProfileAvatar size={80} name={resolvedName} mono={mono} photoUri={photo} userId={user?.id} showCameraBadge={false} />
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{resolvedName}</Text>
              <Text style={styles.email} numberOfLines={1}>{resolvedEmail}</Text>
              <Text style={styles.axiom}>{resolvedAxiom}</Text>
              <View style={styles.memberRow}>
                <Text style={styles.memberSince}>{`Member since ${memberSinceLabel}`}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Edit Profile" onPress={() => setEditSheetOpen(true)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                  <Text style={styles.editLabel}>Edit Profile</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <View style={styles.rule} />
          <Text style={styles.eyebrow}>Your Practice</Text>
          <Text style={styles.practiceSummary}>{`${activeAnchors} active · ${createdAnchorCount} created · ${totalSessionsCount} sessions`}</Text>
          <View style={styles.rule} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Open practice, reminder, account, and privacy settings"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          >
            <Text style={styles.settingsTitle}>Settings</Text>
            <Text style={styles.settingsValue} numberOfLines={1}>Practice · Notifications · Account</Text>
            <ChevronRight color={colors.anchor15.ash} size={18} strokeWidth={1.35} />
          </Pressable>
          <Text style={styles.versionText}>{`Version ${appVersion}`}</Text>
        </ScrollView>
      </SafeAreaView>
      <EditProfileSheet
        open={editSheetOpen}
        profile={{ name: resolvedName, axiom: axiom.trim(), timezone, mono, photo }}
        onClose={() => setEditSheetOpen(false)}
        onSave={handleSaveProfile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.anchor15.ink },
  safeArea: { flex: 1 },
  goldAmbient: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -175, left: -120, backgroundColor: 'rgba(217,179,108,0.065)' },
  topArc: { position: 'absolute', width: 620, height: 620, borderRadius: 310, top: -448, left: -250, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.09)' },
  topBar: { height: 48, paddingHorizontal: 10, justifyContent: 'center' },
  topButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  identityBlock: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 8 },
  identityCopy: { flex: 1 },
  name: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 23, lineHeight: 28, letterSpacing: 0.3 },
  email: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, lineHeight: 16, marginTop: 3 },
  axiom: { color: 'rgba(244,239,230,0.72)', fontFamily: typography.fontFamily.voiceItalic, fontStyle: 'italic', fontSize: 16, lineHeight: 21, marginTop: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, marginTop: 7 },
  memberSince: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, letterSpacing: 0.15, flex: 1 },
  editButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  editLabel: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 10, letterSpacing: 1.45, textTransform: 'uppercase' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.anchor15.hairline, marginVertical: 26 },
  eyebrow: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.1, textTransform: 'uppercase' },
  practiceSummary: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 17, lineHeight: 23, marginTop: 10 },
  settingsRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
  settingsTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  settingsValue: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, textAlign: 'right', flex: 1, marginHorizontal: 16 },
  versionText: { color: 'rgba(135,147,157,0.62)', fontFamily: typography.fontFamily.instrument, fontSize: 10, letterSpacing: 0.5, marginTop: 20 },
  pressed: { opacity: 0.68 },
});
