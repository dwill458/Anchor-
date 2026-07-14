import { create } from 'zustand';

import {
  MILESTONE_DEFINITIONS,
  type MarkMilestoneId,
  type RankMilestoneId,
} from '@/constants/milestones';
import {
  getPendingMilestoneAwards,
  markMilestoneDismissed,
  markMilestoneShown,
  type MilestoneAward,
} from '@/utils/milestoneTracking';
import { logger } from '@/utils/logger';

// Retained for one migration window so sign-out can remove the legacy plaintext key.
export const LAST_MILESTONE_SHOWN_KEY = '@anchor_last_milestone_shown';

export interface ForgeMomentMilestone {
  id?: RankMilestoneId | MarkMilestoneId;
  type: 'rank' | 'mark';
  name: string;
  primeCount?: number;
  rankName?: string;
  markIndex?: number;
}

interface ForgeMomentState {
  scopeId: string | null;
  activeMilestone: ForgeMomentMilestone | null;
  queuedMilestones: ForgeMomentMilestone[];
  hydrateScope: (scopeId: string | null) => Promise<void>;
  queueMilestone: (milestone: ForgeMomentMilestone) => Promise<boolean>;
  markActiveShown: () => Promise<void>;
  dismissMilestone: () => Promise<void>;
  resetMilestones: () => void;
}

let dismissingKey: string | null = null;

function getMilestoneKey(milestone: ForgeMomentMilestone): string {
  return milestone.id ?? `${milestone.type}:${milestone.name}`;
}

function toForgeMilestone(award: MilestoneAward): ForgeMomentMilestone {
  return {
    id: award.id,
    type: award.category,
    name: MILESTONE_DEFINITIONS[award.id].name,
    primeCount: award.presentation.primeCount,
    rankName: award.presentation.rankName,
    markIndex: award.presentation.markIndex,
  };
}

export const useForgeMomentStore = create<ForgeMomentState>((set, get) => ({
  scopeId: null,
  activeMilestone: null,
  queuedMilestones: [],

  hydrateScope: async (scopeId) => {
    if (!scopeId) {
      set({ scopeId: null, activeMilestone: null, queuedMilestones: [] });
      return;
    }

    if (get().scopeId !== scopeId) {
      set({ scopeId, activeMilestone: null, queuedMilestones: [] });
    }

    try {
      const pending = (await getPendingMilestoneAwards(scopeId)).map(toForgeMilestone);
      if (get().scopeId !== scopeId) return;

      set((state) => {
        const existingKeys = new Set(
          [state.activeMilestone, ...state.queuedMilestones]
            .filter((item): item is ForgeMomentMilestone => Boolean(item))
            .map(getMilestoneKey)
        );
        const additions = pending.filter((item) => !existingKeys.has(getMilestoneKey(item)));
        if (additions.length === 0) return state;
        if (!state.activeMilestone) {
          return {
            activeMilestone: additions[0],
            queuedMilestones: [...state.queuedMilestones, ...additions.slice(1)],
          };
        }
        return { queuedMilestones: [...state.queuedMilestones, ...additions] };
      });
    } catch (error) {
      logger.error('[forgeMomentStore] Failed to hydrate milestone outbox', error);
    }
  },

  // Developer previews remain ephemeral. Production awards enter through the
  // persisted milestone ledger and hydrateScope above.
  queueMilestone: async (milestone) => {
    let queued = false;
    set((state) => {
      const milestoneKey = getMilestoneKey(milestone);
      const isDuplicate =
        (state.activeMilestone && getMilestoneKey(state.activeMilestone) === milestoneKey) ||
        state.queuedMilestones.some((item) => getMilestoneKey(item) === milestoneKey);
      if (isDuplicate) return state;
      queued = true;
      if (!state.activeMilestone) return { activeMilestone: milestone };
      return { queuedMilestones: [...state.queuedMilestones, milestone] };
    });
    return queued;
  },

  markActiveShown: async () => {
    const { activeMilestone, scopeId } = get();
    if (!activeMilestone?.id || !scopeId) return;
    try {
      await markMilestoneShown(scopeId, activeMilestone.id);
    } catch (error) {
      logger.error('[forgeMomentStore] Failed to acknowledge shown milestone', error);
    }
  },

  dismissMilestone: async () => {
    const { activeMilestone, scopeId } = get();
    if (!activeMilestone) return;
    const activeKey = getMilestoneKey(activeMilestone);
    if (dismissingKey === activeKey) return;
    dismissingKey = activeKey;

    try {
      if (activeMilestone?.id && scopeId) {
        await markMilestoneDismissed(scopeId, activeMilestone.id);
      }
      set((state) => {
        if (
          !state.activeMilestone ||
          getMilestoneKey(state.activeMilestone) !== activeKey
        ) {
          return state;
        }
        return {
          activeMilestone: state.queuedMilestones[0] ?? null,
          queuedMilestones: state.queuedMilestones.slice(1),
        };
      });
    } catch (error) {
      logger.error('[forgeMomentStore] Failed to acknowledge dismissed milestone', error);
    } finally {
      if (dismissingKey === activeKey) dismissingKey = null;
    }
  },

  resetMilestones: () => {
    dismissingKey = null;
    set({ scopeId: null, activeMilestone: null, queuedMilestones: [] });
  },
}));
