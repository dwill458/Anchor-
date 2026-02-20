/**
 * Teaching Store
 *
 * Persistent state for the Micro-Teaching System.
 * Tracks which teachings have been shown, milestones queued, and
 * explicit behavioral flags that drive teaching triggers.
 *
 * Key: 'anchor-teaching-storage' | schemaVersion: 2
 *
 * sessionSeenIds + sessionSeenPatterns are intentionally NOT persisted —
 * they reset each app session to allow Ground Note pattern-level cooldowns
 * to work correctly per session.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TeachingPattern } from '@/constants/teaching';

export interface TeachingUserFlags {
  hasCreatedFirstAnchor: boolean;
  hasCompletedFirstCharge: boolean;
  hasCompletedFirstBurn: boolean;
  hasCompletedFirstStabilize: boolean;
  hasTracedBefore: boolean;
}

export interface TeachingState {
  schemaVersion: 2;
  /** How many times each teaching has been shown. */
  showCounts: Record<string, number>;
  /** ISO timestamps of last show per teaching. */
  lastShownAt: Record<string, string>;
  /**
   * O(1) exhaustion lookup. A teaching is added here when
   * showCounts[id] >= content.maxShows (and maxShows > 0).
   */
  exhaustedIds: Record<string, true>;
  /** IDs of milestone teachings waiting to be shown. Drained 1 per 10s on AppState active. */
  pendingMilestones: string[];
  /** ISO timestamp of last Veil Card shown. Pattern-level 24h cooldown. */
  lastVeilCardAt: string | null;
  /** Deterministic behavioral flags — explicit booleans, never derived from counts. */
  userFlags: TeachingUserFlags;
  /** How many times each trace hint cap key has surfaced. */
  traceHintSeenCounts: Record<string, number>;
  /** O(1) lookup for trace hint keys that should never be shown again. */
  traceHintExhaustedIds: Record<string, true>;

  // Session-only (NOT persisted — reset each app foreground)
  sessionSeenIds: string[];
  sessionSeenPatterns: TeachingPattern[];

  // Actions
  recordShown: (id: string, pattern: TeachingPattern, maxShows: number) => void;
  isExhausted: (id: string) => boolean;
  isOnCooldown: (id: string, cooldownMs: number) => boolean;
  isSessionSeen: (id: string) => boolean;
  queueMilestone: (id: string) => void;
  dequeueMilestone: () => string | undefined;
  clearSessionSeen: () => void;
  setUserFlag: (flag: keyof TeachingUserFlags, value: boolean) => void;
  recordTraceHintSeen: (id: string) => void;
  exhaustTraceHint: (id: string) => void;
  isTraceHintExhausted: (id: string) => boolean;
}

export const useTeachingStore = create<TeachingState>()(
  persist(
    (set, get) => ({
      schemaVersion: 2 as const,
      showCounts: {},
      lastShownAt: {},
      exhaustedIds: {},
      pendingMilestones: [],
      lastVeilCardAt: null,
      userFlags: {
        hasCreatedFirstAnchor: false,
        hasCompletedFirstCharge: false,
        hasCompletedFirstBurn: false,
        hasCompletedFirstStabilize: false,
        hasTracedBefore: false,
      },
      traceHintSeenCounts: {},
      traceHintExhaustedIds: {},

      // Session-only — initialized empty, not persisted
      sessionSeenIds: [],
      sessionSeenPatterns: [],

      recordShown: (id, pattern, maxShows) => {
        set((state) => {
          const newCount = (state.showCounts[id] ?? 0) + 1;
          const nowExhausted =
            maxShows > 0 && newCount >= maxShows
              ? { ...state.exhaustedIds, [id]: true as const }
              : state.exhaustedIds;

          const newSessionSeenIds = state.sessionSeenIds.includes(id)
            ? state.sessionSeenIds
            : [...state.sessionSeenIds, id];

          const newSessionSeenPatterns = state.sessionSeenPatterns.includes(pattern)
            ? state.sessionSeenPatterns
            : [...state.sessionSeenPatterns, pattern];

          return {
            showCounts: { ...state.showCounts, [id]: newCount },
            lastShownAt: { ...state.lastShownAt, [id]: new Date().toISOString() },
            exhaustedIds: nowExhausted,
            lastVeilCardAt:
              pattern === 'glass_card' ? new Date().toISOString() : state.lastVeilCardAt,
            sessionSeenIds: newSessionSeenIds,
            sessionSeenPatterns: newSessionSeenPatterns,
          };
        });
      },

      isExhausted: (id) => id in get().exhaustedIds,

      isOnCooldown: (id, cooldownMs) => {
        const lastShown = get().lastShownAt[id];
        if (!lastShown) return false;
        return Date.now() - new Date(lastShown).getTime() < cooldownMs;
      },

      isSessionSeen: (id) => get().sessionSeenIds.includes(id),

      queueMilestone: (id) => {
        set((state) => {
          // Don't queue if already exhausted or already pending
          if (id in state.exhaustedIds || state.pendingMilestones.includes(id)) {
            return state;
          }
          return { pendingMilestones: [...state.pendingMilestones, id] };
        });
      },

      dequeueMilestone: () => {
        const { pendingMilestones } = get();
        if (pendingMilestones.length === 0) return undefined;
        const [first, ...rest] = pendingMilestones;
        set({ pendingMilestones: rest });
        return first;
      },

      clearSessionSeen: () => {
        set({ sessionSeenIds: [], sessionSeenPatterns: [] });
      },

      setUserFlag: (flag, value) => {
        set((state) => ({
          userFlags: { ...state.userFlags, [flag]: value },
        }));
      },

      recordTraceHintSeen: (id) => {
        set((state) => ({
          traceHintSeenCounts: {
            ...state.traceHintSeenCounts,
            [id]: (state.traceHintSeenCounts[id] ?? 0) + 1,
          },
        }));
      },

      exhaustTraceHint: (id) => {
        set((state) => ({
          traceHintExhaustedIds: { ...state.traceHintExhaustedIds, [id]: true },
        }));
      },

      isTraceHintExhausted: (id) => id in get().traceHintExhaustedIds,
    }),
    {
      name: 'anchor-teaching-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const userFlags = {
          hasCreatedFirstAnchor: false,
          hasCompletedFirstCharge: false,
          hasCompletedFirstBurn: false,
          hasCompletedFirstStabilize: false,
          hasTracedBefore: false,
          ...(persistedState.userFlags ?? {}),
        };

        return {
          ...persistedState,
          schemaVersion: 2 as const,
          userFlags,
          traceHintSeenCounts: persistedState.traceHintSeenCounts ?? {},
          traceHintExhaustedIds: persistedState.traceHintExhaustedIds ?? {},
        };
      },
      // Exclude session-only state from persistence
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        showCounts: state.showCounts,
        lastShownAt: state.lastShownAt,
        exhaustedIds: state.exhaustedIds,
        pendingMilestones: state.pendingMilestones,
        lastVeilCardAt: state.lastVeilCardAt,
        userFlags: state.userFlags,
        traceHintSeenCounts: state.traceHintSeenCounts,
        traceHintExhaustedIds: state.traceHintExhaustedIds,
      }),
    }
  )
);
