import { AnalyticsService } from '@/services/AnalyticsService';
import { useVisionGenerationAnalytics } from './useVisionGenerationAnalytics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { selectedDevImageModel } from '@/stores/devImageModelStore';
import { AppState } from 'react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { isProFeatureLocked } from '@/utils/premiumAccess';
import { visionApiData } from './visionApi';

export interface VisionGenerationCandidate {
  id: string;
  assetId: string | null;
  role: string;
  prompt: string;
  sortOrder: number;
  imageUrl: string | null;
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export interface VisionGenerationJob {
  id: string;
  /** SET = a numbered image set; SCENE = one described scene added to the board. */
  kind?: 'SET' | 'SCENE';
  visionId: string;
  anchorId: string;
  setNumber: number;
  retryCount: number;
  status: 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'COMPLETE' | 'FAILED';
  stage: string;
  error: string | null;
  candidates: VisionGenerationCandidate[];
}

export function generationMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    if (cause.code === 'VISION_GENERATION_LIMIT') return 'You have used all three generated image sets for this Vision.';
    if (cause.code === 'VISION_RETRY_LIMIT') return 'This image set cannot be retried again.';
    if (cause.code === 'VISION_GENERATION_IN_PROGRESS') return 'Your images are still being created.';
  }
  return 'Image creation is unavailable right now. You can still add your own images.';
}

export function useV2VisionGeneration(anchorId: string, onPremiumRequired?: () => void) {
  const [job, setJob] = useState<VisionGenerationJob | null>(null);
  useVisionGenerationAnalytics(anchorId, job);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const pendingKey = useRef<string | null>(null);
  const active = job && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(job.status);
  const path = `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision/generation`;

  const refresh = useCallback(async () => {
    if (!anchorId) return;
    try {
      const response = await apiClient.get<VisionGenerationJob | null>(path);
      if (mounted.current) { setJob(visionApiData<VisionGenerationJob | null>(response)); setError(null); }
    } catch (cause) {
      if (mounted.current) setError(generationMessage(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [anchorId, path]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  // Poll only while the app is in front; catch up the moment it returns,
  // because images keep being created on the server while it is away.
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
    const timer = setInterval(() => { void refresh(); }, 2500);
    return () => clearInterval(timer);
  }, [active, foreground, refresh]);

  const start = useCallback(async (description: string, appearanceReferenceId?: string | null): Promise<boolean> => {
    if (pendingKey.current) return false;
    // Mirror the server's Pro rule so the paywall opens before a doomed request (and under a dev tier override).
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    const key = `vision-${Date.now()}-${Math.floor(Math.random() * 1e12)}`;
    const devImageModel = selectedDevImageModel('vision');
    pendingKey.current = key;
    setError(null);
    try {
      const response = await apiClient.post<VisionGenerationJob>(path, { description, idempotencyKey: key,
        ...(devImageModel ? { devImageModel } : {}),
        ...(appearanceReferenceId ? { appearanceReferenceId } : {}) });
      if (mounted.current) setJob(visionApiData<VisionGenerationJob>(response));
      AnalyticsService.track('vision_image_generation_started', { anchor_id: anchorId, job_id: visionApiData<VisionGenerationJob>(response).id });
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else if (mounted.current) setError(generationMessage(cause));
      return false;
    } finally {
      pendingKey.current = null;
    }
  }, [onPremiumRequired, path]);

  const retrying = useRef(false);
  const retry = useCallback(async (): Promise<boolean> => {
    if (!job || job.status !== 'FAILED' || retrying.current) return false;
    if (onPremiumRequired && isProFeatureLocked()) { onPremiumRequired(); return false; }
    retrying.current = true;
    try {
      const response = await apiClient.post<VisionGenerationJob>(`${path}/${encodeURIComponent(job.id)}/retry`);
      if (mounted.current) { setJob(visionApiData<VisionGenerationJob>(response)); setError(null); }
      return true;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'VISION_PREMIUM_REQUIRED') onPremiumRequired?.();
      else if (mounted.current) setError(generationMessage(cause));
      return false;
    } finally {
      retrying.current = false;
    }
  }, [job, onPremiumRequired, path]);

  return { job, loading, error, refresh, start, retry };
}
