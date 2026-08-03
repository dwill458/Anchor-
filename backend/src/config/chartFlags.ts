import { env } from './env';
import { AppError } from '../api/middleware/errorHandler';
import type { ChartFeatureFlags } from '../types/chart';

export function getChartFeatureFlags(): ChartFeatureFlags {
  return {
    chart_enabled: env.ENABLE_CHART,
    chart_write_enabled: env.ENABLE_CHART && env.ENABLE_CHART_WRITE,
    chart_ai_planner_enabled: env.ENABLE_CHART && env.ENABLE_CHART_AI_PLANNER,
    chart_reflections_enabled: env.ENABLE_CHART && env.ENABLE_CHART_REFLECTIONS,
    chart_notifications_enabled: env.ENABLE_CHART && env.ENABLE_CHART_NOTIFICATIONS,
    chart_existing_user_intro_enabled: env.ENABLE_CHART && env.ENABLE_CHART_EXISTING_USER_INTRO,
  };
}

export function requireChartEnabled(): void {
  if (!getChartFeatureFlags().chart_enabled) {
    throw new AppError('Chart is currently disabled', 403, 'FEATURE_DISABLED');
  }
}

export function requireChartWriteEnabled(): void {
  const flags = getChartFeatureFlags();
  if (!flags.chart_enabled || !flags.chart_write_enabled) {
    throw new AppError('Chart writes are currently disabled', 403, 'FEATURE_DISABLED');
  }
}

export function requireChartPlannerEnabled(): void {
  const flags = getChartFeatureFlags();
  if (!flags.chart_enabled || !flags.chart_ai_planner_enabled) {
    throw new AppError('Chart planning is currently disabled', 403, 'FEATURE_DISABLED');
  }
}

export function requireChartReflectionWritesEnabled(): void {
  const flags = getChartFeatureFlags();
  if (!flags.chart_enabled || !flags.chart_write_enabled || !flags.chart_reflections_enabled) {
    throw new AppError('Chart reflections are currently disabled', 403, 'FEATURE_DISABLED');
  }
}

export function requireChartInitialized(chartSchemaVersion: number, write = true): void {
  if (chartSchemaVersion !== 1) {
    throw new AppError(
      write ? 'Chart migration is required' : 'Chart migration is required',
      409,
      'MIGRATION_REQUIRED'
    );
  }
}
