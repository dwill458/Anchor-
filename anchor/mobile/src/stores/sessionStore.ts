/**
 * Session Store — tracks the user's practice sessions locally.
 *
 * Local-first; API scaffolded for future sync.
 * Key: 'anchor-session-storage'
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import { useTeachingStore } from './teachingStore';
import { apiClient } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';

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

  // Thread Strength fields
  /** 0–100. Decays on missed days, recovers on priming sessions. */
  threadStrength: number;
  /** Lifetime priming session count — never decrements. */
  totalSessionsCount: number;
  /** YYYY-MM-DD of last priming session, or null. */
  lastPrimedAt: string | null;
  /** [Mon–Sun] true = primed that day, for the current ISO week. */
  weekHistory: boolean[];
  /** ISO week key (e.g. "2026-W11") — used to detect week rollover. */
  weekHistoryKey: string;
  /** YYYY-MM-DD of the last day decay was applied — prevents double-apply. */
  lastDecayDate: string | null;

  // Actions
  recordSession: (entry: Omit<SessionLogEntry, 'id'>) => void;
  consumeGraceDay: () => void;
  /** Call on app foreground to reset today counters if the local date has rolled over */
  resetIfNewDay: () => void;
  /** Apply thread strength decay for missed days. Call on app open / screen focus. */
  applyDecay: () => void;
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
const EMPTY_WEEK_HISTORY = (): boolean[] => [false, false, false, false, false, false, false];

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
      threadStrength: 50,
      totalSessionsCount: 0,
      lastPrimedAt: null,
      weekHistory: EMPTY_WEEK_HISTORY(),
      weekHistoryKey: isoWeekKey(new Date()),
      lastDecayDate: null,

      recordSession: (entry) => {
        // Apply decay before granting any priming gains so sessions started
        // from non-PracticeScreen routes (e.g. Vault → ActivationRitual) don't
        // skip missed-day decay and inflate thread strength on stale values.
        get().applyDecay();

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const full: SessionLogEntry = { id, ...entry };

        const now = new Date();
        const todayKey = localDateString(now);
        const weekKey = isoWeekKey(now);
        // Mon=0 … Sun=6
        const dayOfWeek = (now.getDay() + 6) % 7;
        const isPrimingSession = entry.type === 'activate' || entry.type === 'reinforce';

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

          // Thread strength updates (priming sessions only)
          let threadStrength = state.threadStrength;
          let totalSessionsCount = state.totalSessionsCount;
          let lastPrimedAt = state.lastPrimedAt;
          let weekHistory = state.weekHistory;
          let weekHistoryKey = state.weekHistoryKey;

          if (isPrimingSession) {
            const gain = entry.type === 'reinforce' ? 40 : 25;
            threadStrength = Math.min(100, threadStrength + gain);
            totalSessionsCount = state.totalSessionsCount + 1;
            lastPrimedAt = todayKey;
            // Reset week history on new week
            if (state.weekHistoryKey !== weekKey) {
              weekHistory = EMPTY_WEEK_HISTORY();
              weekHistoryKey = weekKey;
            } else {
              weekHistory = [...state.weekHistory];
            }
            weekHistory[dayOfWeek] = true;
          }

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
            threadStrength,
            totalSessionsCount,
            lastPrimedAt,
            weekHistory,
            weekHistoryKey,
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

        // Sync stabilize sessions to the backend when the user is authenticated.
        // activate/reinforce are synced via the anchor activation flow separately.
        if (full.type === 'stabilize') {
          const token = useAuthStore.getState().token;
          if (token) {
            apiClient.post('/api/practice/stabilize', {
              completedAt: full.completedAt,
              timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            }).catch(() => {
              // Fire-and-forget — local state is already persisted, sync failure is non-fatal.
            });
          }
        }
      },

      consumeGraceDay: () => {
        set({ lastGraceDayUsedAt: new Date().toISOString() });
      },

      resetIfNewDay: () => {
        const { todayPractice, weeklyPractice, weekHistoryKey } = get();
        const now = new Date();
        const todayKey = localDateString(now);
        const weekKey = isoWeekKey(now);

        if (todayPractice.date !== todayKey) {
          set({ todayPractice: { date: todayKey, sessionsCount: 0, totalSeconds: 0 } });
        }
        if (weeklyPractice.weekKey !== weekKey) {
          set({ weeklyPractice: { weekKey, sessionsCount: 0, totalSeconds: 0 } });
        }
        if (weekHistoryKey !== weekKey) {
          set({ weekHistory: EMPTY_WEEK_HISTORY(), weekHistoryKey: weekKey });
        }
      },

      applyDecay: () => {
        const { lastPrimedAt, threadStrength, lastDecayDate } = get();
        const today = localDateString(new Date());

        // Already applied decay today — skip
        if (lastDecayDate === today) return;

        // Mark decay as processed for today
        set({ lastDecayDate: today });

        // Never primed or primed today — no decay
        if (!lastPrimedAt || lastPrimedAt === today) return;

        const primedMs = new Date(lastPrimedAt).getTime();
        const todayMs = new Date(today).getTime();
        const daysMissed = Math.max(0, Math.floor((todayMs - primedMs) / 86400000));
        if (daysMissed <= 0) return;

        // Days already accounted for (between lastPrimedAt and lastDecayDate)
        const daysAlreadyDecayed = lastDecayDate
          ? Math.max(0, Math.floor((new Date(lastDecayDate).getTime() - primedMs) / 86400000))
          : 0;

        if (daysAlreadyDecayed >= daysMissed) return;

        // Apply incremental decay for each new missed day
        let newStrength = threadStrength;
        for (let d = daysAlreadyDecayed + 1; d <= daysMissed; d++) {
          if (d === 1) {
            newStrength = Math.max(10, newStrength - 30);
          } else {
            newStrength = Math.max(5, newStrength - 15);
          }
        }

        set({ threadStrength: newStrength });
      },
    }),
    {
      name: 'anchor-session-storage',
      storage: createJSONStorage(() => encryptedPersistStorage),
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const s = persistedState as Partial<SessionState>;
          return {
            ...s,
            threadStrength: 50,
            totalSessionsCount: 0,
            lastPrimedAt: null,
            weekHistory: EMPTY_WEEK_HISTORY(),
            weekHistoryKey: isoWeekKey(new Date()),
            lastDecayDate: null,
          };
        }
        return persistedState as SessionState;
      },
    }
  )
);
