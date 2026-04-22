/**
 * useAppPerformanceTier — usePerformanceTier wired to the settings store.
 *
 * Reads `devPerfTierOverride` from settingsStore so the dev-menu tier picker
 * takes effect globally without requiring each component to plumb the value.
 * In production builds the override is always 'auto'.
 */
import { useSettingsStore } from '@/stores/settingsStore';
import { usePerformanceTier, type PerformanceTier } from './usePerformanceTier';

export const useAppPerformanceTier = (): PerformanceTier => {
  const override = useSettingsStore((s) => s.devPerfTierOverride);
  return usePerformanceTier({ override: __DEV__ ? override : 'auto' });
};
