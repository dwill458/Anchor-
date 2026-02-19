/**
 * Session Store — tracks the user's practice sessions locally.
 *
 * Local-first; API scaffolded for future sync.
 * Key: 'anchor-session-storage'
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeachingStore } from './teachingStore';

export type SessionType = 'activate' | 'reinforce' | 'stabilize';
export type SessionMode = 'silent' | 'mantra' | 'ambient';

export interface SessionLogEntry {
  id: string;
  anchorId: string;
  type: SessionType;
  durationSeconds: number;
  mode: SessionMode;
  reflectionWord?: string;
  completedAt: string; // ISO string
}

interface DayPractice {
  /** Local YYYY-MM-DD */
  date: string;
  sessionsCount: number;
  totalSeconds: number;
}

interface WeekPractice {
  /** ISO week key: YYYY-WNN */
  weekKey: string;
  sessionsCount: number;
  totalSeconds: number;
}

interface SessionState {
  lastSession: SessionLogEntry | null;
  todayPractice: DayPractice;
  weeklyPractice: WeekPractice;
  /**
   * Grace day tracking — ISO string of when a grace day was last consumed.
   * Used by calculateStreakWithGrace() in utils/streak.ts.
   * Set this externally when the user "uses" their grace day.
   */
  lastGraceDayUsedAt: string | null;
  /** Capped at 50 most-recent entries */
  sessionLog: SessionLogEntry[];

  // Actions
  recordSession: (entry: Omit<SessionLogEntry, 'id'>) => void;
  consumeGraceDay: () => void;
  /** Call on app foreground to reset today counters if the local date has rolled over */
  resetIfNewDay: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO week key: e.g. "2026-W07" */
function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7; // Monday = 1
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const EMPTY_TODAY = (): DayPractice => ({ date: localDateString(new Date()), sessionsCount: 0, totalSeconds: 0 });
const EMPTY_WEEK = (): WeekPractice => ({ weekKey: isoWeekKey(new Date()), sessionsCount: 0, totalSeconds: 0 });

const LOG_CAP = 50;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      lastSession: null,
      todayPractice: EMPTY_TODAY(),
      weeklyPractice: EMPTY_WEEK(),
      lastGraceDayUsedAt: null,
      sessionLog: [],

      recordSession: (entry) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const full: SessionLogEntry = { id, ...entry };

        const now = new Date();
        const todayKey = localDateString(now);
        const weekKey = isoWeekKey(now);

        set((state) => {
          // Reset today counters if date has changed
          const today: DayPractice =
            state.todayPractice.date === todayKey
              ? { ...state.todayPractice }
              : { date: todayKey, sessionsCount: 0, totalSeconds: 0 };

          // Reset week counters if week has changed
          const week: WeekPractice =
            state.weeklyPractice.weekKey === weekKey
              ? { ...state.weeklyPractice }
              : { weekKey, sessionsCount: 0, totalSeconds: 0 };

          const updatedLog = [full, ...state.sessionLog].slice(0, LOG_CAP);

          return {
            lastSession: full,
            todayPractice: {
              date: today.date,
              sessionsCount: today.sessionsCount + 1,
              totalSeconds: today.totalSeconds + entry.durationSeconds,
            },
            weeklyPractice: {
              weekKey: week.weekKey,
              sessionsCount: week.sessionsCount + 1,
              totalSeconds: week.totalSeconds + entry.durationSeconds,
            },
            sessionLog: updatedLog,
          };
        });

        // Wire teaching flags — deterministic booleans, never derived from counts
        const teaching = useTeachingStore.getState();
        if (
          (entry.type === 'activate' || entry.type === 'reinforce') &&
          !teaching.userFlags.hasCompletedFirstCharge
        ) {
          teaching.setUserFlag('hasCompletedFirstCharge', true);
          teaching.queueMilestone('milestone_first_charge_v1');
        }
        if (entry.type === 'stabilize' && !teaching.userFlags.hasCompletedFirstStabilize) {
          teaching.setUserFlag('hasCompletedFirstStabilize', true);
        }

        // TODO: scaffold backend sync — POST /api/sessions when auth token available
      },

      consumeGraceDay: () => {
        set({ lastGraceDayUsedAt: new Date().toISOString() });
      },

      resetIfNewDay: () => {
        const { todayPractice, weeklyPractice } = get();
        const now = new Date();
        const todayKey = localDateString(now);
        const weekKey = isoWeekKey(now);

        if (todayPractice.date !== todayKey) {
          set({ todayPractice: { date: todayKey, sessionsCount: 0, totalSeconds: 0 } });
        }
        if (weeklyPractice.weekKey !== weekKey) {
          set({ weeklyPractice: { weekKey, sessionsCount: 0, totalSeconds: 0 } });
        }
      },
    }),
    {
      name: 'anchor-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
