import Constants from "expo-constants";

import { apiClient } from "@/services/ApiClient";
import { useSessionStore } from "@/stores/sessionStore";
import {
  readSecureValue,
  writeSecureValue,
} from "@/stores/encryptedPersistStorage";
import type { PracticeSessionRecord } from "@/types/practice";
import type { BackgroundAudioMode, GuidanceVoice } from "@/types/sessionAudio";
import type { Anchor } from "@/types";
import { logger } from "@/utils/logger";
import { useAuthStore } from "@/stores/authStore";
import { isBackendAnchorId } from "@/services/BackendAnchorService";

const queueKey = (accountId: string) =>
  `anchor:practice-write-queue:${accountId}`;
const nextActionQueueKey = (accountId: string) =>
  `anchor:practice-next-action-queue:${accountId}`;

interface NextActionWrite {
  sessionId: string;
  nextAction: string | null;
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

export const PracticeCompletionService = {
  async queueLegacyCompletion(params: {
    id: string;
    anchorId: string;
    anchorLocalId?: string | null;
    practiceMode: "focus" | "deep_prime" | "stabilize";
    durationSeconds: number;
    completedAt: string;
    guidanceVoice: GuidanceVoice;
    backgroundAudio: BackgroundAudioMode;
  }): Promise<void> {
    const accountId =
      typeof useAuthStore.getState === "function"
        ? useAuthStore.getState()?.user?.id
        : undefined;
    if (!accountId) return;
    const completedAtMs = new Date(params.completedAt).getTime();
    const record: PracticeSessionRecord = {
      id: params.id,
      accountId,
      anchorId: isBackendAnchorId(params.anchorId) ? params.anchorId : null,
      anchorLocalId: params.anchorLocalId ?? params.anchorId,
      anchorServerId: isBackendAnchorId(params.anchorId)
        ? params.anchorId
        : null,
      practiceMode: params.practiceMode,
      plannedDurationSeconds: Math.max(1, Math.round(params.durationSeconds)),
      completedDurationSeconds: Math.max(1, Math.round(params.durationSeconds)),
      completionStatus: "completed",
      startedAt: new Date(
        completedAtMs - params.durationSeconds * 1000,
      ).toISOString(),
      completedAt: params.completedAt,
      guidanceVoice: params.guidanceVoice,
      backgroundAudio: params.backgroundAudio,
      sceneSnapshot: null,
      nextAction: null,
      clientVersion: Constants.expoConfig?.version ?? null,
      syncState: "pending",
    };
    await this.queueCanonicalCompletion(record, false);
  },

  async queueCanonicalCompletion(
    record: PracticeSessionRecord,
    recordLocally = false,
  ): Promise<void> {
    if (recordLocally) useSessionStore.getState().recordPracticeSession(record);
    else
      useSessionStore.setState((state) => ({
        practiceHistory: state.practiceHistory.some(
          (item) => item.id === record.id,
        )
          ? state.practiceHistory
          : [record, ...state.practiceHistory].sort(
              (a, b) =>
                new Date(b.completedAt).getTime() -
                new Date(a.completedAt).getTime(),
            ),
      }));
    const queue = await readQueue(record.accountId);
    if (!queue.some((item) => item.id === record.id))
      await writeQueue(record.accountId, [...queue, record]);
    void this.flush(record.accountId);
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
  }): Promise<PracticeSessionRecord> {
    const record: PracticeSessionRecord = {
      id: params.id,
      accountId: params.accountId,
      anchorId: isBackendAnchorId(params.anchor.id) ? params.anchor.id : null,
      anchorLocalId: params.anchor.localId ?? params.anchor.id,
      anchorServerId: isBackendAnchorId(params.anchor.id)
        ? params.anchor.id
        : null,
      practiceMode: "visualize",
      plannedDurationSeconds: params.durationSeconds,
      completedDurationSeconds: params.durationSeconds,
      completionStatus: "completed",
      startedAt: params.startedAt,
      completedAt: params.completedAt ?? new Date().toISOString(),
      guidanceVoice: params.guidanceVoice,
      backgroundAudio: params.backgroundAudio,
      sceneSnapshot: params.sceneSnapshot,
      nextAction: null,
      clientVersion: Constants.expoConfig?.version ?? null,
      syncState: "pending",
    };

    // Commit progression/history before attempting any network operation.
    await this.queueCanonicalCompletion(record, true);
    return record;
  },

  async flush(accountId: string): Promise<void> {
    const queue = await readQueue(accountId);
    const remaining: PracticeSessionRecord[] = [];
    for (const session of queue) {
      try {
        await apiClient.post("/api/practice/sessions", serverPayload(session));
        useSessionStore.setState((state) => ({
          practiceHistory: state.practiceHistory.map((item) =>
            item.id === session.id ? { ...item, syncState: "synced" } : item,
          ),
        }));
      } catch (error) {
        remaining.push({ ...session, syncState: "failed" });
        logger.warn("[PracticeCompletionService] Practice sync deferred");
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
    const nextAction = params.nextAction?.trim() || null;
    if (nextAction && nextAction.length > 240) {
      throw new Error("Next action must be 240 characters or fewer.");
    }
    useSessionStore.setState((state) => ({
      practiceHistory: state.practiceHistory.map((item) =>
        item.id === params.sessionId ? { ...item, nextAction } : item,
      ),
    }));
    try {
      await apiClient.patch(
        `/api/practice/sessions/${encodeURIComponent(params.sessionId)}/next-action`,
        {
          nextAction,
        },
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
