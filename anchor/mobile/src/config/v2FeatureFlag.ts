/** V2 must never activate in a release build, regardless of environment text. */
export function isAnchorV2DevEnabled(value: string | undefined, isDevelopment: boolean): boolean {
  return isDevelopment && value === 'true';
}
