import { Platform } from 'react-native';

/**
 * Anchor App - Configuration
 *
 * Central configuration for the app.
 * For production, these values should be set via environment variables or build config.
 */

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
export const REVENUECAT_MONTHLY_PACKAGE_ID = '$rc_monthly';
export const REVENUECAT_ANNUAL_PACKAGE_ID = '$rc_annual';

const readOptionalPublicEnv = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '';
};

// RevenueCat *SDK* keys are publishable client identifiers, not secrets — the
// secret keys are the server-side `sk_...` keys, which never ship in the app.
// Keep source-level fallbacks (same approach as the Google client IDs below) so
// an OTA update bundled without EAS env injection still configures IAP instead
// of silently shipping a blank paywall.
const DEFAULT_REVENUECAT_IOS_API_KEY = 'appl_xtNGVPiFfkiUSuyuNdVTBQqhIia';
const DEFAULT_REVENUECAT_ANDROID_API_KEY = 'goog_FrflxNtkvcxQTrcatSsJbLQqQSC';
const DEFAULT_REVENUECAT_ENTITLEMENT_ID = 'pro';

const platformRevenueCatApiKey =
  Platform.OS === 'ios'
    ? readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY) ||
      DEFAULT_REVENUECAT_IOS_API_KEY
    : Platform.OS === 'android'
      ? readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY) ||
        DEFAULT_REVENUECAT_ANDROID_API_KEY
      : '';
export const REVENUECAT_API_KEY =
  platformRevenueCatApiKey || readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY);
export const REVENUECAT_ENTITLEMENT_ID =
  readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID) ||
  DEFAULT_REVENUECAT_ENTITLEMENT_ID;
export const REVENUECAT_DEFAULT_PACKAGE_ID =
  readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID) ||
  REVENUECAT_MONTHLY_PACKAGE_ID;
export const REVENUECAT_DEFAULT_PLAN_ID =
  REVENUECAT_DEFAULT_PACKAGE_ID === REVENUECAT_ANNUAL_PACKAGE_ID ? 'annual' : 'monthly';

// Google OAuth client IDs are public identifiers, not secrets. Keep a
// source-level fallback so preview/TestFlight builds still authenticate even
// when EAS env injection is missing.
const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '930118716037-lvbff0r43v9rqo61drvpcr8ih499fu6l.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  '930118716037-g86c5d1kj9a0kio795oai3mnmnf1ejek.apps.googleusercontent.com';

export const GOOGLE_WEB_CLIENT_ID =
  readOptionalPublicEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || DEFAULT_GOOGLE_WEB_CLIENT_ID;
export const GOOGLE_IOS_CLIENT_ID =
  readOptionalPublicEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) || DEFAULT_GOOGLE_IOS_CLIENT_ID;
export const ENABLE_GOOGLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN === 'true';
export const ENABLE_LEGACY_SUPABASE_SYNC =
  process.env.EXPO_PUBLIC_ENABLE_LEGACY_SUPABASE_SYNC === 'true';
export const ENABLE_MERCH = process.env.EXPO_PUBLIC_ENABLE_MERCH === 'true';

if (!__DEV__ && (!REVENUECAT_API_KEY || !REVENUECAT_ENTITLEMENT_ID)) {
  // KEEP: deliberate raw console diagnostic — logger is dev-gated and would
  // silence this production misconfiguration signal. With source-level
  // fallbacks in place this should only ever fire on an unsupported platform
  // (e.g. web) or if the fallbacks are removed — IAP would silently fail.
  // eslint-disable-next-line no-console
  console.error('[config] RevenueCat key/entitlement missing — IAP will silently fail');
}

export const Config = {
  API_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  REVENUECAT_MONTHLY_PACKAGE_ID,
  REVENUECAT_ANNUAL_PACKAGE_ID,
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_DEFAULT_PACKAGE_ID,
  REVENUECAT_DEFAULT_PLAN_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  ENABLE_GOOGLE_SIGN_IN,
  ENABLE_LEGACY_SUPABASE_SYNC,
  ENABLE_MERCH,
};
