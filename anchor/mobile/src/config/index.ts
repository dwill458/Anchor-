/**
 * Anchor App - Configuration
 *
 * Central configuration for the app.
 * For production, these values should be set via environment variables or build config.
 */

import { Platform } from 'react-native';

// EXPO_PUBLIC_API_URL overrides ALL build modes (dev and production).
// Use this to point any APK build at a local or staging backend via ngrok/tunnel:
//   EXPO_PUBLIC_API_URL=https://xxxx.ngrok.io
//
// For dev-only local backend (only used when __DEV__=true and EXPO_PUBLIC_API_URL is not set):
//   EXPO_PUBLIC_DEV_API_URL=http://192.168.x.x:8000  (physical device)
//   EXPO_PUBLIC_DEV_API_URL=http://10.0.2.2:8000      (Android emulator)
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__
    ? (process.env.EXPO_PUBLIC_DEV_API_URL ?? 'http://localhost:8000')
    : 'https://anchor-production-26bf.up.railway.app');

export const Config = {
  API_URL,
};
