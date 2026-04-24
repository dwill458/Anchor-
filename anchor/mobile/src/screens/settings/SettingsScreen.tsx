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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettingsState } from '@/hooks/useSettings';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import {
  syncDailyGoalNudgesFromStores,
  syncDailyReminderFromStores,
} from '@/services/DailyGoalNudgeService';
import NotificationService from '@/services/NotificationService';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSectionBlock } from '@/components/settings/SettingsSectionBlock';
import { useNotificationController } from '../../hooks/useNotificationController';
import { colors } from '@/theme';
import {
  formatFocusSummary,
  formatGoalSummary,
  formatHapticFeedbackLabel,
  formatPrimingSummary,
  SETTINGS_MUTED_TEXT,
  SETTINGS_SCREEN_BACKGROUND,
} from './shared';

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
  const { notifState, toggleNotifications, updateActiveHours } = useNotificationController();
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
              // Clear local data
              const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
              await writeSecureValue('anchor-sync-retry-queue', '[]');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete account';
              Alert.alert('Deletion Failed', message);
              console.error('[SettingsScreen] Failed to delete account', error);
              return;
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

  const handleToggleDailyReminder = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await NotificationService.requestPermissions();
        if (!granted) {
          Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
          return;
        }
      }

      await updateSetting('dailyReminderEnabled', value);

      if (value) {
        await syncDailyReminderFromStores();
      } else {
        await NotificationService.cancelDailyReminder();
      }

      await syncDailyGoalNudgesFromStores();
    },
    [updateSetting]
  );

  const handleReminderTimeChange = useCallback(
    async (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!selectedDate || event.type !== 'set') {
        return;
      }

      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      await updateSetting('dailyReminderTime', timeString);

      if (settings.dailyReminderEnabled) {
        await syncDailyReminderFromStores();
        await syncDailyGoalNudgesFromStores(selectedDate);
      }
    },
    [settings.dailyReminderEnabled, updateSetting]
  );

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
              title="Priming Defaults"
              value={formatPrimingSummary(settings)}
              type="chevron"
              onPress={() => navigation.navigate('PrimingDefaults')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Default Focus Mode"
              value={formatFocusSummary(settings)}
              type="chevron"
              onPress={() => navigation.navigate('DefaultFocusMode')}
              disabled={isLoading}
            />
            <SettingsRow
              title="Daily Focus Goal"
              value={formatGoalSummary(settings.focusBurstGoal)}
              type="chevron"
              onPress={() => navigation.navigate('DailyPracticeGoal')}
              disabled={isLoading}
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
              title="Hide Intention Text"
              type="toggle"
              toggleValue={settings.reduceIntentionVisibility}
              onToggle={(value) => updateSetting('reduceIntentionVisibility', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Notifications"
              subtitle="Enable daily priming reminders"
              type="toggle"
              toggleValue={notifState?.notification_enabled ?? true}
              onToggle={(value) => {
                void toggleNotifications(value);
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
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Notifications</Text>
          <Text style={styles.sectionDescription}>Silence reminders to support consistency.</Text>
          <SettingsSectionBlock>
            <SettingsRow
              title="Daily Reminder"
              type="toggle"
              toggleValue={settings.dailyReminderEnabled}
              onToggle={handleToggleDailyReminder}
              disabled={isLoading}
              showDivider={settings.dailyReminderEnabled}
            />
            {settings.dailyReminderEnabled ? (
              <View style={styles.inlineTimePickerContainer}>
                <Text style={styles.inlineTimePickerLabel}>Reminder Time</Text>
                <DateTimePicker
                  value={(() => {
                    const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
                    const date = new Date();
                    date.setHours(hours, minutes, 0, 0);
                    return date;
                  })()}
                  mode="time"
                  display="spinner"
                  onChange={handleReminderTimeChange}
                  style={styles.inlineDateTimePicker}
                />
              </View>
            ) : null}
            <SettingsRow
              title="Thread Strength Alerts"
              type="toggle"
              toggleValue={settings.streakProtectionAlertsEnabled}
              onToggle={(value) => updateSetting('streakProtectionAlertsEnabled', value)}
              disabled={isLoading}
            />
            <SettingsRow
              title="Weekly Summary"
              type="toggle"
              toggleValue={settings.weeklySummaryEnabled}
              onToggle={(value) => updateSetting('weeklySummaryEnabled', value)}
              disabled={isLoading}
              showDivider={false}
            />
          </SettingsSectionBlock>

          <Text style={styles.sectionLabel}>Appearance</Text>
          <SettingsSectionBlock>
            <SettingsRow title="Theme" value="Zen Architect" type="chevron" onPress={() => {}} />
            <SettingsRow
              title="Accent Color"
              value="Gold"
              type="chevron"
              onPress={() => {}}
              showDivider={false}
            />
          </SettingsSectionBlock>

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
              onPress={() => void Linking.openURL('https://anchorintentions.com/privacy')}
            />
            <SettingsRow
              title="Terms of Service"
              type="chevron"
              onPress={() => void Linking.openURL('https://anchorintentions.com/terms')}
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
                const url = 'mailto:support@anchorintentions.com';
                const supported = await Linking.canOpenURL(url);
                if (!supported) {
                  Alert.alert('Contact Support', 'Mail is not available on this device.');
                  return;
                }
                await Linking.openURL(url);
              }}
              showDivider={false}
            />
          </SettingsSectionBlock>

          {__DEV__ && DeveloperToolsSection ? (
            <DeveloperToolsSection
              settings={settings}
              updateSetting={updateSetting}
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
