import { refreshChartAfterProposal } from '@/hooks/v2/chart/useAnchorChart';
import { fetch as streamingFetch } from 'expo/fetch';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import { classifyChartError, ChartRequestError } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';

/**
 * Ask Chart endpoints (/api/v2). One conversation per Anchor Chart; every proposal is applied by the server from
 * what it stored, so the client only ever sends its approval.
 */

export type AskSkill =
  | 'FREE'
  | 'CREATION'
  | 'BREAK_DOWN'
  | 'PLAN_WEEK'
  | 'ANOTHER_APPROACH'
  | 'STUCK'
  | 'SUGGEST_MOVE'
  | 'EXPLAIN_MOVE'
  | 'REVISE_ROUTE'
  | 'REFLECT';

export type CoachStyle = 'SUPPORTIVE' | 'DRIVEN' | 'DIRECT';
export type AskActionStatus = 'PENDING' | 'APPLIED' | 'DISMISSED';

export type AskAction = {
  type: 'ADD_MOVES' | 'REVISE_ROUTE';
  /** The smallest level the change works at. The card shown depends on it. */
  scope?: 'MOVE' | 'WAYPOINT' | 'ROUTE';
  /** One line on why a route change is needed. */
  routeReason?: string | null;
  status: AskActionStatus;
  summary: string;
  waypointId: string | null;
  waypointTitle: string | null;
  moves: Array<{ title: string; rationale: string | null; detail?: string | null }>;
  reason: string | null;
  detail: string | null;
  routeProposalId: string | null;
  routeTitles: string[] | null;
  baseCourseVersion: number | null;
};

export type AskPlanInput = { actualStartingPoint: string; startingContext: string | null; photoAssetIds: string[] };

export type AskMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  createdAt: string;
  attachments: Array<{ assetId: string }>;
  suggestions: string[];
  requestPhoto: { reason: string } | null;
  readyToPlan: boolean;
  planInput: AskPlanInput | null;
  action: AskAction | null;
  actionUnavailable: boolean;
  skill: string | null;
};

export type AskMode = 'CREATE' | 'ONGOING';

export type AskConversation = { conversationId: string | null; messages: AskMessage[]; mode: AskMode; courseId: string | null };

export type AskTurnBody = {
  idempotencyKey: string;
  text?: string;
  attachments?: string[];
  skill?: AskSkill;
  targetMoveId?: string | null;
  conversationId?: string | null;
  opening?: boolean;
};

export type AskTurnResult = {
  conversationId: string;
  mode: AskMode;
  userMessage: AskMessage | null;
  assistantMessage: AskMessage;
  remembered: { key: string; value: string } | null;
  generation: { source: 'ai'; fallbackUsed: boolean };
  replayed: boolean;
};

export type AskStage = 'preparing_change';

export type AskTurnHandlers = {
  /** The reply written so far. Replaces, never appends. */
  onReply?: (text: string) => void;
  onStage?: (stage: AskStage) => void;
};

export type AskProfile = {
  style: CoachStyle;
  memories: Array<{ key: AskMemoryKey; value: string; source: string; updatedAt: string }>;
};
export type AskMemoryKey = 'availability' | 'hoursPerWeek' | 'constraints' | 'approach' | 'resources';

// ── Server-sent events ────────────────────────────────────────────────────────────────────────

export type SseEvent = { event: string; data: unknown };

/**
 * Incremental SSE parser: feed it decoded text in any chunking and it emits each complete event once.
 * Events whose data is not JSON are dropped; a stream may be cut mid-event without throwing.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let pending = '';
  return {
    push(text: string) {
      pending += text.replace(/\r\n/g, '\n');
      let boundary = pending.indexOf('\n\n');
      while (boundary >= 0) {
        const block = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (data.length) {
          try {
            onEvent({ event, data: JSON.parse(data.join('\n')) });
          } catch {
            /* a malformed event never ends the stream */
          }
        }
        boundary = pending.indexOf('\n\n');
      }
    },
  };
}

type ServerErrorBody = { code: string; message: string; status: number };

/** Anything the server said on purpose (as opposed to a transport failure). */
class AskServerError extends Error {
  constructor(readonly body: ServerErrorBody) {
    super(body.message);
  }
}

function toRequestError(body: ServerErrorBody): ChartRequestError {
  return classifyChartError(new ApiClientError(body.message, body.code, body.status));
}

async function streamTurn(
  anchorId: string,
  body: AskTurnBody,
  handlers: AskTurnHandlers,
  signal: AbortSignal | undefined
): Promise<{ result: AskTurnResult; receivedAnything: boolean }> {
  const token = await AuthService.getIdToken();
  const response = await streamingFetch(`${apiClient.defaults.baseURL ?? ''}/api/v2/anchors/${encodeURIComponent(anchorId)}/chart/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    // Rejected before streaming began (validation, auth, rate limit): a normal JSON error body.
    let parsed: { error?: { code?: string; message?: string } } = {};
    try {
      parsed = (await response.json()) as typeof parsed;
    } catch {
      /* not JSON */
    }
    throw new AskServerError({ code: parsed.error?.code ?? 'ASK_FAILED', message: parsed.error?.message ?? 'Ask Chart failed', status: response.status });
  }
  if (!response.body) throw new Error('stream_unavailable');
  let receivedAnything = false;
  let result: AskTurnResult | null = null;
  let failure: ServerErrorBody | null = null;
  const parser = createSseParser(({ event, data }) => {
    receivedAnything = true;
    if (event === 'delta') handlers.onReply?.((data as { text: string }).text);
    else if (event === 'stage') handlers.onStage?.((data as { stage: AskStage }).stage);
    else if (event === 'done') result = data as AskTurnResult;
    else if (event === 'error') failure = data as ServerErrorBody;
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  if (failure) throw new AskServerError(failure);
  if (!result) throw Object.assign(new Error('stream_incomplete'), { receivedAnything });
  return { result, receivedAnything };
}

const enc = encodeURIComponent;
const TURN_TIMEOUT_MS = 70_000;
const PHOTO_TIMEOUT_MS = 60_000;

type Envelope<T> = { success: boolean; data: T };

async function call<T>(operation: () => Promise<{ data: Envelope<T> }>): Promise<T> {
  try {
    return (await operation()).data.data;
  } catch (error) {
    throw classifyChartError(error);
  }
}

export const askChartApi = {
  /**
   * One conversation turn. Streams the reply when the platform allows it. If the stream cannot start, or dies
   * before anything arrived, the same turn is retried once as a plain request: the idempotency key makes that
   * safe, and the server returns the answer it already gave rather than asking the model again.
   */
  async turn(anchorId: string, body: AskTurnBody, handlers: AskTurnHandlers = {}, signal?: AbortSignal): Promise<AskTurnResult> {
    try {
      return (await streamTurn(anchorId, body, handlers, signal)).result;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof AskServerError) throw toRequestError(error.body);
      const streamed = (error as { receivedAnything?: boolean }).receivedAnything;
      if (streamed) throw new ChartRequestError('offline', undefined);
    }
    return call(() => apiClient.post(`/api/v2/anchors/${enc(anchorId)}/chart/ask`, body, { timeout: TURN_TIMEOUT_MS, signal }));
  },

  /**
   * Uploads one photo for a message. The server re-encodes it (dropping location and camera metadata) and deletes it
   * after a day. Progress is reported as 0 to 1 while the bytes go up.
   */
  uploadPhoto(
    anchorId: string,
    body: { base64Image: string; mimeType: 'image/jpeg' },
    options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
  ): Promise<{ assetId: string; width: number; height: number }> {
    return call(() =>
      apiClient.post(`/api/v2/anchors/${enc(anchorId)}/chart/ask/photo`, body, {
        timeout: PHOTO_TIMEOUT_MS,
        signal: options.signal,
        onUploadProgress: (event: { loaded: number; total?: number }) => {
          if (event.total) options.onProgress?.(Math.min(1, event.loaded / event.total));
        },
      })
    );
  },

  getConversation(anchorId: string, signal?: AbortSignal): Promise<AskConversation> {
    return call(() => apiClient.get(`/api/v2/anchors/${enc(anchorId)}/chart/ask`, { signal }));
  },

  clearConversation(anchorId: string): Promise<{ cleared: number }> {
    return call(() => apiClient.delete(`/api/v2/anchors/${enc(anchorId)}/chart/ask`));
  },

  getProfile(anchorId: string): Promise<AskProfile> {
    return call(() => apiClient.get(`/api/v2/anchors/${enc(anchorId)}/chart/ask/profile`));
  },

  setStyle(style: CoachStyle): Promise<{ style: CoachStyle }> {
    return call(() => apiClient.put('/api/v2/chart-coach/style', { style }));
  },

  setMemory(anchorId: string, key: AskMemoryKey, value: string): Promise<{ key: AskMemoryKey; value: string }> {
    return call(() => apiClient.put(`/api/v2/anchors/${enc(anchorId)}/chart/ask/memory/${enc(key)}`, { value }));
  },

  deleteMemory(anchorId: string, key: AskMemoryKey): Promise<{ deleted: boolean }> {
    return call(() => apiClient.delete(`/api/v2/anchors/${enc(anchorId)}/chart/ask/memory/${enc(key)}`));
  },

  deleteAllMemories(anchorId: string): Promise<{ deleted: number }> {
    return call(() => apiClient.delete(`/api/v2/anchors/${enc(anchorId)}/chart/ask/memory`));
  },

  async approve(courseId: string, messageId: string): Promise<{ chart: CourseDetail; added: number; batchId?: string }> {
    const result = await call<{ chart: CourseDetail; added: number; batchId?: string }>(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/ask/${enc(messageId)}/approve`));
    await refreshChartAfterProposal(courseId, result.chart.anchorId);
    return result;
  },

  async undoProposal(courseId: string, batchId: string): Promise<{ chart: CourseDetail }> {
    const result = await call<{ chart: CourseDetail }>(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/ask/${enc(batchId)}/undo`));
    await refreshChartAfterProposal(courseId, result.chart.anchorId);
    return result;
  },

  dismiss(courseId: string, messageId: string): Promise<{ dismissed: boolean }> {
    return call(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/ask/${enc(messageId)}/dismiss`));
  },

  routeApplied(courseId: string, messageId: string): Promise<{ applied: boolean }> {
    return call(() => apiClient.post(`/api/v2/charts/${enc(courseId)}/ask/${enc(messageId)}/route-applied`));
  },
};

export type AskChartApi = Pick<typeof askChartApi, 'turn' | 'getConversation'>;
