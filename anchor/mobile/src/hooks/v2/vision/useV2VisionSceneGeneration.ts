import { AnalyticsService } from '@/services/AnalyticsService';
import { selectedDevImageModel } from '@/stores/devImageModelStore';
import { useVisionGenerationAnalytics } from './useVisionGenerationAnalytics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { isProFeatureLocked } from '@/utils/premiumAccess';
import { visionApiData } from './visionApi';
import { generationMessage, type VisionGenerationJob } from './useV2VisionGeneration';
import { useVisionConversation } from './useVisionConversation';
import type { VisionSceneRequestOptions } from '@/types/visionConversation';

const POLL_MS = 2000;

function sceneMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    if (cause.code === 'VISION_IMAGE_LIMIT') return 'Your board is full. Remove an image to add another.';
    if (cause.code === 'VISION_NOT_FOUND') return 'Create your Vision before adding to it.';
    if (cause.code === 'VISION_GENERATION_LIMIT') return 'You have reached the limit for generated scenes on this Vision.';
  }
  return generationMessage(cause);
}

/**
 * One described scene for an existing Vision board, as two candidates. It runs
 * on its own job kind: it never uses one of the three numbered image sets and
 * never rewrites the Vision's description.
 */
export function useV2VisionSceneGeneration(anchorId: string, onPremiumRequired?: () => void) {
  const conversation = useVisionConversation(anchorId);
  const [jobState, setJobState] = useState<{ owner: string | null; job: VisionGenerationJob | null } | null>(null);
  const job = jobState?.owner === conversation.owner ? jobState.job : null;
  const setJob = useCallback((next: VisionGenerationJob | null) => setJobState({ owner: conversation.owner, job: next }), [conversation.owner]);
  useVisionGenerationAnalytics(anchorId, job);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // The server code behind the last failed start/retry. Sticky until a start succeeds, so a
  // background refresh never brings back a "try again" the server will refuse.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const lastCode = useRef<string | null>(null);
  const fail = useCallback((cause: unknown) => {
    if (!conversation.isCurrent()) return;
    const code = cause instanceof ApiClientError ? cause.code ?? null : null;
    lastCode.current = code;
    if (mounted.current) { setErrorCode(code); setError(sceneMessage(cause)); }
  }, [conversation.isCurrent]);
  const starting = useRef(false);
  const retrying = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => { setError(null); setErrorCode(null); lastCode.current = null; starting.current = false; retrying.current = false; pendingRequest.current = null; }, [conversation.owner]);
  const base = `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`;
  const active = Boolean(job && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(job.status));
  const jobId = job?.id ?? null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await apiClient.get<VisionGenerationJob | null>(`${base}/scene-generation/${encodeURIComponent(jobId)}`, conversation.requestConfig());
      const next = visionApiData<VisionGenerationJob | null>(response);
      if (mounted.current && conversation.isCurrent() && next) { setJob(next); setError(null); }
    } catch (cause) {
      if (mounted.current && conversation.isCurrent()) setError(sceneMessage(cause));
    }
  }, [base, jobId, conversation.requestConfig, conversation.isCurrent]);

  // Poll only while the app is in front; catch up the moment it returns.
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const nowForeground = state === 'active';
      setForeground(nowForeground);
      if (nowForeground) void refresh();
    });
    return () => subscription?.remove?.();
  }, [refresh]);
  useEffect(() => {
    if (!active || !foreground) return;
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, foreground, refresh]);

  const start = useCallback(async (sceneDescription: string, appearanceReferenceId?: string | null, startAssetId?: string | null, options?: VisionSceneRequestOptions): Promise<boolean> => {
    if (starting.current || !conversation.isCurrent()) return false;
    // Mirror the server's Pro rule so the paywall opens before a doomed request (and under a dev tier override).
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    starting.current = true;
    const devImageModel = selectedDevImageModel('vision');
    setError(null); lastCode.current = null;
    try {
      const savedSession = options ? await conversation.ensureSession(sceneDescription) : null;
      const payload = {
        sceneDescription,
        ...(devImageModel ? { devImageModel } : {}),
        ...(appearanceReferenceId ? { appearanceReferenceId } : {}),
        ...(startAssetId ? { startAssetId } : {}),
        ...(options ? { ...options, sessionId: options.sessionId ?? savedSession!.id } : {}),
      };
      const fingerprint = JSON.stringify(payload);
      if (pendingRequest.current?.fingerprint !== fingerprint) pendingRequest.current = { fingerprint, key: `vision-scene-${Date.now()}-${Math.floor(Math.random() * 1e12)}` };
      const idempotencyKey = options ? await conversation.prepareRequest(fingerprint) : pendingRequest.current.key;
      const response = await apiClient.post<VisionGenerationJob>(`${base}/scene-generation`, { ...payload, idempotencyKey }, conversation.requestConfig());
      const next = visionApiData<VisionGenerationJob>(response);
      if (!conversation.isCurrent()) return false;
      if (mounted.current) { setJob(next); setErrorCode(null); }
      pendingRequest.current = null;
      if (options) void conversation.acceptedRequest().catch(() => undefined);
      AnalyticsService.track('vision_image_generation_started', { anchor_id: anchorId, job_id: next.id });
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else fail(cause);
      return false;
    } finally {
      starting.current = false;
    }
  }, [base, onPremiumRequired, fail, conversation.ensureSession, conversation.prepareRequest, conversation.acceptedRequest, conversation.requestConfig, conversation.isCurrent]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (!job || job.status !== 'FAILED' || retrying.current) return false;
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    retrying.current = true;
    try {
      const response = await apiClient.post<VisionGenerationJob>(`${base}/generation/${encodeURIComponent(job.id)}/retry`, undefined, conversation.requestConfig());
      if (mounted.current && conversation.isCurrent()) { setJob(visionApiData<VisionGenerationJob>(response)); setError(null); }
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else fail(cause);
      return false;
    } finally {
      retrying.current = false;
    }
  }, [base, job, onPremiumRequired, fail, conversation.requestConfig, conversation.isCurrent]);
  const lastErrorCode = useCallback(() => lastCode.current, []);
  useEffect(() => {
    if (job?.status === 'COMPLETE' || job?.status === 'FAILED') void conversation.refresh().catch(() => undefined);
  }, [job?.id, job?.status, conversation.refresh]);

  const restoreJob = useCallback((saved: VisionGenerationJob | null) => { setJob(saved); setError(null); }, [setJob]);
  return { job, error, errorCode, lastErrorCode, start, retry, refresh, restoreJob, conversation };
}
