import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';

import { T, settingsTypography } from '@/components/settings/settingsTheme';
import {
  IconBack,
  IconBadge,
  IconBell,
  IconDev,
  IconLock,
  IconPencil,
  IconShield,
  IconSliders,
  IconTarget,
} from '@/components/settings/SettingsIcons';
import {
  CompactConfirmSheet,
  SectionLabel,
  SettingsMetric,
  SettingsRow,
  SettingsRule,
} from '@/components/settings/SettingsPrimitives';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { PracticeSubscreen } from './PracticeSubscreen';
import { NotificationsSubscreen } from './NotificationsSubscreen';
import { AppExperienceSubscreen } from './AppExperienceSubscreen';
import { AccountDataSubscreen } from './AccountDataSubscreen';
import { PrivacySupportSubscreen } from './PrivacySupportSubscreen';
import { DeveloperToolsSubscreen } from './DeveloperToolsSubscreen';

import { useProgressionData } from '@/hooks/useProgressionData';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { apiClient } from '@/services/ApiClient';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { AuthService } from '@/services/AuthService';
import { persistProfilePhoto } from '@/services/ProfileMediaService';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { logger } from '@/utils/logger';
import type { ApiResponse, User } from '@/types';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';

export type SettingsSubscreenType =
  | 'main'
  | 'practice'
  | 'notifications'
  | 'experience'
  | 'account'
  | 'privacy'
  | 'developer';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const reveal = useSettingsReveal();

  const [activeSubscreen, setActiveSubscreen] = useState<SettingsSubscreenType>('main');
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  const frameRef = useRef<number | null>(null);
  const hasMarkedReadyRef = useRef(false);

  // Auth Store
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const profileEmail = useAuthStore((s) => s.profileData?.user?.email?.trim() ?? '');
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const setUser = useAuthStore((s) => s.setUser);
  const setHasCompletedOnboarding = useAuthStore((s) => s.setHasCompletedOnboarding);
  const signOut = useAuthStore((s) => s.signOut);

  // Profile Store
  const { name, axiom, timezone, mono, photo, memberSince, updateProfile, syncFromUser } = useProfileStore();

  // Metrics
  const totalSessionsCount = useSessionStore((s) => s.totalSessionsCount);
  const activeAnchors = useProgressionData().activeAnchors;
  const createdAnchorCount = user?.totalAnchorsCreated ?? activeAnchors;

  // Subscription / RevenueCat
  const { isSubscribed, isTrialActive, daysRemaining } = useTrialStatus();

  useEffect(() => {
    syncFromUser(user);
  }, [syncFromUser, user]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const firebaseEmail = isAuthenticated ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? '' : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;

  const resolvedName = name || user?.displayName || user?.email?.split('@')[0] || 'Practitioner';
  const memberSinceDate = memberSince ? new Date(memberSince) : user?.createdAt ? new Date(user.createdAt) : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : 'May 2026';

  const subscriptionTierBadge = isSubscribed ? 'PRO' : isTrialActive ? 'TRIAL' : 'FREE';
  const subscriptionSummary = isSubscribed
    ? 'Pro'
    : isTrialActive
      ? `Trial · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
      : 'Free';

  // Android hardware back handler
  useEffect(() => {
    const onBackPress = () => {
      if (activeSubscreen !== 'main') {
        setActiveSubscreen('main');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeSubscreen]);

  const markReady = useCallback(() => {
    if (hasMarkedReadyRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      hasMarkedReadyRef.current = true;
      reveal.markSettingsReady();
    });
  }, [reveal]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent();
    if (parent) {
      parent.goBack();
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const resetToOnboarding = useCallback(() => {
    const rootNavigation = navigation.getParent() as any;
    (rootNavigation ?? navigation).dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
    );
  }, [navigation]);

  const handleSignIn = useCallback(() => {
    try {
      (navigation as any).navigate('Login', { initialTab: 'signin' });
    } catch {
      const parent = navigation.getParent();
      if (parent) {
        (parent as any).navigate('Login', { initialTab: 'signin' });
      }
    }
  }, [navigation]);

  const handlePaywall = useCallback(() => {
    try {
      const parent = navigation.getParent() as any;
      (parent ?? navigation).navigate('V2Paywall', {
        context: 'GENERAL_UPGRADE',
        source: 'settings',
      });
    } catch {
      try {
        (navigation as any).navigate('Paywall', { source: 'settings' });
      } catch (err) {
        logger.warn('[SettingsScreen] Failed to navigate to paywall', err);
      }
    }
  }, [navigation]);

  const handleSaveProfile = async (updates: {
    name: string;
    photo: string | null;
  }) => {
    const persistedPhoto =
      user?.id != null
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
        logger.warn('[SettingsScreen] Failed to sync profile remotely', error);
      }
    }

    setEditSheetOpen(false);
  };

  const confirmSignOut = useCallback(async () => {
    setConfirmSignOutOpen(false);
    try {
      AnalyticsService.track(AnalyticsEvents.SIGN_OUT, { source: 'settings' });
      await AuthService.signOut();
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
      await signOut();
      setHasCompletedOnboarding(false);
      resetToOnboarding();
    } catch (error) {
      logger.warn('[SettingsScreen] Failed to sign out cleanly', error);
      Alert.alert('Sign Out Failed', 'We could not sign you out right now.');
    }
  }, [resetToOnboarding, setHasCompletedOnboarding, signOut]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || user.email?.trim()) return;
    if (firebaseEmail) setUser({ ...user, email: firebaseEmail });
    void fetchProfile().catch((error) => logger.warn('[SettingsScreen] Failed to refresh account profile', error));
  }, [fetchProfile, firebaseEmail, isAuthenticated, setUser, user]);

  /* ── Subscreen Routing ── */
  if (activeSubscreen === 'practice') {
    return <PracticeSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'notifications') {
    return <NotificationsSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'experience') {
    return <AppExperienceSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'account') {
    return (
      <AccountDataSubscreen
        onBack={() => setActiveSubscreen('main')}
        onNavigateToLogin={handleSignIn}
        onResetToOnboarding={resetToOnboarding}
      />
    );
  }
  if (activeSubscreen === 'privacy') {
    return <PrivacySupportSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'developer' && __DEV__) {
    return (
      <DeveloperToolsSubscreen
        onBack={() => setActiveSubscreen('main')}
        onResetOnboarding={resetToOnboarding}
      />
    );
  }

  const displayInitial = (resolvedName.charAt(0) || 'P').toUpperCase();

  /* ── Main Settings Hub ── */
  return (
    <View style={styles.container} onLayout={markReady}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.navButton}
            activeOpacity={0.65}
          >
            <IconBack size={22} color={T.ink} />
          </TouchableOpacity>
          <Text
            style={styles.navTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Profile & Settings
          </Text>
          <View style={styles.navButtonPlaceholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header (Open Editorial Composition) */}
          <View style={styles.profileHeader}>
            <View style={styles.identityRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit Profile photo"
                onPress={() => setEditSheetOpen(true)}
                activeOpacity={0.85}
                style={styles.avatarCircle}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{displayInitial}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.identityTextGroup}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {resolvedName}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.memberSinceText}>{`Member since ${memberSinceLabel}`}</Text>
                  <View style={[styles.badgeContainer, isSubscribed && styles.badgeContainerPro]}>
                    <Text style={[styles.badgeText, isSubscribed && styles.badgeTextPro]}>{subscriptionTierBadge}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.metricsContainer}>
              <SettingsMetric value={createdAnchorCount} label="Anchors" />
              <SettingsMetric value={totalSessionsCount} label="Sessions" />
            </View>
          </View>

          <SettingsRule mt={24} mb={0} />

          {/* Account Section */}
          <SectionLabel first>Account</SectionLabel>
          <SettingsRow
            icon={<IconPencil size={20} color={T.ink2} />}
            label="Edit profile"
            onPress={() => setEditSheetOpen(true)}
            testID="settings-row-Edit profile"
          />
          <SettingsRow
            icon={<IconBadge size={20} color={T.ink2} />}
            label="Subscription"
            value={subscriptionSummary}
            onPress={handlePaywall}
            testID="settings-row-Subscription"
          />

          {/* Preferences Section */}
          <SectionLabel>Preferences</SectionLabel>
          <SettingsRow
            icon={<IconTarget size={20} color={T.ink2} />}
            label="Practice"
            desc="Defaults, daily goals, and behavior"
            onPress={() => setActiveSubscreen('practice')}
            testID="settings-row-Practice"
          />
          <SettingsRow
            icon={<IconBell size={20} color={T.ink2} />}
            label="Notifications & reminders"
            desc="Daily prime, thread alerts, and recap"
            onPress={() => setActiveSubscreen('notifications')}
            testID="settings-row-Notifications & reminders"
          />
          <SettingsRow
            icon={<IconSliders size={20} color={T.ink2} />}
            label="App experience"
            desc="Haptics, sound, motion, and tips"
            onPress={() => setActiveSubscreen('experience')}
            testID="settings-row-App experience"
          />

          {/* More Section */}
          <SectionLabel>More</SectionLabel>
          <SettingsRow
            icon={<IconLock size={20} color={T.ink2} />}
            label="Account & data"
            desc="Email, purchases, and export"
            onPress={() => setActiveSubscreen('account')}
            testID="settings-row-Account & data"
          />
          <SettingsRow
            icon={<IconShield size={20} color={T.ink2} />}
            label="Privacy & support"
            desc="Analytics, support, and legal"
            onPress={() => setActiveSubscreen('privacy')}
            testID="settings-row-Privacy & support"
          />

          {/* Developer Tools Section (DEV ONLY) */}
          {__DEV__ ? (
            <View style={styles.devSection}>
              <SectionLabel>Developer</SectionLabel>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Developer Tools"
                onPress={() => setActiveSubscreen('developer')}
                style={styles.devRow}
                activeOpacity={0.7}
                testID="settings-row-Developer Tools"
              >
                <View style={styles.devIconWrapper}>
                  <IconDev size={20} color={T.devGreen} />
                </View>
                <View style={styles.devRowContent}>
                  <View style={styles.devTitleRow}>
                    <Text style={styles.devRowTitle}>Developer Tools</Text>
                    <View style={styles.devOnlyBadge}>
                      <Text style={styles.devOnlyBadgeText}>DEV ONLY</Text>
                    </View>
                  </View>
                  <Text style={styles.devRowDesc}>Internal testing controls & simulator</Text>
                </View>
                <IconBack size={14} color={T.devGreen} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Account Actions / Footer */}
          <View style={styles.accountActionsContainer}>
            {isAuthenticated ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={() => setConfirmSignOutOpen(true)}
                style={styles.signOutBtn}
                activeOpacity={0.65}
                testID="settings-row-Sign Out"
              >
                <Text style={styles.signOutBtnText}>Sign out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                onPress={handleSignIn}
                style={styles.signOutBtn}
                activeOpacity={0.65}
                testID="settings-row-Sign In"
              >
                <Text style={styles.signOutBtnText}>Sign in</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.versionFooter}>{`Version ${appVersion}`}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={editSheetOpen}
        profile={{ name: resolvedName, axiom: axiom.trim(), timezone, mono, photo }}
        onClose={() => setEditSheetOpen(false)}
        onSave={handleSaveProfile}
      />

      {/* Sign Out Confirmation */}
      <CompactConfirmSheet
        open={confirmSignOutOpen}
        title="Sign out of Anchor?"
        desc="You can sign back in at any time to continue your practice."
        confirmLabel="Sign Out"
        onConfirm={() => void confirmSignOut()}
        onClose={() => setConfirmSignOutOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: T.bg,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 23,
    color: T.ink,
    letterSpacing: -0.3,
  },
  navButtonPlaceholder: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  profileHeader: {
    paddingTop: 8,
    gap: 20,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontFamily: settingsTypography.displayBold,
    fontSize: 32,
    color: T.ink,
  },
  identityTextGroup: {
    flex: 1,
    gap: 6,
  },
  displayName: {
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 24,
    color: T.ink,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberSinceText: {
    fontFamily: settingsTypography.body,
    fontSize: 13.5,
    color: T.ink2,
  },
  badgeContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeContainerPro: {
    backgroundColor: '#FAF5EA',
    borderColor: '#DDC9A3',
  },
  badgeText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: T.ink2,
    textTransform: 'uppercase',
  },
  badgeTextPro: {
    color: '#8C682A',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 36,
  },
  devSection: {
    marginTop: 6,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.devGreenBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.devGreenBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  devIconWrapper: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devRowContent: {
    flex: 1,
    gap: 2,
  },
  devTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devRowTitle: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 15,
    color: T.devGreen,
  },
  devOnlyBadge: {
    backgroundColor: T.devGreen,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  devOnlyBadgeText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  devRowDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12,
    color: '#3B6047',
  },
  accountActionsContainer: {
    marginTop: 36,
    alignItems: 'center',
    gap: 12,
  },
  signOutBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.ink2,
  },
  versionFooter: {
    fontFamily: settingsTypography.body,
    fontSize: 12,
    color: T.ink3,
  },
});
