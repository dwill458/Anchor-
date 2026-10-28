import Constants from 'expo-constants';
import { traceStabilizationStage } from '@/utils/stabilizationDiagnostics';
import { sqlCipherEnabled } from '@/storage/sqlcipher/persistence';
const database = () => (require('@/storage/sqlcipher/runtime') as typeof import('@/storage/sqlcipher/runtime')).recordDatabase();

import { AnalyticsService } from '@/services/AnalyticsService';
import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { NotificationCoordinator } from '@/services/notifications/NotificationCoordinator';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import {
  readSecureValue,
  writeSecureValue,
} from '@/stores/encryptedPersistStorage';
import { useSessionStore, createInitialSessionState, projectCanonicalCompletion } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import type {
  PracticeCompletionSource,
  PracticeMode,
  PracticeSessionRecord,
} from '@/types/practice';
import type { BackgroundAudioMode, GuidanceVoice } from '@/types/sessionAudio';
import { logger } from '@/utils/logger';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
import {
  getCompletionTimeContext,
  PRACTICE_SESSION_SCHEMA_VERSION,
} from '@/utils/practiceTime';
import { calculateOptimisticPracticeGain } from '@/utils/threadStrength';
import { invalidateV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';

const queueKey = (accountId: string) =>
  `anchor:practice-write-queue:${accountId}`;
let canonicalCompletionTail: Promise<void> = Promise.resolve();
const completionReceipts = new Map<string, Promise<void>>();
const nextActionQueueKey = (accountId: string) =>
  `anchor:practice-next-action-queue:${accountId}`;
const boundRequestArgs = (isCurrent: () => boolean, token: string | null): [] | [AccountBoundRequestConfig] =>
  sqlCipherEnabled() ? [{ anchorAuthGuard: isCurrent, anchorAuthToken: token ?? undefined }] : [];

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

function buildRecord(input: CompletePracticeSessionInput): PracticeSessionRecord {
  const completedAt = new Date(input.completedAt ?? new Date().toISOString());
  const context = getCompletionTimeContext(completedAt);
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
    const revision = useAuthStore.getState().accountRevision;
    const token = useAuthStore.getState().token;
    const isCurrent = () => useAuthStore.getState().user?.id === input.accountId &&
      useAuthStore.getState().accountRevision === revision && useAuthStore.getState().token === token;

    if (Math.round(input.actualDurationSeconds) < Math.round(input.plannedDurationSeconds)) {
      throw new Error('Practice session ended early and cannot be marked as completed.');
    }
    const receiptKey = `${input.accountId}:${input.sessionId}`;
    const pendingReceipt = completionReceipts.get(receiptKey);
    if (sqlCipherEnabled() && pendingReceipt) {
      await pendingReceipt;
      if (!isCurrent()) throw new Error('Practice account changed during completion');
      const saved = useSessionStore.getState().practiceHistory.find((event) => event.id === input.sessionId && event.accountId === input.accountId);
      if (!saved) throw new Error('Committed practice event requires owner restoration');
      return { record: saved, duplicate: true };
    }

    const existing = useSessionStore
      .getState()
      .practiceHistory.find((event) => event.id === input.sessionId && event.accountId === input.accountId);
    if (existing) {
      AnalyticsService.track('practice_duplicate_prevented', {
        mode: existing.practiceMode,
        source: input.source,
        session_id: input.sessionId,
      });
      return { record: existing, duplicate: true };
    }

    const record = buildRecord(input);

    const targetAnchorId = input.anchorId || input.anchorLocalId || input.anchorServerId;
    const targetAnchor = targetAnchorId
      ? useAnchorStore
          .getState()
          .anchors.find(
            (a) => a.id === targetAnchorId || a.localId === targetAnchorId
          )
      : null;

    if (targetAnchorId) {
      const history = useSessionStore.getState().practiceHistory;
      const anchorHistory = history.filter(
        (s) =>
          (s.anchorId === targetAnchorId ||
            s.anchorLocalId === targetAnchorId ||
            (targetAnchor &&
              (s.anchorId === targetAnchor.id ||
                s.anchorLocalId === targetAnchor.localId))) &&
          s.id !== input.sessionId
      );

      const hadEarlierPractice =
        (typeof targetAnchor?.threadStrength === 'number' &&
          targetAnchor.threadStrength > 0) ||
        anchorHistory.some(
          (s) =>
            s.practiceMode !== 'release' &&
            (s.completionStatus === 'completed' ||
              (s.completedDurationSeconds ?? 0) > 0)
        );
      const isFirstPracticeEver = !hadEarlierPractice;

      const todaySessions = anchorHistory.filter(
        (s) =>
          s.localDateKey === record.localDateKey &&
          s.practiceMode !== 'release' &&
          (s.completionStatus === 'completed' ||
            (s.completedDurationSeconds ?? 0) > 0)
      );
      const isFirstSessionToday = todaySessions.length === 0;
      const priorEligibleSecondsToday = todaySessions.reduce(
        (acc, s) => acc + (s.completedDurationSeconds ?? 0),
        0
      );

      const gain = calculateOptimisticPracticeGain({
        currentStrength: targetAnchor?.threadStrength,
        practiceType: input.mode,
        durationSeconds: record.completedDurationSeconds,
        isFirstPracticeEver,
        isFirstSessionToday,
        priorEligibleSecondsToday,
      });

      record.threadStrengthBefore = gain.beforeStrength;
      record.threadStrengthAfter = gain.afterStrength;
      record.threadStrengthDelta = gain.delta;

      if (input.mode !== 'release') {
        useAnchorStore.getState().updateAnchor(targetAnchorId, {
          threadStrength: gain.afterStrength,
        });
      }
      invalidateV2RecommendationContext(targetAnchorId);
    }

    const receipt = this.queueCanonicalCompletion(
      record,
      options.mirrorLegacySession === true,
      options.flushImmediately !== false,
    );
    if (sqlCipherEnabled()) completionReceipts.set(receiptKey, receipt);
    try {
      await receipt;
      if (sqlCipherEnabled() && !isCurrent()) throw new Error('Practice account changed during completion');
    } finally {
      if (completionReceipts.get(receiptKey) === receipt) completionReceipts.delete(receiptKey);
    }
    void NotificationCoordinator.recordPracticeCompleted(record);
    AnalyticsService.track('practice_session_completed', {
      mode: record.practiceMode,
      practice_mode: record.practiceMode,
      source: record.completionSource,
      session_id: record.id,
      planned_duration_seconds: record.plannedDurationSeconds,
      actual_duration_seconds: record.completedDurationSeconds,
      planned_duration_ms: record.plannedDurationSeconds * 1000,
      actual_duration_ms: record.completedDurationSeconds * 1000,
      completion_status: record.completionStatus,
      strength_before: record.threadStrengthBefore,
      strength_after: record.threadStrengthAfter,
      strength_delta: record.threadStrengthDelta,
      local_date_key: record.localDateKey,
      sync_outcome: 'queued',
    });
    if (
      record.practiceMode !== 'release' &&
      typeof record.threadStrengthBefore === 'number' &&
      typeof record.threadStrengthAfter === 'number'
    ) {
      AnalyticsService.track('thread_strength_changed', {
        anchor_id: targetAnchorId ?? undefined,
        practice_mode: record.practiceMode,
        session_id: record.id,
        strength_before: record.threadStrengthBefore,
        strength_after: record.threadStrengthAfter,
        strength_delta:
          record.threadStrengthDelta ??
          record.threadStrengthAfter - record.threadStrengthBefore,
      });
    }
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
  }): Promise<void> {
    const accountId = useAuthStore.getState?.()?.user?.id;
    if (!accountId) return;
    const completedAtMs = new Date(params.completedAt).getTime();
    await this.completePracticeSession({
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
    }, { mirrorLegacySession: sqlCipherEnabled() });
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

    if (sqlCipherEnabled()) {
      const commit = traceStabilizationStage('canonical.queue', () => canonicalCompletionTail.then(async () => {
      if (!useSessionStore.persist.hasHydrated()) await traceStabilizationStage('canonical.hydration', () => Promise.resolve(useSessionStore.persist.rehydrate()));
      if (!useSessionStore.persist.hasHydrated()) throw new Error('Practice storage must be restored before confirming completion');
      if (useAuthStore.getState().user?.id !== record.accountId) throw new Error('Practice account changed during storage restoration');
      const append = (current: unknown) => {
        const history = (current ?? []) as PracticeSessionRecord[];
        return history.some((event) => event.id === record.id) ? history : [...history, record];
      };
      const live = useSessionStore.getState();
      // Only explicitly owned history can seed an owner snapshot. Unowned
      // legacy summaries remain in their original document for recovery.
      const recordedHere = live.sessionLog.some((event) => event.id === record.id);
      const ownedLive = (live.practiceHistory.length > 0 || recordedHere) && live.practiceHistory.every((event) => event.accountId === record.accountId);
      let projection = createInitialSessionState();
      // Canonical completion is authoritative. The session summary is a
      // projection published only after its event and outbox commit together.
      await traceStabilizationStage('canonical.commit', () => database().mutateMany([
        { namespace: queueKey(record.accountId), change: append },
        { namespace: `anchor:practice-history:${record.accountId}`, change: append },
        { namespace: `anchor:session-snapshot:${record.accountId}`, change: (current) => {
          const base = { ...createInitialSessionState(), ...(current ?? (ownedLive ? live : {})) };
          projection = projectCanonicalCompletion(base, record, mirrorLegacySession);
          return projection;
        } },
      ]));
      if (useAuthStore.getState().user?.id === record.accountId) {
        if (mirrorLegacySession) useSessionStore.getState().recordPracticeSession(record);
        else useSessionStore.getState().appendCanonicalPracticeSession(record);
        useSessionStore.setState(projection);
      }
      }));
      canonicalCompletionTail = commit.catch(() => undefined);
      await commit;
      if (flushImmediately) void this.flush(record.accountId);
      return;
    } else {
      const queue = await readQueue(record.accountId);
      if (!queue.some((item) => item.id === record.id)) await writeQueue(record.accountId, [...queue, record]);
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
    durationSeconds: 60 | 180 | 300 | 600;
    actualDurationSeconds?: number;
    startedAt: string;
    completedAt?: string;
    guidanceVoice: GuidanceVoice;
    backgroundAudio: BackgroundAudioMode;
    sceneSnapshot: string;
    source?: PracticeCompletionSource;
    metadata?: Record<string, unknown>;
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
        actualDurationSeconds: params.actualDurationSeconds ?? params.durationSeconds,
        startedAt: params.startedAt,
        completedAt: params.completedAt,
        source: params.source ?? 'practice_screen',
        guidanceVoice: params.guidanceVoice,
        backgroundAudio: params.backgroundAudio,
        sceneSnapshot: params.sceneSnapshot,
        metadata: params.metadata,
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
    const revision = useAuthStore.getState().accountRevision;
    const token = useAuthStore.getState().token;
    const isCurrent = () => useAuthStore.getState().user?.id === accountId &&
      useAuthStore.getState().accountRevision === revision && useAuthStore.getState().token === token;
    const queue = await readQueue(accountId);
    const remaining: PracticeSessionRecord[] = [];
    for (const session of queue) {
      if (!isCurrent()) return;
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: {
            threadStrengthMovement?: {
              beforeStrength: number;
              afterStrength: number;
              delta: number;
            };
            threadStrength?: number;
            newMilestones?: MilestoneRecord[];
          };
        }>('/api/practice/sessions', serverPayload(session), ...boundRequestArgs(isCurrent, token));
        if (!isCurrent()) return;

        const movement = response.data?.data?.threadStrengthMovement;
        // Automatic celebrations are requested only by the mounted post-practice
        // completion boundary. Background/offline queue flushes never present UI.
        const threadStrength =
          typeof response.data?.data?.threadStrength === 'number'
            ? response.data.data.threadStrength
            : movement?.afterStrength;

        const updates: Partial<PracticeSessionRecord> = {};
        if (movement) {
          updates.threadStrengthBefore = movement.beforeStrength;
          updates.threadStrengthAfter = movement.afterStrength;
          updates.threadStrengthDelta = movement.delta;
        }

        if (sqlCipherEnabled()) {
          await database().mutateMany([
            { namespace: `anchor:practice-history:${accountId}`, change: (current) => ((current ?? []) as PracticeSessionRecord[]).map((event) => event.id === session.id ? { ...event, ...updates, syncState: 'synced' } : event) },
            { namespace: `anchor:session-snapshot:${accountId}`, change: (current) => current ? { ...current, practiceHistory: (current as { practiceHistory: PracticeSessionRecord[] }).practiceHistory.map((event) => event.id === session.id ? { ...event, ...updates, syncState: 'synced' } : event) } : current },
          ]);
          if (!isCurrent()) return;
        }

        useSessionStore.getState().markPracticeSessionSynced(session.id, updates);

        const targetAnchorId = session.anchorId || session.anchorLocalId;
        if (typeof threadStrength === 'number' && targetAnchorId) {
          useAnchorStore.getState().updateAnchor(targetAnchorId, {
            threadStrength,
          });
          invalidateV2RecommendationContext(targetAnchorId);
        }
      } catch {
        if (!isCurrent()) return;
        remaining.push({ ...session, syncState: 'failed' });
        AnalyticsService.track('practice_sync_failed', {
          mode: session.practiceMode,
          session_id: session.id,
        });
        logger.warn('[PracticeCompletionService] Practice sync deferred');
      }
    }
    if (!isCurrent()) return;
    if (sqlCipherEnabled()) {
      const failed = new Map(remaining.map((event) => [event.id, event]));
      const attempted = new Map(queue.map((event) => [event.id, JSON.stringify(event)]));
      await database().mutate(queueKey(accountId), (current) => ((current ?? []) as PracticeSessionRecord[]).flatMap((event) => {
        // A changed or newly appended event must survive an older acknowledgement.
        if (attempted.get(event.id) !== JSON.stringify(event)) return [event];
        return failed.has(event.id) ? [failed.get(event.id)!] : [];
      }));
    } else await writeQueue(accountId, remaining);

    const nextActionQueue = await readNextActionQueue(accountId);
    const remainingNextActions: NextActionWrite[] = [];
    for (const write of nextActionQueue) {
      if (!isCurrent()) return;
      try {
        await apiClient.patch(
          `/api/practice/sessions/${encodeURIComponent(write.sessionId)}/next-action`,
          { nextAction: write.nextAction },
          ...boundRequestArgs(isCurrent, token),
        );
      } catch {
        remainingNextActions.push(write);
      }
    }
    if (!isCurrent()) return;
    if (sqlCipherEnabled()) {
      const failed = new Set(remainingNextActions.map((entry) => entry.sessionId));
      const attempted = new Map(nextActionQueue.map((entry) => [entry.sessionId, JSON.stringify(entry)]));
      await database().mutate(nextActionQueueKey(accountId), (current) => ((current ?? []) as NextActionWrite[]).filter((entry) => attempted.get(entry.sessionId) !== JSON.stringify(entry) || failed.has(entry.sessionId)));
    } else await writeNextActionQueue(accountId, remainingNextActions);
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
    if (sqlCipherEnabled()) {
      const revision = useAuthStore.getState().accountRevision;
      const token = useAuthStore.getState().token;
      const isCurrent = () => useAuthStore.getState().user?.id === params.accountId && useAuthStore.getState().accountRevision === revision && useAuthStore.getState().token === token;
      const write = { sessionId: params.sessionId, nextAction };
      const update = (current: unknown) => ((current ?? []) as PracticeSessionRecord[]).map((event) => event.id === params.sessionId ? { ...event, nextAction } : event);
      // The edit and retry intent commit before any network call or saved UI state.
      await database().mutateMany([
        { namespace: nextActionQueueKey(params.accountId), change: (current) => [...((current ?? []) as NextActionWrite[]).filter((event) => event.sessionId !== params.sessionId), write] },
        { namespace: `anchor:practice-history:${params.accountId}`, change: update },
        { namespace: `anchor:session-snapshot:${params.accountId}`, change: (current) => current ? { ...current, practiceHistory: update((current as { practiceHistory: PracticeSessionRecord[] }).practiceHistory) } : current },
      ]);
      if (!isCurrent()) return;
      useSessionStore.getState().updatePracticeSessionNextAction(params.sessionId, nextAction);
      try {
        await apiClient.patch(`/api/practice/sessions/${encodeURIComponent(params.sessionId)}/next-action`, { nextAction }, ...boundRequestArgs(isCurrent, token));
      } catch { return; }
      await database().mutate(nextActionQueueKey(params.accountId), (current) => ((current ?? []) as NextActionWrite[]).filter((event) => JSON.stringify(event) !== JSON.stringify(write)));
      return;
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
      if (sqlCipherEnabled()) {
        await database().mutate(nextActionQueueKey(params.accountId), (current) => [
          ...((current ?? []) as NextActionWrite[]).filter((entry) => entry.sessionId !== params.sessionId),
          { sessionId: params.sessionId, nextAction },
        ]);
        return;
      }
      const queue = await readNextActionQueue(params.accountId);
      await writeNextActionQueue(params.accountId, [
        ...queue.filter((item) => item.sessionId !== params.sessionId),
        { sessionId: params.sessionId, nextAction },
      ]);
    }
  },
};
