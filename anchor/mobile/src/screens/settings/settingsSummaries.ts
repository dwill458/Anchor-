import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NOTIFICATION_STATE_STORAGE_KEY,
  normalizeNotificationState,
  type NotificationState,
} from '@/services/NotificationState';
import { GUIDANCE_VOICE_LABELS, type GuidanceVoice } from '@/types/sessionAudio';
import { deviceUses24Hour, formatDisplay } from '@/utils/reminderTime';

const TONE_LABELS: Record<string, string> = {
  encouraging: 'Encouraging',
  direct: 'Direct',
  reflective: 'Reflective',
  performance: 'Performance',
};

export const formatPracticeSummary = (
  dailyGoal: number,
  threadStrength: string | undefined,
  focusVoice: GuidanceVoice | undefined
): string => {
  const strength =
    threadStrength === 'lenient' ? 'Lenient' : threadStrength === 'strict' ? 'Strict' : 'Balanced';
  const parts = [`${dailyGoal} a day`, strength];
  if (focusVoice) {
    parts.push(
      focusVoice === 'none' ? 'No guidance' : `${GUIDANCE_VOICE_LABELS[focusVoice]} voice`
    );
  }
  return parts.join(' · ');
};

export const formatSoundSummary = (
  haptic: string | undefined,
  soundEffectsEnabled: boolean | undefined
): string => {
  const haptics =
    haptic === 'strong' ? 'Strong haptics' : haptic === 'light' ? 'Soft haptics' : 'Standard haptics';
  return `${haptics} · Sound effects ${soundEffectsEnabled === false ? 'off' : 'on'}`;
};

export const formatReminderSummary = (state: NotificationState | null): string => {
  if (!state) return 'Daily reminder, nudges and recap';
  const tone = `${TONE_LABELS[state.notificationTone] ?? 'Encouraging'} tone`;
  const dailyOn =
    state.notification_enabled && state.dailyPrimeEnabled && state.personalDailyReminderOptedIn;
  if (!dailyOn) return `Daily reminder off · ${tone}`;
  return `Daily at ${formatDisplay(state.dailyPrimeTime, deviceUses24Hour())} · ${tone}`;
};

/** Read-only look at the stored notification prefs, for the hub's one-line summary. */
export function useStoredNotificationState(refreshKey: unknown): NotificationState | null {
  const [state, setState] = useState<NotificationState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
        if (raw && !cancelled) setState(normalizeNotificationState(JSON.parse(raw)));
      } catch {
        // The summary falls back to generic copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return state;
}
