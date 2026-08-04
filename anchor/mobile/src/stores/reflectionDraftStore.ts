import { create } from 'zustand';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import { CHART_REFLECTION_DRAFTS_KEY_PREFIX } from '@/types/chart';
import type {
  ReflectionMood,
  ReflectionPromptType,
  ReflectionSource,
  ReflectionStructuredContent,
} from '@/types/chart';

export type ReflectionDraft = {
  draftKey: string;
  accountId: string;
  source: ReflectionSource;
  promptType: ReflectionPromptType;
  promptVersion: number;
  practiceSessionId?: string;
  anchorId?: string;
  courseId?: string;
  waypointId?: string;
  body?: string;
  structuredContent?: ReflectionStructuredContent;
  moodBefore?: ReflectionMood;
  moodAfter?: ReflectionMood;
  updatedAt: string;
  saveState: 'draft' | 'queued' | 'failed';
  retryCount: number;
  /** Kept only in encrypted storage so an explicit offline save is replay-safe. */
  idempotencyKey: string;
  tombstoned?: boolean;
};

type PersistedDrafts = { schemaVersion: 1; accountId: string; drafts: ReflectionDraft[]; handledOfferKeys?: string[] };

type ReflectionDraftState = {
  accountId: string | null;
  hydrated: boolean;
  drafts: Record<string, ReflectionDraft>;
  handledOfferKeys: string[];
  bindAccount: (accountId: string | null) => Promise<void>;
  /**
   * Ordinary content autosave. Merges over the stored record and never changes
   * queue state, retry accounting, or the replay key — those belong to the
   * explicit transitions below.
   */
  upsert: (draft: ReflectionDraft) => Promise<void>;
  remove: (draftKey: string) => Promise<void>;
  /**
   * The one atomic transition into the send queue. Pass the composer's draft so
   * the newest content and the queued state are written together; an already
   * stored replay key is always retained.
   */
  markQueued: (draftKey: string, draft?: ReflectionDraft) => Promise<void>;
  markFailed: (draftKey: string) => Promise<void>;
  scheduleRetry: (draftKey: string) => Promise<void>;
  tombstoneByIdempotencyKey: (idempotencyKey: string) => Promise<void>;
  markOfferHandled: (offerKey: string) => Promise<void>;
  clearAccount: (accountId?: string | null) => Promise<void>;
};

export const reflectionDraftStorageKey = (accountId: string): string =>
  `${CHART_REFLECTION_DRAFTS_KEY_PREFIX}${accountId}`;

function toRecord(drafts: ReflectionDraft[]): Record<string, ReflectionDraft> {
  return Object.fromEntries(drafts.map((draft) => [draft.draftKey, draft]));
}

function normalize(value: unknown, accountId: string): ReflectionDraft[] {
  if (!value || typeof value !== 'object') return [];
  const parsed = value as Partial<PersistedDrafts>;
  if (parsed.schemaVersion !== 1 || parsed.accountId !== accountId || !Array.isArray(parsed.drafts)) return [];
  return parsed.drafts.filter((draft): draft is ReflectionDraft =>
    Boolean(draft && typeof draft.draftKey === 'string' && draft.accountId === accountId && typeof draft.idempotencyKey === 'string'),
  );
}

async function persist(accountId: string, drafts: Record<string, ReflectionDraft>, handledOfferKeys: string[] = []): Promise<void> {
  const value: PersistedDrafts = { schemaVersion: 1, accountId, drafts: Object.values(drafts), handledOfferKeys };
  await encryptedPersistStorage.setItem(reflectionDraftStorageKey(accountId), JSON.stringify(value));
}

/**
 * A content write carries the person's current writing; it must not carry queue
 * state. Merging keeps `saveState`, `retryCount`, and `idempotencyKey` from the
 * stored record so a rerender cannot silently downgrade a durable `queued`
 * reflection back to `draft` or mint a second replay key for it.
 */
function mergeContent(existing: ReflectionDraft, incoming: ReflectionDraft): ReflectionDraft {
  return {
    ...incoming,
    saveState: existing.saveState,
    retryCount: existing.retryCount,
    idempotencyKey: existing.idempotencyKey,
    ...(existing.tombstoned ? { tombstoned: true } : {}),
  };
}

type DraftSet = (partial: Partial<ReflectionDraftState>) => void;
type DraftGet = () => ReflectionDraftState;

/** Unconditional record write. Only the explicit transitions above use it. */
async function writeDraft(set: DraftSet, get: DraftGet, draft: ReflectionDraft): Promise<void> {
  const drafts = { ...get().drafts, [draft.draftKey]: draft };
  set({ drafts });
  await persist(draft.accountId, drafts, get().handledOfferKeys);
}

export const useReflectionDraftStore = create<ReflectionDraftState>((set, get) => ({
  accountId: null,
  hydrated: false,
  drafts: {},
  handledOfferKeys: [],

  bindAccount: async (accountId) => {
    if (!accountId) {
      set({ accountId: null, hydrated: false, drafts: {}, handledOfferKeys: [] });
      return;
    }
    // Re-binding the account already loaded would drop hydrated drafts on the
    // floor and re-read encrypted storage for nothing.
    if (get().accountId === accountId && get().hydrated) return;
    // Clear synchronously before awaiting I/O so another account never sees a prior draft.
    set({ accountId, hydrated: false, drafts: {}, handledOfferKeys: [] });
    try {
      const raw = await encryptedPersistStorage.getItem(reflectionDraftStorageKey(accountId));
      if (get().accountId !== accountId) return;
      const parsed = raw ? JSON.parse(raw) as PersistedDrafts : null;
      // A draft written while this read was in flight is newer than what storage
      // returned, so hydration merges under it rather than replacing it.
      set({ drafts: { ...toRecord(normalize(parsed, accountId)), ...get().drafts }, handledOfferKeys: Array.isArray(parsed?.handledOfferKeys) ? parsed!.handledOfferKeys.filter((key): key is string => typeof key === 'string') : [], hydrated: true });
    } catch {
      if (get().accountId === accountId) set({ hydrated: true });
    }
  },

  upsert: async (draft) => {
    if (get().accountId !== draft.accountId || draft.tombstoned) return;
    const existing = get().drafts[draft.draftKey];
    if (existing?.tombstoned) return;
    await writeDraft(set, get, existing ? mergeContent(existing, draft) : draft);
  },

  remove: async (draftKey) => {
    const accountId = get().accountId;
    if (!accountId) return;
    const { [draftKey]: _removed, ...drafts } = get().drafts;
    set({ drafts });
    await persist(accountId, drafts, get().handledOfferKeys);
  },

  markQueued: async (draftKey, draft) => {
    const accountId = get().accountId;
    if (!accountId) return;
    const existing = get().drafts[draftKey];
    if (existing?.tombstoned) return;
    const base = existing ? (draft ? mergeContent(existing, draft) : existing) : draft;
    if (!base || base.accountId !== accountId) return;
    await writeDraft(set, get, {
      ...base,
      draftKey,
      saveState: 'queued',
      // An explicit Save is a fresh send request, so the retry budget resets;
      // the replay key never does, or the server would see a second create.
      retryCount: 0,
      idempotencyKey: existing?.idempotencyKey ?? base.idempotencyKey,
      updatedAt: new Date().toISOString(),
    });
  },

  markFailed: async (draftKey) => {
    const draft = get().drafts[draftKey];
    if (!draft) return;
    await writeDraft(set, get, {
      ...draft,
      saveState: 'failed',
      retryCount: Math.min(draft.retryCount + 1, 3),
      updatedAt: new Date().toISOString(),
    });
  },

  scheduleRetry: async (draftKey) => {
    const draft = get().drafts[draftKey];
    if (!draft) return;
    const retryCount = Math.min(draft.retryCount + 1, 3);
    await writeDraft(set, get, {
      ...draft,
      saveState: retryCount >= 3 ? 'failed' : 'queued',
      retryCount,
      updatedAt: new Date().toISOString(),
    });
  },

  tombstoneByIdempotencyKey: async (idempotencyKey) => {
    const accountId = get().accountId;
    if (!accountId) return;
    const drafts = Object.fromEntries(
      Object.entries(get().drafts).filter(([, draft]) => draft.idempotencyKey !== idempotencyKey),
    );
    set({ drafts });
    await persist(accountId, drafts, get().handledOfferKeys);
  },

  markOfferHandled: async (offerKey) => {
    const accountId = get().accountId;
    if (!accountId || get().handledOfferKeys.includes(offerKey)) return;
    const handledOfferKeys = [...get().handledOfferKeys, offerKey].slice(-100);
    set({ handledOfferKeys });
    await persist(accountId, get().drafts, handledOfferKeys);
  },

  clearAccount: async (accountId) => {
    const active = get().accountId;
    if (active && (!accountId || active === accountId)) set({ accountId: null, hydrated: false, drafts: {}, handledOfferKeys: [] });
    if (accountId) await encryptedPersistStorage.removeItem(reflectionDraftStorageKey(accountId));
  },
}));

export async function purgeReflectionDraftsForAccount(accountId: string): Promise<void> {
  await encryptedPersistStorage.removeItem(reflectionDraftStorageKey(accountId));
}
