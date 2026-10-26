/**
 * Weekly Insight 2.0 rollout flag (client). The server independently gates the endpoints with
 * WEEKLY_INSIGHT_V2_ENABLED; if the server says FEATURE_DISABLED the app falls back to the
 * classic screen, so the two flags can never strand a user.
 */
export function isWeeklyInsightV2Enabled(env: string | undefined = process.env.EXPO_PUBLIC_WEEKLY_INSIGHT_V2): boolean {
  return env === 'true';
}
