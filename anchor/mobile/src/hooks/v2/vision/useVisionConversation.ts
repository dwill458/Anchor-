import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { apiClient, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { useAuthStore } from '@/stores/authStore';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
import type { VisionConversationSession, VisionReferenceAttachment, VisionReferenceInput } from '@/types/visionConversation';
import { visionApiData } from './visionApi';

interface ConversationDraft {
  id: string;
  description: string;
  draftPrompt: string;
  references: VisionReferenceAttachment[];
  updatedAt: number;
  pending?: { fingerprint: string; key: string };
  pendingSeal?: { selectedCandidateId: string; viewedRoundId?: string | null };
}
type DraftChange = Partial<Pick<ConversationDraft, 'description' | 'draftPrompt' | 'references'>>;
export const conversationAttachments = (refs: VisionConversationSession['references']): VisionReferenceAttachment[] => refs.map(ref => ({
  id: ref.assetId, assetId: ref.assetId, uri: ref.imageUrl ?? '', mimeType: 'image/jpeg', role: ref.role, ...(ref.label ? { label: ref.label } : {}),
}));

/** Owner-bound durable drafts; typing updates refs, never the generation hook's React state. */
export function useVisionConversation(anchorId: string) {
  const owner = useAuthStore(state => state.user?.id ?? null);
  const [session, setSession] = useState<VisionConversationSession | null>(null);
  const sessionRef = useRef<VisionConversationSession | null>(null);
  const hydration = useRef<Promise<void> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useRef<ConversationDraft | null>(null);
  const scope = useRef<string | null>(null);
  const epoch = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localWrites = useRef(Promise.resolve());
  const remoteWrites = useRef(Promise.resolve());
  const dirty = useRef(false);
  const creating = useRef<Promise<VisionConversationSession> | null>(null);
  const base = `/api/v2/anchors/${encodeURIComponent(anchorId)}/vision/creation-sessions`;
  const key = owner ? `vision-conversation.${encodeURIComponent(owner)}.${encodeURIComponent(anchorId)}` : null;
  const visibleDraft = useMemo(() => ({ get current() { return scope.current === key ? draft.current : null; } }), [key]);
  const config = useCallback((): AccountBoundRequestConfig => ({ anchorAuthGuard: () => Boolean(owner && useAuthStore.getState().user?.id === owner) }), [owner]);
  const isCurrent = useCallback(() => Boolean(owner && useAuthStore.getState().user?.id === owner), [owner]);

  const saveLocal = useCallback(async () => {
    if (!key || scope.current !== key || !draft.current) return;
    const serialized = JSON.stringify(draft.current);
    const write = localWrites.current.catch(() => undefined).then(() => writeSecureValue(key, serialized));
    localWrites.current = write;
    await write;
  }, [key]);

  const refresh = useCallback(async () => {
    if (!owner) return null;
    const requestEpoch = epoch.current;
    const receipt = scope.current === key ? draft.current?.pendingSeal : null;
    if (receipt && draft.current) {
      try { await apiClient.patch(`${base}/${encodeURIComponent(draft.current.id)}`, { ...receipt, status: 'SEALED' }, config()); }
      catch (cause) {
        // The board save was already confirmed; an expired session must not repeat that save.
        if (!(cause && typeof cause === 'object' && 'status' in cause && cause.status === 404)) throw cause;
      }
      if (requestEpoch !== epoch.current || !isCurrent()) return null;
      draft.current = null; dirty.current = false; sessionRef.current = null; setSession(null);
      await writeSecureValue(key!, 'null'); setError(null);
      return null;
    }
    const response = await apiClient.get<VisionConversationSession | null>(base, config());
    const next = visionApiData<VisionConversationSession | null>(response);
    if (requestEpoch !== epoch.current || useAuthStore.getState().user?.id !== owner) return null;
    sessionRef.current = next; setSession(next);
    setError(null);
    return next;
  }, [base, owner, config, key, isCurrent]);

  const flushDraft = useCallback(async () => {
    const snapshot = scope.current === key ? draft.current : null;
    await saveLocal();
    if (!snapshot || snapshot.pendingSeal || !session || snapshot.id !== session.id || !dirty.current) return;
    // All uploads are sequential and completed before IDs are synchronized to the server.
    const references: VisionReferenceInput[] = snapshot.references.filter(ref => ref.assetId).map(ref => ({ assetId: ref.assetId!, role: ref.role, ...(ref.label ? { label: ref.label } : {}) }));
    const input = { description: snapshot.description, draftPrompt: snapshot.draftPrompt, ...(references.length === snapshot.references.length ? { references } : {}) };
    const savedRevision = snapshot.updatedAt;
    const write = remoteWrites.current.catch(() => undefined).then(async () => {
      await apiClient.patch(`${base}/${encodeURIComponent(snapshot.id)}`, input, config());
      if (draft.current?.id === snapshot.id && draft.current.updatedAt === savedRevision) dirty.current = false;
    });
    remoteWrites.current = write;
    await write;
  }, [saveLocal, session?.id, base, config, key]);

  const saveDraft = useCallback((change: DraftChange) => {
    if (!owner || scope.current !== key) return;
    draft.current = { id: draft.current?.id ?? Crypto.randomUUID(), description: '', draftPrompt: '', references: [], ...draft.current, ...change, updatedAt: Date.now() };
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushDraft().catch(() => { if (isCurrent()) setError('Your draft is saved on this device. Reconnect to sync it.'); }); }, 400);
  }, [owner, flushDraft, key, isCurrent]);

  useEffect(() => {
    const requestEpoch = ++epoch.current;
    scope.current = key; draft.current = null; creating.current = null; dirty.current = false; sessionRef.current = null; setSession(null); setLoaded(false);
    if (!owner || !key) { setLoaded(true); return; }
    hydration.current = (async () => {
      let local: ConversationDraft | null = null;
      try {
        const stored = await readSecureValue(key);
        if (stored) {
          const parsed = JSON.parse(stored) as ConversationDraft;
          if (typeof parsed.id === 'string' && typeof parsed.description === 'string' && Array.isArray(parsed.references) && parsed.updatedAt > Date.now() - 30 * 86400000) local = parsed;
        }
      } catch { /* A lost local draft never invalidates server-owned history. */ }
      if (requestEpoch !== epoch.current || !isCurrent()) return;
      draft.current = local;
      let remote: VisionConversationSession | null = null;
      try { remote = await refresh(); } catch { if (requestEpoch === epoch.current) setError('Reconnect to restore your saved scene.'); }
      if (requestEpoch !== epoch.current || useAuthStore.getState().user?.id !== owner) return;
      if (local?.pendingSeal) {
        if (draft.current?.pendingSeal) { sessionRef.current = null; setSession(null); setLoaded(true); return; }
        local = null;
      }
      if (remote) {
        const refreshed = conversationAttachments(remote.references);
        draft.current = local && local.id === remote.id ? { ...local, references: local.references.map(ref => ({ ...ref, uri: refreshed.find(item => item.assetId === ref.assetId)?.uri || ref.uri })) }
          : { id: remote.id, description: remote.description, draftPrompt: remote.draftPrompt, references: refreshed, updatedAt: Date.now() };
      } else draft.current = local;
      dirty.current = Boolean(local);
      setLoaded(true);
    })();
    return () => { epoch.current += 1; if (timer.current) clearTimeout(timer.current); void saveLocal().catch(() => undefined); };
  }, [anchorId, owner, key, refresh, saveLocal]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') void flushDraft().catch(() => undefined);
      else void refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [flushDraft, refresh]);

  const ensureSession = useCallback(async (description: string) => {
    await hydration.current;
    if (draft.current?.pendingSeal) throw new Error('Your image is already on the board. Reconnect to finish saving this session.');
    if (sessionRef.current) return sessionRef.current;
    if (creating.current) return creating.current;
    if (!owner) throw new Error('Sign in to save your scene.');
    if (!draft.current) saveDraft({ description });
    const id = draft.current!.id;
    const requestEpoch = epoch.current;
    creating.current = (async () => {
      await saveLocal();
      const response = await apiClient.post<VisionConversationSession>(base, { id, description }, config());
      const next = visionApiData<VisionConversationSession>(response);
      if (requestEpoch !== epoch.current || useAuthStore.getState().user?.id !== owner) throw new Error('Account changed. Reopen your scene.');
      sessionRef.current = next; setSession(next); setError(null);
      return next;
    })().finally(() => { creating.current = null; });
    return creating.current;
  }, [session, owner, saveDraft, saveLocal, base, config]);

  const prepareRequest = useCallback(async (fingerprint: string) => {
    if (!isCurrent() || scope.current !== key) throw new Error('Account changed. Reopen your scene.');
    if (!draft.current) throw new Error('Save your scene before generating.');
    if (draft.current.pending?.fingerprint !== fingerprint) draft.current = { ...draft.current, pending: { fingerprint, key: `vision-scene-${Crypto.randomUUID()}` } };
    await saveLocal();
    return draft.current!.pending!.key;
  }, [saveLocal, isCurrent, key]);
  const acceptedRequest = useCallback(async () => {
    if (!isCurrent() || scope.current !== key) return;
    if (draft.current) { draft.current = { ...draft.current, pending: undefined }; await saveLocal(); }
    await refresh();
  }, [saveLocal, refresh, isCurrent, key]);
  const update = useCallback(async (input: { selectedCandidateId?: string | null; viewedRoundId?: string | null; status?: 'ABANDONED' | 'SEALED' }) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    if (input.status === 'SEALED' && input.selectedCandidateId && draft.current && scope.current === key) {
      draft.current = { ...draft.current, pendingSeal: { selectedCandidateId: input.selectedCandidateId, viewedRoundId: input.viewedRoundId } };
      await saveLocal();
    }
    const requestEpoch = epoch.current;
    const write = remoteWrites.current.catch(() => undefined).then(async () => {
      const response = await apiClient.patch<VisionConversationSession>(`${base}/${encodeURIComponent(currentSession.id)}`, input, config());
      if (requestEpoch !== epoch.current || !isCurrent()) return;
      if (input.status) {
        draft.current = null; dirty.current = false; sessionRef.current = null; setSession(null); await writeSecureValue(key!, 'null');
      } else { const next = visionApiData<VisionConversationSession>(response); sessionRef.current = next; setSession(next); }
    });
    remoteWrites.current = write;
    await write;
  }, [session, base, config, key, isCurrent, saveLocal]);

  const startDifferent = useCallback(async () => {
    await hydration.current;
    await update({ status: 'ABANDONED' });
    if (!isCurrent() || scope.current !== key) return;
    draft.current = { id: Crypto.randomUUID(), description: '', draftPrompt: '', references: [], updatedAt: Date.now() };
    dirty.current = false;
    await saveLocal();
  }, [update, saveLocal, isCurrent, key]);

  return { owner, session: scope.current === key ? session : null, loaded: scope.current === key && loaded, error: scope.current === key ? error : null, draft: visibleDraft, refresh, saveDraft, flushDraft, ensureSession, prepareRequest, acceptedRequest, update, startDifferent, requestConfig: config, isCurrent };
}
