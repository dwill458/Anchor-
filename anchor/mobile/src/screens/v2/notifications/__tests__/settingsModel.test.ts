import { deriveSettingsModel, shouldShowVisionChart } from '../settingsModel';

const base = {
  notification_enabled: true,
  notificationPermissionStatus: 'granted' as const,
  dailyPrimeEnabled: true,
  personalDailyReminderOptedIn: true,
  dailyPrimeTime: '20:30',
  momentumCheckinsEnabled: false,
  threadStrengthAlertsEnabled: false,
  unfinishedAnchorRemindersEnabled: false,
};

describe('deriveSettingsModel', () => {
  it('daily is on only when every condition and the native schedule agree', () => {
    expect(deriveSettingsModel(base, true).dailyOn).toBe(true);
    expect(deriveSettingsModel({ ...base, notification_enabled: false }, true).dailyOn).toBe(false);
    expect(deriveSettingsModel({ ...base, notificationPermissionStatus: 'undetermined' }, true).dailyOn).toBe(false);
    expect(deriveSettingsModel({ ...base, dailyPrimeEnabled: false }, true).dailyOn).toBe(false);
    expect(deriveSettingsModel({ ...base, personalDailyReminderOptedIn: false }, true).dailyOn).toBe(false);
  });

  it('daily is false when the native schedule is missing even if prefs say true', () => {
    expect(deriveSettingsModel(base, false).dailyOn).toBe(false);
  });

  it('formats the time label and shows Off when not on', () => {
    expect(deriveSettingsModel(base, true).timeLabel).toBe('8:30 PM');
    expect(deriveSettingsModel({ ...base, dailyPrimeTime: '00:05' }, true).timeLabel).toBe('12:05 AM');
    expect(deriveSettingsModel(base, false).timeLabel).toBe('Off');
  });

  it('flags OS denial', () => {
    expect(deriveSettingsModel({ ...base, notificationPermissionStatus: 'denied' }, false).osDenied).toBe(true);
    expect(deriveSettingsModel(base, true).osDenied).toBe(false);
  });

  it('momentum is on when any of the three flags is on', () => {
    expect(deriveSettingsModel(base, true).momentumOn).toBe(false);
    expect(deriveSettingsModel({ ...base, threadStrengthAlertsEnabled: true }, true).momentumOn).toBe(true);
    expect(deriveSettingsModel({ ...base, momentumCheckinsEnabled: true }, true).momentumOn).toBe(true);
  });

  it('tolerates a null state', () => {
    const m = deriveSettingsModel(null, false);
    expect(m.dailyOn).toBe(false);
    expect(m.timeLabel).toBe('Off');
  });
});

describe('shouldShowVisionChart', () => {
  const g = global as unknown as { __DEV__: boolean };
  const original = g.__DEV__;
  const envKey = 'EXPO_PUBLIC_ENABLE_SMART_REMINDER_TOGGLES';
  const originalEnv = process.env[envKey];
  afterEach(() => {
    g.__DEV__ = original;
    if (originalEnv === undefined) delete process.env[envKey];
    else process.env[envKey] = originalEnv;
  });

  it('is shown in dev builds', () => {
    g.__DEV__ = true;
    delete process.env[envKey];
    expect(shouldShowVisionChart()).toBe(true);
  });

  it('is hidden in production without the flag', () => {
    g.__DEV__ = false;
    delete process.env[envKey];
    expect(shouldShowVisionChart()).toBe(false);
    expect(deriveSettingsModel(base, true).showVisionChart).toBe(false);
  });

  it('is shown in production with the flag, but not for "false"/"0"', () => {
    g.__DEV__ = false;
    process.env[envKey] = 'true';
    expect(shouldShowVisionChart()).toBe(true);
    process.env[envKey] = 'false';
    expect(shouldShowVisionChart()).toBe(false);
    process.env[envKey] = '0';
    expect(shouldShowVisionChart()).toBe(false);
  });
});
