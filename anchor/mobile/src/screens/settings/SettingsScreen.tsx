import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
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
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettingsState } from '@/hooks/useSettings';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { AuthService } from '@/services/AuthService';
import { openStoreListing } from '@/services/reviewPromptService';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { LEGAL_URLS, SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSectionBlock } from '@/components/settings/SettingsSectionBlock';
import { useTeachingStore } from '@/stores/teachingStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import NotificationService from '@/services/NotificationService';
import revenueCatService from '@/services/RevenueCatService';
import { useNotificationController } from '../../hooks/useNotificationController';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { colors } from '@/theme';
import {
  formatHapticFeedbackLabel,
  SETTINGS_MUTED_TEXT,
  SETTINGS_SCREEN_BACKGROUND,
} from './shared';
import { logger } from '@/utils/logger';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOW_DEVELOPER_TOOLS =
  __DEV__ || process.env.EXPO_PUBLIC_APP_ENV !== 'production';

const formatDurationLabel = (durationSeconds: number): string => {
  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} min`;
};

let restoreInFlight = false;

const restorePurchases = async (): Promise<void> => {
  if (restoreInFlight) return;
  restoreInFlight = true;

  try {
    const status = await revenueCatService.restorePurchases();
    if (status.hasActiveEntitlement) {
      Alert.alert('Purchases restored', 'Your Pro access is active again.');
    } else {
      Alert.alert(
        'No subscription found',
        'No active subscription was found for this account. If you subscribed with a different store account, switch to it and try again.'
      );
    }
  } catch (error) {
    logger.warn('[SettingsScreen] Restore purchases failed', error);
    Alert.alert(
      'Restore failed',
      'We could not restore purchases right now. Check your connection and try again.'
    );
  } finally {
    restoreInFlight = false;
  }
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, updateSetting, resetSettings, isLoading } = useSettingsState();
  const focusSessionMode = useSettingsStore((state) => state.focusSessionMode ?? 'quick');
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'ambient');
  const primeSessionDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const primeSessionAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'ambient');
  const analyticsEnabled = useSettingsStore((state) => state.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((state) => state.setAnalyticsEnabled);
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const setTraceDefaultEnabled = useSettingsStore((state) => state.setTraceDefaultEnabled);
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const reduceMotionEnabled = useReduceMotionEnabled();
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);
  const dailyPracticeGoalPreset = useSettingsStore(
    (state) => state.dailyPracticeGoalPreset ?? 'three'
  );
  const threadStrengthSensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced'
  );
  const restDays = useSettingsStore((state) => state.restDays ?? []);
  const {
    notifState,
    toggleNotifications,
    updateNotificationPreferences,
  } = useNotificationController();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profileEmail = useAuthStore((state) => state.profileData?.user?.email?.trim() ?? '');
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setUser = useAuthStore((state) => state.setUser);
  const setHasCompletedOnboarding = useAuthStore((state) => state.setHasCompletedOnboarding);
  const signOut = useAuthStore((state) => state.signOut);
  const reveal = useSettingsReveal();
  const [timePickerTarget, setTimePickerTarget] = useState<'dailyPrime' | null>(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [spEmail, setSpEmail] = useState('');
  const [spPassword, setSpPassword] = useState('');
  const [spConfirm, setSpConfirm] = useState('');
  const [spError, setSpError] = useState('');
  const [spLoading, setSpLoading] = useState(false);
  const [spShowPass, setSpShowPass] = useState(false);
  const [spShowConfirm, setSpShowConfirm] = useState(false);
  const hasMarkedReadyRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const DeveloperToolsSection = __DEV__
    ? require('@/components/settings/DeveloperToolsSection').DeveloperToolsSection
    : null;

  const firebaseEmail = isAuthenticated
    ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? ''
    : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;
  const canSetPassword = isAuthenticated && !AuthService.getLinkedProviders().includes('password');
  const accountSubtitle = isAuthenticated
    ? accountEmail
      ? 'Synced to this account'
      : 'Syncing account details...'
    : 'Not signed in';

  const handleRootLayout = useCallback(() => {
    if (hasMarkedReadyRef.current || frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (hasMarkedReadyRef.current) {
        return;
      }
      hasMarkedReadyRef.current = true;
      reveal.markSettingsReady();
    });
  }, [reveal]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              AnalyticsService.track(AnalyticsEvents.SIGN_OUT, {
                source: 'settings',
              });
              await AuthService.signOut();
            } catch (error) {
              Alert.alert('Sign Out Failed', 'We could not sign you out right now.');
              logger.warn('[SettingsScreen] Failed to sign out cleanly', error);
              return;
            }

            try {
              // Clear sync retry queue so stale anchor data is not carried over
              const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
              await writeSecureValue('anchor-sync-retry-queue', '[]');
            } catch (error) {
              logger.warn('[SettingsScreen] Failed to clear sync retry queue on sign-out', error);
            }

            await signOut();
            setHasCompletedOnboarding(false);
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              })
            );
          },
        },
      ]
    );
  }, [navigation, signOut, setHasCompletedOnboarding]);

  const handleSignIn = useCallback(() => {
    navigation.navigate('Login', {
      initialTab: 'signin',
    });
  }, [navigation]);

  const handleResetTeachingTips = useCallback(() => {
    Alert.alert(
      'Reset teaching tips?',
      'Anchor will show guidance again the next time it is useful.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Tips',
          onPress: () => {
            useTeachingStore.getState().reset();
            AnalyticsService.track('teaching_reset');
          },
        },
      ],
    );
  }, []);

  const handleTraceDefaultToggle = useCallback(
    (enabled: boolean) => {
      setTraceDefaultEnabled(enabled);
      AnalyticsService.track(
        enabled ? 'trace_default_enabled' : 'trace_default_disabled',
        { source: 'settings' }
      );
    },
    [setTraceDefaultEnabled]
  );

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your anchors and data will be deleted from our servers. \n\nImportant: Deleting your account will not cancel active subscriptions. Please cancel any active subscriptions through your App Store or Google Play account to prevent future billing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.deleteAccount();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete account';
              Alert.alert('Deletion Failed', message);
              logger.error('[SettingsScreen] Failed to delete account', error);
              return;
            }

            try {
              // Clear local data
              const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
              await writeSecureValue('anchor-sync-retry-queue', '[]');
            } catch (error) {
              logger.warn('[SettingsScreen] Failed to clear sync retry queue after account deletion', error);
            }

            await signOut();
            setHasCompletedOnboarding(false);
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              })
            );
          },
        },
      ]
    );
  }, [navigation, signOut, setHasCompletedOnboarding]);

  const handleOpenSetPassword = useCallback(() => {
    setSpEmail(accountEmail || firebaseEmail || '');
    setSpPassword('');
    setSpConfirm('');
    setSpError('');
    setSpLoading(false);
    setSpShowPass(false);
    setSpShowConfirm(false);
    setShowSetPasswordModal(true);
  }, [accountEmail, firebaseEmail]);

  const handleSubmitSetPassword = useCallback(async () => {
    if (spPassword.length < 6) {
      setSpError('Password must be at least 6 characters.');
      return;
    }
    if (spPassword !== spConfirm) {
      setSpError('Passwords do not match.');
      return;
    }
    setSpLoading(true);
    setSpError('');
    try {
      await AuthService.linkEmailPassword(spEmail, spPassword);
      setShowSetPasswordModal(false);
      Alert.alert('Password Set', 'You can now sign in with your email and password.');
    } catch (error) {
      setSpError(error instanceof Error ? error.message : 'Failed to set password.');
    } finally {
      setSpLoading(false);
    }
  }, [spEmail, spPassword, spConfirm]);

  const handleResetOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(false);
  }, [setHasCompletedOnboarding]);

  const handlePrivacyPolicy = () => {
    Linking.openURL(LEGAL_URLS.privacyPolicy);
  };

  const handleSupport = () => {
    Linking.openURL(LEGAL_URLS.support);
  };

  const handleRateAnchor = useCallback(async () => {
    const opened = await openStoreListing();
    if (!opened) {
      Alert.alert('Rate Anchor', 'The store listing is not available in this build.');
    }
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id || user.email?.trim()) {
      return;
    }

    if (firebaseEmail) {
      setUser({ ...user, email: firebaseEmail });
    }

    void fetchProfile().catch((error) => {
      logger.warn('[SettingsScreen] Failed to refresh account profile', error);
    });
  }, [fetchProfile, firebaseEmail, isAuthenticated, setUser, user]);

  const formatHourLabel = useCallback((hour: number | null | undefined) => {
    const normalizedHour = Math.max(0, Math.min(23, hour ?? 0));
    const meridiem = normalizedHour >= 12 ? 'PM' : 'AM';
    const hour12 = normalizedHour % 12 || 12;
    return `${hour12}:00 ${meridiem}`;
  }, []);

  const formatTimeLabel = useCallback((time: string | null | undefined) => {
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
    if (!match) {
      return formatHourLabel(21);
    }

    return formatHourLabel(Number(match[1]));
  }, [formatHourLabel]);

  const handleTimeSelection = useCallback(
    async (hour: number) => {
      if (timePickerTarget === 'dailyPrime') {
        await updateNotificationPreferences({
          dailyPrimeTime: `${String(hour).padStart(2, '0')}:00`,
        });
      }

      setTimePickerTarget(null);
    },
    [
      timePickerTarget,
      updateNotificationPreferences,
    ]
  );

  const cycleThreadThreshold = useCallback(() => {
    const current = notifState?.threadStrengthThreshold ?? 70;
    const next = current >= 85 ? 60 : current >= 70 ? 85 : 70;
    void updateNotificationPreferences({ threadStrengthThreshold: next });
  }, [notifState?.threadStrengthThreshold, updateNotificationPreferences]);

  const cycleNotificationTone = useCallback(() => {
    const order = ['direct', 'encouraging', 'reflective', 'performance'] as const;
    const current = notifState?.notificationTone ?? 'encouraging';
    const index = order.indexOf(current);
    const next = order[(index + 1) % order.length];
    void updateNotificationPreferences({ notificationTone: next });
  }, [notifState?.notificationTone, updateNotificationPreferences]);

  const sessionSummary =
    focusSessionMode === 'deep'
      ? `Deep Prime · ${formatDurationLabel(primeSessionDuration)} · ${primeSessionAudio === 'ambient' ? 'Ambient' : 'Silent'}`
      : `Quick Prime · ${formatDurationLabel(focusSessionDuration)} · ${focusSessionAudio === 'ambient' ? 'Ambient' : 'Silent'}`;

  const goalSummary =
    dailyPracticeGoalPreset === 'once'
      ? 'Once / day'
      : dailyPracticeGoalPreset === 'three'
        ? 'Three times / day'
        : dailyPracticeGoalPreset === 'five'
          ? 'Five times / day'
          : `Custom · ${dailyPracticeGoal} / day`;

  const threadStrengthSummary =
    threadStrengthSensitivity.charAt(0).toUpperCase() + threadStrengthSensitivity.slice(1);

  const restDaysSummary =
    restDays.length === 0
      ? 'None'
      : restDays.length === 1
        ? WEEKDAY_LABELS[restDays[0]]
        : restDays.map((day) => WEEKDAY_LABELS[day].slice(0, 3)).join(', ');

  return (
    <View style={styles.container} onLayout={handleRootLayout}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageDescription}>
            Personalize your path with Anchor&apos;s core configurations.
          </Text>

          <Text style={styles.sectionLabel}>Practice Settings</Text>
          <Text style={styles.sectionDescription}>
            Control how your anchors are created, primed, and activated.
          </Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Session Defaults"
              value={sessionSummary}
              type="chevron"
              onPress={() => navigation.navigate('SessionDefaults')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Daily Practice Goal"
              value={goalSummary}
              type="chevron"
              onPress={() => navigation.navigate('DailyPracticeGoal')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Thread Strength"
              value={threadStrengthSummary}
              type="chevron"
              onPress={() => navigation.navigate('ThreadStrength')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Rest Days"
              value={restDaysSummary}
              type="chevron"
              onPress={() => navigation.navigate('RestDays')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Hide Intention Text"
              subtitle="During priming, show only the anchor"
              type="toggle"
              toggleValue={settings.reduceIntentionVisibility}
              onToggle={(value) => updateSetting('reduceIntentionVisibility', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Trace Structures"
              subtitle="Show the tracing step by default while creating and priming."
              type="toggle"
              toggleValue={traceDefaultEnabled}
              onToggle={handleTraceDefaultToggle}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>App Behavior</Text>
          <Text style={styles.sectionDescription}>
            Tune how Anchor supports your day and nudges you back into practice.
          </Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Prime on Launch"
              subtitle="Opens directly to your practice"
              type="toggle"
              toggleValue={settings.openDailyAnchorAutomatically}
              onToggle={(value) => updateSetting('openDailyAnchorAutomatically', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Guide Mode"
              subtitle="Show helpful guidance while you create and practice."
              type="toggle"
              toggleValue={settings.practiceGuidanceEnabled}
              onToggle={(value) => {
                updateSetting('practiceGuidanceEnabled', value);
                AnalyticsService.track('guide_mode_toggled', { enabled: value });
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Reduce Motion"
              subtitle="Calm ambient animation. Follows your device setting until you change it."
              type="toggle"
              toggleValue={reduceMotionEnabled}
              onToggle={(value) => {
                setReduceMotion(value ? 'on' : 'off');
                AnalyticsService.track('reduce_motion_toggled', { enabled: value });
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Analytics"
              subtitle="Share usage and reliability signals."
              type="toggle"
              toggleValue={analyticsEnabled}
              onToggle={(value) => {
                setAnalyticsEnabled(value);
                const effectiveEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && value;
                AnalyticsService.setEnabled(effectiveEnabled);
                if (effectiveEnabled) {
                  AnalyticsService.track('analytics_opted_in', { source: 'settings' });
                }
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Reset Teaching Tips"
              subtitle="Show dismissed guidance again."
              type="chevron"
              onPress={handleResetTeachingTips}
              disabled={isLoading}
            />

            <SettingsRow
              title="Notifications"
              subtitle="Enable calm practice reminders"
              type="toggle"
              toggleValue={notifState?.notification_enabled ?? true}
              onToggle={(value) => {
                void (async () => {
                  if (!value) {
                    await toggleNotifications(false);
                    return;
                  }

                  const granted = await NotificationService.requestPermissions();
                  if (!granted) {
                    const message =
                      NotificationService.getLastError()?.message ??
                      'Please enable notifications in your device settings.';
                    Alert.alert('Notification Permission Required', message);
                    return;
                  }

                  await toggleNotifications(true);
                })();
              }}
              disabled={isLoading}
              showDivider={!(notifState?.notification_enabled ?? true)}
            />
            {notifState?.notification_enabled ? (
              <>
                <SettingsRow
                  title="Daily Prime Reminder"
                  subtitle="One reminder if no Focus Session or Deep Prime is complete"
                  type="toggle"
                  toggleValue={notifState?.dailyPrimeEnabled ?? true}
                  onToggle={(enabled) => void updateNotificationPreferences({ dailyPrimeEnabled: enabled })}
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Daily Reminder Time"
                  subtitle="The time Anchor checks whether a prime would help"
                  value={formatTimeLabel(notifState?.dailyPrimeTime ?? '21:00')}
                  type="chevron"
                  onPress={() => setTimePickerTarget('dailyPrime')}
                  disabled={isLoading || !(notifState?.dailyPrimeEnabled ?? true)}
                />
                <SettingsRow
                  title="Thread Strength Alerts"
                  subtitle="Only when Thread Strength drops below your threshold"
                  type="toggle"
                  toggleValue={notifState?.threadStrengthAlertsEnabled ?? true}
                  onToggle={(enabled) =>
                    void updateNotificationPreferences({ threadStrengthAlertsEnabled: enabled })
                  }
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Thread Threshold"
                  subtitle="Tap to change the alert threshold"
                  value={`${notifState?.threadStrengthThreshold ?? 70}%`}
                  type="chevron"
                  onPress={cycleThreadThreshold}
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Unfinished Anchor Reminders"
                  subtitle="One reminder when an anchor stays unsealed"
                  type="toggle"
                  toggleValue={notifState?.unfinishedAnchorRemindersEnabled ?? true}
                  onToggle={(enabled) =>
                    void updateNotificationPreferences({ unfinishedAnchorRemindersEnabled: enabled })
                  }
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Weekly Progress Recap"
                  subtitle="A quiet weekly summary when there is activity"
                  type="toggle"
                  toggleValue={notifState?.weeklyRecapEnabled ?? false}
                  onToggle={(enabled) =>
                    void updateNotificationPreferences({ weeklyRecapEnabled: enabled })
                  }
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Milestone Celebrations"
                  subtitle="Earned progress moments"
                  type="toggle"
                  toggleValue={notifState?.milestoneNotificationsEnabled ?? true}
                  onToggle={(enabled) =>
                    void updateNotificationPreferences({ milestoneNotificationsEnabled: enabled })
                  }
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Notification Tone"
                  subtitle="Tap to cycle the copy style"
                  value={(notifState?.notificationTone ?? 'encouraging')
                    .replace('_', ' ')
                    .replace(/^\w/, (char) => char.toUpperCase())}
                  type="chevron"
                  onPress={cycleNotificationTone}
                  disabled={isLoading}
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Appearance section removed */}

          <Text style={styles.sectionLabel}>Audio & Haptics</Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Haptic Feedback"
              value={formatHapticFeedbackLabel(settings.hapticFeedback)}
              type="chevron"
              onPress={() => navigation.navigate('HapticFeedback')}
            />
            <SettingsRow
              title="Sound"
              subtitle="Audio feedback during forge and prime sessions"
              type="toggle"
              toggleValue={settings.soundEffectsEnabled}
              onToggle={(value) => updateSetting('soundEffectsEnabled', value)}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Account</Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Email Address"
              subtitle={accountSubtitle}
              value={accountEmail || 'Not signed in'}
              type="static"
            />
            {canSetPassword ? (
              <SettingsRow
                title="Set Password"
                subtitle="Add email sign-in to your account"
                type="chevron"
                onPress={handleOpenSetPassword}
              />
            ) : null}
            {isAuthenticated ? (
              <SettingsRow title="Sign Out" type="chevron" onPress={handleSignOut} />
            ) : (
              <SettingsRow
                title="Sign In"
                subtitle="Create or reconnect your account"
                type="chevron"
                onPress={handleSignIn}
              />
            )}
            <SettingsRow
              title="Privacy Policy"
              type="chevron"
              onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}
            />
            <SettingsRow
              title="Terms of Service"
              type="chevron"
              onPress={() => void Linking.openURL(LEGAL_URLS.termsOfService)}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Legal & Support</Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Privacy Policy"
              type="chevron"
              onPress={handlePrivacyPolicy}
            />
            <SettingsRow
              title="Support"
              type="chevron"
              onPress={handleSupport}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Subscription</Text>
          <SettingsSectionBlock>
            <SettingsRow title="Current Plan" value="Active" type="static" />
            <View style={styles.benefitsRow}>
              <Text style={styles.benefitsText}>
                {'· Unlimited anchors\n· Advanced customization\n· Manual creation tools'}
              </Text>
            </View>
            <SettingsRow
              title="Manage Subscription"
              type="chevron"
              onPress={() => navigation.navigate('Paywall' as never)}
            />
            <SettingsRow
              title="Restore Purchase"
              type="chevron"
              onPress={restorePurchases}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>About Anchor</Text>
          <SettingsSectionBlock>
            <SettingsRow title="App Version" value={appVersion} type="static" />
            <SettingsRow
              title="Rate Anchor"
              subtitle="Help others discover a better way to lock in."
              type="chevron"
              onPress={() => void handleRateAnchor()}
            />
            <SettingsRow
              title="Contact Support"
              subtitle={SUPPORT_EMAIL}
              type="chevron"
              onPress={async () => {
                const supported = await Linking.canOpenURL(SUPPORT_EMAIL_URL);
                if (!supported) {
                  Alert.alert('Contact Support', 'Mail is not available on this device.');
                  return;
                }
                await Linking.openURL(SUPPORT_EMAIL_URL);
              }}
              showDivider={false}
            />
          </SettingsSectionBlock>

          {SHOW_DEVELOPER_TOOLS && DeveloperToolsSection ? (
            <DeveloperToolsSection
              resetSettings={resetSettings}
              onResetOnboarding={handleResetOnboarding}
            />
          ) : null}
          {isAuthenticated ? (
            <>
              <Text style={[styles.sectionLabel, styles.dangerLabel]}>Danger Zone</Text>
              <SettingsSectionBlock>
                <SettingsRow
                  title="Delete Account"
                  type="none"
                  titleColor="#e05252"
                  onPress={handleDeleteAccount}
                  style={styles.dangerRow}
                  showDivider={false}
                />
              </SettingsSectionBlock>
            </>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={timePickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <Pressable style={styles.hourPickerOverlay} onPress={() => setTimePickerTarget(null)}>
          <Pressable style={styles.hourPickerCard} onPress={() => {}}>
            <Text style={styles.hourPickerTitle}>
              Select Daily Reminder Time
            </Text>
            <ScrollView
              style={styles.hourPickerList}
              contentContainerStyle={styles.hourPickerListContent}
              showsVerticalScrollIndicator={false}
            >
              {Array.from({ length: 24 }, (_, hour) => {
                const activeHour = Number((notifState?.dailyPrimeTime ?? '21:00').slice(0, 2));
                const isSelected = activeHour === hour;

                return (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.hourPickerOption,
                      isSelected ? styles.hourPickerOptionActive : null,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      void handleTimeSelection(hour);
                    }}
                  >
                    <Text
                      style={[
                        styles.hourPickerOptionText,
                        isSelected ? styles.hourPickerOptionTextActive : null,
                      ]}
                    >
                      {formatHourLabel(hour)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={showSetPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSetPasswordModal(false)}
      >
        <Pressable style={styles.hourPickerOverlay} onPress={() => setShowSetPasswordModal(false)}>
          <Pressable style={styles.hourPickerCard} onPress={() => {}}>
            <Text style={styles.hourPickerTitle}>Set Password</Text>
            <Text style={styles.setPasswordSubtitle}>
              Add a password so you can also sign in with your email.
            </Text>
            <View style={styles.setPasswordFields}>
              <TextInput
                style={styles.setPasswordInput}
                value={spEmail}
                onChangeText={setSpEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Email"
                placeholderTextColor="rgba(245,245,220,0.3)"
              />
              <View style={styles.setPasswordInputRow}>
                <TextInput
                  style={[styles.setPasswordInput, styles.setPasswordInputFlex]}
                  value={spPassword}
                  onChangeText={setSpPassword}
                  secureTextEntry={!spShowPass}
                  placeholder="New password"
                  placeholderTextColor="rgba(245,245,220,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.setPasswordEye}
                  onPress={() => setSpShowPass((v) => !v)}
                >
                  <Text style={styles.setPasswordEyeText}>{spShowPass ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.setPasswordInputRow}>
                <TextInput
                  style={[styles.setPasswordInput, styles.setPasswordInputFlex]}
                  value={spConfirm}
                  onChangeText={setSpConfirm}
                  secureTextEntry={!spShowConfirm}
                  placeholder="Confirm password"
                  placeholderTextColor="rgba(245,245,220,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.setPasswordEye}
                  onPress={() => setSpShowConfirm((v) => !v)}
                >
                  <Text style={styles.setPasswordEyeText}>{spShowConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {spError ? <Text style={styles.setPasswordError}>{spError}</Text> : null}
              <TouchableOpacity
                style={[styles.setPasswordButton, spLoading && styles.setPasswordButtonDisabled]}
                onPress={() => void handleSubmitSetPassword()}
                disabled={spLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.setPasswordButtonText}>
                  {spLoading ? 'Setting...' : 'Set Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SETTINGS_SCREEN_BACKGROUND,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: SETTINGS_SCREEN_BACKGROUND,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  pageDescription: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 17,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  benefitsRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  benefitsText: {
    color: SETTINGS_MUTED_TEXT,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
  },
  dangerLabel: {
    color: '#e05252',
  },
  dangerRow: {
    backgroundColor: 'transparent',
  },
  bottomSpacer: {
    height: 32,
  },
  inlineTimePickerContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  inlineTimePickerLabel: {
    color: SETTINGS_MUTED_TEXT,
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  inlineDateTimePicker: {
    height: 120,
  },
  hourPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 12, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hourPickerCard: {
    maxHeight: '70%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: '#101822',
    paddingVertical: 20,
  },
  hourPickerTitle: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    color: colors.gold,
    fontSize: 18,
    fontFamily: 'Cinzel-Regular',
  },
  hourPickerList: {
    flexGrow: 0,
  },
  hourPickerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  hourPickerOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  hourPickerOptionActive: {
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  hourPickerOptionText: {
    color: colors.bone,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  hourPickerOptionTextActive: {
    color: colors.gold,
  },
  setPasswordSubtitle: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    color: SETTINGS_MUTED_TEXT,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  setPasswordFields: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  setPasswordInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.bone,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  setPasswordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setPasswordInputFlex: {
    flex: 1,
  },
  setPasswordEye: {
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  setPasswordEyeText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  setPasswordError: {
    color: '#e05252',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  setPasswordButton: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  setPasswordButtonDisabled: {
    opacity: 0.5,
  },
  setPasswordButtonText: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});
