import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import type { GeneratedVariation } from '@/types';
import { captureCreationAuthContext } from '@/services/CreationAuthContext';

export type CreationGenerationInput = {
  sigilSvg: string;
  styleChoice: string;
  intentionText: string;
  generationAttempt?: number;
  variationCount?: number;
  validateStructure?: boolean;
  devImageModel?: string;
};
export type CreationGenerationResponse = {
  creationSessionId: string;
  variations?: GeneratedVariation[];
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  provider?: string;
  controlMethod?: string;
  generationTime?: number;
  reuseRequestId?: string;
  passingCount?: number;
};
type Reservation = { requestKey: string; creationSessionId: string };
const pending = new Map<string, Promise<Reservation>>();

// Compact local lookup only. Ownership and request binding are verified by the server.
function localKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/** The persisted flow key recovers the server reservation after retries and restarts. */
export async function generateAuthorizedAnchor(input: CreationGenerationInput, requestKey: string, signal?: AbortSignal): Promise<CreationGenerationResponse> {
  const auth = captureCreationAuthContext();
  const identity = await AuthService.ensureGuestSession();
  auth.assertIdentity(identity.user.id, identity.isAnonymous);
  // The verified owner scopes this key on the server. Keeping account IDs out
  // preserves recovery when guest history is merged into an existing account.
  const binding = JSON.stringify([requestKey, input.sigilSvg, input.styleChoice, input.intentionText, input.devImageModel]);
  const storageKey = `${identity.user.id}:${auth.revision}:anchor-creation-session-${localKey(binding)}`;
  const body = { ...input, anchorId: `temp-${localKey(binding)}`, provider: 'gemini', tier: 'premium' };
  let operation = pending.get(storageKey);
  if (!operation) {
    operation = (async () => {
      // Always revalidate/rearm through the server: a prior technical failure may
      // have released its reservation. The stable key still prevents double charges.
      const config: AccountBoundRequestConfig = {
        headers: { 'Idempotency-Key': `creation-${localKey(binding)}-${requestKey}`.slice(0, 200) }, signal,
        anchorAuthToken: identity.token,
        anchorAuthGuard: auth.isCurrent,
      };
      const response = await apiClient.post<{ creationSessionId: string }>('/api/ai/creation-sessions', body, config);
      auth.assertCurrent();
      if (!response.data.creationSessionId) throw new Error('The server did not reserve a creation session.');
      const record = { requestKey: binding, creationSessionId: response.data.creationSessionId };
      return record;
    })();
    pending.set(storageKey, operation);
  }
  let reservation: Reservation;
  try { reservation = await operation; } finally { pending.delete(storageKey); }
  auth.assertCurrent();
  const config: AccountBoundRequestConfig = { timeout: 180000, anchorAuthToken: identity.token,
    anchorAuthGuard: auth.isCurrent, ...(signal ? { signal } : {}) };
  try {
    const response = await apiClient.post<CreationGenerationResponse>('/api/ai/enhance', {
      ...body, creationSessionId: reservation.creationSessionId,
    }, config);
    auth.assertCurrent();
    return { ...response.data, creationSessionId: reservation.creationSessionId };
  } catch (error) {
    auth.assertCurrent();
    // Recovery only reads durable output. An exhausted recovery budget or an
    // interrupted second option must never erase the interpretation already paid for.
    try {
      const recoveryConfig: AccountBoundRequestConfig = { ...config, timeout: 15000 };
      const response = await apiClient.get<CreationGenerationResponse>(
        `/api/ai/creation-sessions/${encodeURIComponent(reservation.creationSessionId)}`, recoveryConfig);
      auth.assertCurrent();
      if (response.data.variations?.length) return { ...response.data, creationSessionId: reservation.creationSessionId };
    } catch { /* Preserve the original generation failure when recovery is unavailable. */ }
    throw error;
  }
}

export function creationSelection(metadata?: { creationSessionId?: string; selectedOptionId?: string }, keepOriginal = false) {
  if (keepOriginal && metadata?.creationSessionId) return { creationSessionId: metadata.creationSessionId, keepOriginal: true };
  return metadata?.creationSessionId && metadata.selectedOptionId ? {
    creationSessionId: metadata.creationSessionId, selectedOptionId: metadata.selectedOptionId,
  } : {};
}
