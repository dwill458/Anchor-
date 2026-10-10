import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import NotificationService from '@/services/NotificationService';
import { NotificationCoordinator } from '@/services/notifications/NotificationCoordinator';
import { useNotificationController } from '@/hooks/useNotificationController';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { logger } from '@/utils/logger';

export type ReminderEnrollmentStatus =
  | 'idle'
  | 'requesting'
  | 'success'
  | 'denied'
  | 'blocked'
  | 'failed';

const parseHHmm = (time: string): { hour: number; minute: number } => {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
};

/**
 * Orchestrates permission -> enable -> verified native schedule for the
 * personal daily reminder. Success is reported only after native storage
 * confirms a matching schedule. Never depends on animation timing.
 */
export const useReminderEnrollment = () => {
  const { enableDailyReminderOnly } = useNotificationController();
  const [status, setStatus] = useState<ReminderEnrollmentStatus>('idle');
  const tail = useRef<{ time: string; gen: number; promise: Promise<void> } | null>(null);
  const generation = useRef(0);
  const lastSelectedTime = useRef<string | null>(null);
  const mounted = useRef(true);
  const controller = useRef({ enableDailyReminderOnly });
  controller.current = { enableDailyReminderOnly };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (time: string, gen: number): Promise<void> => {
    // gen was captured when enroll() was called. A reset() since then cancels
    // a queued run outright; a reset() mid-run only mutes its status updates.
    if (generation.current !== gen) return;
    const setSafe = (next: ReminderEnrollmentStatus) => {
      if (mounted.current && generation.current === gen) setStatus(next);
    };
    // A reset() during any await abandons this run: it must not prompt-side-effect,
    // enable the schedule, or persist anything after that point.
    const abandoned = () => generation.current !== gen;
    setSafe('requesting');
    const payload = parseHHmm(time);
    try {
      const { enableDailyReminderOnly: enable } = controller.current;
      // No time is persisted here: the picked time is written only by enable(time) on a grant.
      if (lastSelectedTime.current !== time) {
        lastSelectedTime.current = time;
        AnalyticsService.track(AnalyticsEvents.REMINDER_TIME_SELECTED, payload);
      }

      const current = await NotificationService.getPermissionStatus();
      if (abandoned()) return;
      if (current === 'denied') {
        // The OS will not show a prompt again; only system settings can fix this.
        setSafe('blocked');
        return;
      }
      if (current !== 'granted') {
        const granted = await NotificationService.requestPermissions();
        if (abandoned()) return;
        if (!granted) {
          AnalyticsService.track(AnalyticsEvents.NOTIFICATION_PERMISSION_DENIED);
          setSafe('denied');
          return;
        }
      }

      // Permission is confirmed granted. Enable only the personal daily reminder:
      // no weekly summary, push-token sync, or smart-category scheduling.
      const enabled = await enable(time);
      if (abandoned()) return;
      if (!enabled) {
        setSafe('failed');
        return;
      }
      await NotificationCoordinator.verifyAndReconcileNativeSchedule();
      if (abandoned()) return;
      const confirmed = await NotificationService.hasMatchingPersonalDailyReminder(time);
      if (abandoned()) return;
      if (confirmed) {
        AnalyticsService.track(AnalyticsEvents.PERSONAL_REMINDER_ENABLED, payload);
        setSafe('success');
      } else {
        setSafe('failed');
      }
    } catch (error) {
      logger.warn('[useReminderEnrollment] enroll failed', error);
      setSafe('failed');
    }
  }, []);

  const enroll = useCallback((time: string): Promise<void> => {
    const gen = generation.current;
    // A tail from before a reset() is abandoned: never share or queue behind it.
    const current = tail.current && tail.current.gen === gen ? tail.current : null;
    // Same time while in flight: share the one promise (one prompt, one schedule).
    if (current && current.time === time) return current.promise;
    // Different time: queue behind the in-flight run so prompts never overlap
    // and the result returned reflects this time. run() never rejects.
    const prev = current ? current.promise : Promise.resolve();
    const promise: Promise<void> = prev.then(() => run(time, gen));
    const entry = { time, gen, promise };
    tail.current = entry;
    void promise.then(() => {
      if (tail.current === entry) tail.current = null;
    });
    return promise;
  }, [run]);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    tail.current = null;
    if (mounted.current) setStatus('idle');
  }, []);

  return { status, enroll, openSystemSettings, reset };
};
