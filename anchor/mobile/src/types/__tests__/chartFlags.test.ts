import {
  DEFAULT_CHART_FEATURE_FLAGS,
  resolveChartFeatureFlags,
} from '../chart';

describe('resolveChartFeatureFlags', () => {
  it('defaults Chart off when server flags are absent', () => {
    expect(resolveChartFeatureFlags(undefined, true)).toEqual(DEFAULT_CHART_FEATURE_FLAGS);
  });

  it('applies the more restrictive build-time backstop', () => {
    const enabledByServer = {
      chart_enabled: true,
      chart_write_enabled: true,
      chart_ai_planner_enabled: true,
      chart_reflections_enabled: true,
      chart_notifications_enabled: true,
      chart_existing_user_intro_enabled: true,
    };

    expect(resolveChartFeatureFlags(enabledByServer, false)).toEqual(DEFAULT_CHART_FEATURE_FLAGS);
    expect(resolveChartFeatureFlags(enabledByServer, true)).toEqual(enabledByServer);
  });

  /**
   * Decision D8 — AI plan review is deferred out of Phase 1.
   *
   * Deferral is the default state, not a change: every Chart flag is FROZEN OFF
   * by the contract freeze, `AIPlanReview` is a registered placeholder, and no
   * plan generation, persistence, versioning, or failure contract exists to
   * implement. This pins the default so enabling AI planning has to be a
   * deliberate act with a contract behind it.
   */
  it('leaves the AI planner off by default and turns nothing else on with it', () => {
    expect(DEFAULT_CHART_FEATURE_FLAGS.chart_ai_planner_enabled).toBe(false);
    expect(resolveChartFeatureFlags(undefined, true).chart_ai_planner_enabled).toBe(false);
    expect(resolveChartFeatureFlags({}, true).chart_ai_planner_enabled).toBe(false);

    // Enabling Chart itself must not imply the planner.
    const chartOnly = resolveChartFeatureFlags(
      { chart_enabled: true, chart_write_enabled: true },
      true,
    );
    expect(chartOnly.chart_enabled).toBe(true);
    expect(chartOnly.chart_ai_planner_enabled).toBe(false);
  });

  it('keeps every Chart flag off by default', () => {
    for (const value of Object.values(DEFAULT_CHART_FEATURE_FLAGS)) {
      expect(value).toBe(false);
    }
  });
});
