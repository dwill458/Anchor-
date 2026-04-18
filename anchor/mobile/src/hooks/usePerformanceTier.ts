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
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';

export type PerformanceTier = 'high' | 'medium' | 'low';

export type PerformanceTierOverride = PerformanceTier | 'auto';

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

const detectDeviceTier = (): PerformanceTier => {
  let tier: PerformanceTier = detectPlatformTier();

  try {
    const yearClass = Device.deviceYearClass;
    if (yearClass !== null && yearClass !== undefined) {
      if (yearClass < 2019) tier = minTier(tier, 'low');
      else if (yearClass < 2021) tier = minTier(tier, 'medium');
    }

    const memoryBytes = Device.totalMemory;
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

  const [deviceTier] = useState<PerformanceTier>(detectDeviceTier);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Battery low-power / battery-saver listener
  useEffect(() => {
    let mounted = true;
    let sub: { remove(): void } | null = null;

    Battery.getPowerStateAsync()
      .then((state) => {
        if (mounted) setLowPowerMode(!!state.lowPowerMode);
      })
      .catch(() => {});

    try {
      sub = Battery.addLowPowerModeListener(({ lowPowerMode: lpm }) => {
        if (mounted) setLowPowerMode(lpm);
      });
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
      setReduceMotion,
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
