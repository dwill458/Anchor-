import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  IconChevron,
  IconDev,
  IconLock,
  IconShield,
  IconSliders,
  IconTarget,
} from '@/components/settings/SettingsIcons';
import {
  CompactConfirmSheet,
  SectionLabel,
  SettingsMetric,
} from '@/components/settings/SettingsPrimitives';
import {
  GroupLabel,
  GroupRow,
  SettingsGroup,
  StatusPill,
  TierPill,
} from '@/components/settings/SettingsCards';
import { PracticeSubscreen } from './PracticeSubscreen';
import { NotificationSettingsScreen } from '@/screens/v2/notifications/NotificationSettingsScreen';
import { SoundFeelSubscreen } from './SoundFeelSubscreen';
import { AccountSubscreen } from './AccountSubscreen';
import { DataPrivacySubscreen } from './DataPrivacySubscreen';
import { HelpAboutSubscreen } from './HelpAboutSubscreen';
import { EditProfileSubscreen } from './EditProfileSubscreen';
import { DeveloperToolsSubscreen } from './DeveloperToolsSubscreen';
import { BackupRecoverySubscreen } from './BackupRecoverySubscreen';
import {
  formatPracticeSummary,
  formatReminderSummary,
  formatSoundSummary,
  useStoredNotificationState,
} from './settingsSummaries';
import { useLastBackupAt } from '@/storage/backup/lastBackup';
import { mapHapticIntensityToFeedback } from '@/utils/hapticFeedbackLevel';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEV_MOCK_IDENTITY } from '@/utils/devMockIdentity';

import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { apiClient } from '@/services/ApiClient';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { AuthService } from '@/services/AuthService';
import { forceEntranceAfterSignOut } from '@/services/forceEntranceAfterSignOut';
import { persistProfilePhoto } from '@/services/ProfileMediaService';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { logger } from '@/utils/logger';
import { isSfxLogEnabled } from '@/services/audio/sfxLog';
import { AudioLogView } from './AudioLogView';
import type { ApiResponse, User } from '@/types';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';

export type SettingsSubscreenType =
  | 'main'
  | 'practice'
  | 'notifications'
  | 'sound'
  | 'data'
  | 'backup'
  | 'account'
  | 'help'
  | 'profile'
  | 'developer';

interface HubRow {
  key: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  onPress: () => void;
}

interface HubGroup {
  label: string;
  rows: HubRow[];
}

const SEARCH_SHORTCUTS = ['Reminder time', 'Thread Strength', 'Back up', 'Haptics'];

const cardGold = '#7A5A0C';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const reveal = useSettingsReveal();

  const [activeSubscreen, setActiveSubscreen] = useState<SettingsSubscreenType>('main');
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [audioLogVisible, setAudioLogVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  const name = useProfileStore((s) => s.name);
  const axiom = useProfileStore((s) => s.axiom);
  const timezone = useProfileStore((s) => s.timezone);
  const mono = useProfileStore((s) => s.mono);
  const photo = useProfileStore((s) => s.photo);
  const memberSince = useProfileStore((s) => s.memberSince);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const syncFromUser = useProfileStore((s) => s.syncFromUser);
  const visionAppearance = useVisionAppearanceReference();

  const dailyPracticeGoal = useSettingsStore((s) => s.dailyPracticeGoal ?? 1);
  const threadStrengthSensitivity = useSettingsStore((s) => s.threadStrengthSensitivity);
  const focusVoice = useSettingsStore((s) => s.sessionAudioDefaults?.focus?.guidanceVoice);
  const hapticIntensity = useSettingsStore((s) => s.hapticIntensity);
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const devMockIdentity = useSettingsStore((s) => s.devMockIdentity);
  const lastBackupAt = useLastBackupAt();
  const storedNotificationState = useStoredNotificationState(activeSubscreen);

  // Metrics
  const totalSessionsCount = useSessionStore((s) => s.totalSessionsCount);
  // Only a count is needed here; avoid the full progression computation on mount.
  const activeAnchors = useAnchorStore(
    (s) => s.anchors.filter((a) => !a.isReleased && !a.releasedAt && !a.archivedAt).length
  );
  const createdAnchorCount = user?.totalAnchorsCreated ?? activeAnchors;

  // Subscription / RevenueCat
  const { isSubscribed, isTrialActive, daysRemaining } = useTrialStatus();

  useEffect(() => {
    syncFromUser(user);
  }, [syncFromUser, user]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const firebaseEmail = isAuthenticated ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? '' : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;

  const mockIdentity = __DEV__ && devMockIdentity;
  const resolvedName = mockIdentity
    ? DEV_MOCK_IDENTITY.displayName
    : name || user?.displayName || user?.email?.split('@')[0] || 'Practitioner';
  const profilePhotoUri = mockIdentity ? DEV_MOCK_IDENTITY.profilePictureUrl : photo || user?.profilePictureUrl || null;
  const memberSinceDate = memberSince ? new Date(memberSince) : user?.createdAt ? new Date(user.createdAt) : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : 'May 2026';

  const subscriptionTierBadge = isSubscribed ? 'PRO' : isTrialActive ? 'TRIAL' : 'FREE';
  const subscriptionSummary = isSubscribed
    ? 'Anchor Pro \u00b7 Active'
    : isTrialActive
      ? `Trial \u00b7 ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
      : 'Anchor Free';

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
    usePhotoInVision?: boolean;
  }) => {
    const persistedPhoto =
      user?.id != null
        ? await persistProfilePhoto({ userId: user.id, photoUri: updates.photo, previousPhotoUri: photo })
        : updates.photo;
    const nextUpdates = { name: updates.name, photo: persistedPhoto };
    updateProfile(nextUpdates);

    if (updates.usePhotoInVision !== undefined) {
      if (updates.usePhotoInVision && persistedPhoto) {
        await visionAppearance.setProfilePreference(true, persistedPhoto);
      } else {
        await visionAppearance.setProfilePreference(false);
      }
    } else if (persistedPhoto !== photo && visionAppearance.enabledByPreference) {
      // A changed profile image is not silently repurposed for generation.
      // Keep the profile itself, but require a fresh Vision opt-in next time.
      await visionAppearance.setProfilePreference(false);
    }

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
      forceEntranceAfterSignOut();
    } catch (error) {
      logger.warn('[SettingsScreen] Failed to sign out cleanly', error);
      Alert.alert('Sign Out Failed', 'We could not sign you out right now.');
    }
  }, [setHasCompletedOnboarding, signOut]);

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
    return <NotificationSettingsScreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'sound') {
    return <SoundFeelSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'data') {
    return (
      <DataPrivacySubscreen
        onBack={() => setActiveSubscreen('main')}
        onOpenBackup={() => setActiveSubscreen('backup')}
        onResetToOnboarding={resetToOnboarding}
      />
    );
  }
  if (activeSubscreen === 'backup') {
    return <BackupRecoverySubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'account') {
    return (
      <AccountSubscreen
        onBack={() => setActiveSubscreen('main')}
        onNavigateToLogin={handleSignIn}
        onOpenPaywall={handlePaywall}
        onSignedOut={() => setActiveSubscreen('main')}
      />
    );
  }
  if (activeSubscreen === 'help') {
    return <HelpAboutSubscreen onBack={() => setActiveSubscreen('main')} />;
  }
  if (activeSubscreen === 'profile') {
    return (
      <EditProfileSubscreen
        name={resolvedName}
        photo={profilePhotoUri}
        onBack={() => setActiveSubscreen('main')}
        onSave={handleSaveProfile}
      />
    );
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

  const hubGroups: HubGroup[] = [
    {
      label: 'Make Anchor yours',
      rows: [
        {
          key: 'Practice',
          title: 'Practice',
          subtitle: formatPracticeSummary(dailyPracticeGoal, threadStrengthSensitivity, focusVoice),
          keywords:
            'daily goal thread strength session defaults duration voice guide mode hide intention tracing open to practice',
          icon: <IconTarget size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('practice'),
        },
        {
          key: 'Notifications & reminders',
          title: 'Reminders',
          subtitle: formatReminderSummary(storedNotificationState),
          keywords: 'reminder time notifications nudges momentum weekly recap tone time zone timezone',
          icon: <IconBell size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('notifications'),
        },
        {
          key: 'App experience',
          title: 'Sound & feel',
          subtitle: formatSoundSummary(mapHapticIntensityToFeedback(hapticIntensity ?? 55), soundEffectsEnabled),
          keywords: 'haptics sound effects motion reduce motion',
          icon: <IconSliders size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('sound'),
        },
      ],
    },
    {
      label: 'Your data',
      rows: [
        {
          key: 'Back up my data',
          title: 'Backup & recovery',
          subtitle: 'Encrypted copy of your Anchors',
          keywords: 'back up backup restore recovery key',
          icon: <IconLock size={20} color={cardGold} />,
          badge: lastBackupAt ? undefined : <StatusPill label="Not backed up" />,
          onPress: () => setActiveSubscreen('backup'),
        },
        {
          key: 'Account & data',
          title: 'Data & privacy',
          subtitle: 'Export, analytics, delete data',
          keywords: 'export analytics delete account danger privacy',
          icon: <IconShield size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('data'),
        },
      ],
    },
    {
      label: 'Account & help',
      rows: [
        {
          key: 'Subscription',
          title: 'Account & subscription',
          subtitle: subscriptionSummary,
          keywords: 'email restore purchases subscription pro trial sign out',
          icon: <IconBadge size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('account'),
        },
        {
          key: 'Privacy & support',
          title: 'Help & about',
          subtitle: 'Support, app tips, legal',
          keywords: 'help support contact replay app tips rate privacy policy terms legal',
          icon: <IconShield size={20} color={cardGold} />,
          onPress: () => setActiveSubscreen('help'),
        },
      ],
    },
  ];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleGroups = hubGroups
    .map((group) => ({
      ...group,
      rows: normalizedQuery
        ? group.rows.filter((row) =>
            `${row.title} ${row.subtitle} ${row.keywords}`.toLowerCase().includes(normalizedQuery)
          )
        : group.rows,
    }))
    .filter((group) => group.rows.length > 0);

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
          <Text style={styles.navTitle} numberOfLines={1} accessibilityRole="header">
            Settings
          </Text>
          <View style={styles.navButtonPlaceholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => setActiveSubscreen('profile')}
              activeOpacity={0.85}
              style={styles.identityRow}
              testID="settings-row-Edit profile"
            >
              <View style={styles.avatarCircle}>
                {profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{displayInitial}</Text>
                )}
              </View>
              <View style={styles.identityTextGroup}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {resolvedName}
                </Text>
                <View style={styles.metaRow}>
                  <TierPill label={subscriptionTierBadge} />
                  <Text style={styles.memberSinceText}>{`Member since ${memberSinceLabel}`}</Text>
                </View>
              </View>
              <IconChevron size={20} color={T.ink3} />
            </TouchableOpacity>
            <View style={styles.metricsContainer}>
              <View style={styles.metricCell}>
                <SettingsMetric value={createdAnchorCount} label="Anchors" />
              </View>
              <View style={[styles.metricCell, styles.metricCellDivider]}>
                <SettingsMetric value={totalSessionsCount} label="Sessions" />
              </View>
            </View>
          </View>

          {/* Search */}
          <TextInput
            accessibilityLabel="Search settings"
            placeholder="Search settings"
            placeholderTextColor={T.ink2}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
            testID="settings-search"
          />
          {!normalizedQuery ? (
            <View style={styles.chipRow}>
              {SEARCH_SHORTCUTS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  accessibilityRole="button"
                  accessibilityLabel={chip}
                  onPress={() => setSearchQuery(chip)}
                  style={styles.chip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {normalizedQuery && visibleGroups.length === 0 ? (
            <Text style={styles.emptySearch}>{`No settings match "${searchQuery.trim()}".`}</Text>
          ) : null}

          {visibleGroups.map((group) => (
            <View key={group.label}>
              <GroupLabel>{group.label}</GroupLabel>
              <SettingsGroup>
                {group.rows.map((row) => (
                  <GroupRow
                    key={row.key}
                    icon={row.icon}
                    title={row.title}
                    subtitle={row.subtitle}
                    badge={row.badge}
                    onPress={row.onPress}
                    testID={`settings-row-${row.key}`}
                  />
                ))}
              </SettingsGroup>
            </View>
          ))}

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
            {isSfxLogEnabled() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Version ${appVersion}. Long press to open audio log.`}
                onLongPress={() => setAudioLogVisible(true)}
                delayLongPress={500}
                testID="settings-open-audio-log"
              >
                <Text style={styles.versionFooter}>{`Anchor ${appVersion}`}</Text>
              </Pressable>
            ) : (
              <Text style={styles.versionFooter}>{`Anchor ${appVersion}`}</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Sign Out Confirmation */}
      <CompactConfirmSheet
        open={confirmSignOutOpen}
        title="Sign out of Anchor?"
        desc="You can sign back in at any time to continue your practice."
        confirmLabel="Sign Out"
        onConfirm={() => void confirmSignOut()}
        onClose={() => setConfirmSignOutOpen(false)}
      />

      <AudioLogView visible={audioLogVisible} onClose={() => setAudioLogVisible(false)} />
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
    marginTop: 12,
  },
  metricCell: { flex: 1, paddingTop: 12, paddingHorizontal: 4 },
  metricCellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: T.line,
    paddingLeft: 16,
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
    borderRadius: 20,
    padding: 16,
  },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#B3AA97',
    backgroundColor: T.surface,
    paddingHorizontal: 16,
    fontFamily: settingsTypography.body,
    fontSize: 16,
    color: T.ink,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginHorizontal: 16 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#B3AA97',
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: settingsTypography.bodySemiBold, fontSize: 15, color: T.ink },
  emptySearch: { marginHorizontal: 20, marginTop: 24, fontFamily: settingsTypography.body, fontSize: 15, color: T.ink2 },
  groupCard: {
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },  devSection: {
    marginTop: 6,
    marginHorizontal: 16,
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
