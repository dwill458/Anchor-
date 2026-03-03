/**
 * Anchor App - Configuration
 *
 * Central configuration for the app.
 * For production, these values should be set via environment variables or build config.
 */

import { Platform } from 'react-native';

// Set EXPO_PUBLIC_DEV_API_URL in your .env to point at your local backend.
// e.g. EXPO_PUBLIC_DEV_API_URL=http://192.168.x.x:8000  (physical device)
//      EXPO_PUBLIC_DEV_API_URL=http://10.0.2.2:8000      (Android emulator)
// Falls back to localhost for CI / web dev.
export const API_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_DEV_API_URL ?? 'http://localhost:8000')
  : 'https://api.anchor.app';

export const Config = {
  API_URL,
};
