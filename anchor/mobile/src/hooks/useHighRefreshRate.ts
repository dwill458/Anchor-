import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

type DisplayModeModule = {
  requestHighRefreshRate?: () => void;
  restoreDefault?: () => void;
};

/** A pending restore from a screen that has just gone; a new request cancels it. */
let restoreTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Asks Android for the panel's highest refresh rate (120 Hz where it exists) while `active`.
 * The native module is optional — iOS, Expo Go and builds that predate it silently do nothing —
 * and a panel with no faster mode simply keeps its own. `restoreDelayMs` keeps the rate a little
 * past unmount, for a hand-off whose animation plays on the next screen.
 */
export function useHighRefreshRate(active = true, restoreDelayMs = 0): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return undefined;
    const module = NativeModules.AnchorDisplayMode as DisplayModeModule | undefined;
    if (!module) return undefined;
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = null;
    module.requestHighRefreshRate?.();
    return () => {
      if (restoreDelayMs <= 0) {
        module.restoreDefault?.();
        return;
      }
      restoreTimer = setTimeout(() => {
        restoreTimer = null;
        module.restoreDefault?.();
      }, restoreDelayMs);
    };
  }, [active, restoreDelayMs]);
}
