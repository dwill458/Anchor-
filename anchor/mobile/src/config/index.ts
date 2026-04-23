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

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
export const REVENUECAT_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? '';
export const REVENUECAT_DEFAULT_PACKAGE_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID ?? '$rc_monthly';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const Config = {
  API_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_DEFAULT_PACKAGE_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
};
