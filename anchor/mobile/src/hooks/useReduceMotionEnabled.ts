import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

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
 * Effective reduce-motion state: the in-app Settings preference wins; 'system'
 * (the default) follows the OS flag. On Android the OS flag is also true when
 * "Remove animations" is on or the animator scale is 0, so the in-app override
 * is the only way for those users to get ambient animation back.
 */
export const useReduceMotionEnabled = (): boolean => {
  const preference = useSettingsStore((state) => state.reduceMotion ?? 'system');
  const systemReduceMotionEnabled = useSystemReduceMotionEnabled();

  if (preference === 'system') {
    return systemReduceMotionEnabled;
  }

  return preference === 'on';
};

/**
 * For sacred ritual flows (like Anchor Creation) that exist to be watched as a deliberate,
 * meaningful sequence rather than a generic UI utility transition.
 *
 * It only reduces motion if the user explicitly enabled 'reduceMotion: on' in Anchor settings.
 * It is NOT automatically collapsed by Android OS developer settings (animator_duration_scale=0)
 * or vendor accessibility flags (Samsung One UI "Remove animations").
 */
export const useCreationReduceMotion = (): boolean => {
  const preference = useSettingsStore((state) => state.reduceMotion ?? 'system');
  return preference === 'on';
};

