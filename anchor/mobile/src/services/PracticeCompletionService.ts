import Constants from 'expo-constants';

import { AnalyticsService } from '@/services/AnalyticsService';
import { apiClient } from '@/services/ApiClient';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { useAuthStore } from '@/stores/authStore';
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
  if (
    !isChartPracticeEntrySource(entrySource ?? undefined) ||
    !isChartPracticeContext(context)
  ) {
    return { courseId: null, waypointId: null, practiceEntrySource: entrySource };
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

export const PracticeCompletionService = {
  async completePracticeSession(
    input: CompletePracticeSessionInput,
    options: { mirrorLegacySession?: boolean; flushImmediately?: boolean } = {},
  ): Promise<{ record: PracticeSessionRecord; duplicate: boolean }> {
    const currentAccountId = useAuthStore.getState().user?.id;
    if (!currentAccountId || currentAccountId !== input.accountId) {
      throw new Error('Practice completion account does not match the active account.');
    }

    const existing = useSessionStore
      .getState()
      .practiceHistory.find((event) => event.id === input.sessionId);
    if (existing) {
      AnalyticsService.track('practice_duplicate_prevented', {
        mode: existing.practiceMode,
        source: input.source,
        session_id: input.sessionId,
      });
      return { record: existing, duplicate: true };
    }

    const record = buildRecord(input);
    await this.queueCanonicalCompletion(
      record,
      options.mirrorLegacySession === true,
      options.flushImmediately !== false,
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
    return { record, duplicate: false };
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
    });
    return result.record;
  },

  async queueCanonicalCompletion(
    record: PracticeSessionRecord,
    mirrorLegacySession = false,
    flushImmediately = true,
  ): Promise<void> {
    const currentAccountId = useAuthStore.getState().user?.id;
    if (!currentAccountId || currentAccountId !== record.accountId) {
      throw new Error('Cannot queue practice history for an inactive account.');
    }

    const queue = await readQueue(record.accountId);
    if (!queue.some((item) => item.id === record.id)) {
      await writeQueue(record.accountId, [...queue, record]);
    }
    if (mirrorLegacySession) {
      useSessionStore.getState().recordPracticeSession(record);
    } else {
      useSessionStore.getState().appendCanonicalPracticeSession(record);
    }
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
    if (useAuthStore.getState().user?.id !== accountId) return;
    const queue = await readQueue(accountId);
    const remaining: PracticeSessionRecord[] = [];
    for (const session of queue) {
      try {
        await apiClient.post('/api/practice/sessions', serverPayload(session));
        useSessionStore.getState().markPracticeSessionSynced(session.id);
      } catch {
        remaining.push({ ...session, syncState: 'failed' });
        AnalyticsService.track('practice_sync_failed', {
          mode: session.practiceMode,
          session_id: session.id,
        });
        logger.warn('[PracticeCompletionService] Practice sync deferred');
      }
    }
    await writeQueue(accountId, remaining);

    const nextActionQueue = await readNextActionQueue(accountId);
    const remainingNextActions: NextActionWrite[] = [];
    for (const write of nextActionQueue) {
      try {
        await apiClient.patch(
          `/api/practice/sessions/${encodeURIComponent(write.sessionId)}/next-action`,
          { nextAction: write.nextAction },
        );
      } catch {
        remainingNextActions.push(write);
      }
    }
    await writeNextActionQueue(accountId, remainingNextActions);
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
      const queue = await readNextActionQueue(params.accountId);
      await writeNextActionQueue(params.accountId, [
        ...queue.filter((item) => item.sessionId !== params.sessionId),
        { sessionId: params.sessionId, nextAction },
      ]);
    }
  },
};
