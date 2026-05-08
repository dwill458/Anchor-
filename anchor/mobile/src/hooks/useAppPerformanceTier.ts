import { useSettingsStore } from '@/stores/settingsStore';
import { usePerformanceTier } from './usePerformanceTier';

export type { PerformanceTier, PerformanceTierOverride } from './usePerformanceTier';

export const useAppPerformanceTier = () => {
  const override = useSettingsStore((state) => state.devPerfTierOverride);
  return usePerformanceTier({ override });
};
