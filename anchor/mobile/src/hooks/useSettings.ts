import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActivationMode,
  ChargeDurationPreset,
  ChargeMode,
} from '@/stores/settingsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import type {
  AnchorSettings,
  FocusDuration,
  PrimingDuration,
  PrimingMode,
} from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

const PRIME_ON_LAUNCH_KEY = '@anchor_prime_on_launch';
const LEGACY_OPEN_DAILY_ANCHOR_KEY = 'anchor:settings:openDailyAnchorAuto';

const SETTINGS_KEY_MAP: Record<keyof AnchorSettings, string> = {
  primingMode: 'anchor:settings:primingMode',
  primingDuration: 'anchor:settings:primingDuration',
  openDailyAnchorAutomatically: PRIME_ON_LAUNCH_KEY,
  practiceGuidanceEnabled: 'anchor:settings:practiceGuidance',
  focusDuration: 'anchor:settings:focusDuration',
  focusDefaultMode: 'anchor:settings:focusDefaultMode',
  focusBurstGoal: 'anchor:settings:focusBurstGoal',
  reduceIntentionVisibility: 'anchor:settings:reduceIntentionVisibility',
  dailyReminderEnabled: 'anchor:settings:dailyReminder',
  dailyReminderTime: 'anchor:settings:dailyReminderTime',
  streakProtectionAlertsEnabled: 'anchor:settings:streakAlerts',
  weeklySummaryEnabled: 'anchor:settings:weeklySummary',
  hapticFeedback: 'anchor:settings:hapticFeedback',
  soundEffectsEnabled: 'anchor:settings:soundEffects',
  dev_developerModeEnabled: 'anchor:dev:developerModeEnabled',
  dev_overridesEnabled: 'anchor:dev:overridesEnabled',
  dev_simulatedTier: 'anchor:dev:simulatedTier',
  dev_skipOnboarding: 'anchor:dev:skipOnboarding',
  dev_allowDirectAnchorDelete: 'anchor:dev:allowDirectAnchorDelete',
  dev_debugLogging: 'anchor:dev:debugLogging',
  dev_forceStreakBreak: 'anchor:dev:forceStreakBreak',
};

const FOCUS_DURATION_PRESETS: ReadonlyArray<FocusDuration> = [10, 30, 60];
const PRIMING_DURATION_BY_PRESET: Record<ChargeDurationPreset, PrimingDuration> = {
  '30s': 30,
  '1m': 120,
  '2m': 120,
  '5m': 300,
  '10m': 300,
  custom: 300,
};

const clampFocusDuration = (value: number): number => Math.min(60, Math.max(10, Math.round(value)));
const clampFocusBurstGoal = (value: number): number => Math.min(20, Math.max(1, Math.round(value)));

const mapChargeModeToPrimingMode = (mode: ChargeMode): PrimingMode =>
  mode === 'ritual' ? 'deep' : 'quick';

const mapPrimingModeToChargeMode = (mode: PrimingMode): ChargeMode =>
  mode === 'deep' ? 'ritual' : 'focus';

const mapChargePresetToPrimingDuration = (preset: ChargeDurationPreset): PrimingDuration =>
  PRIMING_DURATION_BY_PRESET[preset] ?? DEFAULT_SETTINGS.primingDuration;

const mapPrimingDurationToChargePreset = (duration: PrimingDuration): ChargeDurationPreset => {
  if (duration === 30) {
    return '30s';
  }
  if (duration === 120) {
    return '2m';
  }
  return '5m';
};

const mapHapticIntensityToFeedback = (intensity: number): AnchorSettings['hapticFeedback'] => {
  if (intensity <= 0) {
    return 'none';
  }
  if (intensity <= 33) {
    return 'light';
  }
  if (intensity <= 66) {
    return 'medium';
  }
  return 'strong';
};

const mapFeedbackToHapticIntensity = (feedback: AnchorSettings['hapticFeedback']): number => {
  switch (feedback) {
    case 'none':
      return 0;
    case 'light':
      return 25;
    case 'medium':
      return 55;
    case 'strong':
    default:
      return 80;
  }
};

const mapDefaultActivationToFocusDuration = (): FocusDuration => {
  const { defaultActivation } = useSettingsStore.getState();
  if (defaultActivation.unit !== 'seconds') {
    return DEFAULT_SETTINGS.focusDuration;
  }

  const clamped = clampFocusDuration(defaultActivation.value);
  return FOCUS_DURATION_PRESETS.includes(clamped) ? clamped : clamped;
};

const getBridgeDefaults = (): AnchorSettings => {
  const settings = useSettingsStore.getState();
  const subscription = useSubscriptionStore.getState();

  return {
    ...DEFAULT_SETTINGS,
    primingMode: mapChargeModeToPrimingMode(settings.defaultCharge.mode),
    primingDuration: mapChargePresetToPrimingDuration(settings.defaultCharge.preset),
    openDailyAnchorAutomatically: settings.openDailyAnchorAutomatically,
    practiceGuidanceEnabled: settings.guideMode,
    focusDuration: mapDefaultActivationToFocusDuration(),
    focusDefaultMode:
      settings.defaultActivation.mode === 'ambient' ? 'ambient' : DEFAULT_SETTINGS.focusDefaultMode,
    focusBurstGoal: settings.dailyPracticeGoal,
    reduceIntentionVisibility: settings.reduceIntentionVisibility,
    dailyReminderEnabled: settings.dailyReminderEnabled,
    dailyReminderTime: settings.dailyReminderTime,
    streakProtectionAlertsEnabled: settings.streakProtectionAlerts,
    weeklySummaryEnabled: settings.weeklySummaryEnabled,
    hapticFeedback: mapHapticIntensityToFeedback(settings.hapticIntensity),
    soundEffectsEnabled: settings.soundEffectsEnabled,
    dev_developerModeEnabled: settings.developerModeEnabled,
    dev_overridesEnabled: subscription.devOverrideEnabled,
    dev_simulatedTier: subscription.devTierOverride,
    dev_skipOnboarding: settings.developerSkipOnboardingEnabled,
    dev_allowDirectAnchorDelete: settings.developerDeleteWithoutBurnEnabled,
    dev_debugLogging: settings.debugLoggingEnabled,
    dev_forceStreakBreak: settings.developerForceStreakBreakEnabled,
  };
};

const applySettingsToStores = (settings: AnchorSettings): void => {
  useSettingsStore.setState((current) => ({
    ...current,
    defaultCharge: {
      mode: mapPrimingModeToChargeMode(settings.primingMode),
      preset: mapPrimingDurationToChargePreset(settings.primingDuration),
      customMinutes: undefined,
    },
    defaultActivation: {
      ...current.defaultActivation,
      type: 'visual',
      unit: 'seconds',
      value: clampFocusDuration(settings.focusDuration),
      mode: settings.focusDefaultMode as ActivationMode,
    },
    openDailyAnchorAutomatically: settings.openDailyAnchorAutomatically,
    dailyPracticeGoal: clampFocusBurstGoal(settings.focusBurstGoal),
    reduceIntentionVisibility: settings.reduceIntentionVisibility,
    dailyReminderEnabled: settings.dailyReminderEnabled,
    dailyReminderTime: settings.dailyReminderTime,
    streakProtectionAlerts: settings.streakProtectionAlertsEnabled,
    weeklySummaryEnabled: settings.weeklySummaryEnabled,
    hapticIntensity: mapFeedbackToHapticIntensity(settings.hapticFeedback),
    soundEffectsEnabled: settings.soundEffectsEnabled,
    developerModeEnabled: __DEV__ ? settings.dev_developerModeEnabled : current.developerModeEnabled,
    developerSkipOnboardingEnabled: __DEV__
      ? settings.dev_skipOnboarding
      : current.developerSkipOnboardingEnabled,
    developerForceStreakBreakEnabled: __DEV__
      ? settings.dev_forceStreakBreak
      : current.developerForceStreakBreakEnabled,
    developerDeleteWithoutBurnEnabled: __DEV__
      ? settings.dev_allowDirectAnchorDelete
      : current.developerDeleteWithoutBurnEnabled,
    debugLoggingEnabled: __DEV__ ? settings.dev_debugLogging : current.debugLoggingEnabled,
    guideMode: settings.practiceGuidanceEnabled,
  }));

  if (__DEV__) {
    useSubscriptionStore.setState((current) => ({
      ...current,
      devOverrideEnabled: settings.dev_overridesEnabled,
      devTierOverride: settings.dev_simulatedTier,
    }));
  }
};

const loadStoredSettings = async (): Promise<Partial<AnchorSettings>> => {
  const entries = await AsyncStorage.multiGet(Object.values(SETTINGS_KEY_MAP));
  const entryMap = new Map(entries);
  const stored = {} as Record<keyof AnchorSettings, AnchorSettings[keyof AnchorSettings] | undefined>;

  (Object.keys(SETTINGS_KEY_MAP) as Array<keyof AnchorSettings>).forEach((key) => {
    const rawValue = entryMap.get(SETTINGS_KEY_MAP[key]);
    if (!rawValue) {
      return;
    }

    try {
      stored[key] = JSON.parse(rawValue) as AnchorSettings[typeof key];
    } catch {
      stored[key] = rawValue as AnchorSettings[typeof key];
    }
  });

  return stored as Partial<AnchorSettings>;
};

const readOpenDailyAnchorAutomaticallySetting = async (): Promise<boolean | undefined> => {
  const nextRawValue = await AsyncStorage.getItem(PRIME_ON_LAUNCH_KEY);
  const legacyRawValue =
    nextRawValue == null
      ? await AsyncStorage.getItem(LEGACY_OPEN_DAILY_ANCHOR_KEY)
      : null;
  const rawValue = nextRawValue ?? legacyRawValue;

  if (rawValue == null) {
    return undefined;
  }

  let parsedValue: boolean;
  try {
    parsedValue = JSON.parse(rawValue) as boolean;
  } catch {
    parsedValue = rawValue === 'true' || rawValue === '1';
  }

  if (nextRawValue == null && legacyRawValue != null) {
    await AsyncStorage.setItem(PRIME_ON_LAUNCH_KEY, JSON.stringify(parsedValue));
    await AsyncStorage.removeItem(LEGACY_OPEN_DAILY_ANCHOR_KEY);
  }

  return parsedValue;
};

const persistSettings = async (settings: AnchorSettings): Promise<void> => {
  const entries = (Object.keys(SETTINGS_KEY_MAP) as Array<keyof AnchorSettings>).map(
    (key): [string, string] => [SETTINGS_KEY_MAP[key], JSON.stringify(settings[key])]
  );
  await AsyncStorage.multiSet(entries);
  await AsyncStorage.removeItem(LEGACY_OPEN_DAILY_ANCHOR_KEY);
};

export const loadSettingsSnapshot = async (): Promise<AnchorSettings> => {
  const openDailyAnchorAutomatically = await readOpenDailyAnchorAutomaticallySetting();
  const snapshot = {
    ...getBridgeDefaults(),
    ...(await loadStoredSettings()),
    ...(openDailyAnchorAutomatically == null
      ? null
      : { openDailyAnchorAutomatically }),
  };
  applySettingsToStores(snapshot);
  return snapshot;
};

export async function getSetting<K extends keyof AnchorSettings>(
  key: K
): Promise<AnchorSettings[K]> {
  if (key === 'openDailyAnchorAutomatically') {
    const value = await readOpenDailyAnchorAutomaticallySetting();
    return (value ?? getBridgeDefaults()[key]) as AnchorSettings[K];
  }

  const rawValue = await AsyncStorage.getItem(SETTINGS_KEY_MAP[key]);
  if (rawValue == null) {
    return getBridgeDefaults()[key];
  }

  try {
    return JSON.parse(rawValue) as AnchorSettings[K];
  } catch {
    return rawValue as AnchorSettings[K];
  }
}

export async function setSetting<K extends keyof AnchorSettings>(
  key: K,
  value: AnchorSettings[K]
): Promise<void> {
  const nextSettings = {
    ...(await loadSettingsSnapshot()),
    [key]: value,
  };
  await AsyncStorage.setItem(SETTINGS_KEY_MAP[key], JSON.stringify(value));
  if (key === 'openDailyAnchorAutomatically') {
    await AsyncStorage.removeItem(LEGACY_OPEN_DAILY_ANCHOR_KEY);
  }
  applySettingsToStores(nextSettings);
}

export async function resetSettings(): Promise<void> {
  await persistSettings(DEFAULT_SETTINGS);
  applySettingsToStores(DEFAULT_SETTINGS);
}

export function useSettingsState() {
  const [settings, setSettings] = useState<AnchorSettings>(getBridgeDefaults());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadSettingsSnapshot()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }
        setSettings(snapshot);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AnchorSettings>(key: K, value: AnchorSettings[K]) => {
      setSettings((current) => {
        const nextSettings = { ...current, [key]: value };
        applySettingsToStores(nextSettings);
        return nextSettings;
      });

      await AsyncStorage.setItem(SETTINGS_KEY_MAP[key], JSON.stringify(value));
      if (key === 'openDailyAnchorAutomatically') {
        await AsyncStorage.removeItem(LEGACY_OPEN_DAILY_ANCHOR_KEY);
      }
    },
    []
  );

  const handleResetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await persistSettings(DEFAULT_SETTINGS);
    applySettingsToStores(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings: handleResetSettings,
    isLoading,
  };
}
