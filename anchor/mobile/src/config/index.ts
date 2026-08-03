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

const readOptionalPublicEnv = (value: string | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '';
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const REVENUECAT_MONTHLY_PACKAGE_ID = '$rc_monthly';
export const REVENUECAT_ANNUAL_PACKAGE_ID = '$rc_annual';
// RevenueCat's reserved package identifier for a one-time, non-consumable purchase.
export const REVENUECAT_LIFETIME_PACKAGE_ID = '$rc_lifetime';
const platformRevenueCatApiKey =
  Platform.OS === 'ios'
    ? readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)
    : Platform.OS === 'android'
      ? readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY)
      : '';
const sharedRevenueCatApiKey = readOptionalPublicEnv(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY);
export const REVENUECAT_API_KEY = platformRevenueCatApiKey || sharedRevenueCatApiKey;
export const REVENUECAT_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? '';
export const REVENUECAT_DEFAULT_PACKAGE_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_DEFAULT_PACKAGE_ID ?? REVENUECAT_MONTHLY_PACKAGE_ID;
export const REVENUECAT_DEFAULT_PLAN_ID =
  REVENUECAT_DEFAULT_PACKAGE_ID === REVENUECAT_LIFETIME_PACKAGE_ID
    ? 'lifetime'
    : REVENUECAT_DEFAULT_PACKAGE_ID === REVENUECAT_ANNUAL_PACKAGE_ID
      ? 'annual'
      : 'monthly';

const expectedRevenueCatApiKeyPrefix =
  Platform.OS === 'ios' ? 'appl_' : Platform.OS === 'android' ? 'goog_' : '';
const usingSharedRevenueCatFallback = !platformRevenueCatApiKey && sharedRevenueCatApiKey.length > 0;
const hasRevenueCatApiKeyPrefixMismatch =
  expectedRevenueCatApiKeyPrefix.length > 0 &&
  REVENUECAT_API_KEY.length > 0 &&
  !REVENUECAT_API_KEY.startsWith(expectedRevenueCatApiKeyPrefix);

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
// Keep Google auth enabled unless it is explicitly disabled. EAS Update can
// publish without injecting build-profile booleans, and treating "missing" as
// false hides the login path in OTA bundles even when the native binary fully
// supports Google auth.
export const ENABLE_GOOGLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN !== 'false';
export const ENABLE_LEGACY_SUPABASE_SYNC =
  process.env.EXPO_PUBLIC_ENABLE_LEGACY_SUPABASE_SYNC === 'true';
export const ENABLE_MERCH = process.env.EXPO_PUBLIC_ENABLE_MERCH === 'true';
// Visualize ships in the 1.1.2 native binary. EAS Update can publish without
// build-profile booleans, so a missing value must not remove the mode from an
// otherwise compatible OTA bundle. Set this to "false" only for an explicit
// production rollback.
export const ENABLE_VISUALIZE = process.env.EXPO_PUBLIC_ENABLE_VISUALIZE !== 'false';
// Chart is deliberately default-off. The server flag is consumed separately
// by the Course store and can only make this build more restrictive.
export const ENABLE_CHART = process.env.EXPO_PUBLIC_ENABLE_CHART === 'true';
// Widgets aren't ready for this release — keep the native surface built but
// disable the JS-side sync/task-handler/deep-link wiring until they are.
export const WIDGETS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_WIDGETS === 'true';
export const IOS_BUNDLE_ID = 'com.anchorintentions.app';
export const ANDROID_PACKAGE_NAME = 'com.anchorintentions.app';
export const PASSWORD_RESET_CONTINUE_URL = readOptionalPublicEnv(
  process.env.EXPO_PUBLIC_PASSWORD_RESET_CONTINUE_URL
);
export const PASSWORD_RESET_LINK_DOMAIN = readOptionalPublicEnv(
  process.env.EXPO_PUBLIC_PASSWORD_RESET_LINK_DOMAIN
);

if (usingSharedRevenueCatFallback && (Platform.OS === 'ios' || Platform.OS === 'android')) {
  // KEEP: raw console diagnostic so Expo dev-client / OTA builds surface the
  // exact env source even before the app logger is configured.
  // eslint-disable-next-line no-console
  console.warn(
    `[config] RevenueCat is using shared EXPO_PUBLIC_REVENUECAT_API_KEY fallback on ${Platform.OS}. ` +
      `Set the platform-specific key to avoid cross-platform key mixups.`
  );
}

if (hasRevenueCatApiKeyPrefixMismatch) {
  // KEEP: deliberate raw console diagnostic — this usually means the wrong
  // public SDK key was injected for the current store platform.
  // eslint-disable-next-line no-console
  console.error(
    `[config] RevenueCat ${Platform.OS} API key prefix mismatch — expected ${expectedRevenueCatApiKeyPrefix}..., ` +
      `got ${REVENUECAT_API_KEY.slice(0, 5)}...`
  );
}

if (!__DEV__ && (!REVENUECAT_API_KEY || !REVENUECAT_ENTITLEMENT_ID)) {
  // KEEP: deliberate raw console diagnostic — logger is dev-gated and would
  // silence this production misconfiguration signal.
  // eslint-disable-next-line no-console
  console.error('[config] RevenueCat env not injected — IAP will silently fail');
}

export const Config = {
  API_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  REVENUECAT_MONTHLY_PACKAGE_ID,
  REVENUECAT_ANNUAL_PACKAGE_ID,
  REVENUECAT_LIFETIME_PACKAGE_ID,
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_DEFAULT_PACKAGE_ID,
  REVENUECAT_DEFAULT_PLAN_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  ENABLE_GOOGLE_SIGN_IN,
  ENABLE_LEGACY_SUPABASE_SYNC,
  ENABLE_MERCH,
  ENABLE_VISUALIZE,
  ENABLE_CHART,
  WIDGETS_ENABLED,
  IOS_BUNDLE_ID,
  ANDROID_PACKAGE_NAME,
  PASSWORD_RESET_CONTINUE_URL,
  PASSWORD_RESET_LINK_DOMAIN,
};
