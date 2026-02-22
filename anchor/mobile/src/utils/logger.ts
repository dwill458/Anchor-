/**
 * Anchor App - Logger Utility
 *
 * Simple logging utility for development and debugging
 */

import { useSettingsStore } from '@/stores/settingsStore';

const isDebugLoggingEnabled = (): boolean => {
  if (!__DEV__) {
    return false;
  }

  const envEnabled = process.env.EXPO_PUBLIC_DEBUG_LOGGING === 'true';
  const runtimeEnabled = useSettingsStore.getState().debugLoggingEnabled;
  return envEnabled || runtimeEnabled;
};

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (isDebugLoggingEnabled()) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (isDebugLoggingEnabled()) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  error: (message: string, error?: any, ...args: any[]) => {
    if (isDebugLoggingEnabled()) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  },

  debug: (message: string, ...args: any[]) => {
    if (isDebugLoggingEnabled()) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};
