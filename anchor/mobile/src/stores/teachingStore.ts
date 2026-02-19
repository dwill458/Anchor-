/**
 * Teaching Store
 *
 * Persistent state for the Micro-Teaching System.
 * Tracks which teachings have been shown, milestones queued, and
 * explicit behavioral flags that drive teaching triggers.
 *
 * Key: 'anchor-teaching-storage' | schemaVersion: 1
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
}

export interface TeachingState {
  schemaVersion: 1;
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
}

export const useTeachingStore = create<TeachingState>()(
  persist(
    (set, get) => ({
      schemaVersion: 1 as const,
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
      },

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
    }),
    {
      name: 'anchor-teaching-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Exclude session-only state from persistence
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        showCounts: state.showCounts,
        lastShownAt: state.lastShownAt,
        exhaustedIds: state.exhaustedIds,
        pendingMilestones: state.pendingMilestones,
        lastVeilCardAt: state.lastVeilCardAt,
        userFlags: state.userFlags,
      }),
    }
  )
);
