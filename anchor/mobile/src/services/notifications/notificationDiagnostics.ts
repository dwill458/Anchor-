/**
 * Notification diagnostics
 *
 * Reminders are scheduled locally and delivered by the OS, so when they fail to
 * arrive there is nothing to see in logs or on the server. This collects the
 * whole chain — which JS bundle is running, what the OS thinks the permission
 * and channels are, what the app believes, and what is actually queued — into
 * one report the user can read or send on.
 *
 * Deliberately reachable in release builds: the existing developer tools are
 * gated behind `__DEV__`, which is exactly the situation where this is needed.
 */

import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NOTIFICATION_STATE_STORAGE_KEY,
  normalizeNotificationState,
  type NotificationState,
} from '@/services/NotificationState';
import {
  readPendingSmartNotification,
  type PendingSmartNotification,
} from '@/services/notifications/pendingNotificationStore';
import { logger } from '@/utils/logger';

export interface ScheduledNotificationSummary {
  identifier: string;
  triggerType: string;
  nextFireAt: string | null;
  channelId: string | null;
}

export interface AndroidChannelSummary {
  id: string;
  importance: number;
  sound: string | null;
}

export interface NotificationDiagnosticsReport {
  collectedAt: string;
  platform: string;
  osVersion: string | number | null;
  /** Which JS bundle is live — the answer to "did my OTA actually land?". */
  bundle: {
    appVersion: string | null;
    runtimeVersion: string | null;
    channel: string | null;
    updateId: string | null;
    updateCreatedAt: string | null;
    isEmbeddedLaunch: boolean;
  };
  permission: {
    status: string;
    granted: boolean;
    androidImportance: number | null;
    iosAuthorizationStatus: number | null;
  };
  androidChannels: AndroidChannelSummary[];
  appState: {
    notificationEnabled: boolean;
    permissionStatus: NotificationState['notificationPermissionStatus'];
    dailyPrimeEnabled: boolean;
    dailyPrimeTime: string;
    threadStrengthAlertsEnabled: boolean;
    weeklyRecapEnabled: boolean;
    milestoneNotificationsEnabled: boolean;
    lastNotificationSentAt: NotificationState['lastNotificationSentAt'];
  } | null;
  pending: PendingSmartNotification | null;
  scheduled: ScheduledNotificationSummary[];
  errors: string[];
}

const describeTrigger = (
  trigger: Notifications.NotificationTrigger | null
): { type: string; nextFireAt: string | null; channelId: string | null } => {
  if (!trigger) {
    return { type: 'none', nextFireAt: null, channelId: null };
  }

  const record = trigger as unknown as Record<string, unknown>;
  const channelId = typeof record.channelId === 'string' ? record.channelId : null;
  const type = typeof record.type === 'string' ? record.type : 'unknown';

  // Reanimated-style structural probing: the trigger shape differs per type and
  // is not fully described by the public types.
  const timestamp =
    typeof record.value === 'number'
      ? record.value
      : typeof record.date === 'number'
        ? record.date
        : null;

  let nextFireAt: string | null = null;
  if (timestamp != null) {
    const parsed = new Date(timestamp);
    nextFireAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } else if (typeof record.hour === 'number' && typeof record.minute === 'number') {
    nextFireAt = `${String(record.hour).padStart(2, '0')}:${String(record.minute).padStart(2, '0')} daily`;
  }

  return { type, nextFireAt, channelId };
};

export async function collectNotificationDiagnostics(): Promise<NotificationDiagnosticsReport> {
  const errors: string[] = [];

  const report: NotificationDiagnosticsReport = {
    collectedAt: new Date().toISOString(),
    platform: Platform.OS,
    osVersion: Platform.Version ?? null,
    bundle: {
      appVersion: Constants.expoConfig?.version ?? null,
      runtimeVersion: Updates.runtimeVersion ?? null,
      channel: Updates.channel ?? null,
      updateId: Updates.updateId ?? null,
      updateCreatedAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    },
    permission: {
      status: 'unknown',
      granted: false,
      androidImportance: null,
      iosAuthorizationStatus: null,
    },
    androidChannels: [],
    appState: null,
    pending: null,
    scheduled: [],
    errors,
  };

  try {
    const permissions = await Notifications.getPermissionsAsync();
    report.permission = {
      status: permissions.status,
      granted: permissions.granted,
      androidImportance: permissions.android?.importance ?? null,
      iosAuthorizationStatus: permissions.ios?.status ?? null,
    };
  } catch (error) {
    errors.push(`permissions: ${(error as Error).message}`);
  }

  if (Platform.OS === 'android') {
    try {
      const channels = await Notifications.getNotificationChannelsAsync();
      report.androidChannels = channels.map((channel) => ({
        id: channel.id,
        importance: channel.importance,
        sound: channel.sound ?? null,
      }));
    } catch (error) {
      errors.push(`channels: ${(error as Error).message}`);
    }
  }

  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
    if (raw) {
      const state = normalizeNotificationState(JSON.parse(raw));
      report.appState = {
        notificationEnabled: state.notification_enabled,
        permissionStatus: state.notificationPermissionStatus,
        dailyPrimeEnabled: state.dailyPrimeEnabled,
        dailyPrimeTime: state.dailyPrimeTime,
        threadStrengthAlertsEnabled: state.threadStrengthAlertsEnabled,
        weeklyRecapEnabled: state.weeklyRecapEnabled,
        milestoneNotificationsEnabled: state.milestoneNotificationsEnabled,
        lastNotificationSentAt: state.lastNotificationSentAt,
      };
    }
  } catch (error) {
    errors.push(`stored state: ${(error as Error).message}`);
  }

  try {
    report.pending = await readPendingSmartNotification();
  } catch (error) {
    errors.push(`pending: ${(error as Error).message}`);
  }

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    report.scheduled = scheduled.map((notification) => {
      const described = describeTrigger(notification.trigger);
      return {
        identifier: notification.identifier,
        triggerType: described.type,
        nextFireAt: described.nextFireAt,
        channelId: described.channelId,
      };
    });
  } catch (error) {
    errors.push(`scheduled queue: ${(error as Error).message}`);
  }

  return report;
}

export function formatNotificationDiagnostics(
  report: NotificationDiagnosticsReport
): string {
  const lines: string[] = [];

  lines.push('ANCHOR — NOTIFICATION DIAGNOSTICS');
  lines.push(report.collectedAt);
  lines.push('');

  lines.push(`Platform: ${report.platform} ${report.osVersion ?? '?'}`);
  lines.push('');

  lines.push('BUNDLE (is the OTA live?)');
  lines.push(`  app version:     ${report.bundle.appVersion ?? '—'}`);
  lines.push(`  runtime version: ${report.bundle.runtimeVersion ?? '—'}`);
  lines.push(`  channel:         ${report.bundle.channel ?? '—'}`);
  lines.push(
    `  running:         ${report.bundle.isEmbeddedLaunch ? 'BUILT-IN bundle (no OTA applied)' : 'OTA update'}`
  );
  lines.push(`  update id:       ${report.bundle.updateId ?? '—'}`);
  lines.push(`  update built:    ${report.bundle.updateCreatedAt ?? '—'}`);
  lines.push('');

  lines.push('OS PERMISSION');
  lines.push(`  status:  ${report.permission.status}`);
  lines.push(`  granted: ${report.permission.granted}`);
  if (report.permission.androidImportance != null) {
    lines.push(`  android importance: ${report.permission.androidImportance}`);
  }
  if (report.permission.iosAuthorizationStatus != null) {
    lines.push(`  ios authorization:  ${report.permission.iosAuthorizationStatus}`);
  }
  lines.push('');

  if (report.platform === 'android') {
    lines.push(`ANDROID CHANNELS (${report.androidChannels.length})`);
    if (report.androidChannels.length === 0) {
      lines.push('  none — channels are created on first schedule');
    }
    report.androidChannels.forEach((channel) => {
      lines.push(`  ${channel.id} — importance ${channel.importance}, sound ${channel.sound ?? 'default'}`);
    });
    lines.push('');
  }

  lines.push('APP STATE');
  if (!report.appState) {
    lines.push('  no stored notification state yet');
  } else {
    lines.push(`  notifications enabled: ${report.appState.notificationEnabled}`);
    lines.push(`  permission (as stored): ${report.appState.permissionStatus}`);
    lines.push(`  daily prime enabled:   ${report.appState.dailyPrimeEnabled}`);
    lines.push(`  daily prime time:      ${report.appState.dailyPrimeTime}`);
    lines.push(`  thread strength:       ${report.appState.threadStrengthAlertsEnabled}`);
    lines.push(`  weekly recap:          ${report.appState.weeklyRecapEnabled}`);
    lines.push(`  milestones:            ${report.appState.milestoneNotificationsEnabled}`);
    const sent = Object.entries(report.appState.lastNotificationSentAt ?? {});
    lines.push(`  last delivered:        ${sent.length === 0 ? 'never' : ''}`);
    sent.forEach(([category, at]) => lines.push(`    ${category}: ${at}`));
  }
  lines.push('');

  lines.push('QUEUED BY THE APP');
  lines.push(
    report.pending
      ? `  ${report.pending.category} → ${report.pending.fireDate} (${report.pending.identifier})`
      : '  nothing queued'
  );
  lines.push('');

  lines.push(`ACTUALLY SCHEDULED WITH THE OS (${report.scheduled.length})`);
  if (report.scheduled.length === 0) {
    lines.push('  NOTHING — the OS has no pending notifications for this app');
  }
  report.scheduled.forEach((notification) => {
    lines.push(
      `  ${notification.identifier}\n    trigger ${notification.triggerType}, fires ${notification.nextFireAt ?? '?'}, channel ${notification.channelId ?? '—'}`
    );
  });

  if (report.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS');
    report.errors.forEach((error) => lines.push(`  ${error}`));
  }

  return lines.join('\n');
}

export async function buildNotificationDiagnosticsText(): Promise<string> {
  try {
    return formatNotificationDiagnostics(await collectNotificationDiagnostics());
  } catch (error) {
    logger.error('[NotificationDiagnostics] Failed to collect report', error);
    return `Failed to collect notification diagnostics: ${(error as Error).message}`;
  }
}
