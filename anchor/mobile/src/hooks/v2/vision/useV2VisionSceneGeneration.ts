import { AnalyticsService } from '@/services/AnalyticsService';
import { useVisionGenerationAnalytics } from './useVisionGenerationAnalytics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { isProFeatureLocked } from '@/utils/premiumAccess';
import { visionApiData } from './visionApi';
import { generationMessage, type VisionGenerationJob } from './useV2VisionGeneration';

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
  const [job, setJob] = useState<VisionGenerationJob | null>(null);
  useVisionGenerationAnalytics(anchorId, job);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const starting = useRef(false);
  const retrying = useRef(false);
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
      const response = await apiClient.get<VisionGenerationJob | null>(`${base}/scene-generation/${encodeURIComponent(jobId)}`);
      const next = visionApiData<VisionGenerationJob | null>(response);
      if (mounted.current && next) { setJob(next); setError(null); }
    } catch (cause) {
      if (mounted.current) setError(sceneMessage(cause));
    }
  }, [base, jobId]);

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

  const start = useCallback(async (sceneDescription: string, appearanceReferenceId?: string | null, startAssetId?: string | null): Promise<boolean> => {
    if (starting.current) return false;
    // Mirror the server's Pro rule so the paywall opens before a doomed request (and under a dev tier override).
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    starting.current = true;
    setError(null);
    try {
      const idempotencyKey = `vision-scene-${Date.now()}-${Math.floor(Math.random() * 1e12)}`;
      const response = await apiClient.post<VisionGenerationJob>(`${base}/scene-generation`, {
        sceneDescription,
        idempotencyKey,
        ...(appearanceReferenceId ? { appearanceReferenceId } : {}),
        ...(startAssetId ? { startAssetId } : {}),
      });
      const next = visionApiData<VisionGenerationJob>(response);
      if (mounted.current) setJob(next);
      AnalyticsService.track('vision_image_generation_started', { anchor_id: anchorId, job_id: next.id });
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else if (mounted.current) setError(sceneMessage(cause));
      return false;
    } finally {
      starting.current = false;
    }
  }, [base, onPremiumRequired]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (!job || job.status !== 'FAILED' || retrying.current) return false;
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    retrying.current = true;
    try {
      const response = await apiClient.post<VisionGenerationJob>(`${base}/generation/${encodeURIComponent(job.id)}/retry`);
      if (mounted.current) { setJob(visionApiData<VisionGenerationJob>(response)); setError(null); }
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else if (mounted.current) setError(sceneMessage(cause));
      return false;
    } finally {
      retrying.current = false;
    }
  }, [base, job, onPremiumRequired]);

  return { job, error, start, retry, refresh };
}
