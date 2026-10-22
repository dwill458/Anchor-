import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * What each Anchor has already been celebrated for, with the real date. A stage celebrates fully
 * once per Anchor; reaching it again after decay is a quiet relight. Full Strength is a ceiling
 * moment: full the first time, short after decay, nothing when already there. These are facts about
 * the past, kept on this device. Plain AsyncStorage: dates and ids, nothing sensitive.
 */
export const CELEBRATION_RECORDS_STORAGE_KEY = '@anchor/v2/celebration-records';

export type CelebratedStageId = 'building' | 'established' | 'integrated' | 'reinforced';

export type AnchorCelebrationRecord = {
  /** ISO date each stage was first celebrated. */
  stages: Partial<Record<CelebratedStageId, string>>;
  /** ISO date Full Strength was first reached. */
  fullStrengthAt?: string;
  /** ISO date Full Strength was most recently reached again after decay. */
  fullStrengthLastAt?: string;
};

export type CelebrationOutcome = 'first' | 'repeat';

type CelebrationRecordsState = {
  records: Record<string, AnchorCelebrationRecord>;
  /** False until the stored record has been read. Never persisted. */
  hydrated: boolean;
  getRecord: (anchorId: string) => AnchorCelebrationRecord | undefined;
  /**
   * Notes that a stage was reached. 'first' when it had never been celebrated (the date is stored),
   * 'repeat' when it had (the original date is kept). Before hydration nothing is written and the
   * result is 'repeat', so an unread record can never replay a full celebration.
   */
  recordStage: (anchorId: string, stage: CelebratedStageId, at?: string) => CelebrationOutcome;
  /** Same contract for Full Strength: 'first' stores the date; 'repeat' updates only the last date. */
  recordFullStrength: (anchorId: string, at?: string) => CelebrationOutcome;
};

type PersistedRecords = { records?: Record<string, AnchorCelebrationRecord> };

const nowIso = () => new Date().toISOString();

export const useCelebrationRecordsStore = create<CelebrationRecordsState>()(
  persist(
    (set, get) => ({
      records: {},
      hydrated: false,
      getRecord: (anchorId) => get().records[anchorId],
      recordStage: (anchorId, stage, at = nowIso()) => {
        if (!get().hydrated) return 'repeat';
        const record = get().records[anchorId];
        if (record?.stages[stage]) return 'repeat';
        set((state) => {
          const current = state.records[anchorId] ?? { stages: {} };
          return { records: { ...state.records, [anchorId]: { ...current, stages: { ...current.stages, [stage]: at } } } };
        });
        return 'first';
      },
      recordFullStrength: (anchorId, at = nowIso()) => {
        if (!get().hydrated) return 'repeat';
        const record = get().records[anchorId];
        if (record?.fullStrengthAt) {
          set((state) => ({ records: { ...state.records, [anchorId]: { ...record, fullStrengthLastAt: at } } }));
          return 'repeat';
        }
        set((state) => {
          const current = state.records[anchorId] ?? { stages: {} };
          return { records: { ...state.records, [anchorId]: { ...current, fullStrengthAt: at } } };
        });
        return 'first';
      },
    }),
    {
      name: CELEBRATION_RECORDS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ records: state.records }),
      // Writes are refused before hydration, so any session record here is newer than the stored one.
      merge: (persistedState, currentState) => ({
        ...currentState,
        records: { ...((persistedState as PersistedRecords | undefined)?.records ?? {}), ...currentState.records },
      }),
      // Runs on success and on failure: an unreadable record must not leave scenes waiting forever.
      onRehydrateStorage: () => () => {
        useCelebrationRecordsStore.setState({ hydrated: true });
      },
    }
  )
);

/** Resolves once the stored records have been read, or after `timeoutMs` (default 800) so a slow read cannot hold a scene. */
export function celebrationRecordsReady(timeoutMs = 800): Promise<boolean> {
  if (useCelebrationRecordsStore.getState().hydrated) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsubscribe(); resolve(false); }, timeoutMs);
    const unsubscribe = useCelebrationRecordsStore.subscribe((state) => {
      if (!state.hydrated) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}
