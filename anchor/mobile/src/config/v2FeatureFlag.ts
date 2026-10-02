export function isAnchorV2Enabled(
  value: string | undefined = process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
  isDevelopment: boolean = __DEV__,
  appEnvironment: string | undefined = process.env.EXPO_PUBLIC_APP_ENV
): boolean {
  if (value === 'false') return false;
  return (
    value === 'true' ||
    isDevelopment ||
    appEnvironment === 'staging' ||
    appEnvironment === 'preview' ||
    appEnvironment === 'development'
  );
}
