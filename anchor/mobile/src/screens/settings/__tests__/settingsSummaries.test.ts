import { formatPracticeSummary, formatReminderSummary, formatSoundSummary } from '../settingsSummaries';
import { formatLastBackup } from '@/storage/backup/lastBackup';
import { deviceTimezoneSummary } from '@/utils/deviceTimezone';
import { mapFeedbackToHapticIntensity, mapHapticIntensityToFeedback } from '@/utils/hapticFeedbackLevel';
import { initializeNotificationState } from '@/services/NotificationState';

describe('settings summaries', () => {
  it('summarises Practice in the hub with goal, thread behaviour and voice', () => {
    expect(formatPracticeSummary(1, 'balanced', 'female')).toBe('1 a day · Balanced · Serene voice');
    expect(formatPracticeSummary(3, 'strict', 'none')).toBe('3 a day · Strict · No guidance');
  });

  it('summarises Sound & feel from the stored haptic level and sound toggle', () => {
    expect(formatSoundSummary('strong', true)).toBe('Strong haptics · Sound effects on');
    expect(formatSoundSummary('light', false)).toBe('Soft haptics · Sound effects off');
  });

  it('reports the real reminder time and tone, not a hard-coded default', () => {
    const state = {
      ...initializeNotificationState(),
      notification_enabled: true,
      dailyPrimeEnabled: true,
      personalDailyReminderOptedIn: true,
      dailyPrimeTime: '08:00',
      notificationTone: 'reflective' as const,
    };
    const summary = formatReminderSummary(state);
    expect(summary).toContain('Reflective tone');
    expect(summary).toMatch(/Daily at 8:00/);
    expect(formatReminderSummary({ ...state, dailyPrimeEnabled: false })).toContain('Daily reminder off');
  });

  it('round-trips haptic levels through the stored intensity', () => {
    (['light', 'medium', 'strong'] as const).forEach((level) => {
      expect(mapHapticIntensityToFeedback(mapFeedbackToHapticIntensity(level))).toBe(level);
    });
  });

  it('formats backup status and the device time zone', () => {
    expect(formatLastBackup(null)).toBe('Never. Back up now to protect your data.');
    expect(formatLastBackup('2026-10-25T12:00:00.000Z')).toMatch(/2026/);
    expect(deviceTimezoneSummary(new Date('2026-10-25T12:00:00Z'))).toMatch(/UTC[+−]\d/);
  });
});
