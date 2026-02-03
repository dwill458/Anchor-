export type AnalyticsProvider = 'mixpanel' | 'amplitude' | 'both' | 'none';

declare const process: {
  env: Record<string, string | undefined>;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

export const MobileEnv = {
  API_URL: process.env.EXPO_PUBLIC_API_URL,

  ANALYTICS_ENABLED: parseBoolean(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED, true),
  ANALYTICS_PROVIDER: (process.env.EXPO_PUBLIC_ANALYTICS_PROVIDER as AnalyticsProvider) || 'mixpanel',
  MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '',
  AMPLITUDE_API_KEY: process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || '',

  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  SENTRY_ENVIRONMENT: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),

  FIREBASE_PERF_ENABLED: parseBoolean(process.env.EXPO_PUBLIC_FIREBASE_PERF_ENABLED, !__DEV__),

  REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '',
  REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '',
  REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '',
  REVENUECAT_ENTITLEMENT_PRO: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO || 'pro',
};
