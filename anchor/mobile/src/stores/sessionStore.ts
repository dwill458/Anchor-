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
import { useSettingsStore } from '@/stores/settingsStore';
import {
  buildPrimingHistoryEntry,
  getIsoWeekdayIndex,
  isoWeekKey,
  isPrimingSessionType,
  localDateString,
  localWeekStartString,
  type PrimingHistoryEntry,
} from '@/utils/primingAnalytics';
import {
  calculateThreadDecay,
  getThreadDecayStartDay,
} from '@/utils/threadStrength';

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
  /** Uncapped priming history with local day/time metadata for analytics. */
  primingHistory: PrimingHistoryEntry[];
  /** Monday date for the user's first tracked priming week. */
  journeyWeekStart: string | null;
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

const EMPTY_TODAY = (): DayPractice => ({ date: localDateString(new Date()), sessionsCount: 0, totalSeconds: 0 });
const EMPTY_WEEK = (): WeekPractice => ({ weekKey: isoWeekKey(new Date()), sessionsCount: 0, totalSeconds: 0 });
const EMPTY_WEEK_HISTORY = (): boolean[] => [false, false, false, false, false, false, false];

const LOG_CAP = 50;

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

function countDecayEligibleDays(
  startDateExclusive: string,
  endDateInclusive: string,
  restDays: number[]
): number {
  const start = parseLocalDate(startDateExclusive);
  const end = parseLocalDate(endDateInclusive);
  if (end.getTime() <= start.getTime()) {
    return 0;
  }

  const restDaySet = new Set(restDays);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);

  let eligibleDays = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (!restDaySet.has(cursor.getDay())) {
      eligibleDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return eligibleDays;
}

function coercePrimingHistory(entries: unknown): PrimingHistoryEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof (entry as PrimingHistoryEntry).id !== 'string' ||
        typeof (entry as PrimingHistoryEntry).anchorId !== 'string' ||
        !isPrimingSessionType(String((entry as PrimingHistoryEntry).type)) ||
        typeof (entry as PrimingHistoryEntry).completedAt !== 'string' ||
        typeof (entry as PrimingHistoryEntry).localDate !== 'string' ||
        typeof (entry as PrimingHistoryEntry).weekKey !== 'string' ||
        typeof (entry as PrimingHistoryEntry).weekStart !== 'string' ||
        typeof (entry as PrimingHistoryEntry).weekdayIndex !== 'number' ||
        typeof (entry as PrimingHistoryEntry).hourOfDay !== 'number' ||
        typeof (entry as PrimingHistoryEntry).timeOfDay !== 'string'
      ) {
        return null;
      }

      return entry as PrimingHistoryEntry;
    })
    .filter((entry): entry is PrimingHistoryEntry => entry !== null);
}

function derivePrimingHistoryFromSessionLog(sessionLog: unknown): PrimingHistoryEntry[] {
  if (!Array.isArray(sessionLog)) {
    return [];
  }

  return sessionLog
    .map((entry, index) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof (entry as SessionLogEntry).anchorId !== 'string' ||
        !isPrimingSessionType(String((entry as SessionLogEntry).type)) ||
        typeof (entry as SessionLogEntry).completedAt !== 'string'
      ) {
        return null;
      }

      return buildPrimingHistoryEntry({
        id:
          typeof (entry as SessionLogEntry).id === 'string'
            ? (entry as SessionLogEntry).id
            : `migrated-prime-${index}`,
        anchorId: (entry as SessionLogEntry).anchorId,
        type: (entry as SessionLogEntry).type as 'activate' | 'reinforce',
        completedAt: (entry as SessionLogEntry).completedAt,
      });
    })
    .filter((entry): entry is PrimingHistoryEntry => entry !== null);
}

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
      primingHistory: [],
      journeyWeekStart: null,
      lastDecayDate: null,

      recordSession: (entry) => {
        // Apply decay before granting any priming gains so sessions started
        // from non-PracticeScreen routes (e.g. Vault → ActivationRitual) don't
        // skip missed-day decay and inflate thread strength on stale values.
        get().applyDecay();

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const full: SessionLogEntry = { id, ...entry };

        const completedAtDate = new Date(entry.completedAt);
        const eventDate = Number.isNaN(completedAtDate.getTime()) ? new Date() : completedAtDate;
        const todayKey = localDateString(eventDate);
        const weekKey = isoWeekKey(eventDate);
        const weekStart = localWeekStartString(eventDate);
        // Mon=0 … Sun=6
        const dayOfWeek = getIsoWeekdayIndex(eventDate);
        const isPrimingSession = isPrimingSessionType(entry.type);
        const { restDays, restDayPolicy } = useSettingsStore.getState();
        const isRestDay = restDays.includes(eventDate.getDay());
        const shouldBuildThread = !isRestDay || restDayPolicy === 'build';
        const primingHistoryEntry = isPrimingSession
          ? buildPrimingHistoryEntry({
            id,
            anchorId: entry.anchorId,
            type: entry.type as 'activate' | 'reinforce',
            completedAt: entry.completedAt,
          })
          : null;

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
          let primingHistory = state.primingHistory;
          let journeyWeekStart = state.journeyWeekStart;

          if (isPrimingSession) {
            totalSessionsCount = state.totalSessionsCount + 1;
            if (primingHistoryEntry) {
              primingHistory = [primingHistoryEntry, ...state.primingHistory];
              journeyWeekStart = state.journeyWeekStart ?? primingHistoryEntry.weekStart ?? weekStart;
            }
            // Reset week history on new week
            if (state.weekHistoryKey !== weekKey) {
              weekHistory = EMPTY_WEEK_HISTORY();
              weekHistoryKey = weekKey;
            } else {
              weekHistory = [...state.weekHistory];
            }
            weekHistory[dayOfWeek] = true;

            if (shouldBuildThread) {
              const gain = entry.type === 'reinforce' ? 40 : 25;
              threadStrength = Math.min(100, threadStrength + gain);
              lastPrimedAt = todayKey;
            }
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
            primingHistory,
            journeyWeekStart,
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
        const { threadStrengthSensitivity, restDays } = useSettingsStore.getState();
        const today = localDateString(new Date());

        // Already applied decay today — skip
        if (lastDecayDate === today) return;

        // Never primed or primed today — no decay
        if (!lastPrimedAt || lastPrimedAt === today) {
          set({ lastDecayDate: today });
          return;
        }

        const decayEligibleMissedDays = countDecayEligibleDays(lastPrimedAt, today, restDays);
        const daysAlreadyDecayed = lastDecayDate
          ? countDecayEligibleDays(lastPrimedAt, lastDecayDate, restDays)
          : 0;

        if (daysAlreadyDecayed >= decayEligibleMissedDays) {
          set({ lastDecayDate: today });
          return;
        }

        let newStrength = threadStrength;
        const decayStartDay = getThreadDecayStartDay(threadStrengthSensitivity);

        for (let missedDay = daysAlreadyDecayed + 1; missedDay <= decayEligibleMissedDays; missedDay += 1) {
          const previousPenalty = calculateThreadDecay(missedDay - 1, threadStrengthSensitivity);
          const nextPenalty = calculateThreadDecay(missedDay, threadStrengthSensitivity);
          const penaltyDelta = nextPenalty - previousPenalty;

          if (penaltyDelta <= 0) {
            continue;
          }

          const minimumStrengthFloor = missedDay === decayStartDay ? 10 : 5;
          newStrength = Math.max(minimumStrengthFloor, newStrength - penaltyDelta);
        }

        set({ threadStrength: newStrength, lastDecayDate: today });
      },
    }),
    {
      name: 'anchor-session-storage',
      storage: createJSONStorage(() => encryptedPersistStorage),
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState as Partial<SessionState>) ?? {};
        const migratedState: Partial<SessionState> = { ...s };

        if (version < 2) {
          migratedState.threadStrength = 50;
          migratedState.totalSessionsCount = 0;
          migratedState.lastPrimedAt = null;
          migratedState.weekHistory = EMPTY_WEEK_HISTORY();
          migratedState.weekHistoryKey = isoWeekKey(new Date());
          migratedState.lastDecayDate = null;
        }

        if (version < 3) {
          const primingHistory = derivePrimingHistoryFromSessionLog(s.sessionLog);
          const existingPrimingHistory = coercePrimingHistory(s.primingHistory);
          const hydratedPrimingHistory =
            existingPrimingHistory.length > 0 ? existingPrimingHistory : primingHistory;
          const oldestPrimingEntry = hydratedPrimingHistory[hydratedPrimingHistory.length - 1] ?? null;

          migratedState.primingHistory = hydratedPrimingHistory;
          migratedState.journeyWeekStart =
            typeof s.journeyWeekStart === 'string'
              ? s.journeyWeekStart
              : oldestPrimingEntry?.weekStart ?? null;
        }

        return migratedState as SessionState;
      },
    }
  )
);
