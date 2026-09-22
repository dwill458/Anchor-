import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { visionApiData } from './visionApi';
import {
  toV2VisionPresentationState,
  toVisualizeHandoff,
  type VisionReadModel,
  type V2VisionPresentationState,
  type V2VisionTile,
  type V2VisualizeHandoff,
  type VisionSceneSource,
} from '@/adapters/v2/vision';

export interface UseV2VisionResult {
  state: V2VisionPresentationState;
  vision: VisionReadModel | null;
  tiles: V2VisionTile[];
  description: string;
  seenToday: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  visualizeHandoff: V2VisualizeHandoff;
  recordVisionView: () => Promise<boolean>;
  refresh: () => Promise<void>;
  createVision: (input: {
    description: string;
    title?: string;
    scenes?: Array<{ assetId: string; prompt?: string; sourceType: VisionSceneSource }>;
  }) => Promise<VisionReadModel | null>;
  updateVision: (input: { title?: string; description?: string }) => Promise<VisionReadModel | null>;
  addScene: (input: {
    assetId: string;
    prompt?: string;
    sourceType: VisionSceneSource;
    sortOrder?: number;
  }) => Promise<VisionReadModel | null>;
  reorderScenes: (sceneOrders: Array<{ id: string; sortOrder: number }>) => Promise<VisionReadModel | null>;
  deleteScene: (sceneId: string) => Promise<VisionReadModel | null>;
  archiveVision: () => Promise<boolean>;
  uploadAsset: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
}

export type UploadAssetResult =
  | { ok: true; asset: { id: string; resolvedUrl: string | null; mimeType: string; fileSizeBytes: number | null; createdAt: string } }
  | { ok: false; message: string };

function resolveUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Last Vision read per Anchor for this app session (`null` = the Anchor has no
 * Vision). Home, Anchor Details, Practice and the Vision screen each mount
 * this hook for the same Anchor; seeding from the previous read lets them
 * render the real Vision on their first frame and revalidate behind it,
 * instead of drawing a spinner or an "Add Vision" card that flips a moment
 * after the navigation transition.
 */
const visionReadCache = new Map<string, VisionReadModel | null>();

/** Drops every cached Vision read (sign-out, account switch, tests). */
export function resetV2VisionReadCache(): void {
  visionReadCache.clear();
}

function sameVision(a: VisionReadModel | null, b: VisionReadModel | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useV2Vision(anchorId: string): UseV2VisionResult {
  const [vision, setVision] = useState<VisionReadModel | null>(() => (anchorId ? visionReadCache.get(anchorId) ?? null : null));
  const [loading, setLoading] = useState<boolean>(() => !(anchorId && visionReadCache.has(anchorId)));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const currentAnchorId = useRef(anchorId);
  currentAnchorId.current = anchorId;
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeRequest.current?.abort();
    };
  }, []);

  /** Every server read lands here: cached for the next mount, and identity kept when unchanged. */
  const commitVision = useCallback((next: VisionReadModel | null, forAnchorId: string) => {
    if (forAnchorId) visionReadCache.set(forAnchorId, next);
    setVision((previous) => (sameVision(previous, next) ? previous : next));
  }, []);

  const fetchVision = useCallback(
    async (isRefresh = false) => {
      const thisRequest = ++requestId.current;
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      if (!anchorId) {
        setLoading(false);
        setVision(null);
        return;
      }
      if (visionReadCache.has(anchorId)) {
        // Already known: show it now and revalidate without a loading state.
        const cached = visionReadCache.get(anchorId) ?? null;
        setVision((previous) => (sameVision(previous, cached) ? previous : cached));
        setLoading(false);
        setRefreshing(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const timeZone = resolveUserTimeZone();
      try {
        const response = await apiClient.get<VisionReadModel>(
          `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`,
          {
            params: { timeZone },
            signal: controller.signal,
          },
        );
        if (!isMountedRef.current || currentAnchorId.current !== anchorId || requestId.current !== thisRequest) return;
        commitVision(visionApiData<VisionReadModel | null>(response), anchorId);
        setIsOffline(false);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (!isMountedRef.current || currentAnchorId.current !== anchorId || requestId.current !== thisRequest) return;
        const status =
          (err instanceof ApiClientError ? err.status : undefined) ??
          (typeof err === 'object' && err !== null ? (err as { status?: number }).status : undefined);

        if (status === 404) {
          // No active vision exists for this anchor - this is an honest empty state
          commitVision(null, anchorId);
          setIsOffline(false);
        } else {
          const message = err instanceof Error ? err.message : 'Unable to load Vision';
          setError(message);
          setIsOffline(true);
        }
      } finally {
        if (isMountedRef.current && currentAnchorId.current === anchorId && requestId.current === thisRequest) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [anchorId, commitVision],
  );

  useEffect(() => {
    fetchVision(false);
  }, [fetchVision]);

  /**
   * Records a genuine view of the Vision surface.
   * MUST only be called when the user actually views the surface, never during prefetch.
   */
  const recordVisionView = useCallback(async (): Promise<boolean> => {
    if (!vision?.id || vision.seenToday) {
      return false;
    }
    const timeZone = resolveUserTimeZone();
    try {
      await apiClient.post<{ seenToday: boolean }>(
        `/api/v2/visions/${encodeURIComponent(vision.id)}/view`,
        { timeZone },
      );
      const cached = visionReadCache.get(anchorId);
      if (cached) visionReadCache.set(anchorId, { ...cached, seenToday: true });
      if (isMountedRef.current) {
        setVision((prev) => (prev ? { ...prev, seenToday: true } : prev));
      }
      return true;
    } catch {
      // Degrade silently; failure to record view does not block the user
      return false;
    }
  }, [anchorId, vision?.id, vision?.seenToday]);

  const createVision = useCallback(
    async (input: {
      description: string;
      title?: string;
      scenes?: Array<{ assetId: string; prompt?: string; sourceType: VisionSceneSource }>;
    }): Promise<VisionReadModel | null> => {
      try {
        const response = await apiClient.post<VisionReadModel>(
          `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`,
          input,
        );
        if (isMountedRef.current) {
          commitVision(visionApiData<VisionReadModel>(response), anchorId);
        }
        return visionApiData<VisionReadModel>(response);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create Vision';
        setError(message);
        return null;
      }
    },
    [anchorId, commitVision],
  );

  const updateVision = useCallback(
    async (input: { title?: string; description?: string }): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        const response = await apiClient.patch<VisionReadModel>(
          `/api/v2/visions/${encodeURIComponent(vision.id)}`,
          input,
        );
        if (isMountedRef.current) {
          commitVision(visionApiData<VisionReadModel>(response), anchorId);
        }
        return visionApiData<VisionReadModel>(response);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update Vision';
        setError(message);
        return null;
      }
    },
    [anchorId, commitVision, vision?.id],
  );

  const reloadAfterMutation = useCallback(async (): Promise<VisionReadModel | null> => {
    const response = await apiClient.get<VisionReadModel>(`/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`);
    const latest = visionApiData<VisionReadModel | null>(response);
    if (isMountedRef.current) commitVision(latest, anchorId);
    return latest;
  }, [anchorId, commitVision]);

  const addScene = useCallback(
    async (input: {
      assetId: string;
      prompt?: string;
      sourceType: VisionSceneSource;
      sortOrder?: number;
    }): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        await apiClient.post(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes`,
          input,
        );
        return await reloadAfterMutation();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add scene';
        setError(message);
        return null;
      }
    },
    [reloadAfterMutation, vision?.id],
  );

  const reorderScenes = useCallback(
    async (sceneOrders: Array<{ id: string; sortOrder: number }>): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        await apiClient.put(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes/reorder`,
          { sceneOrders },
        );
        return await reloadAfterMutation();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to reorder scenes';
        setError(message);
        return null;
      }
    },
    [reloadAfterMutation, vision?.id],
  );

  const deleteScene = useCallback(
    async (sceneId: string): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        await apiClient.delete(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes/${encodeURIComponent(sceneId)}`,
        );
        return await reloadAfterMutation();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove scene';
        setError(message);
        return null;
      }
    },
    [reloadAfterMutation, vision?.id],
  );

  const archiveVision = useCallback(async (): Promise<boolean> => {
    if (!vision?.id) return false;
    try {
      await apiClient.delete(`/api/v2/visions/${encodeURIComponent(vision.id)}`);
      if (anchorId) visionReadCache.set(anchorId, null);
      if (isMountedRef.current) {
        setVision(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [anchorId, vision?.id]);

  const uploadAsset = useCallback(async (input: { base64Image: string; mimeType: string }): Promise<UploadAssetResult> => {
    try {
      const response = await apiClient.post<{ id: string; resolvedUrl: string | null; mimeType: string; fileSizeBytes: number | null; createdAt: string }>(
        '/api/v2/assets/upload', input,
      );
      return { ok: true, asset: visionApiData<{ id: string; resolvedUrl: string | null; mimeType: string; fileSizeBytes: number | null; createdAt: string }>(response) };
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : 'Image upload failed' };
    }
  }, []);

  const refresh = useCallback(() => fetchVision(true), [fetchVision]);

  // Memoised for identity: consumers memoise on `state`, and a fresh object per
  // render made every one of them re-render whenever their host did.
  const presentationState = useMemo(
    () =>
      toV2VisionPresentationState(
        vision?.anchorId === anchorId ? vision : null,
        anchorId,
        error ? { error, isOffline } : undefined,
      ),
    [anchorId, error, isOffline, vision],
  );
  const state = useMemo<V2VisionPresentationState>(
    () => (loading ? { state: 'loading', anchorId } : presentationState),
    [anchorId, loading, presentationState],
  );

  const activeTiles = presentationState.state === 'ready' ? presentationState.tiles : [];
  const activeDesc = presentationState.state === 'ready' ? presentationState.description : '';
  const activeSeenToday = presentationState.state === 'ready' ? presentationState.seenToday : false;

  return {
    state,
    vision,
    tiles: activeTiles,
    description: activeDesc,
    seenToday: activeSeenToday,
    loading,
    refreshing,
    error,
    isOffline,
    visualizeHandoff: toVisualizeHandoff(vision),
    recordVisionView,
    refresh,
    createVision,
    updateVision,
    addScene,
    reorderScenes,
    deleteScene,
    archiveVision,
    uploadAsset,
  };
}
