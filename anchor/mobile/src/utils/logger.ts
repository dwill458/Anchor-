/**
 * Anchor App - Logger Utility
 *
 * Simple logging utility for development and debugging
 */

const isDev = __DEV__;

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  error: (message: string, error?: any, ...args: any[]) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  },

  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};
