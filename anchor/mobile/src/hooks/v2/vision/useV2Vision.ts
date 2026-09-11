import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import {
  toV2VisionPresentationState,
  toVisualizeHandoff,
  type VisionReadModel,
  type V2VisionPresentationState,
  type V2VisionTile,
  type V2VisualizeHandoff,
  type VisionSceneSource,
  type VisionAssetReadModel,
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
  uploadVisionAsset: (uri: string, mimeType?: string) => Promise<VisionAssetReadModel | null>;
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
}

function resolveUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useV2Vision(anchorId: string): UseV2VisionResult {
  const [vision, setVision] = useState<VisionReadModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchVision = useCallback(
    async (isRefresh = false) => {
      if (!anchorId) {
        setLoading(false);
        setVision(null);
        return;
      }
      if (isRefresh) {
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
          },
        );
        if (!isMountedRef.current) return;
        setVision(response.data);
        setIsOffline(false);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const status =
          (err instanceof ApiClientError ? err.status : undefined) ??
          (typeof err === 'object' && err !== null ? (err as { status?: number }).status : undefined);

        if (status === 404) {
          // No active vision exists for this anchor - this is an honest empty state
          setVision(null);
          setIsOffline(false);
        } else {
          const message = err instanceof Error ? err.message : 'Unable to load Vision';
          setError(message);
          setIsOffline(true);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [anchorId],
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
      if (isMountedRef.current) {
        setVision((prev) => (prev ? { ...prev, seenToday: true } : prev));
      }
      return true;
    } catch {
      // Degrade silently; failure to record view does not block the user
      return false;
    }
  }, [vision?.id, vision?.seenToday]);

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
          setVision(response.data);
        }
        return response.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create Vision';
        setError(message);
        return null;
      }
    },
    [anchorId],
  );

  // A Vision never references a client-local or prototype asset ID. The server
  // owns validation, private storage, and the resulting canonical Asset ID.
  const uploadVisionAsset = useCallback(
    async (uri: string, suppliedMimeType?: string): Promise<VisionAssetReadModel | null> => {
      try {
        const mimeType = suppliedMimeType ?? (uri.toLowerCase().endsWith('.png')
          ? 'image/png'
          : uri.toLowerCase().endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg');
        const base64Image = uri.startsWith('data:')
          ? uri
          : `data:${mimeType};base64,${await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            })}`;
        const response = await apiClient.post<VisionAssetReadModel>('/api/v2/assets/upload', {
          base64Image,
          mimeType,
        });
        return response.data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to upload image');
        return null;
      }
    },
    [],
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
          setVision(response.data);
        }
        return response.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update Vision';
        setError(message);
        return null;
      }
    },
    [vision?.id],
  );

  const addScene = useCallback(
    async (input: {
      assetId: string;
      prompt?: string;
      sourceType: VisionSceneSource;
      sortOrder?: number;
    }): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        const response = await apiClient.post<VisionReadModel>(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes`,
          input,
        );
        if (isMountedRef.current) {
          setVision(response.data);
        }
        return response.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add scene';
        setError(message);
        return null;
      }
    },
    [vision?.id],
  );

  const reorderScenes = useCallback(
    async (sceneOrders: Array<{ id: string; sortOrder: number }>): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        const response = await apiClient.put<VisionReadModel>(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes/reorder`,
          { sceneOrders },
        );
        if (isMountedRef.current) {
          setVision(response.data);
        }
        return response.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to reorder scenes';
        setError(message);
        return null;
      }
    },
    [vision?.id],
  );

  const deleteScene = useCallback(
    async (sceneId: string): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      try {
        const response = await apiClient.delete<VisionReadModel>(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes/${encodeURIComponent(sceneId)}`,
        );
        if (isMountedRef.current) {
          setVision(response.data);
        }
        return response.data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove scene';
        setError(message);
        return null;
      }
    },
    [vision?.id],
  );

  const archiveVision = useCallback(async (): Promise<boolean> => {
    if (!vision?.id) return false;
    try {
      await apiClient.delete(`/api/v2/visions/${encodeURIComponent(vision.id)}`);
      if (isMountedRef.current) {
        setVision(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [vision?.id]);

  const refresh = useCallback(() => fetchVision(true), [fetchVision]);

  const presentationState = toV2VisionPresentationState(
    vision,
    anchorId,
    error ? { error, isOffline } : undefined,
  );

  const activeTiles = presentationState.state === 'ready' ? presentationState.tiles : [];
  const activeDesc = presentationState.state === 'ready' ? presentationState.description : '';
  const activeSeenToday = presentationState.state === 'ready' ? presentationState.seenToday : false;

  return {
    state: loading ? { state: 'loading', anchorId } : presentationState,
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
    uploadVisionAsset,
    updateVision,
    addScene,
    reorderScenes,
    deleteScene,
    archiveVision,
  };
}
