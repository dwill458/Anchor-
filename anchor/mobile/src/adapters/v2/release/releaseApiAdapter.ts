import { apiClient, ApiClientError } from '@/services/ApiClient';
import type { V2ReleaseAdapter, V2ReleaseRequest, V2ReleaseResult } from './types';

/**
 * Canonical non-destructive V2 release endpoint. Release seals the Anchor
 * (`status: 'released'`) and preserves every history record. The legacy
 * destructive `POST /api/anchors/:id/burn` route is never called from here.
 */
export const V2_RELEASE_ENDPOINT = (anchorId: string): string =>
  `/api/v2/anchors/${encodeURIComponent(anchorId)}/release`;

/** Server codes that mean "already released" — a successful idempotent replay, not an error. */
const ALREADY_RELEASED_CODES = new Set([
  'ANCHOR_ALREADY_RELEASED',
  'ALREADY_RELEASED',
  'ANCHOR_RELEASED',
]);

type HttpClient = Pick<typeof apiClient, 'post'>;

/** Stable idempotency key for one release attempt. Reused verbatim across offline/timeout retries. */
export function createReleaseIdempotencyKey(anchorId: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `release-${anchorId}-${Date.now()}-${rand}`;
}

/**
 * Builds the production release adapter over the shared authenticated API
 * client. Injectable so screens and tests can substitute a fake.
 */
export function createV2ReleaseApiAdapter(client: HttpClient = apiClient): V2ReleaseAdapter {
  return {
    async submitRelease(request: V2ReleaseRequest): Promise<V2ReleaseResult> {
      const { anchorId, idempotencyKey, reason } = request;

      try {
        const response = await client.post(V2_RELEASE_ENDPOINT(anchorId), {
          idempotencyKey,
          ...(reason ? { reason } : {}),
        });

        const payload = extractPayload(response);
        return {
          status: 'released',
          anchorId,
          releasedAt:
            payload.releasedAt ??
            payload.intentionCompletedAt ??
            new Date().toISOString(),
          lifecycleState: payload.lifecycleState ?? 'released',
        };
      } catch (error: unknown) {
        return classifyFailure(anchorId, error);
      }
    },
  };
}

/** Default production adapter instance. */
export const v2ReleaseApiAdapter: V2ReleaseAdapter = createV2ReleaseApiAdapter();

interface ReleasePayload {
  releasedAt?: string;
  intentionCompletedAt?: string;
  lifecycleState?: 'active' | 'completed' | 'released';
}

function extractPayload(response: unknown): ReleasePayload {
  const body = (response as { data?: unknown })?.data;
  const inner = (body as { data?: unknown })?.data ?? body;
  return (inner && typeof inner === 'object' ? inner : {}) as ReleasePayload;
}

function classifyFailure(anchorId: string, error: unknown): V2ReleaseResult {
  if (error instanceof ApiClientError) {
    // Idempotent replay: the server already sealed this Anchor.
    if (
      error.status === 409 ||
      (error.code && ALREADY_RELEASED_CODES.has(error.code))
    ) {
      return {
        status: 'released',
        anchorId,
        releasedAt: new Date().toISOString(),
        lifecycleState: 'released',
      };
    }

    // Server-side errors are safe to retry with the same key.
    if (typeof error.status === 'number' && error.status >= 500) {
      return {
        status: 'pending',
        anchorId,
        message: error.message,
        retryable: true,
      };
    }

    return { status: 'failed', anchorId, message: error.message, retryable: false };
  }

  const message = error instanceof Error ? error.message : 'Release request failed';

  // ApiClient throws a plain Error for offline ("Network error…") and 5xx
  // ("Server error…"). A timeout is not proof of failure — reconcile, do not
  // claim success or "nothing changed".
  if (/network error|server error|timeout|timed out/i.test(message)) {
    return { status: 'pending', anchorId, message, retryable: true };
  }

  return { status: 'failed', anchorId, message, retryable: false };
}
