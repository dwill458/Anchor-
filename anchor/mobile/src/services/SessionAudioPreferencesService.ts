import { updateUserSettings } from '@/services/ApiClient';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { UserSettings } from '@/types';
import {
  migrateLegacySessionAudioDefaults,
  normalizeSessionAudioDefaultsByType,
  type SessionAudioDefaults,
  type SessionAudioDefaultsByType,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';
import { logger } from '@/utils/logger';

let settingsSyncQueue: Promise<void> = Promise.resolve();

const enqueueSettingsSync = (task: () => Promise<void>): Promise<void> => {
  const result = settingsSyncQueue.then(task, task);
  settingsSyncQueue = result.catch(() => undefined);
  return result;
};

const syncDefaultsToAccount = (
  ownerUserId: string,
  defaults: SessionAudioDefaultsByType
): Promise<void> =>
  enqueueSettingsSync(async () => {
    if (useAuthStore.getState().user?.id !== ownerUserId) {
      return;
    }

    const remote = await updateUserSettings({
      sessionAudioDefaults: normalizeSessionAudioDefaultsByType(defaults),
    });

    if (useAuthStore.getState().user?.id !== ownerUserId) {
      return;
    }

    useSettingsStore.getState().applyRemoteSessionAudioDefaults({
      ownerUserId,
      defaults: remote.sessionAudioDefaults ?? defaults,
      updatedAt: remote.updatedAt,
    });
  });

export const persistSessionAudioDefaults = async (
  sessionType: SessionAudioSessionType,
  defaults: SessionAudioDefaults
): Promise<void> => {
  const authState = useAuthStore.getState();
  const ownerUserId = authState.isAuthenticated ? authState.user?.id ?? null : null;
  const settings = useSettingsStore.getState();
  settings.setSessionAudioDefaults(sessionType, defaults, ownerUserId);

  AnalyticsService.track('session_audio_default_changed', {
    session_type: sessionType,
    guidance_voice: defaults.guidanceVoice,
    background_audio: defaults.backgroundAudio,
    source: 'default',
  });

  if (!ownerUserId) {
    return;
  }

  const nextDefaults = useSettingsStore.getState().sessionAudioDefaults;
  try {
    await syncDefaultsToAccount(ownerUserId, nextDefaults);
  } catch (error) {
    logger.warn('[SessionAudioPreferences] Failed to sync Voice & Sound defaults', error);
    throw error;
  }
};

export const applyRemoteSessionAudioPreferences = (
  ownerUserId: string,
  remoteSettings?: UserSettings | null
): void => {
  const store = useSettingsStore.getState();
  store.bindSessionAudioDefaultsOwner(ownerUserId);

  if (!remoteSettings) {
    return;
  }

  const defaults = remoteSettings.sessionAudioDefaults
    ? normalizeSessionAudioDefaultsByType(remoteSettings.sessionAudioDefaults)
    : migrateLegacySessionAudioDefaults(remoteSettings);
  const result = useSettingsStore.getState().applyRemoteSessionAudioDefaults({
    ownerUserId,
    defaults,
    updatedAt: remoteSettings.updatedAt,
  });

  if (result !== 'local_newer') {
    return;
  }

  const localDefaults = useSettingsStore.getState().sessionAudioDefaults;
  void syncDefaultsToAccount(ownerUserId, localDefaults).catch((error) => {
    logger.warn('[SessionAudioPreferences] Failed to reconcile newer local defaults', error);
  });
};

export const resetSessionAudioPreferencesForGuest = (): void => {
  useSettingsStore.getState().bindSessionAudioDefaultsOwner(null);
};

export const __resetSessionAudioPreferencesSyncForTests = (): void => {
  settingsSyncQueue = Promise.resolve();
};
