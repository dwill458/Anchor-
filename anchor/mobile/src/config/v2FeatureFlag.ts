/** V2 is opt-in in development and in the explicitly marked staging preview build. */
export function isAnchorV2Enabled(
  value: string | undefined,
  isDevelopment: boolean,
  appEnvironment: string | undefined
): boolean {
  return value === 'true' && (isDevelopment || appEnvironment === 'staging');
}
