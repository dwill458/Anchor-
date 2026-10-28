import { AnalyticsService } from '@/services/AnalyticsService';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { visionApiData } from './visionApi';
import { resolveSlotMap } from '@/components/v2/vision/board/visionBoardSlots';
import { clampVisionNotePresentationForAspect } from '@/components/v2/vision/notes/visionNotePlacement';
import { retainPendingVisionWrite,clearPendingVisionWrite,takePendingVisionWrites,releasePendingVisionWrites } from './visionPendingWrites';
import { enqueueVisionMutation, getVisionMutationFeedback, subscribeVisionMutations, resetVisionMutationQueues, type VisionMutationFeedback } from './visionMutationQueue';
import type { VisionBoardLayout, VisionNoteLayoutPositions } from '@/adapters/v2/vision';
import { toV2VisionPresentationState, toVisualizeHandoff, type VisionReadModel, type V2VisionPresentationState, type V2VisionTile, type V2VisualizeHandoff, type VisionSceneSource, type VisionNotePresentation } from '@/adapters/v2/vision';

export interface UseV2VisionResult {
  state: V2VisionPresentationState;
  mutationFeedback: VisionMutationFeedback;
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
    scenes?: Array<{ assetId: string; prompt?: string; caption?: string | null; sourceType: VisionSceneSource }>;
  }) => Promise<VisionReadModel | null>;
  updateVision: (input: { title?: string; description?: string; boardLayout?: VisionBoardLayout; expectedUpdatedAt?: string }) => Promise<VisionReadModel | null>;
  addScene: (input: {
    assetId: string;
    prompt?: string;
      caption?: string | null;
    sourceType: VisionSceneSource;
    sortOrder?: number;
  }) => Promise<VisionReadModel | null>;
  reorderScenes: (sceneOrders: Array<{ id: string; sortOrder: number }>) => Promise<VisionReadModel | null>;
  deleteScene: (sceneId: string) => Promise<VisionReadModel | null>;
  archiveVision: () => Promise<boolean>;
  createNote: (input: { clientRequestId: string; content: { text: string }; presentation: VisionNotePresentation }) => Promise<VisionReadModel | null>;
  updateNote: (noteId: string, input: { content?: { text: string }; presentation?: VisionNotePresentation; layoutPositions?: VisionNoteLayoutPositions }) => Promise<VisionReadModel | null>;
  deleteNote: (noteId: string) => Promise<VisionReadModel | null>;
  restoreNote: (noteId: string) => Promise<VisionReadModel | null>;
  updateSceneCaption: (sceneId: string, caption: string | null) => Promise<VisionReadModel | null>;
  replaceScene: (sceneId:string,replacement:{assetId:string;sourceType:VisionSceneSource;prompt?:string|null;caption?:string|null})=>Promise<VisionReadModel|null>;
  setBoardLayout: (layout: VisionBoardLayout, expectedUpdatedAt?: string) => Promise<VisionReadModel | null>;
  updateSceneSlots: (slots: Array<{ sceneId: string; slotIndex: number }>) => Promise<VisionReadModel | null>;
  syncScenePresentation: (sceneId: string, patch: { slotIndex?: number | null; focal?: { x: number; y: number } | null }) => Promise<VisionReadModel | null>;
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
const visionMutationVersions = new Map<string, number>();
const visionReadCache = new Map<string, VisionReadModel | null>();
const persistedVisionReads = new Map<string, Promise<VisionReadModel | null | undefined>>();
type VisionReadListener = (key: string, value: VisionReadModel | null) => void;
const visionReadListeners = new Set<VisionReadListener>();

/**
 * Writes a Vision read and tells every mounted `useV2Vision` for that Anchor.
 * Home, Practice and the Vision screen each hold their own copy of the read;
 * without this a reorder made on the Vision screen left the others showing the
 * previous order (and a different hero image) until they next refetched.
 */
function setVisionRead(key: string, value: VisionReadModel | null): void {
  visionReadCache.set(key, value);
  visionReadListeners.forEach(listener => listener(key, value));
}

const currentAccountId = () => useAuthStore.getState().user?.id ?? null;
const visionCacheKey = (anchorId: string, accountId = currentAccountId()) => `${accountId ?? 'anonymous'}:${anchorId}`;
const visionStorageKey = (anchorId: string, accountId: string) =>
  `anchor:v2:vision-read:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;

function persistVisionRead(anchorId: string, accountId: string | null, value: VisionReadModel | null): void {
  if (!anchorId || !accountId) return;
  const snapshot = { schemaVersion: 1, accountId, anchorId, value };
  void Promise.resolve(encryptedPersistStorage.setItem(visionStorageKey(anchorId, accountId), JSON.stringify(snapshot))).catch(() => undefined);
}

/** Seed the shared Vision read cache (fixtures, previews, and tests); surfaces update immediately. */
export function primeVisionRead(anchorId: string, value: VisionReadModel, accountId = currentAccountId()): void {
  const key = visionCacheKey(anchorId, accountId);
  setVisionRead(key, value);
  persistVisionRead(anchorId, accountId, value);
}

async function restoreVisionRead(anchorId: string, accountId: string | null): Promise<VisionReadModel | null | undefined> {
  if (!anchorId) return undefined;
  const key = visionCacheKey(anchorId, accountId);
  if (visionReadCache.has(key)) return visionReadCache.get(key) ?? null;
  if (!accountId) return undefined;

  let pending = persistedVisionReads.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const raw = await encryptedPersistStorage.getItem(visionStorageKey(anchorId, accountId));
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as {
          schemaVersion?: number;
          accountId?: string;
          anchorId?: string;
          value?: unknown;
        };
        if (parsed.schemaVersion !== 1 || parsed.accountId !== accountId || parsed.anchorId !== anchorId) return undefined;
        if (parsed.value === null) return null;
        if (!parsed.value || typeof parsed.value !== 'object' || (parsed.value as VisionReadModel).anchorId !== anchorId) return undefined;
        return parsed.value as VisionReadModel;
      } catch {
        return undefined;
      }
    })();
    persistedVisionReads.set(key, pending);
    void pending.finally(() => {
      if (persistedVisionReads.get(key) === pending) persistedVisionReads.delete(key);
    });
  }

  const restored = await pending;
  if (visionReadCache.has(key)) return visionReadCache.get(key) ?? null;
  if (restored !== undefined) setVisionRead(key, restored);
  return restored;
}

/** Drops every cached Vision read (sign-out, account switch, tests). */
export function resetV2VisionReadCache(): void {
  visionReadCache.clear();
  resetVisionMutationQueues();
  visionMutationVersions.clear();
  persistedVisionReads.clear();
  inFlightVision.clear();
}

/** Synchronously checks if Vision is already cached for this Anchor. */
export function peekV2Vision(anchorId: string, accountId = currentAccountId()): VisionReadModel | null | undefined {
  const key = visionCacheKey(anchorId, accountId);
  if (!anchorId || !visionReadCache.has(key)) return undefined;
  return visionReadCache.get(key) ?? null;
}

const inFlightVision = new Map<string, Promise<VisionReadModel | null>>();

/** One shared request path for bootstrap prefetch and mounted Home hooks. */
function requestV2Vision(anchorId: string, signal?: AbortSignal, accountId = currentAccountId()): Promise<VisionReadModel | null> {
  const key = visionCacheKey(anchorId, accountId);
  const existing = inFlightVision.get(key);
  if (existing) return existing;

  const mutationVersion = visionMutationVersions.get(key) ?? 0;
  const span = HomeStartupProfiler.start('vision_request', { anchorId });
  const request = (async () => {
    const timeZone = resolveUserTimeZone();
    try {
      const response = await apiClient.get<VisionReadModel>(
        `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`,
        { params: { timeZone }, signal },
      );
      // A GET started before a confirmed write must not erase that write on
      // the board, even when it finishes after the composer has returned.
      if ((visionMutationVersions.get(key) ?? 0) !== mutationVersion) return visionReadCache.get(key) ?? null;
      const data = visionApiData<VisionReadModel | null>(response);
      setVisionRead(key, data);
      persistVisionRead(anchorId, accountId, data);
      span({ ok: true });
      return data;
    } catch (err: unknown) {
      if ((visionMutationVersions.get(key) ?? 0) !== mutationVersion) return visionReadCache.get(key) ?? null;
      const status =
        (err instanceof ApiClientError ? err.status : undefined) ??
        (typeof err === 'object' && err !== null ? (err as { status?: number }).status : undefined);
      if (status === 404) {
        setVisionRead(key, null);
        persistVisionRead(anchorId, accountId, null);
      }
      span({ ok: status === 404, status: status ?? null });
      throw err;
    } finally {
      inFlightVision.delete(key);
    }
  })();

  inFlightVision.set(key, request);
  return request;
}

/** Pre-warms Vision cache in the background; never throws on failure. */
export async function prefetchV2Vision(anchorId: string, signal?: AbortSignal): Promise<VisionReadModel | null> {
  if (!anchorId) return null;
  const accountId = currentAccountId();
  const key = visionCacheKey(anchorId, accountId);
  if (visionReadCache.has(key)) return visionReadCache.get(key) ?? null;
  void restoreVisionRead(anchorId, accountId);
  try {
    return await requestV2Vision(anchorId, signal, accountId);
  } catch {
    return visionReadCache.get(key) ?? null;
  }
}

function sameVision(a: VisionReadModel | null, b: VisionReadModel | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useV2Vision(anchorId: string): UseV2VisionResult {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const key = visionCacheKey(anchorId, accountId);
  const mutationFeedback = useSyncExternalStore(useCallback(listener => subscribeVisionMutations(key, listener), [key]), useCallback(() => getVisionMutationFeedback(key), [key]));
  const [vision, setVision] = useState<VisionReadModel | null>(() => (anchorId ? visionReadCache.get(key) ?? null : null));
  const [loading, setLoading] = useState<boolean>(() => !(anchorId && visionReadCache.has(key)));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const currentCacheKey = useRef(key);
  const pendingLayoutRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryFetchRef = useRef<() => void>(() => undefined);
  const schedulePendingRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (AppState.currentState === 'active') retryFetchRef.current();
    }, 30_000);
  }, []);

  // Synchronize state immediately if anchorId changes during rendering
  if (currentCacheKey.current !== key) {
    currentCacheKey.current = key;
    const cached = anchorId ? visionReadCache.get(key) ?? null : null;
    const hasCache = Boolean(anchorId && visionReadCache.has(key));
    setVision(cached);
    setLoading(!hasCache);
    setRefreshing(hasCache);
    setError(null);
  }

  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeRequest.current?.abort();
      if(retryTimerRef.current)clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Stay in step with reads made by other screens for this Anchor.
  useEffect(() => {
    const listener: VisionReadListener = (changedKey, value) => {
      if (changedKey !== currentCacheKey.current || !isMountedRef.current) return;
      setVision(previous => (sameVision(previous, value) ? previous : value));
    };
    visionReadListeners.add(listener);
    return () => { visionReadListeners.delete(listener); };
  }, []);

  /** Every server read lands here: cached for the next mount, and identity kept when unchanged. */
  const commitVision = useCallback((next: VisionReadModel | null, forAnchorId: string, forAccountId = accountId) => {
    if (forAnchorId) {
      const forKey = visionCacheKey(forAnchorId, forAccountId);
      setVisionRead(forKey, next);
      persistVisionRead(forAnchorId, forAccountId, next);
      if (currentCacheKey.current === forKey) {
        setError(null);
        setVision((previous) => (sameVision(previous, next) ? previous : next));
      }
    }
  }, [accountId]);

  const commitMutation = useCallback((next: VisionReadModel | null, forAnchorId: string) => {
    const writeKey = visionCacheKey(forAnchorId, accountId);
    visionMutationVersions.set(writeKey, (visionMutationVersions.get(writeKey) ?? 0) + 1);
    commitVision(next, forAnchorId);
  }, [accountId, commitVision]);

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
      if (visionReadCache.has(key)) {
        // Already known: show it now and revalidate without a loading state.
        const cached = visionReadCache.get(key) ?? null;
        setVision((previous) => (sameVision(previous, cached) ? previous : cached));
        setLoading(false);
        setRefreshing(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const nextVision = await requestV2Vision(anchorId, controller.signal, accountId);
        if (!isMountedRef.current || currentCacheKey.current !== key || requestId.current !== thisRequest) return;
        let pendingWrites: Awaited<ReturnType<typeof takePendingVisionWrites>> = [];
        if (accountId && !getVisionMutationFeedback(key).pending) {
          try { pendingWrites = await takePendingVisionWrites(accountId, anchorId); }
          catch { /* Keep the confirmed server read usable; the encrypted queue remains intact. */ }
        }
        const pendingLayout = pendingWrites.find(write =>
          write.path === `/api/v2/visions/${encodeURIComponent(nextVision?.id ?? '')}` &&
          typeof write.body.boardLayout === 'string');
        if(pendingLayout)pendingLayoutRef.current=true;
        const visibleVision = pendingLayout && nextVision
          ? { ...nextVision, boardLayout: pendingLayout.body.boardLayout as VisionBoardLayout }
          : nextVision;
        commitVision(visibleVision, anchorId);
        setIsOffline(false);
        if(accountId&&pendingWrites.length)void (async()=>{
          const writes = pendingWrites;
          let retryLayout=false;
          for(const write of writes) {
            if(currentAccountId()!==accountId)return;
            const retryBody = typeof write.body.boardLayout === 'string' && nextVision?.updatedAt
              ? { ...write.body, expectedUpdatedAt: nextVision.updatedAt }
              : write.body;
            if(retryBody!==write.body)try { await retainPendingVisionWrite(accountId,anchorId,write.method,write.path,retryBody); } catch { /* Keep the original durable retry. */ }
            await enqueueVisionMutation(key,'Saved after reconnect',async()=>{
              try {
                const response=await apiClient[write.method]<VisionReadModel>(write.path,retryBody);
                const saved=visionApiData<VisionReadModel>(response);
                if(typeof retryBody.boardLayout === 'string' && saved.boardLayout !== retryBody.boardLayout) {
                  const current=visionReadCache.get(key) ?? visibleVision;
                  if(current)commitMutation({...saved,boardLayout:retryBody.boardLayout as VisionBoardLayout},anchorId);
                  retryLayout=true;
                  return current ?? null;
                }
                commitMutation(saved,anchorId);
                await clearPendingVisionWrite(accountId,anchorId,write.method,write.path,retryBody);
                if(typeof retryBody.boardLayout==='string') {
                  pendingLayoutRef.current=false;
                  if(retryTimerRef.current)clearTimeout(retryTimerRef.current);
                  retryTimerRef.current=null;
                }
                return saved;
              }catch(err){if(typeof retryBody.boardLayout==='string')retryLayout=true;if(isMountedRef.current&&currentCacheKey.current===key)setError(err instanceof Error?err.message:'The offline change could not be saved. Try again.');return null;}
            });
          }
          if(retryLayout&&pendingLayoutRef.current)schedulePendingRetry();
        })().finally(()=>releasePendingVisionWrites(accountId,anchorId));
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (!isMountedRef.current || currentCacheKey.current !== key || requestId.current !== thisRequest) return;
        const status =
          (err instanceof ApiClientError ? err.status : undefined) ??
          (typeof err === 'object' && err !== null ? (err as { status?: number }).status : undefined);

        if (status === 404) {
          // No active vision exists for this anchor - this is an honest empty state
          commitVision(null, anchorId);
          setIsOffline(false);
        } else {
          setIsOffline(true);
          if(accountId&&pendingLayoutRef.current)schedulePendingRetry();
          // Keep a last-known Vision visible when revalidation is unavailable.
          // A cached absence is not enough to claim the server still has none.
          if (!visionReadCache.get(key)) {
            const message = err instanceof Error ? err.message : 'Unable to load Vision';
            setError(message);
          }
        }
      } finally {
        if (isMountedRef.current && currentCacheKey.current === key && requestId.current === thisRequest) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [accountId, anchorId, commitVision, commitMutation,key,schedulePendingRetry],
  );

  retryFetchRef.current = () => { void fetchVision(true); };

  useEffect(() => {
    fetchVision(false);
  }, [fetchVision]);

  // Revalidate retained edits when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && accountId) void fetchVision(true);
    });
    return () => subscription.remove();
  }, [accountId, fetchVision]);

  // Reconstruct the last-known Vision presentation from encrypted storage
  // while the server request above continues independently.
  useEffect(() => {
    if (!anchorId || !accountId) return undefined;
    let cancelled = false;
    void restoreVisionRead(anchorId, accountId).then((cached) => {
      if (cancelled || cached === undefined || currentCacheKey.current !== key) return;
      const cacheKey = visionCacheKey(anchorId, accountId);
      if (!visionReadCache.has(cacheKey)) setVisionRead(cacheKey, cached);
      setVision((previous) => (sameVision(previous, cached) ? previous : cached));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, anchorId, key]);

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
      const cached = visionReadCache.get(key);
      if (cached) {
        const updated = { ...cached, seenToday: true };
        setVisionRead(key, updated);
        persistVisionRead(anchorId, accountId, updated);
      }
      if (isMountedRef.current && currentCacheKey.current === key) {
        setVision((prev) => (prev ? { ...prev, seenToday: true } : prev));
      }
      return true;
    } catch {
      // Degrade silently; failure to record view does not block the user
      return false;
    }
  }, [anchorId, key, vision?.id, vision?.seenToday]);

  const createVision = useCallback(
    async (input: {
      description: string;
      title?: string;
      scenes?: Array<{ assetId: string; prompt?: string; caption?: string | null; sourceType: VisionSceneSource }>;
    }): Promise<VisionReadModel | null> => {
      try {
        const response = await apiClient.post<VisionReadModel>(
          `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`,
          input,
        );
        if (isMountedRef.current) {
          commitMutation(visionApiData<VisionReadModel>(response), anchorId);
        }
        if (input.scenes?.length) AnalyticsService.track('vision_created', { anchor_id: anchorId, vision_id: visionApiData<VisionReadModel>(response).id });
        return visionApiData<VisionReadModel>(response);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create Vision';
        setError(message);
        return null;
      }
    },
    [anchorId, commitMutation],
  );

  const sendChange = useCallback(async (method: 'patch' | 'put' | 'post' | 'delete', path: string, body?: object, confirms?: (value: VisionReadModel) => boolean): Promise<VisionReadModel | null> => {
    if (currentAccountId() !== accountId) return null;
    const payload = { ...body } as Record<string, unknown>;
    if (!payload.expectedUpdatedAt) delete payload.expectedUpdatedAt;
    let retained=false;
    if(accountId&&(method==='patch'||method==='put')){
      try {await retainPendingVisionWrite(accountId,anchorId,method,path,payload);retained=true;}catch{/* Online saves may still succeed when local storage is unavailable. */}
    }
    let activePayload = payload;
    try {
      let response: any;
      try {
        response = method === 'delete' ? await apiClient.delete<VisionReadModel>(path, { timeout: 15_000 }) : await apiClient[method]<VisionReadModel>(path, activePayload);
      } catch (reqErr) {
        // Older deployed Vision APIs (e.g. Railway production) reject expectedUpdatedAt with a strict validation error.
        // Strip it and retry once so note moves and scene updates succeed against older backend revisions.
        if (
          (method === 'patch' || method === 'put') &&
          activePayload &&
          typeof activePayload === 'object' &&
          'expectedUpdatedAt' in activePayload &&
          reqErr instanceof Error &&
          /expectedupdatedat/i.test(reqErr.message)
        ) {
          const { expectedUpdatedAt: _ignored, ...stripped } = activePayload as Record<string, unknown>;
          activePayload = stripped;
          response = await apiClient[method]<VisionReadModel>(path, activePayload);
        } else {
          throw reqErr;
        }
      }
      const updated=visionApiData<VisionReadModel>(response);
      if(confirms && !confirms(updated)) {
        const local=visionReadCache.get(key);
        if(local)commitMutation({...updated,boardLayout:local.boardLayout??'CLASSIC'},anchorId);
        return null;
      }
      commitMutation(updated,anchorId);
      if(accountId&&(method==='patch'||method==='put'))void clearPendingVisionWrite(accountId,anchorId,method,path,payload).catch(()=>undefined);
      return updated;
    } catch(err) {
      if(accountId&&(method==='patch'||method==='put')&&err instanceof Error&&/network|timeout|timed out|offline|connection|fetch/i.test(err.message)) {
        setIsOffline(true);
        try { if(!retained)await retainPendingVisionWrite(accountId,anchorId,method,path,activePayload); }
        catch { if(isMountedRef.current&&currentCacheKey.current===key)setError('Your change could not be saved or retained for retry. Please keep your draft and try again.');return null; }
      }
      // Validation/conflict rejections require a deliberate edit after refresh; never replay them automatically.
      else if(accountId&&(method==='patch'||method==='put')&&!confirms)void clearPendingVisionWrite(accountId,anchorId,method,path,payload).catch(()=>undefined);
      if(isMountedRef.current && currentCacheKey.current===key) setError(err instanceof Error ? err.message : 'Your change could not be saved. Try again.');
      return null;
    }
  }, [accountId,anchorId,commitMutation,key]);
  const queueChange = useCallback((label:string, forward:(before:VisionReadModel)=>Promise<VisionReadModel|null>, inverse?:(before:VisionReadModel,result:VisionReadModel)=>Promise<VisionReadModel|null>) => {
    let previous:VisionReadModel|null=null;
    visionMutationVersions.set(key,(visionMutationVersions.get(key)??0)+1);
    return enqueueVisionMutation(key,label,async()=>{
      previous=visionReadCache.get(key)??vision;
      if(!previous) return null;
      return forward(previous);
    },inverse ? async result=>previous ? inverse(previous,result) : null : undefined);
  },[key,vision]);
  const updateVision = useCallback((input: { title?: string; description?: string; boardLayout?: VisionBoardLayout; expectedUpdatedAt?: string }) =>
    queueChange(input.boardLayout ? `Layout: ${input.boardLayout.charAt(0)+input.boardLayout.slice(1).toLowerCase()}` : 'Vision saved',
      before=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}`,{...input,expectedUpdatedAt:input.expectedUpdatedAt??before.updatedAt}),
      (before,result)=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}`,{
        ...(input.title!==undefined?{title:before.title}:{}),...(input.description!==undefined?{description:before.description}:{}),
        ...(input.boardLayout!==undefined?{boardLayout:before.boardLayout??'CLASSIC'}:{}),expectedUpdatedAt:result.updatedAt })),[queueChange,sendChange]);

  const reloadAfterMutation = useCallback(async (): Promise<VisionReadModel | null> => {
    const response = await apiClient.get<VisionReadModel>(`/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`);
    const latest = visionApiData<VisionReadModel | null>(response);
    if (isMountedRef.current) commitMutation(latest, anchorId);
    return latest;
  }, [anchorId, commitMutation]);

  const addScene = useCallback(
    async (input: {
      assetId: string;
      prompt?: string;
    caption?: string | null;
      sourceType: VisionSceneSource;
      sortOrder?: number;
    }): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      return enqueueVisionMutation(key,'Image added',async()=>{
      try {
        await apiClient.post(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes`,
          input,
        );
        // Generated selection is recorded on the ceremony's Choose tap, before Seal.
        if (input.sourceType !== 'AI_GENERATED') {
          AnalyticsService.track('vision_image_selected', { vision_id: vision.id, asset_id: input.assetId, source_type: input.sourceType });
          AnalyticsService.track('vision_photo_added', { anchor_id: anchorId, vision_id: vision.id, asset_id: input.assetId, source_type: input.sourceType });
        }
        const latest = await reloadAfterMutation();
        return latest;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to add scene';
        setError(message);
        return null;
      }
      });
    },
    [key,reloadAfterMutation, vision?.id],
  );

  const reorderScenes = useCallback(
    async (sceneOrders: Array<{ id: string; sortOrder: number }>): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      return enqueueVisionMutation(key,'Moved',async()=>{
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
      });
    },
    [key,reloadAfterMutation, vision?.id],
  );

  const deleteScene = useCallback(
    async (sceneId: string): Promise<VisionReadModel | null> => {
      if (!vision?.id) return null;
      return enqueueVisionMutation(key,'Image removed',async()=>{
      try {
        await apiClient.delete(
          `/api/v2/visions/${encodeURIComponent(vision.id)}/scenes/${encodeURIComponent(sceneId)}`,
        );
        AnalyticsService.track('vision_image_removed', { vision_id: vision.id, scene_id: sceneId });
        return await reloadAfterMutation();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove scene';
        setError(message);
        return null;
      }
      });
    },
    [key,reloadAfterMutation, vision?.id],
  );

  const createNote = useCallback(async (input: { clientRequestId: string; content: { text: string }; presentation: VisionNotePresentation }): Promise<VisionReadModel | null> => {
    let failure:unknown;
    const result=await enqueueVisionMutation(key,'Note saved',async()=>{
      try {
        const response=await apiClient.post<VisionReadModel>(`/api/v2/anchors/${encodeURIComponent(anchorId)}/vision/notes`,input);
        const updated=visionApiData<VisionReadModel>(response);commitMutation(updated,anchorId);return updated;
      }catch(err){failure=err;setError(err instanceof Error?err.message:'Failed to create note');return null;}
    });
    if(failure)throw failure;
    return result;
  },[key,anchorId,commitMutation]);

  const updateNote = useCallback((noteId:string,input:{content?:{text:string};presentation?:VisionNotePresentation;layoutPositions?:VisionNoteLayoutPositions})=>{
    const sanitizedInput = input.presentation
      ? { ...input, presentation: clampVisionNotePresentationForAspect(input.presentation, 1) }
      : input;
    return queueChange(input.content?'Note saved':'Note moved',before=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}/notes/${encodeURIComponent(noteId)}`,
      {...sanitizedInput,expectedUpdatedAt:before.notes?.find(n=>n.id===noteId)?.updatedAt}),
      (before,result)=>{
        const old=before.notes?.find(n=>n.id===noteId), saved=result.notes?.find(n=>n.id===noteId);
        if(!old||!saved) return Promise.resolve(null);
        const positions=input.layoutPositions ? Object.fromEntries(Object.keys(input.layoutPositions).map(layout=>[layout,old.layoutPositions?.[layout as 'EDITORIAL'|'SCRAPBOOK']??null])) : undefined;
        return sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}/notes/${encodeURIComponent(noteId)}`,{
          ...(input.content?{content:old.content}:{}),...(input.presentation?{presentation:old.presentation}:{}),...(positions?{layoutPositions:positions}:{}),expectedUpdatedAt:saved.updatedAt});
      });
  },[queueChange,sendChange]);
  const mutateNoteState = useCallback((noteId:string,restore:boolean)=>queueChange(restore?'Note restored':'Note deleted',
    before=>sendChange(restore?'post':'delete',`/api/v2/visions/${encodeURIComponent(before.id)}/notes/${encodeURIComponent(noteId)}${restore?'/restore':''}`),
    (_before,result)=>sendChange(restore?'delete':'post',`/api/v2/visions/${encodeURIComponent(result.id)}/notes/${encodeURIComponent(noteId)}${restore?'':'/restore'}`)),[queueChange,sendChange]);
  const deleteNote = useCallback((id:string)=>mutateNoteState(id,false),[mutateNoteState]);
  const restoreNote = useCallback((id:string)=>mutateNoteState(id,true),[mutateNoteState]);
  const updateSceneCaption = useCallback((sceneId:string,caption:string|null)=>queueChange('Caption saved',
    before=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}/scenes/${encodeURIComponent(sceneId)}`,{caption:caption?.trim()||null,expectedUpdatedAt:before.scenes.find(s=>s.id===sceneId)?.updatedAt}),
    (before,result)=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}/scenes/${encodeURIComponent(sceneId)}`,{caption:before.scenes.find(s=>s.id===sceneId)?.caption??null,expectedUpdatedAt:result.scenes.find(s=>s.id===sceneId)?.updatedAt})),[queueChange,sendChange]);
  const replaceScene = useCallback((sceneId:string,replacement:{assetId:string;sourceType:VisionSceneSource;prompt?:string|null;caption?:string|null})=>queueChange('Photo replaced',
    before=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}/scenes/${encodeURIComponent(sceneId)}`,{replacement,expectedUpdatedAt:before.scenes.find(s=>s.id===sceneId)?.updatedAt}),
    (before,result)=>{
      const old=before.scenes.find(scene=>scene.id===sceneId);
      if(!old?.assetId)return Promise.resolve(null);
      return sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}/scenes/${encodeURIComponent(sceneId)}`,{replacement:{assetId:old.assetId,sourceType:old.sourceType,prompt:old.prompt,caption:old.caption??null},expectedUpdatedAt:result.scenes.find(s=>s.id===sceneId)?.updatedAt});
    }),[queueChange,sendChange]);
  const syncScenePresentation = useCallback((sceneId:string,patch:{slotIndex?:number|null;focal?:{x:number;y:number}|null})=>queueChange('Reposition saved',
    // Focal saves use the original scene-patch contract. Older deployed Vision APIs accept `focal`
    // but strictly reject the newer expectedUpdatedAt field, which made crop saves roll back.
    before=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}/scenes/${encodeURIComponent(sceneId)}`,{
      ...patch,...(patch.focal===undefined?{expectedUpdatedAt:before.scenes.find(s=>s.id===sceneId)?.updatedAt}:{})}),
    (before,result)=>{
      const old=before.scenes.find(s=>s.id===sceneId);
      return sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}/scenes/${encodeURIComponent(sceneId)}`,{
        ...(patch.slotIndex!==undefined?{slotIndex:old?.slotIndex??null}:{}),...(patch.focal!==undefined?{focal:old?.focal??null}:{}),
        ...(patch.focal===undefined?{expectedUpdatedAt:result.scenes.find(s=>s.id===sceneId)?.updatedAt}:{})});
    }),[queueChange,sendChange]);
  const setBoardLayout = useCallback((boardLayout:VisionBoardLayout,expectedUpdatedAt?:string)=>queueChange(
    `Layout: ${boardLayout.charAt(0)+boardLayout.slice(1).toLowerCase()}`,
    async before=>{
      const local={...before,boardLayout};
      commitMutation(local,anchorId);
      if(accountId) {
        try { await retainPendingVisionWrite(accountId,anchorId,'patch',`/api/v2/visions/${encodeURIComponent(before.id)}`,{
          boardLayout,expectedUpdatedAt:expectedUpdatedAt??before.updatedAt,
        }); }
        catch { commitMutation(before,anchorId); return null; }
        pendingLayoutRef.current=true;
      }
      const saved=await sendChange('patch',`/api/v2/visions/${encodeURIComponent(before.id)}`,{
        boardLayout,expectedUpdatedAt:expectedUpdatedAt??before.updatedAt,
      },value=>value.boardLayout===boardLayout);
      if(saved) {
        pendingLayoutRef.current=false;
        if(retryTimerRef.current)clearTimeout(retryTimerRef.current);
        retryTimerRef.current=null;
      } else if(accountId)schedulePendingRetry();
      return saved ?? (visionReadCache.get(key) ?? local);
    },
    (before,result)=>sendChange('patch',`/api/v2/visions/${encodeURIComponent(result.id)}`,{
      boardLayout:before.boardLayout??'CLASSIC',expectedUpdatedAt:result.updatedAt,
    },value=>value.boardLayout===(before.boardLayout??'CLASSIC')),
  ),[accountId,anchorId,commitMutation,key,queueChange,schedulePendingRetry,sendChange]);
  const updateSceneSlots = useCallback((slots:Array<{sceneId:string;slotIndex:number}>)=>queueChange('Moved',
    before=>sendChange('put',`/api/v2/visions/${encodeURIComponent(before.id)}/scenes/slots`,{slots,expectedUpdatedAt:before.updatedAt}),
    (before,result)=>sendChange('put',`/api/v2/visions/${encodeURIComponent(result.id)}/scenes/slots`,{
      slots:resolveSlotMap(before.scenes.filter(s=>!s.isArchived).map(s=>s.id),Object.fromEntries(before.scenes.filter(s=>s.slotIndex!=null).map(s=>[s.id,s.slotIndex!]))).flatMap((sceneId,slotIndex)=>sceneId?[{sceneId,slotIndex}]:[]),expectedUpdatedAt:result.updatedAt})),[queueChange,sendChange]);

  const archiveVision = useCallback(async (): Promise<boolean> => {
    if (!vision?.id) return false;
    try {
      await apiClient.delete(`/api/v2/visions/${encodeURIComponent(vision.id)}`);
      if (anchorId) {
        setVisionRead(key, null);
        persistVisionRead(anchorId, accountId, null);
      }
      if (isMountedRef.current && currentCacheKey.current === key) {
        setVision(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [anchorId, key, vision?.id]);

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
    mutationFeedback,
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
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    updateSceneCaption,
    replaceScene,
    syncScenePresentation,
    setBoardLayout,
    updateSceneSlots,
    uploadAsset,
  };
}
