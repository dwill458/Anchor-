import { create } from 'zustand';
import type { V2RecommendationAction } from '@/constants/v2/practice';

/**
 * In-memory dev preview of the Today card's recommendation. Display only: it is never written
 * to the server, the recommendation cache, or any persisted store. `null` restores the real
 * recommendation, and restarting the app also clears it.
 */
type DevRecommendationOverrideState = {
  action: V2RecommendationAction | null;
  setAction: (action: V2RecommendationAction | null) => void;
};

export const useDevRecommendationOverride = create<DevRecommendationOverrideState>((set) => ({
  action: null,
  setAction: (action) => set({ action }),
}));
