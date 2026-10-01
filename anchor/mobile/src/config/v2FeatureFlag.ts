export function isAnchorV2Enabled(
  value: string | undefined,
  isDevelopment: boolean,
  appEnvironment: string | undefined
): boolean {
  if (value === 'false') return false;
  return value === 'true' || isDevelopment || appEnvironment === 'staging' || appEnvironment === 'preview';
}
