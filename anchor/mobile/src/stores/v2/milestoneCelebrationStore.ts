import { create } from 'zustand';
import { getMilestoneSpec } from '@/milestones/registry';
import { uncelebrated, type MilestoneRecord } from '@/milestones/milestoneModel';

/**
 * Milestones waiting to be presented this session. It is only a queue: ownership lives on the
 * server, and the presentation receipt is written by `settleMilestone` when a celebration ends.
 * Only a server-reserved featured award may enter the automatic queue.
 */
export type MilestonePresentation = {
  /** Unique per presentation. A replay of the same milestone gets its own key. */
  key: string;
  /** `award` settles the receipt when it ends; `replay` changes nothing anywhere. */
  mode: 'award' | 'replay';
  accountId: string | null;
  record: MilestoneRecord;
  onReturn?: () => void;
  transition?: boolean;
  origin?: { x: number; y: number };
  isActive?: () => boolean;
};

type MilestoneCelebrationState = {
  queue: MilestonePresentation[];
  /** Ids queued or presented this session, so a stale unsettled read can never queue one twice. */
  seen: string[];
  holds: string[];
  hold: (key: string) => void;
  release: (key: string) => void;
  origin: { sessionId: string; anchorId: string; x: number; y: number } | null;
  setOrigin: (origin: MilestoneCelebrationState['origin']) => void;
  takeOrigin: (record: MilestoneRecord) => { x: number; y: number } | undefined;
  /** Bounded to one reserved automatic award. Gallery reads cannot enqueue history. */
  enqueueAwards: (records: readonly MilestoneRecord[], accountId: string | null, isActive?: () => boolean, onReturn?: () => void) => number;
  /** Queues a replay of an earned milestone. It never awards, settles or writes anything. */
  requestReplay: (record: MilestoneRecord, onReturn?: () => void) => void;
  /** Removes the presentation that just ended. */
  shift: (key: string) => void;
  reset: () => void;
};

let replayCounter = 0;

export const useMilestoneCelebrationStore = create<MilestoneCelebrationState>()((set, get) => ({
  queue: [],
  seen: [],
  holds: [],
  origin: null,
  setOrigin: (origin) => set({ origin }),
  takeOrigin: (record) => {
    const origin = get().origin;
    if (!origin || origin.anchorId !== record.anchorId || origin.sessionId !== record.sourceEntityId) return undefined;
    set({ origin: null });
    return { x: origin.x, y: origin.y };
  },
  hold: (key) => set(state => ({ holds: state.holds.includes(key) ? state.holds : [...state.holds, key] })),
  release: (key) => set(state => ({ holds: state.holds.filter(id => id !== key) })),

  enqueueAwards: (records, accountId, isActive, onReturn) => {
    const { seen, queue } = get();
    if (queue.some(item => item.mode === 'award')) return 0;
    const fresh = uncelebrated(records).filter((record) => !seen.includes(record.id) &&
      record.presentationId && Date.parse(record.presentationExpiresAt ?? '') > Date.now()).slice(0, 1);
    if (fresh.length === 0) return 0;
    const additions = fresh.map<MilestonePresentation>((record) => ({ key: `award:${record.id}`, mode: 'award', accountId, record, transition: true, isActive, onReturn }));
    // Awards play before any replay that happens to be waiting, in the order they were earned.
    const firstReplay = queue.findIndex((item) => item.mode === 'replay');
    const next = firstReplay === -1 ? [...queue, ...additions] : [...queue.slice(0, firstReplay), ...additions, ...queue.slice(firstReplay)];
    set({ queue: next, seen: [...seen, ...fresh.map((record) => record.id)] });
    return fresh.length;
  },

  requestReplay: (record, onReturn) => {
    if (!getMilestoneSpec(record.definitionId)) return;
    set((state) =>
      state.queue.some((item) => item.mode === 'replay' && item.record.id === record.id)
        ? state
        : { queue: [...state.queue, { key: `replay:${record.id}:${(replayCounter += 1)}`, mode: 'replay', accountId: null, record, onReturn }] },
    );
  },

  shift: (key) => set((state) => ({ queue: state.queue.filter((item) => item.key !== key) })),

  reset: () => set({ queue: [], seen: [], origin: null }),
}));
