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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';

import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSectionBlock } from '@/components/settings/SettingsSectionBlock';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { AuthService } from '@/services/AuthService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import NotificationService from '@/services/NotificationService';
import revenueCatService from '@/services/RevenueCatService';
import { openStoreListing } from '@/services/reviewPromptService';
import { LEGAL_URLS, SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useSettingsState } from '@/hooks/useSettings';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSettingsStore, type ReduceMotionPreference } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { colors, typography } from '@/theme';
import { logger } from '@/utils/logger';
import { formatHapticFeedbackLabel } from './shared';

const SHOW_DEVELOPER_TOOLS = __DEV__;
const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

type PickerKind = 'motion' | 'time' | null;
type ConfirmationKind = 'resetTips' | 'signOut' | 'deleteAccount' | null;

const formatHourLabel = (hour: number): string => {
  const normalizedHour = Math.max(0, Math.min(23, hour));
  const meridiem = normalizedHour >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHour % 12 || 12;
  return `${hour12}:00 ${meridiem}`;
};

const formatTimeLabel = (time: string | null | undefined): string => {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return formatHourLabel(match ? Number(match[1]) : 21);
};

const formatMotionLabel = (preference: ReduceMotionPreference): string => {
  if (preference === 'system') return 'System';
  return preference === 'on' ? 'On' : 'Off';
};

const restorePurchases = async (): Promise<void> => {
  const status = await revenueCatService.restorePurchases();
  if (status.hasActiveEntitlement) {
    Alert.alert('Purchases restored', 'Your Pro access is active again.');
  } else {
    Alert.alert(
      'No subscription found',
      'No active subscription was found for this account. If you subscribed with a different store account, switch to it and try again.',
    );
  }
};

const ChoiceSheet: React.FC<{
  visible: boolean;
  title: string;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}> = ({ visible, title, options, selectedValue, onSelect, onDismiss }) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onDismiss}
    accessibilityViewIsModal
  >
    <Pressable style={styles.sheetScrim} onPress={onDismiss}>
      <Pressable style={styles.choiceSheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView
          style={styles.choiceList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.choiceListContent}
        >
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  selected && styles.choiceRowSelected,
                  pressed && styles.choiceRowPressed,
                ]}
              >
                <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                  {option.label}
                </Text>
                <View style={[styles.radio, selected && styles.radioSelected]} />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onDismiss}
          style={styles.sheetCancel}
        >
          <Text style={styles.sheetCancelLabel}>Cancel</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>
);

const ConfirmationSheet: React.FC<{
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}> = ({
  visible,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onDismiss,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onDismiss}
    accessibilityViewIsModal
  >
    <Pressable style={styles.sheetScrim} onPress={onDismiss}>
      <Pressable
        style={styles.confirmationSheet}
        onPress={(event) => event.stopPropagation()}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.confirmationDescription}>{description}</Text>
        <View style={styles.confirmationActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onDismiss}
            style={styles.confirmationCancel}
          >
            <Text style={styles.sheetCancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={[
              styles.confirmationConfirm,
              destructive && styles.confirmationConfirmDestructive,
            ]}
          >
            <Text
              style={[
                styles.confirmationConfirmLabel,
                destructive && styles.confirmationConfirmLabelDestructive,
              ]}
            >
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { settings, updateSetting, resetSettings, isLoading } = useSettingsState();
  const reveal = useSettingsReveal();
  const frameRef = useRef<number | null>(null);
  const hasMarkedReadyRef = useRef(false);
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [confirmationKind, setConfirmationKind] = useState<ConfirmationKind>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [spEmail, setSpEmail] = useState('');
  const [spPassword, setSpPassword] = useState('');
  const [spConfirm, setSpConfirm] = useState('');
  const [spError, setSpError] = useState('');
  const [spLoading, setSpLoading] = useState(false);
  const [spShowPass, setSpShowPass] = useState(false);
  const [spShowConfirm, setSpShowConfirm] = useState(false);

  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const setTraceDefaultEnabled = useSettingsStore((state) => state.setTraceDefaultEnabled);
  const reduceMotionPreference = useSettingsStore(
    (state) => state.reduceMotion ?? 'off',
  );
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const analyticsEnabled = useSettingsStore((state) => state.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((state) => state.setAnalyticsEnabled);
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);
  const dailyPracticeGoalPreset = useSettingsStore(
    (state) => state.dailyPracticeGoalPreset ?? 'three',
  );
  const threadStrengthSensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced',
  );
  const restDays = useSettingsStore((state) => state.restDays ?? []);
  const { notifState, toggleNotifications, updateNotificationPreferences } =
    useNotificationController();
  // Keep the system preference listener active for the existing reduced-motion contract.
  useReduceMotionEnabled();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profileEmail = useAuthStore(
    (state) => state.profileData?.user?.email?.trim() ?? '',
  );
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setUser = useAuthStore((state) => state.setUser);
  const setHasCompletedOnboarding = useAuthStore(
    (state) => state.setHasCompletedOnboarding,
  );
  const signOut = useAuthStore((state) => state.signOut);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const firebaseEmail = isAuthenticated
    ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? ''
    : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;
  const accountSubtitle = isAuthenticated
    ? accountEmail
      ? 'Synced to this account'
      : 'Syncing account details…'
    : 'Not signed in';
  const canSetPassword =
    isAuthenticated && !AuthService.getLinkedProviders().includes('password');
  const remindersEnabled = notifState?.notification_enabled ?? false;
  const weeklyRecapEnabled = notifState?.weeklyRecapEnabled ?? false;
  const { isSubscribed, isTrialActive, daysRemaining } = useTrialStatus();
  const subscriptionSummary = isSubscribed
    ? 'Pro'
    : isTrialActive
      ? `Trial · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
      : 'Free';

  const DeveloperToolsSection = __DEV__
    ? require('@/components/settings/DeveloperToolsSection').DeveloperToolsSection
    : null;

  const handleRootLayout = useCallback(() => {
    if (hasMarkedReadyRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (hasMarkedReadyRef.current) return;
      hasMarkedReadyRef.current = true;
      reveal.markSettingsReady();
    });
  }, [reveal]);

  const resetToOnboarding = useCallback(() => {
    const rootNavigation = navigation.getParent() as any;
    (rootNavigation ?? navigation).dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      }),
    );
  }, [navigation]);

  const handleSignOut = useCallback(() => {
    setConfirmationKind('signOut');
  }, []);

  const confirmSignOut = useCallback(async () => {
    setConfirmationKind(null);
    try {
      AnalyticsService.track(AnalyticsEvents.SIGN_OUT, { source: 'settings' });
      await AuthService.signOut();
    } catch (error) {
      Alert.alert('Sign Out Failed', 'We could not sign you out right now.');
      logger.warn('[SettingsScreen] Failed to sign out cleanly', error);
      return;
    }

    try {
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
    } catch (error) {
      logger.warn('[SettingsScreen] Failed to clear sync retry queue on sign-out', error);
    }

    await signOut();
    setHasCompletedOnboarding(false);
    resetToOnboarding();
  }, [resetToOnboarding, setHasCompletedOnboarding, signOut]);

  const handleDeleteAccount = useCallback(() => {
    setConfirmationKind('deleteAccount');
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    setConfirmationKind(null);
    try {
      await AuthService.deleteAccount();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      Alert.alert('Deletion Failed', message);
      logger.error('[SettingsScreen] Failed to delete account', error);
      return;
    }

    try {
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
    } catch (error) {
      logger.warn(
        '[SettingsScreen] Failed to clear sync retry queue after account deletion',
        error,
      );
    }

    await signOut();
    setHasCompletedOnboarding(false);
    resetToOnboarding();
  }, [resetToOnboarding, setHasCompletedOnboarding, signOut]);

  const handleResetTeachingTips = useCallback(() => {
    setConfirmationKind('resetTips');
  }, []);

  const confirmResetTeachingTips = useCallback(() => {
    setConfirmationKind(null);
    useTeachingStore.getState().reset();
    AnalyticsService.track('teaching_reset');
  }, []);

  const handleReminderToggle = useCallback(
    (enabled: boolean) => {
      void (async () => {
        if (!enabled) {
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
    },
    [toggleNotifications],
  );

  const handleTimeSelection = useCallback(
    (hour: number) => {
      void updateNotificationPreferences({
        dailyPrimeTime: `${String(hour).padStart(2, '0')}:00`,
      });
      setPickerKind(null);
    },
    [updateNotificationPreferences],
  );

  const handleRestorePurchases = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await restorePurchases();
    } catch (error) {
      logger.warn('[SettingsScreen] Restore purchases failed', error);
      Alert.alert(
        'Restore failed',
        'We could not restore purchases right now. Check your connection and try again.',
      );
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring]);

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
  }, [spConfirm, spEmail, spPassword]);

  const openLegalUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link unavailable', 'This link could not be opened right now.');
    }
  }, []);

  const handleSupport = useCallback(async () => {
    try {
      if (await Linking.canOpenURL(SUPPORT_EMAIL_URL)) {
        await Linking.openURL(SUPPORT_EMAIL_URL);
        return;
      }
      await openLegalUrl(LEGAL_URLS.support);
    } catch {
      Alert.alert('Help & Support', 'Support is not available on this device right now.');
    }
  }, [openLegalUrl]);

  const handleRateAnchor = useCallback(async () => {
    const opened = await openStoreListing();
    if (!opened) {
      Alert.alert('Rate Anchor', 'The store listing is not available in this build.');
    }
  }, []);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || user.email?.trim()) return;
    if (firebaseEmail) setUser({ ...user, email: firebaseEmail });
    void fetchProfile().catch((error) => {
      logger.warn('[SettingsScreen] Failed to refresh account profile', error);
    });
  }, [fetchProfile, firebaseEmail, isAuthenticated, setUser, user]);

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

  const motionOptions = [
    { label: 'System default', value: 'system' },
    { label: 'On', value: 'on' },
    { label: 'Off', value: 'off' },
  ];
  const timeOptions = Array.from({ length: 24 }, (_, hour) => ({
    label: formatHourLabel(hour),
    value: String(hour),
  }));
  const activeReminderHour = Number((notifState?.dailyPrimeTime ?? '21:00').slice(0, 2));
  const confirmation =
    confirmationKind === 'resetTips'
      ? {
          title: 'Show teaching tips again?',
          description: 'Anchor will show first-use guidance again when it is useful.',
          confirmLabel: 'Reset Tips',
          onConfirm: confirmResetTeachingTips,
        }
      : confirmationKind === 'signOut'
        ? {
            title: 'Sign out of Anchor?',
            description: 'You can sign back in at any time to continue your practice.',
            confirmLabel: 'Sign Out',
            onConfirm: () => void confirmSignOut(),
          }
        : confirmationKind === 'deleteAccount'
          ? {
              title: 'Delete your account?',
              description:
                'This action is permanent and cannot be undone. All your Anchors and data will be deleted from our servers. Deleting your account will not cancel active subscriptions; cancel them through your App Store or Google Play account to prevent future billing.',
              confirmLabel: 'Delete Account',
              destructive: true,
              onConfirm: () => void confirmDeleteAccount(),
            }
          : null;

  return (
    <View style={styles.container} onLayout={handleRootLayout}>
      <LinearGradient
        colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.purpleGlow} />
      <View pointerEvents="none" style={styles.goldGlow} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Profile"
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.headerButton}
          >
            <ArrowLeft color={colors.anchor15.ash} size={19} strokeWidth={1.5} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageIntro}>A quiet place to shape how Anchor meets you.</Text>

          <Text style={styles.sectionLabel}>PRACTICE</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Session Defaults"
              value="Duration · Voice · Audio"
              type="chevron"
              onPress={() => navigation.navigate('SessionDefaults')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Anchor Tracing"
              subtitle="Offer tracing during creation and after Practice."
              type="toggle"
              toggleValue={traceDefaultEnabled}
              onToggle={(value) => {
                setTraceDefaultEnabled(value);
                AnalyticsService.track(
                  value ? 'trace_default_enabled' : 'trace_default_disabled',
                  { source: 'settings' },
                );
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Haptic Feedback"
              value={formatHapticFeedbackLabel(settings.hapticFeedback)}
              type="chevron"
              onPress={() => navigation.navigate('HapticFeedback')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Sound Effects"
              subtitle="Interface and Practice sound effects."
              type="toggle"
              toggleValue={settings.soundEffectsEnabled}
              onToggle={(value) => void updateSetting('soundEffectsEnabled', value)}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>EXPERIENCE</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Open to Practice"
              subtitle="Open directly to Practice when you return."
              type="toggle"
              toggleValue={settings.openDailyAnchorAutomatically}
              onToggle={(value) => void updateSetting('openDailyAnchorAutomatically', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Reduce Motion"
              value={formatMotionLabel(reduceMotionPreference)}
              type="chevron"
              onPress={() => setPickerKind('motion')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Reset Teaching Tips"
              subtitle="Show first-use guidance again."
              type="chevron"
              onPress={handleResetTeachingTips}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>REMINDERS</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Practice Reminders"
              subtitle="Receive quiet reminders to return to your Anchor."
              type="toggle"
              toggleValue={remindersEnabled}
              onToggle={handleReminderToggle}
              disabled={isLoading || notifState == null}
            />
            <SettingsRow
              title="Reminder Time"
              value={formatTimeLabel(notifState?.dailyPrimeTime ?? '21:00')}
              type="chevron"
              onPress={() => setPickerKind('time')}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Weekly Recap"
              subtitle="A quiet weekly summary when there is activity."
              type="toggle"
              toggleValue={weeklyRecapEnabled}
              onToggle={(enabled) => void updateNotificationPreferences({ weeklyRecapEnabled: enabled })}
              disabled={isLoading || !remindersEnabled}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Email Address"
              subtitle={accountSubtitle}
              value={accountEmail || 'Not signed in'}
              type="static"
            />
            {canSetPassword ? (
              <SettingsRow
                title="Set Password"
                subtitle="Add email sign-in to your account."
                type="chevron"
                onPress={handleOpenSetPassword}
              />
            ) : null}
            {!isAuthenticated ? (
              <SettingsRow
                title="Sign In"
                subtitle="Create or reconnect your account"
                type="chevron"
                onPress={() => navigation.navigate('Login', { initialTab: 'signin' })}
              />
            ) : null}
            <SettingsRow
              title="Subscription"
              value={subscriptionSummary}
              type="chevron"
              onPress={() => navigation.navigate('Paywall' as never)}
            />
            <SettingsRow
              title="Restore Purchases"
              value={isRestoring ? 'Restoring…' : undefined}
              type="chevron"
              onPress={() => void handleRestorePurchases()}
              disabled={isRestoring}
            />
            <SettingsRow
              title="Export My Data"
              subtitle="Open the native data export and sharing flow."
              type="chevron"
              onPress={() => navigation.navigate('DataPrivacy')}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>SUPPORT & PRIVACY</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Analytics"
              subtitle="Help improve Anchor with anonymous usage data."
              type="toggle"
              toggleValue={analyticsEnabled}
              onToggle={(enabled) => {
                setAnalyticsEnabled(enabled);
                const effectiveEnabled =
                  process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && enabled;
                AnalyticsService.setEnabled(effectiveEnabled);
                if (effectiveEnabled) {
                  AnalyticsService.track('analytics_opted_in', { source: 'settings' });
                }
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Help & Support"
              value={SUPPORT_EMAIL}
              type="chevron"
              onPress={() => void handleSupport()}
            />
            <SettingsRow
              title="Rate Anchor"
              type="chevron"
              onPress={() => void handleRateAnchor()}
            />
            <SettingsRow
              title="Privacy Policy"
              type="chevron"
              onPress={() => void openLegalUrl(LEGAL_URLS.privacyPolicy)}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.nativeSectionLabel}>NATIVE PRACTICE DETAILS</Text>
          <Text style={styles.nativeSectionNote}>
            Additional practice controls remain available here for existing workflows.
          </Text>
          <Text style={styles.sectionLabel}>REMINDER DETAILS</Text>
          <SettingsSectionBlock flat>
            <SettingsRow
              title="Daily Prime Reminder"
              subtitle="One reminder if no Focus Session or Deep Prime is complete."
              type="toggle"
              toggleValue={notifState?.dailyPrimeEnabled ?? true}
              onToggle={(enabled) => void updateNotificationPreferences({ dailyPrimeEnabled: enabled })}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Thread Strength Alerts"
              subtitle="Only when Thread Strength drops below your threshold."
              type="toggle"
              toggleValue={notifState?.threadStrengthAlertsEnabled ?? true}
              onToggle={(enabled) => void updateNotificationPreferences({ threadStrengthAlertsEnabled: enabled })}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Thread Threshold"
              value={`${notifState?.threadStrengthThreshold ?? 70}%`}
              type="chevron"
              onPress={() => {
                const current = notifState?.threadStrengthThreshold ?? 70;
                const next = current >= 85 ? 60 : current >= 70 ? 85 : 70;
                void updateNotificationPreferences({ threadStrengthThreshold: next });
              }}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Unfinished Anchor Reminders"
              subtitle="One reminder when an Anchor stays unsealed."
              type="toggle"
              toggleValue={notifState?.unfinishedAnchorRemindersEnabled ?? true}
              onToggle={(enabled) => void updateNotificationPreferences({ unfinishedAnchorRemindersEnabled: enabled })}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Milestone Celebrations"
              subtitle="Earned progress moments."
              type="toggle"
              toggleValue={notifState?.milestoneNotificationsEnabled ?? true}
              onToggle={(enabled) => void updateNotificationPreferences({ milestoneNotificationsEnabled: enabled })}
              disabled={isLoading || !remindersEnabled}
            />
            <SettingsRow
              title="Notification Tone"
              value={(notifState?.notificationTone ?? 'encouraging')
                .replace('_', ' ')
                .replace(/^\w/, (char) => char.toUpperCase())}
              type="chevron"
              onPress={() => {
                const order = ['direct', 'encouraging', 'reflective', 'performance'] as const;
                const current = notifState?.notificationTone ?? 'encouraging';
                const next = order[(order.indexOf(current) + 1) % order.length];
                void updateNotificationPreferences({ notificationTone: next });
              }}
              disabled={isLoading || !remindersEnabled}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>MORE PRACTICE</Text>
          <SettingsSectionBlock flat>
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
              title="Guide Mode"
              subtitle="Show helpful guidance while you create and practice."
              type="toggle"
              toggleValue={settings.practiceGuidanceEnabled}
              onToggle={(value) => {
                void updateSetting('practiceGuidanceEnabled', value);
                AnalyticsService.track('guide_mode_toggled', { enabled: value });
              }}
              disabled={isLoading}
            />
            <SettingsRow
              title="Hide Intention Text"
              subtitle="During priming, show only the Anchor."
              type="toggle"
              toggleValue={settings.reduceIntentionVisibility}
              onToggle={(value) => void updateSetting('reduceIntentionVisibility', value)}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          {SHOW_DEVELOPER_TOOLS && DeveloperToolsSection ? (
            <DeveloperToolsSection
              resetSettings={resetSettings}
              onResetOnboarding={() => setHasCompletedOnboarding(false)}
            />
          ) : null}

          {isAuthenticated ? (
            <>
              <Text style={[styles.sectionLabel, styles.dangerLabel]}>DANGER / ACCOUNT ACTIONS</Text>
              <SettingsSectionBlock flat style={styles.dangerBlock}>
                <SettingsRow
                  title="Sign Out"
                  type="chevron"
                  onPress={handleSignOut}
                  titleColor={colors.anchor15.ash}
                />
                <SettingsRow
                  title="Delete Account"
                  type="none"
                  titleColor="#c87878"
                  onPress={handleDeleteAccount}
                  showDivider={false}
                />
              </SettingsSectionBlock>
            </>
          ) : null}

          <Text style={styles.footerVersion}>{`Version ${appVersion}`}</Text>
        </ScrollView>
      </SafeAreaView>

      <ChoiceSheet
        visible={pickerKind === 'motion'}
        title="Reduce Motion"
        options={motionOptions}
        selectedValue={reduceMotionPreference}
        onSelect={(value) => {
          setReduceMotion(value as ReduceMotionPreference);
          setPickerKind(null);
        }}
        onDismiss={() => setPickerKind(null)}
      />
      <ChoiceSheet
        visible={pickerKind === 'time'}
        title="Reminder Time"
        options={timeOptions}
        selectedValue={String(activeReminderHour)}
        onSelect={(value) => handleTimeSelection(Number(value))}
        onDismiss={() => setPickerKind(null)}
      />

      <ConfirmationSheet
        visible={confirmation !== null}
        title={confirmation?.title ?? ''}
        description={confirmation?.description ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        destructive={confirmation?.destructive}
        onConfirm={confirmation?.onConfirm ?? (() => setConfirmationKind(null))}
        onDismiss={() => setConfirmationKind(null)}
      />

      <Modal
        visible={showSetPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSetPasswordModal(false)}
        accessibilityViewIsModal
      >
        <Pressable style={styles.sheetScrim} onPress={() => setShowSetPasswordModal(false)}>
          <Pressable style={styles.passwordSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set Password</Text>
            <Text style={styles.passwordSubtitle}>
              Add a password so you can also sign in with your email.
            </Text>
            <TextInput
              style={styles.passwordInput}
              value={spEmail}
              onChangeText={setSpEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Email"
              placeholderTextColor="rgba(244,239,230,0.32)"
            />
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.passwordInput, styles.passwordInputFlex]}
                value={spPassword}
                onChangeText={setSpPassword}
                secureTextEntry={!spShowPass}
                placeholder="New password"
                placeholderTextColor="rgba(244,239,230,0.32)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.passwordEye} onPress={() => setSpShowPass((value) => !value)}>
                <Text style={styles.passwordEyeText}>{spShowPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.passwordInput, styles.passwordInputFlex]}
                value={spConfirm}
                onChangeText={setSpConfirm}
                secureTextEntry={!spShowConfirm}
                placeholder="Confirm password"
                placeholderTextColor="rgba(244,239,230,0.32)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.passwordEye} onPress={() => setSpShowConfirm((value) => !value)}>
                <Text style={styles.passwordEyeText}>{spShowConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {spError ? <Text style={styles.passwordError}>{spError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set Password"
              disabled={spLoading}
              onPress={() => void handleSubmitSetPassword()}
              style={[styles.passwordButton, spLoading && styles.passwordButtonDisabled]}
            >
              <Text style={styles.passwordButtonText}>{spLoading ? 'Setting…' : 'Set Password'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setShowSetPasswordModal(false)}
              style={styles.sheetCancel}
            >
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  purpleGlow: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    top: -160,
    right: -130,
    backgroundColor: 'rgba(61,32,96,0.22)',
  },
  goldGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -175,
    left: -110,
    backgroundColor: 'rgba(217,179,108,0.06)',
  },
  header: {
    height: 54,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.ritual,
    fontSize: 14,
    letterSpacing: 1.1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 52,
  },
  pageIntro: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 9,
    marginBottom: 19,
  },
  sectionLabel: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    letterSpacing: 2.1,
    marginTop: 24,
    marginBottom: 4,
  },
  dangerLabel: {
    color: '#b77d7d',
  },
  nativeSectionLabel: {
    color: colors.anchor15.gilt,
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    letterSpacing: 2.1,
    marginTop: 28,
    marginBottom: 5,
  },
  nativeSectionNote: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 2,
  },
  dangerBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200,120,120,0.25)',
  },
  footerVersion: {
    color: 'rgba(135,147,157,0.6)',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 36,
  },
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,6,12,0.72)',
  },
  choiceSheet: {
    maxHeight: '74%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 20,
  },
  passwordSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 24,
  },
  confirmationSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(244,239,230,0.22)',
    marginBottom: 15,
  },
  sheetTitle: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 24,
    lineHeight: 29,
    textAlign: 'center',
    marginBottom: 10,
  },
  choiceList: {
    maxHeight: 390,
  },
  choiceListContent: {
    paddingBottom: 8,
  },
  choiceRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.anchor15.hairline,
  },
  choiceRowSelected: {
    backgroundColor: 'rgba(217,179,108,0.06)',
  },
  choiceRowPressed: {
    opacity: 0.68,
  },
  choiceLabel: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.serif,
    fontSize: 15,
  },
  choiceLabelSelected: {
    color: colors.anchor15.giltBright,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(242,223,168,0.38)',
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: colors.anchor15.gilt,
  },
  sheetCancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },
  sheetCancelLabel: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
  },
  confirmationDescription: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginHorizontal: 6,
    marginBottom: 18,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmationCancel: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
  },
  confirmationConfirm: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217,179,108,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,179,108,0.34)',
  },
  confirmationConfirmDestructive: {
    backgroundColor: 'rgba(199,123,98,0.12)',
    borderColor: 'rgba(199,123,98,0.42)',
  },
  confirmationConfirmLabel: {
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  confirmationConfirmLabelDestructive: {
    color: '#d18b82',
  },
  passwordSubtitle: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 15,
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  passwordInput: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,179,108,0.26)',
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 14,
    paddingHorizontal: 13,
    borderRadius: 4,
  },
  passwordInputFlex: {
    flex: 1,
    paddingRight: 66,
  },
  passwordEye: {
    position: 'absolute',
    right: 10,
    padding: 8,
  },
  passwordEyeText: {
    color: colors.anchor15.gilt,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
  },
  passwordError: {
    color: '#d78989',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12,
    marginTop: 10,
  },
  passwordButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.anchor15.gilt,
    marginTop: 18,
  },
  passwordButtonDisabled: {
    opacity: 0.55,
  },
  passwordButtonText: {
    color: colors.anchor15.ink,
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
