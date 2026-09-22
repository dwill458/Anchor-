import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/components/settings/settingsTheme';
import {
  CompactPickerSheet,
  SectionLabel,
  SettingsHeader,
  SettingsRow,
  SettingsToggleRow,
} from '@/components/settings/SettingsPrimitives';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useSettingsStore } from '@/stores/settingsStore';
import NotificationService from '@/services/NotificationService';
import type { NotificationTone } from '@/services/notifications/notificationTypes';
import {
  formatThresholdPercentage,
  normalizeThresholdValue,
} from '@/utils/notificationFormatting';

interface Props {
  onBack: () => void;
}

type PickerType = 'time' | 'threshold' | 'tone' | null;

const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
  const normalized = Math.max(0, Math.min(23, hour));
  const meridiem = normalized >= 12 ? 'PM' : 'AM';
  const label = `${normalized % 12 || 12}:00 ${meridiem}`;
  const value = `${String(normalized).padStart(2, '0')}:00`;
  return { label, value };
});

const THRESHOLD_OPTIONS = [
  { label: '50%', value: '50' },
  { label: '60%', value: '60' },
  { label: '70%', value: '70' },
  { label: '80%', value: '80' },
  { label: '90%', value: '90' },
];

const TONE_OPTIONS = [
  { label: 'Encouraging', value: 'encouraging', desc: 'Warm, supportive reminders' },
  { label: 'Direct', value: 'direct', desc: 'Clear, concise reminders' },
  { label: 'Minimal', value: 'minimal', desc: 'Essential signal only' },
];

export const NotificationsSubscreen: React.FC<Props> = ({ onBack }) => {
  const [picker, setPicker] = useState<PickerType>(null);
  const { notifState, toggleNotifications, updateNotificationPreferences } = useNotificationController();

  const remindersEnabled = notifState?.notification_enabled ?? false;
  const dailyPrimeTime = notifState?.dailyPrimeTime ?? '21:00';
  const dailyPrimeEnabled = notifState?.dailyPrimeEnabled ?? true;
  const threadAlertsEnabled = notifState?.threadStrengthAlertsEnabled ?? true;
  const threadThreshold = normalizeThresholdValue(notifState?.threadStrengthThreshold);
  const unfinishedEnabled = notifState?.unfinishedAnchorRemindersEnabled ?? false;
  const tone = notifState?.notificationTone ?? 'encouraging';
  const weeklyRecapEnabled = notifState?.weeklyRecapEnabled ?? false;

  const formatTimeLabel = (timeStr: string): string => {
    const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(timeStr);
    const hour = match ? Number(match[1]) : 21;
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:00 ${meridiem}`;
  };

  const formatToneLabel = (toneVal: string): string => {
    if (toneVal === 'direct') return 'Direct';
    if (toneVal === 'minimal') return 'Minimal';
    return 'Encouraging';
  };

  const handleReminderToggle = async (enabled: boolean) => {
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
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="Notifications & reminders" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel first>Practice Reminders</SectionLabel>
          <SettingsToggleRow
            label="Practice reminders"
            on={remindersEnabled}
            onToggle={handleReminderToggle}
            testID="settings-row-Practice Reminders"
          />
          {remindersEnabled ? (
            <SettingsRow
              label="Reminder time"
              value={formatTimeLabel(dailyPrimeTime)}
              onPress={() => setPicker('time')}
              indent
            />
          ) : null}
          <SettingsToggleRow
            label="Daily practice reminder"
            on={dailyPrimeEnabled}
            disabled={!remindersEnabled}
            onToggle={(val) => void updateNotificationPreferences({ dailyPrimeEnabled: val })}
          />

          <SectionLabel>Consistency Alerts</SectionLabel>
          <SettingsToggleRow
            label="Consistency alerts"
            desc="Notify when an Anchor's Consistency drops below your threshold."
            on={threadAlertsEnabled}
            disabled={!remindersEnabled}
            onToggle={(val) => void updateNotificationPreferences({ threadStrengthAlertsEnabled: val })}
          />
          {threadAlertsEnabled ? (
            <SettingsRow
              label="Alert below"
              value={formatThresholdPercentage(threadThreshold)}
              disabled={!remindersEnabled}
              onPress={() => {
                if (remindersEnabled) setPicker('threshold');
              }}
              indent
            />
          ) : null}
          <SettingsToggleRow
            label="Unfinished anchor reminders"
            on={unfinishedEnabled}
            disabled={!remindersEnabled}
            onToggle={(val) => void updateNotificationPreferences({ unfinishedAnchorRemindersEnabled: val })}
          />

          <SectionLabel>Delivery</SectionLabel>
          <SettingsRow
            label="Notification tone"
            value={formatToneLabel(tone)}
            disabled={!remindersEnabled}
            onPress={() => {
              if (remindersEnabled) setPicker('tone');
            }}
          />
          <SettingsToggleRow
            label="Weekly recap"
            on={weeklyRecapEnabled}
            disabled={!remindersEnabled}
            onToggle={(val) => {
              void updateNotificationPreferences({ weeklyRecapEnabled: val });
              useSettingsStore.getState?.()?.setWeeklySummaryEnabled?.(val);
            }}
            showDivider={false}
          />
        </ScrollView>
      </SafeAreaView>

      {/* Time Picker */}
      <CompactPickerSheet
        open={picker === 'time'}
        title="Reminder Time"
        options={TIME_OPTIONS}
        value={dailyPrimeTime}
        onPick={(val) => void updateNotificationPreferences({ dailyPrimeTime: val })}
        onClose={() => setPicker(null)}
      />

      {/* Threshold Picker */}
      <CompactPickerSheet
        open={picker === 'threshold'}
        title="Alert Below"
        options={THRESHOLD_OPTIONS}
        value={String(threadThreshold)}
        onPick={(val) => void updateNotificationPreferences({ threadStrengthThreshold: normalizeThresholdValue(val) })}
        onClose={() => setPicker(null)}
      />

      {/* Tone Picker */}
      <CompactPickerSheet
        open={picker === 'tone'}
        title="Notification Tone"
        options={TONE_OPTIONS}
        value={tone}
        onPick={(val) => void updateNotificationPreferences({ notificationTone: val as NotificationTone })}
        onClose={() => setPicker(null)}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
});
