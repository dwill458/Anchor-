/**
 * usePerformanceTier — classifies the current device for glow/animation budget.
 *
 * Tiers:
 *   high   — full Skia stack, per-frame particles, blur effects
 *   medium — Skia aura only, no per-frame glow canvas, no dashed rings
 *   low    — baked static glow + scale/opacity transforms only
 *
 * Inputs:
 *   - Platform.OS / Platform.Version  (iOS assumed homogeneous; Android gated on SDK)
 *   - PixelRatio                       (rough proxy for low-density budget phones)
 *   - AccessibilityInfo reduce-motion  (respect accessibility → force low)
 *   - Optional manual override         (from a settings store / user toggle)
 *
 * No new deps required. A battery/thermal signal can be added later by wiring
 * expo-battery into the override source.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, PixelRatio, Platform } from 'react-native';

export type PerformanceTier = 'high' | 'medium' | 'low';

export type PerformanceTierOverride = PerformanceTier | 'auto';

interface UsePerformanceTierOptions {
  /**
   * Manual override. `'auto'` (default) means derive from device signals.
   * Wire this to a user-facing "Visual quality" setting when ready.
   */
  override?: PerformanceTierOverride;
}

const detectBaseTier = (): PerformanceTier => {
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

export const usePerformanceTier = (
  options: UsePerformanceTierOptions = {},
): PerformanceTier => {
  const { override = 'auto' } = options;
  const [reduceMotion, setReduceMotion] = useState(false);

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
    if (reduceMotion) return 'low';
    return detectBaseTier();
  }, [override, reduceMotion]);
};

/**
 * Pure helper for components that already receive a tier and need to decide
 * which sub-effects to render. Centralizes the policy so all glow components
 * agree on what each tier means.
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
