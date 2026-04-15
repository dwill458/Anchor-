import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnchorSettings } from '@/types/settings';
import NotificationService, { type NotificationType } from '@/services/NotificationService';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsRow } from './SettingsRow';
import { SettingsSectionBlock } from './SettingsSectionBlock';

interface DeveloperToolsSectionProps {
  settings: AnchorSettings;
  updateSetting: <K extends keyof AnchorSettings>(
    key: K,
    value: AnchorSettings[K]
  ) => Promise<void> | void;
  resetSettings: () => Promise<void> | void;
  onResetOnboarding: () => Promise<void> | void;
}

const TIERS: ReadonlyArray<{
  value: AnchorSettings['dev_simulatedTier'];
  label: string;
}> = [
  { value: 'pro', label: 'Paid' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Expired' },
];
const TEST_NOTIFICATION_DELAY_SECONDS = 5;

const TEST_NOTIFICATION_OPTIONS: Array<{
  type: NotificationType;
  title: string;
  subtitle: string;
}> = [
  {
    type: 'daily_reminder',
    title: 'Test Daily Reminder',
    subtitle: 'Return-to-anchor reminder payload',
  },
  {
    type: 'daily_goal_checkpoint',
    title: 'Test Goal Checkpoint',
    subtitle: 'Daily progress checkpoint payload',
  },
  {
    type: 'ritual_reminder',
    title: 'Test Ritual Reminder',
    subtitle: 'Anchor ritual reminder payload',
  },
  {
    type: 'streak_protection',
    title: 'Test Streak Protection',
    subtitle: 'Momentum protection payload',
  },
  {
    type: 'weekly_summary',
    title: 'Test Weekly Summary',
    subtitle: 'Weekly reflection payload',
  },
];

export const DeveloperToolsSection: React.FC<DeveloperToolsSectionProps> = ({
  settings,
  updateSetting,
  resetSettings,
  onResetOnboarding,
}) => {
  const [isNotificationActionRunning, setIsNotificationActionRunning] = React.useState(false);
  const [notificationStatus, setNotificationStatus] = React.useState<string | null>(null);
  const selectedTier =
    settings.dev_simulatedTier === 'free' ? 'expired' : settings.dev_simulatedTier;
  const triggerDeveloperWeeklySummaryPreview = useSettingsStore(
    (state) => state.triggerDeveloperWeeklySummaryPreview
  );

  const handleReset = () => {
    Alert.alert(
      'Reset Onboarding',
      'Restart from first launch state?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetSettings();
            await onResetOnboarding();
          },
        },
      ]
    );
  };

  const handleScheduleNotificationTest = async (
    type: NotificationType,
    label: string
  ): Promise<void> => {
    setIsNotificationActionRunning(true);

    try {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        const message =
          NotificationService.getLastError()?.message ??
          'Notification permissions were denied.';
        setNotificationStatus(message);
        Alert.alert('Notification Permission Required', message);
        return;
      }

      const identifier = await NotificationService.scheduleDeveloperTestNotification(
        type,
        TEST_NOTIFICATION_DELAY_SECONDS
      );

      if (!identifier) {
        const message =
          NotificationService.getLastError()?.message ??
          'Failed to schedule the notification test.';
        setNotificationStatus(message);
        Alert.alert('Notification Test Failed', message);
        return;
      }

      setNotificationStatus(
        `${label} scheduled for ${TEST_NOTIFICATION_DELAY_SECONDS} seconds from now.`
      );
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const handleInspectScheduledTests = async (): Promise<void> => {
    setIsNotificationActionRunning(true);

    try {
      const scheduled = await NotificationService.getDeveloperTestNotifications();
      const error = NotificationService.getLastError();

      if (error) {
        setNotificationStatus(error.message);
        Alert.alert('Notification Queue Error', error.message);
        return;
      }

      if (scheduled.length === 0) {
        const message = 'No developer notification tests are currently scheduled.';
        setNotificationStatus(message);
        Alert.alert('Scheduled Notification Tests', message);
        return;
      }

      const message = scheduled
        .map((notification, index) => `${index + 1}. ${notification.identifier}`)
        .join('\n');

      setNotificationStatus(`${scheduled.length} developer notification test(s) queued.`);
      Alert.alert('Scheduled Notification Tests', message);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const handleClearScheduledTests = async (): Promise<void> => {
    setIsNotificationActionRunning(true);

    try {
      const clearedCount = await NotificationService.cancelDeveloperTestNotifications();
      const error = NotificationService.getLastError();

      if (error) {
        setNotificationStatus(error.message);
        Alert.alert('Notification Queue Error', error.message);
        return;
      }

      const message =
        clearedCount === 0
          ? 'No developer notification tests were queued.'
          : `Cleared ${clearedCount} developer notification test${
              clearedCount === 1 ? '' : 's'
            }.`;

      setNotificationStatus(message);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>⌥ Developer Tools</Text>
      <Text style={styles.description}>Build-only. Hidden in production.</Text>

      <SettingsSectionBlock isDev>
        <SettingsRow
          title="Developer Mode"
          type="toggle"
          toggleValue={settings.dev_developerModeEnabled}
          onToggle={(value) => updateSetting('dev_developerModeEnabled', value)}
          isDev
        />
        <SettingsRow
          title="Enable Dev Overrides"
          subtitle="Bypass paywalls & gate logic"
          type="toggle"
          toggleValue={settings.dev_overridesEnabled}
          onToggle={(value) => updateSetting('dev_overridesEnabled', value)}
          isDev
        />
        <View style={styles.segmentRow}>
          <Text style={styles.segmentTitle}>Simulated Subscription Tier</Text>
          <View style={styles.segmentedControl}>
            {TIERS.map(({ value, label }) => {
              const selected = selectedTier === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => updateSetting('dev_simulatedTier', value)}
                  style={[
                    styles.segmentButton,
                    selected ? styles.segmentButtonSelected : null,
                  ]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <SettingsRow
          title="Skip Onboarding"
          subtitle="Jump directly to home"
          type="toggle"
          toggleValue={settings.dev_skipOnboarding}
          onToggle={(value) => updateSetting('dev_skipOnboarding', value)}
          isDev
        />
        <SettingsRow
          title="Allow Direct Anchor Delete"
          subtitle="Delete without full ritual"
          type="toggle"
          toggleValue={settings.dev_allowDirectAnchorDelete}
          onToggle={(value) => updateSetting('dev_allowDirectAnchorDelete', value)}
          isDev
        />
        <SettingsRow
          title="Debug Console Logging"
          subtitle="Verbose app logging"
          type="toggle"
          toggleValue={settings.dev_debugLogging}
          onToggle={(value) => updateSetting('dev_debugLogging', value)}
          isDev
        />
        <SettingsRow
          title="Force Streak Break"
          subtitle="Test streak protection UI"
          type="toggle"
          toggleValue={settings.dev_forceStreakBreak}
          onToggle={(value) => updateSetting('dev_forceStreakBreak', value)}
          isDev
          showDivider={false}
        />
      </SettingsSectionBlock>

      <SettingsSectionBlock isDev style={styles.notificationBlock}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>Notification Tester</Text>
          <Text style={styles.notificationDescription}>
            Schedule local test notifications in {TEST_NOTIFICATION_DELAY_SECONDS} seconds using
            the live app payloads.
          </Text>
        </View>

        {TEST_NOTIFICATION_OPTIONS.map((option) => (
          <SettingsRow
            key={option.type}
            title={option.title}
            subtitle={option.subtitle}
            type="none"
            onPress={() => void handleScheduleNotificationTest(option.type, option.title)}
            disabled={isNotificationActionRunning}
            isDev
            rightElement={
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  +{TEST_NOTIFICATION_DELAY_SECONDS}s
                </Text>
              </View>
            }
          />
        ))}

        <SettingsRow
          title="Show Scheduled Tests"
          subtitle="List queued developer notification tests"
          type="none"
          onPress={() => void handleInspectScheduledTests()}
          disabled={isNotificationActionRunning}
          isDev
          rightElement={
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>Queue</Text>
            </View>
          }
        />
        <SettingsRow
          title="Clear Scheduled Tests"
          subtitle="Remove queued developer notification tests"
          type="none"
          onPress={() => void handleClearScheduledTests()}
          disabled={isNotificationActionRunning}
          isDev
          rightElement={
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>Clear</Text>
            </View>
          }
          showDivider={false}
        />

        {notificationStatus ? (
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Notification Status</Text>
            <Text style={styles.statusText}>{notificationStatus}</Text>
          </View>
        ) : null}
      </SettingsSectionBlock>

      <SettingsSectionBlock isDev style={styles.notificationBlock}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>Weekly Summary Preview</Text>
          <Text style={styles.notificationDescription}>
            Force the in-app weekly summary sheet to appear the next time you visit Sanctuary.
          </Text>
        </View>

        <SettingsRow
          title="Show Weekly Summary Modal"
          subtitle="Open the in-app weekly review sheet"
          type="none"
          onPress={() => {
            triggerDeveloperWeeklySummaryPreview();
            setNotificationStatus('Weekly summary modal primed for preview.');
          }}
          isDev
          rightElement={
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>Open</Text>
            </View>
          }
          showDivider={false}
        />
      </SettingsSectionBlock>

      <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetButton, pressed ? styles.resetButtonPressed : null]}>
        <View>
          <Text style={styles.resetText}>Reset Onboarding</Text>
          <Text style={styles.resetSubtext}>Restart from first launch state</Text>
        </View>
        <Text style={styles.resetChevron}>›</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    color: '#4ade80',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  description: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: '#4ade80',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
    opacity: 0.5,
  },
  segmentRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(74,222,128,0.2)',
  },
  segmentTitle: {
    marginBottom: 8,
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    opacity: 0.9,
  },
  segmentedControl: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  segmentButton: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(74,222,128,0.2)',
    backgroundColor: 'rgba(74,222,128,0.04)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  segmentText: {
    color: '#4ade80',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    opacity: 0.5,
  },
  segmentTextSelected: {
    opacity: 1,
    fontFamily: 'Inter-SemiBold',
  },
  notificationBlock: {
    marginTop: 8,
  },
  notificationHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  notificationTitle: {
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  notificationDescription: {
    marginTop: 4,
    color: 'rgba(74,222,128,0.65)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  notificationBadge: {
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  notificationBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(74,222,128,0.2)',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  statusLabel: {
    color: 'rgba(74,222,128,0.6)',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusText: {
    marginTop: 6,
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  resetButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  resetButtonPressed: {
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  resetText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  resetSubtext: {
    marginTop: 2,
    color: 'rgba(239,68,68,0.5)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  resetChevron: {
    color: '#ef4444',
    fontSize: 14,
    opacity: 0.5,
  },
});
