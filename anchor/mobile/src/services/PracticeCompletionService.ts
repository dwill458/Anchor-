import Constants from 'expo-constants';

import { AnalyticsService } from '@/services/AnalyticsService';
import { apiClient } from '@/services/ApiClient';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { useAuthStore } from '@/stores/authStore';
import { useChartJourneyStore } from '@/stores/chartJourneyStore';
import {
  readSecureValue,
  writeSecureValue,
} from '@/stores/encryptedPersistStorage';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import type {
  ChartPracticeContext,
  PracticeCompletionSource,
  PracticeEntrySource,
  PracticeMode,
  PracticeSessionRecord,
} from '@/types/practice';
import { isChartPracticeContext, isChartPracticeEntrySource } from '@/types/practice';
import type { BackgroundAudioMode, GuidanceVoice } from '@/types/sessionAudio';
import { logger } from '@/utils/logger';
import {
  getCompletionTimeContext,
  PRACTICE_SESSION_SCHEMA_VERSION,
} from '@/utils/practiceTime';

const queueKey = (accountId: string) =>
  `anchor:practice-write-queue:${accountId}`;
const nextActionQueueKey = (accountId: string) =>
  `anchor:practice-next-action-queue:${accountId}`;
const accountQueueOperations = new Map<string, Promise<void>>();
const activeFlushes = new Map<string, Promise<void>>();

async function withAccountQueueLock<T>(
  accountId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = accountQueueOperations.get(accountId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const settled = current.then(() => undefined, () => undefined);
  accountQueueOperations.set(accountId, settled);
  void settled.finally(() => {
    if (accountQueueOperations.get(accountId) === settled) {
      accountQueueOperations.delete(accountId);
    }
  });
  return current;
}

interface NextActionWrite {
  sessionId: string;
  nextAction: string | null;
}

export interface CompletePracticeSessionInput {
  sessionId: string;
  accountId: string;
  anchorId: string | null;
  anchorLocalId?: string | null;
  anchorServerId?: string | null;
  mode: PracticeMode;
  startedAt: string;
  completedAt?: string;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  source: PracticeCompletionSource;
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
  sceneSnapshot?: string | null;
  nextAction?: string | null;
  legacyType?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Chart attribution for a Course-launched session. This is the same canonical
   * PracticeSession as any other completion — Chart adds context columns, it
   * does not get a parallel record.
   */
  chartContext?: ChartPracticeContext;
  practiceEntrySource?: PracticeEntrySource;
}

async function readQueue(accountId: string): Promise<PracticeSessionRecord[]> {
  const raw = await readSecureValue(queueKey(accountId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(
  accountId: string,
  queue: PracticeSessionRecord[],
): Promise<void> {
  await writeSecureValue(queueKey(accountId), JSON.stringify(queue));
}

async function readNextActionQueue(
  accountId: string,
): Promise<NextActionWrite[]> {
  const raw = await readSecureValue(nextActionQueueKey(accountId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeNextActionQueue(
  accountId: string,
  queue: NextActionWrite[],
): Promise<void> {
  await writeSecureValue(nextActionQueueKey(accountId), JSON.stringify(queue));
}

function serverPayload(session: PracticeSessionRecord) {
  const { accountId: _accountId, syncState: _syncState, ...payload } = session;
  return payload;
}

/**
 * Chart columns are only written when the entry source is a Chart source and
 * the context is well-formed. Anything else stores nulls, so a malformed or
 * mismatched context degrades to an ordinary practice session instead of
 * failing the completion or fabricating Course attribution the server would
 * reject with PRACTICE_SESSION_INVALID.
 */
function resolveChartColumns(input: CompletePracticeSessionInput): {
  courseId: string | null;
  waypointId: string | null;
  practiceEntrySource: PracticeEntrySource | null;
} {
  const entrySource = input.practiceEntrySource ?? null;
  const context = input.chartContext;
  if (!isChartPracticeEntrySource(entrySource ?? undefined)) {
    return { courseId: null, waypointId: null, practiceEntrySource: entrySource };
  }
  if (!isChartPracticeContext(context)) {
    return { courseId: null, waypointId: null, practiceEntrySource: null };
  }
  return {
    courseId: context.courseId,
    waypointId: context.waypointId,
    practiceEntrySource: entrySource,
  };
}

function buildRecord(input: CompletePracticeSessionInput): PracticeSessionRecord {
  const completedAt = new Date(input.completedAt ?? new Date().toISOString());
  const context = getCompletionTimeContext(completedAt);
  const chart = resolveChartColumns(input);
  return {
    id: input.sessionId,
    accountId: input.accountId,
    anchorId: input.anchorId,
    anchorLocalId: input.anchorLocalId ?? input.anchorId,
    anchorServerId: input.anchorServerId ?? input.anchorId,
    practiceMode: input.mode,
    plannedDurationSeconds: Math.max(
      1,
      Math.round(input.plannedDurationSeconds),
    ),
    completedDurationSeconds: Math.max(
      1,
      Math.round(input.actualDurationSeconds),
    ),
    completionStatus: 'completed',
    startedAt: input.startedAt,
    completedAt: completedAt.toISOString(),
    ...context,
    completionSource: input.source,
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    legacyType: input.legacyType ?? null,
    guidanceVoice: input.guidanceVoice,
    backgroundAudio: input.backgroundAudio,
    sceneSnapshot: input.sceneSnapshot ?? null,
    nextAction: input.nextAction ?? null,
    clientVersion: Constants.expoConfig?.version ?? null,
    metadata: input.metadata,
    courseId: chart.courseId,
    waypointId: chart.waypointId,
    practiceEntrySource: chart.practiceEntrySource,
    syncState: 'pending',
  };
}

async function markFirstPracticeForActiveAccount(
  accountId: string,
  anchorId: string,
  practiceMode: PracticeMode,
): Promise<void> {
  // Releasing an Anchor is a destructive closing action, not the reinforcing
  // first-Practice milestone that seeds a future Course.
  if (!anchorId || practiceMode === 'release' || useAuthStore.getState().user?.id !== accountId) return;
  // Auth normally starts this hydration. Rechecking immediately before the
  // call prevents a late completion for account A from superseding an
  // account-B bind that already began while the canonical write was awaited.
  await useChartJourneyStore.getState().bindAccount(accountId);
  if (
    useAuthStore.getState().user?.id !== accountId ||
    useChartJourneyStore.getState().accountId !== accountId
  ) return;
  await useChartJourneyStore.getState().markFirstPracticeCompleted(anchorId);
}

function isActivePracticeAccount(accountId: string): boolean {
  return useAuthStore.getState().user?.id === accountId;
}

function assertActivePracticeAccount(accountId: string): void {
  if (!isActivePracticeAccount(accountId)) {
    throw new Error('Practice completion account is no longer active.');
  }
}

import { buildPracticeCompletionSnapshot } from '@/utils/practiceMetrics';
import { useSettingsStore } from '@/stores/settingsStore';
import type { PracticeCompletionSnapshot } from '@/types/practice';

export const PracticeCompletionService = {
  async completePracticeSession(
    input: CompletePracticeSessionInput,
    options: { mirrorLegacySession?: boolean; flushImmediately?: boolean } = {},
  ): Promise<{
    record: PracticeSessionRecord;
    duplicate: boolean;
    snapshot?: PracticeCompletionSnapshot;
  }> {
    const currentAccountId = useAuthStore.getState().user?.id;
    if (!currentAccountId || currentAccountId !== input.accountId) {
      throw new Error('Practice completion account does not match the active account.');
    }

    const existing = useSessionStore
      .getState()
      .practiceHistory.find((event) => event.id === input.sessionId);
    if (existing) {
      if (existing.accountId !== input.accountId) {
        throw new Error('Practice session ID belongs to another account.');
      }
      await markFirstPracticeForActiveAccount(
        input.accountId,
        existing.anchorServerId ?? existing.anchorId ?? existing.anchorLocalId ?? '',
        existing.practiceMode,
      );
      AnalyticsService.track('practice_duplicate_prevented', {
        mode: existing.practiceMode,
        source: input.source,
        session_id: input.sessionId,
      });
      return { record: existing, duplicate: true };
    }

    const sessionState = useSessionStore.getState();
    const settingsState = useSettingsStore.getState();
    const anchorId =
      input.anchorId ?? input.anchorLocalId ?? 'unlinked-anchor';
    const record = buildRecord(input);

    const snapshot = buildPracticeCompletionSnapshot({
      eventsBeforeSession: sessionState.practiceHistory,
      completedSession: record,
      anchorId,
      sensitivity: settingsState.threadStrengthSensitivity,
      sensitivityHistory: settingsState.sensitivityHistory,
      restDays: settingsState.restDays,
      restDaysHistory: settingsState.restDaysHistory,
      baseline: sessionState.getAnchorV2Baseline(anchorId),
    });

    await this.queueCanonicalCompletion(
      record,
      options.mirrorLegacySession === true,
      options.flushImmediately !== false,
    );
    // The invitation milestone is based on a durable canonical Practice write,
    // never on a timer, strength increase, or Waypoint lifecycle change.
    await markFirstPracticeForActiveAccount(
      input.accountId,
      record.anchorServerId ?? record.anchorId ?? record.anchorLocalId ?? '',
      record.practiceMode,
    );
    AnalyticsService.track('practice_session_completed', {
      mode: record.practiceMode,
      source: record.completionSource,
      session_id: record.id,
      planned_duration_seconds: record.plannedDurationSeconds,
      actual_duration_seconds: record.completedDurationSeconds,
      local_date_key: record.localDateKey,
      sync_outcome: 'queued',
      // Opaque IDs only. Destination text, waypoint titles, and reflection
      // bodies never enter analytics.
      ...(record.courseId
        ? {
          course_id: record.courseId,
          waypoint_id: record.waypointId,
          practice_entry_source: record.practiceEntrySource,
        }
        : {}),
    });
    return { record, duplicate: false, snapshot };
  },

  async queueLegacyCompletion(params: {
    id: string;
    anchorId: string;
    anchorLocalId?: string | null;
    practiceMode: 'focus' | 'deep_prime';
    durationSeconds: number;
    completedAt: string;
    guidanceVoice: GuidanceVoice;
    backgroundAudio: BackgroundAudioMode;
    source?: PracticeCompletionSource;
    chartContext?: ChartPracticeContext;
    practiceEntrySource?: PracticeEntrySource;
  }): Promise<PracticeSessionRecord | null> {
    const accountId = useAuthStore.getState?.()?.user?.id;
    if (!accountId) return null;
    const completedAtMs = new Date(params.completedAt).getTime();
    const result = await this.completePracticeSession({
      sessionId: params.id,
      accountId,
      anchorId: isBackendAnchorId(params.anchorId) ? params.anchorId : null,
      anchorLocalId: params.anchorLocalId ?? params.anchorId,
      anchorServerId: isBackendAnchorId(params.anchorId)
        ? params.anchorId
        : null,
      mode: params.practiceMode,
      plannedDurationSeconds: params.durationSeconds,
      actualDurationSeconds: params.durationSeconds,
      startedAt: new Date(
        completedAtMs - params.durationSeconds * 1000,
      ).toISOString(),
      completedAt: params.completedAt,
      source: params.source ?? 'unknown',
      legacyType:
        params.practiceMode === 'deep_prime' ? 'reinforce' : 'activate',
      guidanceVoice: params.guidanceVoice,
      backgroundAudio: params.backgroundAudio,
      chartContext: params.chartContext,
      practiceEntrySource: params.practiceEntrySource,
    }, { flushImmediately: false });
    void this.flush(accountId);
    return result.record;
  },

  async queueCanonicalCompletion(
    record: PracticeSessionRecord,
    mirrorLegacySession = false,
    flushImmediately = true,
  ): Promise<void> {
    assertActivePracticeAccount(record.accountId);
    await withAccountQueueLock(record.accountId, async () => {
      assertActivePracticeAccount(record.accountId);
      const queue = await readQueue(record.accountId);
      assertActivePracticeAccount(record.accountId);
      if (!queue.some((item) => item.id === record.id)) {
        await writeQueue(record.accountId, [...queue, record]);
        assertActivePracticeAccount(record.accountId);
      }
      if (mirrorLegacySession) {
        useSessionStore.getState().recordPracticeSession(record);
      } else {
        useSessionStore.getState().appendCanonicalPracticeSession(record);
      }
    });
    if (flushImmediately) void this.flush(record.accountId);
  },

  async commitVisualizeCompletion(params: {
    id: string;
    accountId: string;
    anchor: Anchor;
    durationSeconds: 60 | 180 | 300;
    startedAt: string;
    completedAt?: string;
    guidanceVoice: GuidanceVoice;
    backgroundAudio: BackgroundAudioMode;
    sceneSnapshot: string;
    source?: PracticeCompletionSource;
    chartContext?: ChartPracticeContext;
    practiceEntrySource?: PracticeEntrySource;
  }): Promise<PracticeSessionRecord> {
    const result = await this.completePracticeSession(
      {
        sessionId: params.id,
        accountId: params.accountId,
        anchorId: isBackendAnchorId(params.anchor.id) ? params.anchor.id : null,
        anchorLocalId: params.anchor.localId ?? params.anchor.id,
        anchorServerId: isBackendAnchorId(params.anchor.id)
          ? params.anchor.id
          : null,
        mode: 'visualize',
        plannedDurationSeconds: params.durationSeconds,
        actualDurationSeconds: params.durationSeconds,
        startedAt: params.startedAt,
        completedAt: params.completedAt,
        source: params.source ?? 'practice_screen',
        guidanceVoice: params.guidanceVoice,
        backgroundAudio: params.backgroundAudio,
        sceneSnapshot: params.sceneSnapshot,
        chartContext: params.chartContext,
        practiceEntrySource: params.practiceEntrySource,
      },
      { mirrorLegacySession: true },
    );
    return result.record;
  },

  async commitReleaseCompletion(params: {
    id: string;
    accountId: string;
    anchor: Anchor;
    startedAt: string;
    completedAt?: string;
    durationSeconds: number;
    source?: PracticeCompletionSource;
  }): Promise<PracticeSessionRecord> {
    const result = await this.completePracticeSession(
      {
        sessionId: params.id,
        accountId: params.accountId,
        anchorId: isBackendAnchorId(params.anchor.id) ? params.anchor.id : null,
        anchorLocalId: params.anchor.localId ?? params.anchor.id,
        anchorServerId: isBackendAnchorId(params.anchor.id)
          ? params.anchor.id
          : null,
        mode: 'release',
        plannedDurationSeconds: params.durationSeconds,
        actualDurationSeconds: params.durationSeconds,
        startedAt: params.startedAt,
        completedAt: params.completedAt,
        source: params.source ?? 'practice_screen',
        legacyType: 'burn',
        guidanceVoice: 'none',
        backgroundAudio: 'off',
      },
      // Keep the durable local event queued while the destructive server burn
      // runs. The caller flushes with the same stable ID after cleanup.
      { flushImmediately: false },
    );
    return result.record;
  },

  async flush(accountId: string): Promise<void> {
    const existingFlush = activeFlushes.get(accountId);
    if (existingFlush) return existingFlush;
    const operation = (async () => {
      if (!isActivePracticeAccount(accountId)) return;
      const queue = await withAccountQueueLock(accountId, async () => {
        if (!isActivePracticeAccount(accountId)) return [];
        const current = await readQueue(accountId);
        return isActivePracticeAccount(accountId) ? current : [];
      });
      const syncedIds = new Set<string>();
      const failedIds = new Set<string>();
      for (const session of queue) {
        if (!isActivePracticeAccount(accountId)) return;
        try {
          await apiClient.post('/api/practice/sessions', serverPayload(session));
          if (!isActivePracticeAccount(accountId)) return;
          syncedIds.add(session.id);
          useSessionStore.getState().markPracticeSessionSynced(session.id);
        } catch {
          if (!isActivePracticeAccount(accountId)) return;
          failedIds.add(session.id);
          AnalyticsService.track('practice_sync_failed', {
            mode: session.practiceMode,
            session_id: session.id,
          });
          logger.warn('[PracticeCompletionService] Practice sync deferred');
        }
      }
      await withAccountQueueLock(accountId, async () => {
        if (!isActivePracticeAccount(accountId)) return;
        const latest = await readQueue(accountId);
        if (!isActivePracticeAccount(accountId)) return;
        const reconciled = latest
          .filter((session) => !syncedIds.has(session.id))
          .map((session) => failedIds.has(session.id) ? { ...session, syncState: 'failed' as const } : session);
        await writeQueue(accountId, reconciled);
      });
      if (!isActivePracticeAccount(accountId)) return;

      const nextActionQueue = await withAccountQueueLock(accountId, async () => {
        if (!isActivePracticeAccount(accountId)) return [];
        const current = await readNextActionQueue(accountId);
        return isActivePracticeAccount(accountId) ? current : [];
      });
      const syncedNextActions = new Set<string>();
      for (const write of nextActionQueue) {
        if (!isActivePracticeAccount(accountId)) return;
        const signature = `${write.sessionId}:${write.nextAction ?? ''}`;
        try {
          await apiClient.patch(
            `/api/practice/sessions/${encodeURIComponent(write.sessionId)}/next-action`,
            { nextAction: write.nextAction },
          );
          if (!isActivePracticeAccount(accountId)) return;
          syncedNextActions.add(signature);
        } catch {
          if (!isActivePracticeAccount(accountId)) return;
        }
      }
      await withAccountQueueLock(accountId, async () => {
        if (!isActivePracticeAccount(accountId)) return;
        const latest = await readNextActionQueue(accountId);
        if (!isActivePracticeAccount(accountId)) return;
        await writeNextActionQueue(
          accountId,
          latest.filter((write) => !syncedNextActions.has(`${write.sessionId}:${write.nextAction ?? ''}`)),
        );
      });
    })();
    activeFlushes.set(accountId, operation);
    try {
      await operation;
    } finally {
      if (activeFlushes.get(accountId) === operation) activeFlushes.delete(accountId);
    }
  },

  async saveNextAction(params: {
    accountId: string;
    sessionId: string;
    nextAction: string | null;
  }): Promise<void> {
    if (useAuthStore.getState().user?.id !== params.accountId) {
      throw new Error('Cannot update practice history for an inactive account.');
    }
    const nextAction = params.nextAction?.trim() || null;
    if (nextAction && nextAction.length > 240) {
      throw new Error('Next action must be 240 characters or fewer.');
    }
    useSessionStore.getState().updatePracticeSessionNextAction(
      params.sessionId,
      nextAction,
    );
    try {
      await apiClient.patch(
        `/api/practice/sessions/${encodeURIComponent(params.sessionId)}/next-action`,
        { nextAction },
      );
    } catch {
      assertActivePracticeAccount(params.accountId);
      await withAccountQueueLock(params.accountId, async () => {
        assertActivePracticeAccount(params.accountId);
        const queue = await readNextActionQueue(params.accountId);
        assertActivePracticeAccount(params.accountId);
        await writeNextActionQueue(params.accountId, [
          ...queue.filter((item) => item.sessionId !== params.sessionId),
          { sessionId: params.sessionId, nextAction },
        ]);
      });
    }
  },
};
