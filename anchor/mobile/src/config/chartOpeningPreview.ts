/** Replay access for the internal V2 preview; never enabled in production. */
export function isChartOpeningPreviewEnabled(
  appEnvironment: string | undefined = process.env.EXPO_PUBLIC_APP_ENV,
  v2Enabled: string | undefined = process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
): boolean {
  return (appEnvironment === 'staging' || appEnvironment === 'preview') && v2Enabled === 'true';
}
