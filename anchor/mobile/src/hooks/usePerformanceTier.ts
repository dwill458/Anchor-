/**
 * usePerformanceTier — classifies the current device for glow/animation budget.
 *
 * Tiers:
 *   high   — full Skia stack, per-frame particles, blur effects
 *   medium — Skia aura only, no per-frame glow canvas, no dashed rings
 *   low    — baked static glow + scale/opacity transforms only
 *
 * Signal priority (worst case wins):
 *   1. Manual override (user-facing "Visual quality" setting)
 *   2. Accessibility reduce-motion → low
 *   3. iOS Low Power Mode / Android Battery Saver → low
 *   4. expo-device year class < 2019 → low, < 2021 → medium
 *   5. expo-device totalMemory < 2 GB → low, < 3 GB → medium
 *   6. Platform.OS + Platform.Version + PixelRatio (sync fallback)
 *
 * Run `npx expo install expo-device expo-battery` if these packages are not
 * yet installed. The hook degrades gracefully if they are missing.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Platform } from 'react-native';

export type PerformanceTier = 'high' | 'medium' | 'low';

export type PerformanceTierOverride = PerformanceTier | 'auto';

interface ExpoDeviceModule {
  deviceYearClass?: number | null;
  totalMemory?: number | null;
  brand?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  designName?: string | null;
}

interface ExpoBatteryPowerState {
  lowPowerMode?: boolean;
}

interface ExpoBatterySubscription {
  remove(): void;
}

interface ExpoBatteryModule {
  getPowerStateAsync?: () => Promise<ExpoBatteryPowerState>;
  addLowPowerModeListener?: (
    listener: (state: ExpoBatteryPowerState) => void,
  ) => ExpoBatterySubscription;
}

interface UsePerformanceTierOptions {
  /**
   * Manual override. `'auto'` (default) means derive from device signals.
   * Wire this to a user-facing "Visual quality" setting when ready.
   */
  override?: PerformanceTierOverride;
}

const TIER_RANK: Record<PerformanceTier, number> = { high: 2, medium: 1, low: 0 };

const minTier = (a: PerformanceTier, b: PerformanceTier): PerformanceTier =>
  TIER_RANK[a] <= TIER_RANK[b] ? a : b;

const maxTier = (a: PerformanceTier, b: PerformanceTier): PerformanceTier =>
  TIER_RANK[a] >= TIER_RANK[b] ? a : b;

const loadExpoDevice = (): ExpoDeviceModule | null => {
  try {
    // Optional dependency in test and partial install environments.
    return require('expo-device') as ExpoDeviceModule;
  } catch {
    return null;
  }
};

const loadExpoBattery = (): ExpoBatteryModule | null => {
  try {
    // Optional dependency in test and partial install environments.
    return require('expo-battery') as ExpoBatteryModule;
  } catch {
    return null;
  }
};

const detectPlatformTier = (): PerformanceTier => {
  if (Platform.OS === 'ios') {
    return 'high';
  }
  if (Platform.OS === 'android') {
    const sdk = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (sdk > 0 && sdk < 29) return 'low';
    if (sdk >= 31) {
      return PixelRatio.get() < 2 ? 'medium' : 'high';
    }
    return 'medium';
  }
  return 'medium';
};

const normalizeDeviceText = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const isKnownHighEndAndroidDevice = (device: ExpoDeviceModule | null): boolean => {
  if (!device || Platform.OS !== 'android') {
    return false;
  }

  const brand = normalizeDeviceText(device.brand || device.manufacturer);
  const model = normalizeDeviceText(device.modelName || device.designName);
  const fingerprint = `${brand} ${model}`;

  return (
    /samsung/.test(brand) &&
      /(s2[4-9].*ultra|sm-s92[8-9]\w*|sm-s93\d\w*|z fold\d|z flip\d)/.test(fingerprint)
  ) || (
    /google/.test(brand) &&
      /(pixel\s?(8|9)(\s(pro|xl|fold))?)/.test(fingerprint)
  ) || (
    /oneplus/.test(brand) &&
      /(oneplus\s?(12|13)|open)/.test(fingerprint)
  );
};

export const getDetectedPerformanceTier = (): PerformanceTier => {
  let tier: PerformanceTier = detectPlatformTier();
  const device = loadExpoDevice();

  if (!device) {
    return tier;
  }

  try {
    if (isKnownHighEndAndroidDevice(device)) {
      return maxTier(tier, 'high');
    }

    const yearClass = device.deviceYearClass;
    if (yearClass !== null && yearClass !== undefined) {
      if (yearClass < 2019) tier = minTier(tier, 'low');
      else if (yearClass < 2021) tier = minTier(tier, 'medium');
    }

    const memoryBytes = device.totalMemory;
    if (memoryBytes !== null && memoryBytes !== undefined && memoryBytes > 0) {
      const memoryGb = memoryBytes / 1_073_741_824;
      if (memoryGb < 2) tier = minTier(tier, 'low');
      else if (memoryGb < 3) tier = minTier(tier, 'medium');
    }
  } catch {
    // expo-device not available — platform tier is sufficient
  }

  return tier;
};

export const usePerformanceTier = (
  options: UsePerformanceTierOptions = {},
): PerformanceTier => {
  const { override = 'auto' } = options;

  const [deviceTier] = useState<PerformanceTier>(getDetectedPerformanceTier);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Battery low-power / battery-saver listener
  useEffect(() => {
    let mounted = true;
    let sub: { remove(): void } | null = null;
    const battery = loadExpoBattery();

    battery?.getPowerStateAsync?.()
      .then((state) => {
        if (mounted) setLowPowerMode(!!state?.lowPowerMode);
      })
      .catch(() => {});

    try {
      sub = battery?.addLowPowerModeListener?.(({ lowPowerMode: lpm }) => {
        if (mounted) setLowPowerMode(!!lpm);
      }) ?? null;
    } catch {
      // expo-battery not available
    }

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  // Accessibility reduce-motion listener
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isEnabled: boolean) => setReduceMotion(isEnabled),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return useMemo<PerformanceTier>(() => {
    if (override !== 'auto') return override;
    if (reduceMotion || lowPowerMode) return 'low';
    return deviceTier;
  }, [override, reduceMotion, lowPowerMode, deviceTier]);
};

export const useDetectedPerformanceTier = (): PerformanceTier => {
  const [deviceTier] = useState<PerformanceTier>(getDetectedPerformanceTier);
  return deviceTier;
};

/**
 * Pure helper so all glow components agree on what each tier enables.
 */
export const tierPolicy = (tier: PerformanceTier) => ({
  enableSkiaAura: tier !== 'low',
  enablePerFrameGlow: tier === 'high',
  enableDashedRings: tier !== 'low',
  enableParticles: tier === 'high',
  enableBlurViews: tier !== 'low',
  blurIntensity: tier === 'high' ? 30 : tier === 'medium' ? 12 : 0,
  particleMultiplier: tier === 'high' ? 1 : tier === 'medium' ? 0.5 : 0,
  rayMultiplier: tier === 'high' ? 1 : tier === 'medium' ? 0.6 : 0,
});
