import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const LAST_MILESTONE_SHOWN_KEY = '@anchor_last_milestone_shown';

export interface ForgeMomentMilestone {
  type: 'rank' | 'constancy';
  name: string;
  primeCount?: number;
}

interface ForgeMomentState {
  activeMilestone: ForgeMomentMilestone | null;
  queuedMilestones: ForgeMomentMilestone[];
  queueMilestone: (milestone: ForgeMomentMilestone) => Promise<boolean>;
  dismissMilestone: () => void;
  resetMilestones: () => void;
}

function getMilestoneKey(milestone: ForgeMomentMilestone): string {
  return `${milestone.type}:${milestone.name}`;
}

export const useForgeMomentStore = create<ForgeMomentState>((set, get) => ({
  activeMilestone: null,
  queuedMilestones: [],

  queueMilestone: async (milestone) => {
    const milestoneKey = getMilestoneKey(milestone);
    const lastMilestoneShown = await AsyncStorage.getItem(LAST_MILESTONE_SHOWN_KEY);
    const { activeMilestone, queuedMilestones } = get();

    if (lastMilestoneShown === milestoneKey) {
      return false;
    }

    const isDuplicate =
      getMilestoneKey(activeMilestone ?? { type: 'rank', name: '' }) === milestoneKey ||
      queuedMilestones.some((item) => getMilestoneKey(item) === milestoneKey);

    if (isDuplicate) {
      return false;
    }

    await AsyncStorage.setItem(LAST_MILESTONE_SHOWN_KEY, milestoneKey);

    set((state) => {
      if (!state.activeMilestone) {
        return { activeMilestone: milestone, queuedMilestones: state.queuedMilestones };
      }

      return {
        activeMilestone: state.activeMilestone,
        queuedMilestones: [...state.queuedMilestones, milestone],
      };
    });

    return true;
  },

  dismissMilestone: () =>
    set((state) => ({
      activeMilestone: state.queuedMilestones[0] ?? null,
      queuedMilestones: state.queuedMilestones.slice(1),
    })),

  resetMilestones: () =>
    set({
      activeMilestone: null,
      queuedMilestones: [],
    }),
}));
