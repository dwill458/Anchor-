import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
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
import { LEGAL_URLS, SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSettingsState } from '@/hooks/useSettings';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { apiClient } from '@/services/ApiClient';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { AuthService } from '@/services/AuthService';
import NotificationService from '@/services/NotificationService';
import revenueCatService from '@/services/RevenueCatService';
import { openStoreListing } from '@/services/reviewPromptService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, type ReduceMotionPreference } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { colors, typography } from '@/theme';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { formatHapticFeedbackLabel } from './shared';
import { logger } from '@/utils/logger';

type PickerKind = 'motion' | 'reminderTime' | 'haptics' | null;
type ConfirmationKind = 'resetTips' | 'signOut' | 'deleteAccount' | null;

const formatHourLabel = (hour: number): string => {
  const normalized = Math.max(0, Math.min(23, hour));
  const meridiem = normalized >= 12 ? 'PM' : 'AM';
  return `${normalized % 12 || 12}:00 ${meridiem}`;
};

const formatTimeLabel = (time: string | null | undefined): string => {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return formatHourLabel(match ? Number(match[1]) : 21);
};

const formatMotionLabel = (preference: ReduceMotionPreference): string => {
  if (preference === 'system') return 'Device Setting';
  return preference === 'on' ? 'Reduced' : 'Full';
};

const ChoiceSheet: React.FC<{
  visible: boolean;
  title: string;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
  reduceMotion: boolean;
  onDismiss: () => void;
  onSelect: (value: string) => void;
}> = ({ visible, title, options, selectedValue, reduceMotion, onDismiss, onSelect }) => (
  <Modal
    visible={visible}
    transparent
    animationType={reduceMotion ? 'none' : 'slide'}
    accessibilityViewIsModal
    onRequestClose={onDismiss}
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
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{option.label}</Text>
                <View style={[styles.radio, selected && styles.radioSelected]} />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onDismiss} style={styles.sheetCancel}>
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
  reduceMotion: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}> = ({
  visible,
  title,
  description,
  confirmLabel,
  destructive = false,
  reduceMotion,
  onDismiss,
  onConfirm,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType={reduceMotion ? 'none' : 'slide'}
    accessibilityViewIsModal
    onRequestClose={onDismiss}
  >
    <Pressable style={styles.sheetScrim} onPress={onDismiss}>
      <Pressable style={styles.confirmationSheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.confirmationDescription}>{description}</Text>
        <View style={styles.confirmationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onDismiss} style={styles.confirmationCancel}>
            <Text style={styles.sheetCancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={[styles.confirmationConfirm, destructive && styles.confirmationConfirmDestructive]}
          >
            <Text style={[styles.confirmationConfirmLabel, destructive && styles.confirmationConfirmLabelDestructive]}>
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
  const { settings, updateSetting, isLoading } = useSettingsState();
  const reveal = useSettingsReveal();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profileEmail = useAuthStore((state) => state.profileData?.user?.email?.trim() ?? '');
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setUser = useAuthStore((state) => state.setUser);
  const setHasCompletedOnboarding = useAuthStore((state) => state.setHasCompletedOnboarding);
  const signOut = useAuthStore((state) => state.signOut);
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const setTraceDefaultEnabled = useSettingsStore((state) => state.setTraceDefaultEnabled);
  const reduceMotionPreference = useSettingsStore((state) => state.reduceMotion ?? 'system');
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const analyticsEnabled = useSettingsStore((state) => state.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((state) => state.setAnalyticsEnabled);
  const { notifState, toggleNotifications, updateNotificationPreferences } = useNotificationController();
  const { isSubscribed, isTrialActive, daysRemaining } = useTrialStatus();
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [confirmationKind, setConfirmationKind] = useState<ConfirmationKind>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [spEmail, setSpEmail] = useState('');
  const [spPassword, setSpPassword] = useState('');
  const [spConfirm, setSpConfirm] = useState('');
  const [spError, setSpError] = useState('');
  const [spLoading, setSpLoading] = useState(false);
  const [spShowPass, setSpShowPass] = useState(false);
  const [spShowConfirm, setSpShowConfirm] = useState(false);
  const frameRef = useRef<number | null>(null);
  const hasMarkedReadyRef = useRef(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const firebaseEmail = isAuthenticated ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? '' : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;
  const canSetPassword = isAuthenticated && !AuthService.getLinkedProviders().includes('password');
  const remindersEnabled = notifState?.notification_enabled ?? false;
  const weeklyRecapEnabled = notifState?.weeklyRecapEnabled ?? false;
  const subscriptionSummary = isSubscribed
    ? 'Pro'
    : isTrialActive
      ? `Trial · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
      : 'Free';

  const markReady = useCallback(() => {
    if (hasMarkedReadyRef.current || frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      hasMarkedReadyRef.current = true;
      reveal.markSettingsReady();
    });
  }, [reveal]);

  const resetToOnboarding = useCallback(() => {
    const rootNavigation = navigation.getParent() as any;
    (rootNavigation ?? navigation).dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] }),
    );
  }, [navigation]);

  const confirmSignOut = useCallback(async () => {
    setConfirmationKind(null);
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

  const confirmDeleteAccount = useCallback(async () => {
    setConfirmationKind(null);
    try {
      await AuthService.deleteAccount();
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
      await signOut();
      setHasCompletedOnboarding(false);
      resetToOnboarding();
    } catch (error) {
      logger.error('[SettingsScreen] Failed to delete account', error);
      Alert.alert('Deletion Failed', error instanceof Error ? error.message : 'Failed to delete account.');
    }
  }, [resetToOnboarding, setHasCompletedOnboarding, signOut]);

  const confirmResetTeachingTips = useCallback(() => {
    setConfirmationKind(null);
    useTeachingStore.getState().reset();
    AnalyticsService.track('teaching_reset');
  }, []);

  const handleReminderToggle = useCallback((enabled: boolean) => {
    void (async () => {
      if (!enabled) {
        await toggleNotifications(false);
        return;
      }
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Notification Permission Required',
          NotificationService.getLastError()?.message ?? 'Please enable notifications in your device settings.',
        );
        return;
      }
      await toggleNotifications(true);
    })();
  }, [toggleNotifications]);

  const handleRestorePurchases = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const status = await revenueCatService.restorePurchases();
      Alert.alert(
        status.hasActiveEntitlement ? 'Purchases restored' : 'No subscription found',
        status.hasActiveEntitlement
          ? 'Your Pro access is active again.'
          : 'No active subscription was found for this account. If you subscribed with a different store account, switch to it and try again.',
      );
    } catch (error) {
      logger.warn('[SettingsScreen] Restore purchases failed', error);
      Alert.alert('Restore failed', 'We could not restore purchases right now. Check your connection and try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring]);

  const handleExportMyData = useCallback(() => {
    if (isExporting) return;
    Alert.alert('Export My Data', 'Prepare a JSON export of your Anchors, sessions, settings, and account activity to share or save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Export',
        onPress: () => void (async () => {
          setIsExporting(true);
          try {
            const response = await apiClient.get<{ success: boolean; data?: unknown }>('/auth/me/export');
            if (!response.data?.success || !response.data.data) throw new Error('Failed to prepare export');
            await Share.share({ title: 'Anchor Data Export', message: JSON.stringify(response.data.data, null, 2) });
          } catch (error) {
            logger.warn('[SettingsScreen] Failed to export user data', error);
            Alert.alert('Export Failed', 'Could not prepare your export. Please try again or contact support.');
          } finally {
            setIsExporting(false);
          }
        })(),
      },
    ]);
  }, [isExporting]);

  const openUrl = useCallback(async (url: string) => {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error('Unsupported URL');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link unavailable', 'This link could not be opened right now.');
    }
  }, []);

  const handleSupport = useCallback(async () => {
    if (await Linking.canOpenURL(SUPPORT_EMAIL_URL)) {
      await Linking.openURL(SUPPORT_EMAIL_URL);
      return;
    }
    await openUrl(LEGAL_URLS.support);
  }, [openUrl]);

  const handleSetPassword = useCallback(async () => {
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

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || user.email?.trim()) return;
    if (firebaseEmail) setUser({ ...user, email: firebaseEmail });
    void fetchProfile().catch((error) => logger.warn('[SettingsScreen] Failed to refresh account profile', error));
  }, [fetchProfile, firebaseEmail, isAuthenticated, setUser, user]);

  const motionOptions = [
    { label: 'Device Setting', value: 'system' },
    { label: 'Reduced', value: 'on' },
    { label: 'Full', value: 'off' },
  ];
  const timeOptions = Array.from({ length: 24 }, (_, hour) => ({ label: formatHourLabel(hour), value: String(hour) }));
  const hapticOptions = [
    { label: 'Strong', value: 'strong' },
    { label: 'Standard', value: 'medium' },
    { label: 'Soft', value: 'light' },
  ];
  const activeReminderHour = Number((notifState?.dailyPrimeTime ?? '21:00').slice(0, 2));
  const confirmation = confirmationKind === 'resetTips'
    ? { title: 'Show teaching tips again?', description: 'Anchor will show first-use guidance again when it is useful.', confirmLabel: 'Reset Tips', onConfirm: confirmResetTeachingTips }
    : confirmationKind === 'signOut'
      ? { title: 'Sign out of Anchor?', description: 'You can sign back in at any time to continue your practice.', confirmLabel: 'Sign Out', onConfirm: () => void confirmSignOut() }
      : confirmationKind === 'deleteAccount'
        ? { title: 'Delete your account?', description: 'This action is permanent and cannot be undone. All your Anchors and data will be deleted from our servers. Deleting your account will not cancel active subscriptions; cancel them through your App Store or Google Play account to prevent future billing.', confirmLabel: 'Delete Account', destructive: true, onConfirm: () => void confirmDeleteAccount() }
        : null;

  return (
    <View style={styles.container} onLayout={markReady}>
      <LinearGradient colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={styles.goldAmbient} />
      <View pointerEvents="none" style={styles.topArc} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={() => navigation.goBack()} style={styles.headerButton}>
            <ArrowLeft color={colors.anchor15.ash} size={19} strokeWidth={1.4} />
          </Pressable>
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>PRACTICE</Text>
          <SettingsSectionBlock flat>
            <SettingsRow title="Session Defaults" value="Duration · Voice · Audio" type="chevron" onPress={() => navigation.navigate('SessionDefaults')} disabled={isLoading} />
            <SettingsRow title="Anchor Tracing" subtitle="Offer tracing during creation and after Practice." type="toggle" toggleValue={traceDefaultEnabled} onToggle={(value) => { setTraceDefaultEnabled(value); AnalyticsService.track(value ? 'trace_default_enabled' : 'trace_default_disabled', { source: 'settings' }); }} disabled={isLoading} />
            <SettingsRow title="Haptic Feedback" value={formatHapticFeedbackLabel(settings.hapticFeedback)} type="chevron" onPress={() => setPickerKind('haptics')} disabled={isLoading} />
            <SettingsRow title="Sound Effects" subtitle="Interface and Practice sound effects." type="toggle" toggleValue={settings.soundEffectsEnabled} onToggle={(value) => void updateSetting('soundEffectsEnabled', value)} disabled={isLoading} showDivider={false} />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>EXPERIENCE</Text>
          <SettingsSectionBlock flat>
            <SettingsRow title="Open to Practice" subtitle="Open directly to Practice when you return." type="toggle" toggleValue={settings.openDailyAnchorAutomatically} onToggle={(value) => void updateSetting('openDailyAnchorAutomatically', value)} disabled={isLoading} />
            <SettingsRow title="Reduce Motion" value={formatMotionLabel(reduceMotionPreference)} type="chevron" onPress={() => setPickerKind('motion')} disabled={isLoading} />
            <SettingsRow title="Reset Teaching Tips" subtitle="Show first-use guidance again." type="chevron" onPress={() => setConfirmationKind('resetTips')} disabled={isLoading} showDivider={false} />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>REMINDERS</Text>
          <SettingsSectionBlock flat>
            <SettingsRow title="Practice Reminders" subtitle="Receive quiet reminders to return to your Anchor." type="toggle" toggleValue={remindersEnabled} onToggle={handleReminderToggle} disabled={isLoading || notifState == null} />
            <SettingsRow title="Reminder Time" value={formatTimeLabel(notifState?.dailyPrimeTime)} type="chevron" onPress={() => setPickerKind('reminderTime')} disabled={isLoading || !remindersEnabled} />
            <SettingsRow title="Weekly Recap" subtitle="A quiet weekly summary when there is activity." type="toggle" toggleValue={weeklyRecapEnabled} onToggle={(value) => void updateNotificationPreferences({ weeklyRecapEnabled: value })} disabled={isLoading || !remindersEnabled} showDivider={false} />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <SettingsSectionBlock flat>
            <SettingsRow title="Email Address" subtitle={isAuthenticated ? 'Synced to this account' : 'Not signed in'} value={accountEmail || 'Not signed in'} type="static" />
            {canSetPassword ? <SettingsRow title="Set Password" subtitle="Add email sign-in to your account." type="chevron" onPress={() => { setSpEmail(accountEmail || firebaseEmail); setSpPassword(''); setSpConfirm(''); setSpError(''); setShowSetPasswordModal(true); }} /> : null}
            {!isAuthenticated ? <SettingsRow title="Sign In" subtitle="Create or reconnect your account" type="chevron" onPress={() => navigation.navigate('Login', { initialTab: 'signin' })} /> : null}
            <SettingsRow
              title="Subscription"
              value={subscriptionSummary}
              type="chevron"
              onPress={() => navigation.getParent()?.navigate('Paywall' as never)}
            />
            <SettingsRow title="Restore Purchases" value={isRestoring ? 'Restoring…' : undefined} type="chevron" onPress={() => void handleRestorePurchases()} disabled={isRestoring} />
            <SettingsRow title="Export My Data" subtitle={isExporting ? 'Preparing your JSON export…' : 'Share a copy of your account data.'} value={isExporting ? 'Preparing…' : undefined} type="chevron" onPress={handleExportMyData} disabled={isExporting} showDivider={false} />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>SUPPORT & PRIVACY</Text>
          <SettingsSectionBlock flat>
            <SettingsRow title="Analytics" subtitle="Help improve Anchor with anonymous usage data." type="toggle" toggleValue={analyticsEnabled} onToggle={(value) => { setAnalyticsEnabled(value); const enabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && value; AnalyticsService.setEnabled(enabled); if (enabled) AnalyticsService.track('analytics_opted_in', { source: 'settings' }); }} disabled={isLoading} />
            <SettingsRow title="Help & Support" value={SUPPORT_EMAIL} type="chevron" onPress={() => void handleSupport()} />
            <SettingsRow title="Rate Anchor" type="chevron" onPress={() => void openStoreListing()} />
            <SettingsRow title="Privacy Policy" type="chevron" onPress={() => void openUrl(LEGAL_URLS.privacyPolicy)} showDivider={false} />
          </SettingsSectionBlock>

          {isAuthenticated ? <>
            <Text style={[styles.sectionLabel, styles.accountActionsLabel]}>ACCOUNT ACTIONS</Text>
            <SettingsSectionBlock flat style={styles.accountActions}>
              <SettingsRow title="Sign Out" type="chevron" titleColor={colors.anchor15.ash} onPress={() => setConfirmationKind('signOut')} />
              <SettingsRow title="Delete Account" type="none" titleColor="#D5968C" onPress={() => setConfirmationKind('deleteAccount')} showDivider={false} />
            </SettingsSectionBlock>
          </> : null}
          <Text style={styles.versionText}>{`Version ${appVersion}`}</Text>
        </ScrollView>
      </SafeAreaView>

      <ChoiceSheet visible={pickerKind === 'motion'} title="Reduce Motion" options={motionOptions} selectedValue={reduceMotionPreference} reduceMotion={reduceMotionEnabled} onDismiss={() => setPickerKind(null)} onSelect={(value) => { setReduceMotion(value as ReduceMotionPreference); setPickerKind(null); }} />
      <ChoiceSheet visible={pickerKind === 'reminderTime'} title="Reminder Time" options={timeOptions} selectedValue={String(activeReminderHour)} reduceMotion={reduceMotionEnabled} onDismiss={() => setPickerKind(null)} onSelect={(value) => { void updateNotificationPreferences({ dailyPrimeTime: `${String(Number(value)).padStart(2, '0')}:00` }); setPickerKind(null); }} />
      <ChoiceSheet visible={pickerKind === 'haptics'} title="Haptic Feedback" options={hapticOptions} selectedValue={settings.hapticFeedback} reduceMotion={reduceMotionEnabled} onDismiss={() => setPickerKind(null)} onSelect={(value) => { void updateSetting('hapticFeedback', value as 'strong' | 'medium' | 'light'); setPickerKind(null); }} />
      <ConfirmationSheet visible={confirmation !== null} title={confirmation?.title ?? ''} description={confirmation?.description ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Confirm'} destructive={confirmation?.destructive} reduceMotion={reduceMotionEnabled} onDismiss={() => setConfirmationKind(null)} onConfirm={confirmation?.onConfirm ?? (() => setConfirmationKind(null))} />

      <Modal visible={showSetPasswordModal} transparent animationType={reduceMotionEnabled ? 'none' : 'slide'} accessibilityViewIsModal onRequestClose={() => setShowSetPasswordModal(false)}>
        <Pressable style={styles.sheetScrim} onPress={() => setShowSetPasswordModal(false)}>
          <Pressable style={styles.passwordSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set Password</Text>
            <Text style={styles.passwordSubtitle}>Add a password so you can also sign in with your email.</Text>
            <TextInput style={styles.passwordInput} value={spEmail} onChangeText={setSpEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="Email" placeholderTextColor="rgba(244,239,230,0.32)" />
            <View style={styles.passwordInputRow}><TextInput style={[styles.passwordInput, styles.passwordInputFlex]} value={spPassword} onChangeText={setSpPassword} secureTextEntry={!spShowPass} placeholder="New password" placeholderTextColor="rgba(244,239,230,0.32)" /><TouchableOpacity onPress={() => setSpShowPass((value) => !value)} style={styles.passwordEye}><Text style={styles.passwordEyeText}>{spShowPass ? 'Hide' : 'Show'}</Text></TouchableOpacity></View>
            <View style={styles.passwordInputRow}><TextInput style={[styles.passwordInput, styles.passwordInputFlex]} value={spConfirm} onChangeText={setSpConfirm} secureTextEntry={!spShowConfirm} placeholder="Confirm password" placeholderTextColor="rgba(244,239,230,0.32)" /><TouchableOpacity onPress={() => setSpShowConfirm((value) => !value)} style={styles.passwordEye}><Text style={styles.passwordEyeText}>{spShowConfirm ? 'Hide' : 'Show'}</Text></TouchableOpacity></View>
            {spError ? <Text style={styles.passwordError}>{spError}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Set Password" disabled={spLoading} onPress={() => void handleSetPassword()} style={[styles.primarySheetButton, spLoading && styles.disabledButton]}><Text style={styles.primarySheetButtonLabel}>{spLoading ? 'Setting…' : 'Set Password'}</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.anchor15.ink },
  safeArea: { flex: 1 },
  goldAmbient: { position: 'absolute', top: -220, left: -110, width: 365, height: 365, borderRadius: 183, backgroundColor: 'rgba(217,179,108,0.055)' },
  topArc: { position: 'absolute', top: -442, left: -250, width: 620, height: 620, borderRadius: 310, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.09)' },
  header: { height: 54, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 12, letterSpacing: 2.0 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 52 },
  sectionLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.15, marginTop: 27, marginBottom: 8 },
  accountActionsLabel: { color: '#B9827C' },
  accountActions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,150,140,0.22)' },
  versionText: { color: 'rgba(135,147,157,0.62)', fontFamily: typography.fontFamily.instrument, fontSize: 10, letterSpacing: 0.5, textAlign: 'center', marginTop: 38 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,6,12,0.76)' },
  choiceSheet: { maxHeight: '76%', paddingHorizontal: 22, paddingTop: 13, paddingBottom: 20, backgroundColor: colors.anchor15.veil, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline },
  confirmationSheet: { paddingHorizontal: 22, paddingTop: 13, paddingBottom: 24, backgroundColor: colors.anchor15.veil, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline },
  passwordSheet: { paddingHorizontal: 22, paddingTop: 13, paddingBottom: 24, backgroundColor: colors.anchor15.veil, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: 'rgba(244,239,230,0.22)', marginBottom: 15 },
  sheetTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 24, lineHeight: 29, textAlign: 'center', marginBottom: 10 },
  choiceList: { maxHeight: 390 },
  choiceListContent: { paddingBottom: 8 },
  choiceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.anchor15.hairline },
  choiceRowSelected: { backgroundColor: 'rgba(217,179,108,0.06)' },
  choiceLabel: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 17 },
  choiceLabelSelected: { color: colors.anchor15.giltBright },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(242,223,168,0.38)' },
  radioSelected: { borderWidth: 5, borderColor: colors.anchor15.gilt },
  sheetCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  sheetCancelLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 13 },
  confirmationDescription: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 13, lineHeight: 20, textAlign: 'center', marginHorizontal: 6, marginBottom: 18 },
  confirmationActions: { flexDirection: 'row', gap: 10 },
  confirmationCancel: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline },
  confirmationConfirm: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,179,108,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.34)' },
  confirmationConfirmDestructive: { backgroundColor: 'rgba(199,123,98,0.12)', borderColor: 'rgba(199,123,98,0.42)' },
  confirmationConfirmLabel: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.instrumentSemiBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  confirmationConfirmLabelDestructive: { color: '#D5968C' },
  passwordSubtitle: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 15 },
  passwordInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  passwordInput: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.26)', color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 14, paddingHorizontal: 13 },
  passwordInputFlex: { flex: 1, paddingRight: 66 },
  passwordEye: { position: 'absolute', right: 10, padding: 8 },
  passwordEyeText: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.instrument, fontSize: 11 },
  passwordError: { color: '#D5968C', fontFamily: typography.fontFamily.instrument, fontSize: 12, marginTop: 10 },
  primarySheetButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.gilt, marginTop: 18 },
  primarySheetButtonLabel: { color: colors.anchor15.ink, fontFamily: typography.fontFamily.instrumentSemiBold, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.68 },
});
