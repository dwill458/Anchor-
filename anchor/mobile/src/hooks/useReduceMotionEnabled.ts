import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';
import { isLowEndDevice } from '@/utils/deviceTier';

export const useSystemReduceMotionEnabled = (): boolean => {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotionEnabled(enabled);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReduceMotionEnabled(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isEnabled: boolean) => setReduceMotionEnabled(isEnabled)
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
};

/**
 * Effective reduce-motion state:
 * - On low-end devices (or when the developer overrides performance tier to 'low'),
 *   reduce-motion is 100% enabled to protect frame rate and memory.
 * - If a developer explicitly sets devPerfTierOverride to 'high' or 'medium',
 *   the setting preference / system accessibility flag is respected.
 * - On standard/high-tier hardware, the in-app Settings preference wins; 'system'
 *   (the default) follows the OS accessibility flag.
 */
export const useReduceMotionEnabled = (): boolean => {
  const preference = useSettingsStore((state) => state.reduceMotion ?? 'system');
  const devPerfTierOverride = useSettingsStore((state) => state.devPerfTierOverride ?? 'auto');
  const systemReduceMotionEnabled = useSystemReduceMotionEnabled();

  // If developer forced a non-low tier in dev tools, honor preference / system
  if (devPerfTierOverride === 'high' || devPerfTierOverride === 'medium') {
    if (preference === 'system') {
      return systemReduceMotionEnabled;
    }
    return preference === 'on';
  }

  // Low-end phones or forced low tier are 100% reduce-motion
  if (devPerfTierOverride === 'low' || isLowEndDevice) {
    return true;
  }

  if (preference === 'system') {
    return systemReduceMotionEnabled;
  }

  return preference === 'on';
};

/**
 * Creation uses the same explicit preference policy as the rest of Anchor:
 * system follows accessibility, on reduces motion, and off requests full motion.
 * Creation's animation clocks remain explicit so Reanimated cannot independently
 * collapse a timeline whose JavaScript stages are still running.
 */
export const useCreationReduceMotion = (): boolean => {
  const preference = useReduceMotionEnabled();
  const system = useSystemReduceMotionEnabled();
  return preference || system;
};
