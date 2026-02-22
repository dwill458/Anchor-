import Constants from 'expo-constants';

const parseSampleRate = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const appSlug = Constants.expoConfig?.slug ?? 'anchor-v2';
const appVersion = Constants.expoConfig?.version ?? '0.0.0';

const sentryEnabledInDev = process.env.EXPO_PUBLIC_ENABLE_SENTRY_IN_DEV === 'true';

export const monitoringConfig = {
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  release: process.env.EXPO_PUBLIC_APP_RELEASE ?? `${appSlug}@${appVersion}`,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sentryEnabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN) && (!__DEV__ || sentryEnabledInDev),
  traceSampleRate: parseSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, __DEV__ ? 1 : 0.2),
  profileSampleRate: parseSampleRate(process.env.EXPO_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE, __DEV__ ? 1 : 0.1),
  slowRequestThresholdMs: Number(process.env.EXPO_PUBLIC_SLOW_REQUEST_MS ?? 2000),
};

