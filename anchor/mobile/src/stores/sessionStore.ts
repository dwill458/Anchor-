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
  JOURNEY_MILESTONE_IDS,
  JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE,
} from '@/constants/milestones';
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
import type { SessionAudioConfiguration } from '@/types/sessionAudio';
import {
  normalizePracticeMode,
  PRACTICE_THREAD_STRENGTH_GAINS,
  type PracticeSessionRecord,
  type UnknownPracticeHistoryRecord,
} from '@/types/practice';
import {
  getCompletionTimeContext,
  PRACTICE_SESSION_SCHEMA_VERSION,
  stablePracticeFingerprint,
} from '@/utils/practiceTime';

export type SessionType = 'activate' | 'reinforce' | 'visualize' | 'stabilize';
export type SessionMode = 'silent' | 'mantra' | 'ambient';

export interface SessionLogEntry {
  id: string;
  anchorId: string;
  type: SessionType;
  durationSeconds: number;
  mode: SessionMode;
  audioConfiguration?: SessionAudioConfiguration;
  reflectionWord?: string;
  completedAt: string; // ISO string
}

interface DayPractice {
  /** Local YYYY-MM-DD */
  date: string;
  sessionsCount: number;
  totalSeconds: number;
}

type SessionRecordInput = Omit<SessionLogEntry, 'id'> & {
  idempotencyKey?: string;
};

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
  /** Canonical uncapped completed-practice history. */
  practiceHistory: PracticeSessionRecord[];
  /** Unrecognized legacy records retained for diagnostics, never metrics. */
  unknownPracticeHistory: UnknownPracticeHistoryRecord[];
  /** Monday date for the user's first tracked priming week. */
  journeyWeekStart: string | null;
  /** YYYY-MM-DD of the last day decay was applied — prevents double-apply. */
  lastDecayDate: string | null;

  // Actions
  recordSession: (entry: SessionRecordInput) => string;
  recordPracticeSession: (entry: PracticeSessionRecord) => string;
  appendCanonicalPracticeSession: (entry: PracticeSessionRecord) => string;
  markPracticeSessionSynced: (id: string) => void;
  updatePracticeSessionNextAction: (
    id: string,
    nextAction: string | null,
  ) => void;
  consumeGraceDay: () => void;
  /** Call on app foreground to reset today counters if the local date has rolled over */
  resetIfNewDay: () => void;
  /** Apply thread strength decay for missed days. Call on app open / screen focus. */
  applyDecay: () => void;
  /** Applies an explicit, non-session-based thread strength delta. */
  bumpThreadStrength: (delta: number) => void;
  /**
   * Seeds the store from backend data on first sign-in.
   * No-op if the local store already has recorded sessions.
   */
  hydrateFromBackend: (params: {
    accountId?: string;
    totalActivations: number;
    currentStreak: number;
    anchors: Array<{ lastActivatedAt?: Date }>;
    primingHistory?: PrimingHistoryEntry[];
    practiceHistory?: PracticeSessionRecord[];
  }) => void;
  reset: () => void;
}

const EMPTY_TODAY = (): DayPractice => ({
  date: localDateString(new Date()),
  sessionsCount: 0,
  totalSeconds: 0,
});
const EMPTY_WEEK = (): WeekPractice => ({
  weekKey: isoWeekKey(new Date()),
  sessionsCount: 0,
  totalSeconds: 0,
});
const EMPTY_WEEK_HISTORY = (): boolean[] => [
  false,
  false,
  false,
  false,
  false,
  false,
  false,
];
const createInitialSessionState = (): Omit<
  SessionState,
  | 'recordSession'
  | 'recordPracticeSession'
  | 'appendCanonicalPracticeSession'
  | 'markPracticeSessionSynced'
  | 'updatePracticeSessionNextAction'
  | 'consumeGraceDay'
  | 'resetIfNewDay'
  | 'applyDecay'
  | 'bumpThreadStrength'
  | 'hydrateFromBackend'
  | 'reset'
> => ({
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
  practiceHistory: [],
  unknownPracticeHistory: [],
  journeyWeekStart: null,
  lastDecayDate: null,
});

const LOG_CAP = 50;

function getPracticeSessionGain(type: SessionType): number {
  if (type === 'activate') return PRACTICE_THREAD_STRENGTH_GAINS.focus;
  if (type === 'reinforce') return PRACTICE_THREAD_STRENGTH_GAINS.deep_prime;
  if (type === 'visualize') return PRACTICE_THREAD_STRENGTH_GAINS.visualize;
  return 0;
}

function sortCanonicalPracticeHistory(
  entries: PracticeSessionRecord[],
): PracticeSessionRecord[] {
  return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values())
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
          new Date(left.completedAt).getTime() ||
        right.id.localeCompare(left.id),
    );
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

function countDecayEligibleDays(
  startDateExclusive: string,
  endDateInclusive: string,
  restDays: number[],
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

function applyThreadDecayForMissedDays(
  strength: number,
  missedDays: number,
  sensitivity: ReturnType<
    typeof useSettingsStore.getState
  >['threadStrengthSensitivity'],
): number {
  let nextStrength = strength;
  const decayStartDay = getThreadDecayStartDay(sensitivity);
  for (let missedDay = 1; missedDay <= missedDays; missedDay += 1) {
    const previousPenalty = calculateThreadDecay(missedDay - 1, sensitivity);
    const nextPenalty = calculateThreadDecay(missedDay, sensitivity);
    const penaltyDelta = nextPenalty - previousPenalty;
    if (penaltyDelta <= 0) continue;
    const minimumStrengthFloor = missedDay === decayStartDay ? 10 : 5;
    nextStrength = Math.max(minimumStrengthFloor, nextStrength - penaltyDelta);
  }
  return nextStrength;
}

function recomputeThreadStrength(
  history: PrimingHistoryEntry[],
  today: string,
): number {
  const { threadStrengthSensitivity, restDays } = useSettingsStore.getState();
  const chronological = [...history].sort(
    (left, right) =>
      new Date(left.completedAt).getTime() -
      new Date(right.completedAt).getTime(),
  );
  let strength = 50;
  let lastPracticeDate: string | null = null;

  for (const entry of chronological) {
    const practiceDate = localDateString(new Date(entry.completedAt));
    if (lastPracticeDate && practiceDate > lastPracticeDate) {
      strength = applyThreadDecayForMissedDays(
        strength,
        countDecayEligibleDays(lastPracticeDate, practiceDate, restDays),
        threadStrengthSensitivity,
      );
    }
    strength = Math.min(100, strength + getPracticeSessionGain(entry.type));
    lastPracticeDate = practiceDate;
  }

  if (lastPracticeDate && today > lastPracticeDate) {
    strength = applyThreadDecayForMissedDays(
      strength,
      countDecayEligibleDays(lastPracticeDate, today, restDays),
      threadStrengthSensitivity,
    );
  }
  return strength;
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

function derivePrimingHistoryFromSessionLog(
  sessionLog: unknown,
): PrimingHistoryEntry[] {
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
        type: (entry as SessionLogEntry).type as
          'activate' | 'reinforce' | 'visualize',
        completedAt: (entry as SessionLogEntry).completedAt,
      });
    })
    .filter((entry): entry is PrimingHistoryEntry => entry !== null);
}

function sortPrimingHistory(
  entries: PrimingHistoryEntry[],
): PrimingHistoryEntry[] {
  return entries
    .slice()
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
        new Date(left.completedAt).getTime(),
    );
}

function mergePrimingHistory(
  existingEntries: PrimingHistoryEntry[],
  incomingEntries: PrimingHistoryEntry[],
): PrimingHistoryEntry[] {
  const seenIds = new Set<string>();
  const lastTimestampBySignature = new Map<string, number>();
  const merged: PrimingHistoryEntry[] = [];
  // Prefer server/canonical entries when a legacy/local event falls inside the
  // established five-second duplicate window.
  for (const entry of sortPrimingHistory([
    ...incomingEntries,
    ...existingEntries,
  ])) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    const timestamp = new Date(entry.completedAt).getTime();
    const signature = `${entry.anchorId}|${entry.type}`;
    const previousTimestamp = lastTimestampBySignature.get(signature);
    if (
      previousTimestamp != null &&
      Number.isFinite(timestamp) &&
      Math.abs(previousTimestamp - timestamp) <= 5_000
    ) {
      continue;
    }
    if (Number.isFinite(timestamp))
      lastTimestampBySignature.set(signature, timestamp);
    merged.push(entry);
  }
  return merged;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...createInitialSessionState(),

      recordSession: (input) => {
        const { idempotencyKey, ...entry } = input;
        const id =
          idempotencyKey?.trim() ||
          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const existing = get();
        if (
          existing.sessionLog.some((session) => session.id === id) ||
          existing.primingHistory.some((session) => session.id === id)
        ) {
          return id;
        }
        // Apply decay before granting any priming gains so sessions started
        // from non-PracticeScreen routes (e.g. Vault → ActivationRitual) don't
        // skip missed-day decay and inflate thread strength on stale values.
        get().applyDecay();

        const full: SessionLogEntry = { id, ...entry };

        const completedAtDate = new Date(entry.completedAt);
        const eventDate = Number.isNaN(completedAtDate.getTime())
          ? new Date()
          : completedAtDate;
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
              type: entry.type as 'activate' | 'reinforce' | 'visualize',
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
              journeyWeekStart =
                state.journeyWeekStart ??
                primingHistoryEntry.weekStart ??
                weekStart;
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
              const gain = getPracticeSessionGain(entry.type);
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
          (entry.type === 'activate' ||
            entry.type === 'reinforce' ||
            entry.type === 'visualize') &&
          !teaching.userFlags.hasCompletedFirstCharge
        ) {
          teaching.setUserFlag('hasCompletedFirstCharge', true);
          teaching.queueMilestone(
            JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[
              JOURNEY_MILESTONE_IDS.firstPrime
            ],
          );
        }
        if (
          entry.type === 'stabilize' &&
          !teaching.userFlags.hasCompletedFirstStabilize
        ) {
          teaching.setUserFlag('hasCompletedFirstStabilize', true);
        }

        // Sync stabilize sessions to the backend when the user is authenticated.
        // activate/reinforce are synced via the anchor activation flow separately.
        if (full.type === 'stabilize') {
          const token = useAuthStore.getState().token;
          if (token) {
            apiClient
              .post('/api/practice/stabilize', {
                completedAt: full.completedAt,
                timezoneOffsetMinutes: new Date().getTimezoneOffset(),
              })
              .catch(() => {
                // Fire-and-forget — local state is already persisted, sync failure is non-fatal.
              });
          }
        }
        return id;
      },

      recordPracticeSession: (entry) => {
        if (get().practiceHistory.some((session) => session.id === entry.id))
          return entry.id;
        if (entry.practiceMode === 'release') {
          set((state) => ({
            practiceHistory: sortCanonicalPracticeHistory([
              entry,
              ...state.practiceHistory,
            ]),
          }));
          return entry.id;
        }
        const legacyType: SessionType =
          entry.practiceMode === 'focus'
            ? 'activate'
            : entry.practiceMode === 'deep_prime'
              ? 'reinforce'
              : entry.practiceMode;
        get().recordSession({
          idempotencyKey: entry.id,
          anchorId: entry.anchorId ?? entry.anchorLocalId ?? 'unlinked-anchor',
          type: legacyType,
          durationSeconds: entry.completedDurationSeconds,
          mode:
            entry.backgroundAudio === 'ambient'
              ? 'ambient'
              : entry.guidanceVoice === 'none'
                ? 'silent'
                : 'mantra',
          audioConfiguration: {
            guidanceVoice: entry.guidanceVoice,
            backgroundAudio: entry.backgroundAudio,
            source: 'session_override',
          },
          completedAt: entry.completedAt,
        });
        set((state) => ({
          practiceHistory: sortCanonicalPracticeHistory([
            entry,
            ...state.practiceHistory,
          ]),
        }));
        return entry.id;
      },

      appendCanonicalPracticeSession: (entry) => {
        if (get().practiceHistory.some((session) => session.id === entry.id)) {
          return entry.id;
        }
        set((state) => ({
          practiceHistory: sortCanonicalPracticeHistory([
            entry,
            ...state.practiceHistory,
          ]),
        }));
        return entry.id;
      },

      markPracticeSessionSynced: (id) => {
        set((state) => ({
          practiceHistory: state.practiceHistory.map((entry) =>
            entry.id === id ? { ...entry, syncState: 'synced' } : entry,
          ),
        }));
      },

      updatePracticeSessionNextAction: (id, nextAction) => {
        set((state) => ({
          practiceHistory: state.practiceHistory.map((entry) =>
            entry.id === id ? { ...entry, nextAction } : entry,
          ),
        }));
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
          set({
            todayPractice: {
              date: todayKey,
              sessionsCount: 0,
              totalSeconds: 0,
            },
          });
        }
        if (weeklyPractice.weekKey !== weekKey) {
          set({
            weeklyPractice: { weekKey, sessionsCount: 0, totalSeconds: 0 },
          });
        }
        if (weekHistoryKey !== weekKey) {
          set({ weekHistory: EMPTY_WEEK_HISTORY(), weekHistoryKey: weekKey });
        }
      },

      applyDecay: () => {
        const { lastPrimedAt, threadStrength, lastDecayDate } = get();
        const { threadStrengthSensitivity, restDays } =
          useSettingsStore.getState();
        const today = localDateString(new Date());

        // Already applied decay today — skip
        if (lastDecayDate === today) return;

        // Never primed or primed today — no decay
        if (!lastPrimedAt || lastPrimedAt === today) {
          set({ lastDecayDate: today });
          return;
        }

        const decayEligibleMissedDays = countDecayEligibleDays(
          lastPrimedAt,
          today,
          restDays,
        );
        const daysAlreadyDecayed = lastDecayDate
          ? countDecayEligibleDays(lastPrimedAt, lastDecayDate, restDays)
          : 0;

        if (daysAlreadyDecayed >= decayEligibleMissedDays) {
          set({ lastDecayDate: today });
          return;
        }

        let newStrength = threadStrength;
        const decayStartDay = getThreadDecayStartDay(threadStrengthSensitivity);

        for (
          let missedDay = daysAlreadyDecayed + 1;
          missedDay <= decayEligibleMissedDays;
          missedDay += 1
        ) {
          const previousPenalty = calculateThreadDecay(
            missedDay - 1,
            threadStrengthSensitivity,
          );
          const nextPenalty = calculateThreadDecay(
            missedDay,
            threadStrengthSensitivity,
          );
          const penaltyDelta = nextPenalty - previousPenalty;

          if (penaltyDelta <= 0) {
            continue;
          }

          const minimumStrengthFloor = missedDay === decayStartDay ? 10 : 5;
          newStrength = Math.max(
            minimumStrengthFloor,
            newStrength - penaltyDelta,
          );
        }

        set({ threadStrength: newStrength, lastDecayDate: today });
      },

      bumpThreadStrength: (delta) => {
        if (!Number.isFinite(delta) || delta === 0) {
          return;
        }

        set((state) => ({
          threadStrength: Math.max(
            0,
            Math.min(100, state.threadStrength + delta),
          ),
        }));
      },

      hydrateFromBackend: ({
        accountId,
        totalActivations,
        currentStreak,
        anchors,
        primingHistory,
        practiceHistory,
      }) => {
        const state = get();
        const now = new Date();
        const currentWeekKey = isoWeekKey(now);
        const hydratedPrimingHistory = coercePrimingHistory(primingHistory);
        const existingPrimingHistory = coercePrimingHistory(
          state.primingHistory,
        );
        const sortedPrimingHistory = mergePrimingHistory(
          existingPrimingHistory,
          hydratedPrimingHistory,
        );
        const incomingAccountId = accountId ?? practiceHistory?.[0]?.accountId;
        let reassignedLegacyPracticeHistory = false;
        const mergedPracticeHistory = sortCanonicalPracticeHistory([
          ...state.practiceHistory
            .filter(
              (entry) =>
                !incomingAccountId ||
                entry.accountId === incomingAccountId ||
                entry.accountId === 'legacy',
            )
            .map((entry) => {
              if (incomingAccountId && entry.accountId === 'legacy') {
                reassignedLegacyPracticeHistory = true;
                return { ...entry, accountId: incomingAccountId };
              }
              return entry;
            }),
          ...(practiceHistory ?? []),
        ]);
        const latestAnchorActivation = anchors.reduce<Date | null>(
          (latest, anchor) => {
            if (!anchor.lastActivatedAt) return latest;
            if (!latest || anchor.lastActivatedAt > latest)
              return anchor.lastActivatedAt;
            return latest;
          },
          null,
        );
        const backendProgressCount = Math.max(
          totalActivations,
          hydratedPrimingHistory.length,
        );
        const localProgressCount = Math.max(
          state.totalSessionsCount,
          existingPrimingHistory.length,
        );
        const hasBackendProgress =
          backendProgressCount > 0 ||
          hydratedPrimingHistory.length > 0 ||
          latestAnchorActivation != null;
        const backendIsMoreComplete =
          backendProgressCount > localProgressCount ||
          hydratedPrimingHistory.length > existingPrimingHistory.length;
        const shouldSeedEmptyLocalStore =
          localProgressCount === 0 && hasBackendProgress;

        if (
          !hasBackendProgress ||
          (!backendIsMoreComplete && !shouldSeedEmptyLocalStore)
        ) {
          if (
            reassignedLegacyPracticeHistory ||
            mergedPracticeHistory.length !== state.practiceHistory.length
          ) {
            set({ practiceHistory: mergedPracticeHistory });
          }
          return;
        }

        const mostRecentEntry = sortedPrimingHistory[0] ?? null;
        const lastPrimedAt = mostRecentEntry
          ? localDateString(new Date(mostRecentEntry.completedAt))
          : latestAnchorActivation
            ? localDateString(latestAnchorActivation)
            : null;

        // Replay canonical/legacy practice once so restored devices receive
        // the same per-mode gains, caps, rest-day behavior, and decay as the
        // device that recorded the sessions.
        const threadStrength =
          sortedPrimingHistory.length > 0
            ? recomputeThreadStrength(
                sortedPrimingHistory,
                localDateString(now),
              )
            : currentStreak >= 7
              ? 90
              : currentStreak >= 3
                ? 75
                : currentStreak >= 1
                  ? 60
                  : 50;

        // Mark days in the current ISO week where a priming session was completed.
        const weekHistory = EMPTY_WEEK_HISTORY();
        for (const entry of sortedPrimingHistory) {
          const completedAt = new Date(entry.completedAt);
          if (
            !Number.isNaN(completedAt.getTime()) &&
            isoWeekKey(completedAt) === currentWeekKey
          ) {
            weekHistory[getIsoWeekdayIndex(completedAt)] = true;
          }
        }

        if (
          sortedPrimingHistory.length === 0 &&
          latestAnchorActivation &&
          isoWeekKey(latestAnchorActivation) === currentWeekKey
        ) {
          weekHistory[getIsoWeekdayIndex(latestAnchorActivation)] = true;
        }

        const sessionLog = sortedPrimingHistory
          .slice(0, LOG_CAP)
          .map((entry) => ({
            id: entry.id,
            anchorId: entry.anchorId,
            type: entry.type,
            durationSeconds:
              entry.type === 'reinforce'
                ? 120
                : entry.type === 'visualize'
                  ? 180
                  : 30,
            mode: 'silent' as const,
            completedAt: entry.completedAt,
          }));

        set({
          totalSessionsCount: Math.max(
            totalActivations,
            state.totalSessionsCount,
            sortedPrimingHistory.length,
          ),
          lastPrimedAt,
          threadStrength,
          lastSession: sessionLog[0] ?? null,
          sessionLog,
          weekHistory,
          weekHistoryKey: currentWeekKey,
          primingHistory: sortedPrimingHistory,
          practiceHistory: mergedPracticeHistory,
          journeyWeekStart:
            sortedPrimingHistory[sortedPrimingHistory.length - 1]?.weekStart ??
            null,
          lastDecayDate: localDateString(now),
        });
      },

      reset: () => {
        set(createInitialSessionState());
      },
    }),
    {
      name: 'anchor-session-storage',
      storage: createJSONStorage(() => encryptedPersistStorage),
      version: 5,
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
          const primingHistory = derivePrimingHistoryFromSessionLog(
            s.sessionLog,
          );
          const existingPrimingHistory = coercePrimingHistory(s.primingHistory);
          const hydratedPrimingHistory =
            existingPrimingHistory.length > 0
              ? existingPrimingHistory
              : primingHistory;
          const oldestPrimingEntry =
            hydratedPrimingHistory[hydratedPrimingHistory.length - 1] ?? null;

          migratedState.primingHistory = hydratedPrimingHistory;
          migratedState.journeyWeekStart =
            typeof s.journeyWeekStart === 'string'
              ? s.journeyWeekStart
              : (oldestPrimingEntry?.weekStart ?? null);
        }

        if (version < 4) {
          const legacyHistory = coercePrimingHistory(
            migratedState.primingHistory ?? s.primingHistory,
          );
          migratedState.practiceHistory = legacyHistory.map((entry) => ({
            id: entry.id,
            accountId: 'legacy',
            anchorId: entry.anchorId,
            anchorLocalId: null,
            anchorServerId: entry.anchorId,
            practiceMode:
              entry.type === 'reinforce'
                ? 'deep_prime'
                : entry.type === 'visualize'
                  ? 'visualize'
                  : 'focus',
            plannedDurationSeconds:
              entry.type === 'reinforce'
                ? 120
                : entry.type === 'visualize'
                  ? 180
                  : 30,
            completedDurationSeconds:
              entry.type === 'reinforce'
                ? 120
                : entry.type === 'visualize'
                  ? 180
                  : 30,
            completionStatus: 'completed',
            startedAt: entry.completedAt,
            completedAt: entry.completedAt,
            ...getCompletionTimeContext(new Date(entry.completedAt)),
            completionSource: 'restored',
            schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
            legacyType: entry.type,
            guidanceVoice: 'none',
            backgroundAudio: 'off',
            sceneSnapshot: null,
            nextAction: null,
            clientVersion: null,
            syncState: 'synced',
          }));
        }

        if (version < 5) {
          const unknownPracticeHistory: UnknownPracticeHistoryRecord[] = [
            ...(migratedState.unknownPracticeHistory ?? []),
          ];
          migratedState.practiceHistory = (
            migratedState.practiceHistory ?? []
          ).flatMap((entry) => {
            if (!entry || typeof entry !== 'object') return [];
            const rawMode = (entry as unknown as { practiceMode?: unknown })
              .practiceMode;
            const practiceMode = normalizePracticeMode(rawMode);
            if (!practiceMode) {
              const raw = entry as unknown as Record<string, unknown>;
              unknownPracticeHistory.push({
                fingerprint: stablePracticeFingerprint([
                  raw.id,
                  rawMode,
                  raw.completedAt,
                  raw.anchorId,
                ]),
                accountId:
                  typeof raw.accountId === 'string' ? raw.accountId : 'legacy',
                legacyType:
                  typeof rawMode === 'string' ? rawMode : 'unknown',
                completedAt:
                  typeof raw.completedAt === 'string' ? raw.completedAt : null,
                raw,
              });
              return [];
            }
            const completedAt = new Date(entry.completedAt);
            if (Number.isNaN(completedAt.getTime())) return [];
            const time = getCompletionTimeContext(completedAt);
            return [
              {
                ...entry,
                practiceMode,
                ...time,
                completionSource: entry.completionSource ?? 'restored',
                schemaVersion:
                  entry.schemaVersion ?? PRACTICE_SESSION_SCHEMA_VERSION,
                legacyType:
                  entry.legacyType ??
                  (entry.practiceMode === 'deep_prime'
                    ? 'reinforce'
                    : entry.practiceMode === 'focus'
                      ? 'activate'
                      : entry.practiceMode),
              } as PracticeSessionRecord,
            ];
          });
          migratedState.unknownPracticeHistory = Array.from(
            new Map(
              unknownPracticeHistory.map((entry) => [entry.fingerprint, entry]),
            ).values(),
          );
        }

        return migratedState as SessionState;
      },
    },
  ),
);
