import { DeviceEventEmitter, DevSettings } from 'react-native';

export type DevOrientationMode = 'sensor' | 'portrait' | 'landscape';

let currentMode: DevOrientationMode = 'sensor';
let hasRegisteredDevMenu = false;
let isNativeModuleAvailable: boolean | null = null;

function getScreenOrientationModule(): typeof import('expo-screen-orientation') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-screen-orientation') as typeof import('expo-screen-orientation');
    if (typeof mod.unlockAsync === 'function' && typeof mod.lockAsync === 'function') {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if expo-screen-orientation native module is linked and ready in the current runtime.
 */
export async function isScreenOrientationAvailable(): Promise<boolean> {
  if (isNativeModuleAvailable !== null) {
    return isNativeModuleAvailable;
  }
  const mod = getScreenOrientationModule();
  if (!mod) {
    isNativeModuleAvailable = false;
    return false;
  }
  try {
    await mod.getOrientationLockAsync();
    isNativeModuleAvailable = true;
    return true;
  } catch {
    isNativeModuleAvailable = false;
    return false;
  }
}

/**
 * Sets orientation mode in development. Strictly a no-op in production.
 */
export async function setDevOrientation(mode: DevOrientationMode): Promise<{ ok: boolean; message?: string }> {
  if (!__DEV__) {
    return { ok: false, message: 'Orientation overrides are disabled in production builds.' };
  }

  const mod = getScreenOrientationModule();
  if (!mod) {
    return {
      ok: false,
      message: 'Native screen orientation module is not available. Please rebuild the dev client.',
    };
  }

  try {
    if (mode === 'landscape') {
      await mod.lockAsync(mod.OrientationLock.LANDSCAPE);
    } else if (mode === 'portrait') {
      await mod.lockAsync(mod.OrientationLock.PORTRAIT_UP);
    } else {
      await mod.unlockAsync();
    }
    currentMode = mode;
    DeviceEventEmitter.emit('anchor:dev-orientation-change', mode);
    return { ok: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `Failed to set orientation (${errorMsg}). Rebuild dev client with expo run:android.`,
    };
  }
}

/**
 * Toggles between portrait and landscape mode.
 */
export async function toggleDevOrientation(): Promise<{ ok: boolean; mode: DevOrientationMode; message?: string }> {
  const nextMode: DevOrientationMode = currentMode === 'landscape' ? 'portrait' : 'landscape';
  const result = await setDevOrientation(nextMode);
  return {
    ok: result.ok,
    mode: nextMode,
    message: result.message,
  };
}

/**
 * Gets the current dev orientation mode.
 */
export function getDevOrientationMode(): DevOrientationMode {
  return currentMode;
}

/**
 * Subscribes to orientation changes triggered via DevSettings, dev menu, or Developer Tools.
 */
export function subscribeDevOrientation(listener: (mode: DevOrientationMode) => void): () => void {
  const sub = DeviceEventEmitter.addListener('anchor:dev-orientation-change', listener);
  return () => {
    sub.remove();
  };
}

/**
 * Initializes orientation handling for development.
 * Automatically unlocks orientation to allow device tilt / auto-rotate,
 * and registers DevSettings and expo-dev-menu shortcuts.
 */
export function initDevOrientation(): void {
  if (!__DEV__) {
    return;
  }

  // Allow auto-rotate with device tilt by default in dev
  void setDevOrientation('sensor');

  if (hasRegisteredDevMenu) {
    return;
  }
  hasRegisteredDevMenu = true;

  try {
    DevSettings.addMenuItem?.('Toggle Landscape / Portrait', () => {
      void toggleDevOrientation();
    });
    DevSettings.addMenuItem?.('Auto-Rotate Orientation (Sensor)', () => {
      void setDevOrientation('sensor');
    });
  } catch {
    // DevSettings may not support addMenuItem in all environments
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const devMenu = require('expo-dev-menu') as {
      registerDevMenuItems?: (
        items: { name: string; callback: () => void; shouldCollapse?: boolean }[]
      ) => Promise<void>;
    };
    const devMenuPromise = devMenu.registerDevMenuItems?.([
      {
        name: 'Toggle Landscape / Portrait',
        callback: () => void toggleDevOrientation(),
        shouldCollapse: true,
      },
      {
        name: 'Auto-Rotate Orientation (Sensor)',
        callback: () => void setDevOrientation('sensor'),
        shouldCollapse: true,
      },
    ]);
    if (devMenuPromise && typeof devMenuPromise.catch === 'function') {
      devMenuPromise.catch(() => {
        // Native dev menu unavailable in this environment
      });
    }
  } catch {
    // Not running inside expo-dev-menu
  }
}
