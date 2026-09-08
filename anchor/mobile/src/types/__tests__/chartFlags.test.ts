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
});
