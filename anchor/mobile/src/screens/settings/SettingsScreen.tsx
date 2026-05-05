import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { LEGAL_URLS, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSectionBlock } from '@/components/settings/SettingsSectionBlock';
import NotificationService from '@/services/NotificationService';
import { useNotificationController } from '../../hooks/useNotificationController';
import { colors } from '@/theme';
import {
  formatHapticFeedbackLabel,
  SETTINGS_MUTED_TEXT,
  SETTINGS_SCREEN_BACKGROUND,
} from './shared';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDurationLabel = (durationSeconds: number): string => {
  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} min`;
};

const restorePurchases = async (): Promise<void> => {
  try {
    const purchasesModule = require('react-native-purchases');
    const purchases = purchasesModule?.default ?? purchasesModule;
    if (typeof purchases?.restorePurchases === 'function') {
      await purchases.restorePurchases();
      Alert.alert('Restore Purchase', 'Your purchases were restored.');
      return;
    }
  } catch {
    // RevenueCat is not available in this build.
  }

  Alert.alert('Restore Purchase', 'RevenueCat restorePurchases() is not available in this build.');
};

const PlaceholderTag: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.placeholderTag}>
    <Text style={styles.placeholderTagText}>{label}</Text>
  </View>
);

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, updateSetting, resetSettings, isLoading } = useSettingsState();
  const focusSessionMode = useSettingsStore((state) => state.focusSessionMode ?? 'quick');
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const primeSessionDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const primeSessionAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'silent');
  const dailyPracticeGoal = useSettingsStore((state) => state.dailyPracticeGoal ?? 3);
  const dailyPracticeGoalPreset = useSettingsStore(
    (state) => state.dailyPracticeGoalPreset ?? 'three'
  );
  const threadStrengthSensitivity = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced'
  );
  const restDays = useSettingsStore((state) => state.restDays ?? []);
  const { notifState, toggleNotifications, updateActiveHours, toggleWeaver } = useNotificationController();
  const { setHasCompletedOnboarding, signOut } = useAuthStore();
  const reveal = useSettingsReveal();
  const [hourPickerTarget, setHourPickerTarget] = useState<'wake' | 'reminder' | null>(null);
  const hasMarkedReadyRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const DeveloperToolsSection = __DEV__
    ? require('@/components/settings/DeveloperToolsSection').DeveloperToolsSection
    : null;

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
              await AuthService.signOut();
            } catch (error) {
              Alert.alert('Sign Out Failed', 'We could not sign you out right now.');
              console.warn('[SettingsScreen] Failed to sign out cleanly', error);
              return;
            }

            try {
              // Clear sync retry queue so stale anchor data is not carried over
              const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
              await writeSecureValue('anchor-sync-retry-queue', '[]');
            } catch (error) {
              console.warn('[SettingsScreen] Failed to clear sync retry queue on sign-out', error);
            }

            signOut();
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

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your anchors and data will be deleted from our servers.',
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
              console.error('[SettingsScreen] Failed to delete account', error);
              return;
            }

            try {
              // Clear local data
              const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
              await writeSecureValue('anchor-sync-retry-queue', '[]');
            } catch (error) {
              console.warn('[SettingsScreen] Failed to clear sync retry queue after account deletion', error);
            }

            signOut();
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

  const handleResetOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(false);
  }, [setHasCompletedOnboarding]);

  const handlePrivacyPolicy = () => {
    Linking.openURL(LEGAL_URLS.privacyPolicy);
  };

  const handleSupport = () => {
    Linking.openURL(LEGAL_URLS.support);
  };

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  const formatHourLabel = useCallback((hour: number | null | undefined) => {
    const normalizedHour = Math.max(0, Math.min(23, hour ?? 0));
    const meridiem = normalizedHour >= 12 ? 'PM' : 'AM';
    const hour12 = normalizedHour % 12 || 12;
    return `${hour12}:00 ${meridiem}`;
  }, []);

  const handleHourSelection = useCallback(
    async (hour: number) => {
      if (hourPickerTarget === 'wake') {
        await updateActiveHours(hour, notifState?.active_hours_end ?? 21);
      } else if (hourPickerTarget === 'reminder') {
        await updateActiveHours(notifState?.active_hours_start ?? 8, hour);
      }

      setHourPickerTarget(null);
    },
    [hourPickerTarget, notifState?.active_hours_end, notifState?.active_hours_start, updateActiveHours]
  );

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
              title="Practice Guidance"
              subtitle="Gentle in-context tips during new practices"
              type="toggle"
              toggleValue={settings.practiceGuidanceEnabled}
              onToggle={(value) => updateSetting('practiceGuidanceEnabled', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Weekly Summary"
              subtitle="Receive a reflection of your week on Sundays"
              type="toggle"
              toggleValue={settings.weeklySummaryEnabled}
              onToggle={async (value) => {
                await updateSetting('weeklySummaryEnabled', value);
                // Also trigger scheduling update since we just changed the toggle
                if (notifState) {
                  if (value) {
                    await NotificationService.scheduleWeeklySummary(notifState.active_hours_end);
                  } else {
                    await NotificationService.cancelWeeklySummary();
                  }
                }
              }}
              disabled={isLoading}
            />

            <SettingsRow
              title="Notifications"
              subtitle="Enable daily priming reminders"
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
                  title="Wake Time"
                  subtitle="When your active day begins"
                  value={formatHourLabel(notifState?.active_hours_start ?? 8)}
                  type="chevron"
                  onPress={() => setHourPickerTarget('wake')}
                  disabled={isLoading}
                />
                <SettingsRow
                  title="Reminder Time"
                  subtitle="When Micro-Prime fires if you haven't primed"
                  value={formatHourLabel(notifState?.active_hours_end ?? 21)}
                  type="chevron"
                  onPress={() => setHourPickerTarget('reminder')}
                  disabled={isLoading}
                  showDivider={true}
                />
                <SettingsRow
                  title="Recovery Nudges"
                  subtitle="Gentle reminder when you've missed a day"
                  type="toggle"
                  toggleValue={notifState?.weaver_enabled ?? true}
                  onToggle={async (enabled) => void toggleWeaver(enabled)}
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
              subtitle="Account sync coming soon"
              type="none"
              rightElement={<PlaceholderTag label="v1.1" />}
            />
            <SettingsRow title="Sign Out" type="chevron" onPress={handleSignOut} />
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
              title="Contact Support"
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

          {__DEV__ && DeveloperToolsSection ? (
            <DeveloperToolsSection
              resetSettings={resetSettings}
              onResetOnboarding={handleResetOnboarding}
            />
          ) : null}

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

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={hourPickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setHourPickerTarget(null)}
      >
        <Pressable style={styles.hourPickerOverlay} onPress={() => setHourPickerTarget(null)}>
          <Pressable style={styles.hourPickerCard} onPress={() => {}}>
            <Text style={styles.hourPickerTitle}>
              {hourPickerTarget === 'wake' ? 'Select Wake Time' : 'Select Reminder Time'}
            </Text>
            <ScrollView
              style={styles.hourPickerList}
              contentContainerStyle={styles.hourPickerListContent}
              showsVerticalScrollIndicator={false}
            >
              {Array.from({ length: 24 }, (_, hour) => {
                const activeHour =
                  hourPickerTarget === 'wake'
                    ? notifState?.active_hours_start ?? 8
                    : notifState?.active_hours_end ?? 21;
                const isSelected = activeHour === hour;

                return (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.hourPickerOption, isSelected ? styles.hourPickerOptionActive : null]}
                    activeOpacity={0.8}
                    onPress={() => {
                      void handleHourSelection(hour);
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
  placeholderTag: {
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  placeholderTagText: {
    color: SETTINGS_MUTED_TEXT,
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    letterSpacing: 0.6,
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
});
