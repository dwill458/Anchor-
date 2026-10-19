import { create } from 'zustand';
import { getMilestoneSpec } from '@/milestones/registry';
import { uncelebrated, type MilestoneRecord } from '@/milestones/milestoneModel';

/**
 * Milestones waiting to be presented this session. It is only a queue: ownership lives on the
 * server, and the presentation receipt is written by `settleMilestone` when a celebration ends.
 * Several unlocks at once line up here and play one after another, never stacked.
 */
export type MilestonePresentation = {
  /** Unique per presentation. A replay of the same milestone gets its own key. */
  key: string;
  /** `award` settles the receipt when it ends; `replay` changes nothing anywhere. */
  mode: 'award' | 'replay';
  accountId: string | null;
  record: MilestoneRecord;
};

type MilestoneCelebrationState = {
  queue: MilestonePresentation[];
  /** Ids queued or presented this session, so a stale unsettled read can never queue one twice. */
  seen: string[];
  /** Queues records not yet celebrated, oldest first. Returns how many were added. */
  enqueueAwards: (records: readonly MilestoneRecord[], accountId: string | null) => number;
  /** Queues a replay of an earned milestone. It never awards, settles or writes anything. */
  requestReplay: (record: MilestoneRecord) => void;
  /** Removes the presentation that just ended. */
  shift: (key: string) => void;
  reset: () => void;
};

let replayCounter = 0;

export const useMilestoneCelebrationStore = create<MilestoneCelebrationState>()((set, get) => ({
  queue: [],
  seen: [],

  enqueueAwards: (records, accountId) => {
    const { seen, queue } = get();
    const fresh = uncelebrated(records).filter((record) => !seen.includes(record.id));
    if (fresh.length === 0) return 0;
    const additions = fresh.map<MilestonePresentation>((record) => ({ key: `award:${record.id}`, mode: 'award', accountId, record }));
    // Awards play before any replay that happens to be waiting, in the order they were earned.
    const firstReplay = queue.findIndex((item) => item.mode === 'replay');
    const next = firstReplay === -1 ? [...queue, ...additions] : [...queue.slice(0, firstReplay), ...additions, ...queue.slice(firstReplay)];
    set({ queue: next, seen: [...seen, ...fresh.map((record) => record.id)] });
    return fresh.length;
  },

  requestReplay: (record) => {
    if (!getMilestoneSpec(record.definitionId)) return;
    set((state) =>
      state.queue.some((item) => item.mode === 'replay' && item.record.id === record.id)
        ? state
        : { queue: [...state.queue, { key: `replay:${record.id}:${(replayCounter += 1)}`, mode: 'replay', accountId: null, record }] },
    );
  },

  shift: (key) => set((state) => ({ queue: state.queue.filter((item) => item.key !== key) })),

  reset: () => set({ queue: [], seen: [] }),
}));
