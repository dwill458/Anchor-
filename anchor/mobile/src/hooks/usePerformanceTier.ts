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
import { AccessibilityInfo, Dimensions, PixelRatio, Platform } from 'react-native';

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
    try {
      const screen = Dimensions.get('screen');
      const pixelRatio = PixelRatio.get();
      const physicalPixelCount = screen.width * screen.height * pixelRatio * pixelRatio;

      // Budget 720p Android displays (e.g. Moto G Play, Galaxy A0x/A1x) have ~1.15M physical pixels
      if (physicalPixelCount > 0 && physicalPixelCount < 2_000_000) {
        return 'low';
      }
    } catch {
      // Dimensions not available in some test environments
    }

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

export const isKnownHighEndAndroidDevice = (device: ExpoDeviceModule | null): boolean => {
  if (!device || Platform.OS !== 'android') {
    return false;
  }

  const brand = normalizeDeviceText(device.brand || device.manufacturer);
  const model = normalizeDeviceText(device.modelName || device.designName);
  const fingerprint = `${brand} ${model}`;

  return (
    /samsung/.test(brand) &&
      /(s2[0-9]\b|s2[0-9].*(ultra|plus|\+|fe)|galaxy\s*s2[0-9]|sm-[sg]9\d{2}\w*|sm-s7[12]1\w*|sm-g78\d\w*|sm-n98\w*|sm-f\d{3}\w*|z fold|z flip|galaxy tab s[7-9]|sm-x\d{3}\w*)/i.test(fingerprint)
  ) || (
    /google/.test(brand) &&
      /(pixel\s?(6|7|8|9|10)(\s(pro|xl|fold|a))?|pixel\s?fold)/i.test(fingerprint)
  ) || (
    /oneplus/.test(brand) &&
      /(oneplus\s?(9|10|11|12|13)|oneplus\s?open|nord\s?[3-5])/i.test(fingerprint)
  ) || (
    /xiaomi|poco|redmi/.test(brand) &&
      /(xiaomi\s?(12|13|14|15)|poco\s?f[4-7]|mix\s?fold)/i.test(fingerprint)
  ) || (
    /motorola/.test(brand) &&
      /(edge\s?(30|40|50|pro|plus|\+)|razr\s?(40|50|\+)?)/i.test(fingerprint)
  ) || (
    /sony/.test(brand) &&
      /(xperia\s?(1|5))/i.test(fingerprint)
  ) || (
    /asus/.test(brand) &&
      /(rog\s?phone|zenfone\s?(9|10|11))/i.test(fingerprint)
  );
};

export const isKnownLowEndAndroidDevice = (device: ExpoDeviceModule | null): boolean => {
  if (!device || Platform.OS !== 'android') {
    return false;
  }

  const brand = normalizeDeviceText(device.brand || device.manufacturer);
  const model = normalizeDeviceText(device.modelName || device.designName);
  const fingerprint = `${brand} ${model}`;

  return (
    /moto.*g.*play|moto.*e\b|motorola.*fogona|xt2413/i.test(fingerprint) ||
    /galaxy.*a0\d|galaxy.*a1[0-4]|sm-a0\d|sm-a1[0-4]/i.test(fingerprint) ||
    /redmi.*(9|10|12)c?|redmi.*a[1-3]/i.test(fingerprint)
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

    if (isKnownLowEndAndroidDevice(device)) {
      return 'low';
    }

    const memoryBytes = device.totalMemory;
    const memoryGb =
      memoryBytes !== null && memoryBytes !== undefined && memoryBytes > 0
        ? memoryBytes / 1_073_741_824
        : null;

    const yearClass = device.deviceYearClass;
    if (yearClass !== null && yearClass !== undefined && yearClass > 0) {
      // On Android, the legacy YearClass library can misreport modern devices (e.g. 2016 or -1)
      // due to SELinux CPU restriction. Do not let yearClass downgrade modern hardware with >= 3.8GB RAM.
      const isModernAndroidWithSufficientRam =
        Platform.OS === 'android' && memoryGb !== null && memoryGb >= 3.8;

      if (!isModernAndroidWithSufficientRam) {
        if (yearClass < 2019) tier = minTier(tier, 'low');
        else if (yearClass < 2021) tier = minTier(tier, 'medium');
      }
    }

    if (memoryGb !== null) {
      if (Platform.OS === 'android') {
        // Android reserves 300-500MB of RAM for kernel/radio. Devices with 4GB physical RAM
        // report ~3.5-3.8GB totalMemory. On modern Android, <=4GB physical is budget entry-level.
        if (memoryGb < 3.8) {
          tier = minTier(tier, 'low');
        } else if (memoryGb < 5.5) {
          tier = minTier(tier, 'medium');
        } else {
          // >= 5.5GB reported RAM (6GB+ physical) on modern Android (SDK >= 31) qualifies as high tier.
          const sdk = typeof Platform.Version === 'number' ? Platform.Version : 0;
          if (sdk >= 31) {
            tier = maxTier(tier, 'high');
          } else {
            tier = maxTier(tier, 'medium');
          }
        }
      } else {
        if (memoryGb < 2) tier = minTier(tier, 'low');
        else if (memoryGb < 3) tier = minTier(tier, 'medium');
      }
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
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  // Accessibility reduce motion listener
  useEffect(() => {
    let mounted = true;
    let sub: { remove(): void } | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotionEnabled(enabled);
      })
      .catch(() => {});

    try {
      sub = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (enabled) => {
          if (mounted) setReduceMotionEnabled(enabled);
        },
      );
    } catch {
      // accessibility info not supported
    }

    return () => {
      mounted = false;
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

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
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  return useMemo<PerformanceTier>(() => {
    if (override !== 'auto') return override;
    if (reduceMotionEnabled || lowPowerMode) return 'low';
    return deviceTier;
  }, [override, reduceMotionEnabled, lowPowerMode, deviceTier]);
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
