import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectCategoryFromText } from '@/utils/categoryDetection';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { describeTrueSigil, type SigilFormation } from '@/utils/sigil/traditional-generator';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { CATEGORY_TO_TIER, type AnchorCategory } from '@/types';
import {
  CREATION_MAX_INTENTION_LENGTH,
  CREATION_STRUCTURE,
  type GeneratedAnchorCandidate,
  type AnchorExpression,
  type CanonicalStructure,
  type CreationStep,
} from '@/constants/v2/creation';

export type SaveState = 'draft' | 'saving' | 'saved' | 'error';
/** Why a save failed, which decides what the user is offered next. */
export type SaveFailure = 'network' | 'auth' | 'server' | 'second_anchor' | 'limit';
export type GenerationState = 'idle' | 'generating' | 'complete' | 'error';

export interface CreationDraft {
  draftId: string;
  /**
   * The idempotency key for the one server write. Stable across retries of the same
   * structure, so a retry after a lost response returns the Anchor already made instead of
   * making a second one.
   */
  clientRequestId: string;
  intention: string;
  normalizedIntention?: string;
  category?: AnchorCategory;
  distilledLetters?: string[];
  structureType?: CanonicalStructure;
  /** The generated structure. Locked from `reveal` onward: nothing after formation writes it. */
  structureSvg?: string;
  expression: AnchorExpression;
  /** The selected AI results. The canonical SVG remains the source of truth. */
  generatedCandidates: GeneratedAnchorCandidate[];
  selectedCandidateIndex: number;
  generationState: GenerationState;
  generationError?: string;
  enhancementMetadata?: Record<string, unknown>;
  /** The selected final visual, absent when the original structure is kept. */
  enhancedImageUrl?: string;
  saveState: SaveState;
  saveFailure?: SaveFailure;
  /** True once a save has been sent. After that the key can no longer safely change. */
  saveAttempted: boolean;
  anchorPersisted: boolean;
  persistedAnchorId?: string;
  currentStep: CreationStep;
  /** Set when validation rejects the intention or the structure could not be formed. */
  formationError?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'anchor-v2-creation-draft';
/** v2: the 2.0 continuous flow. Drafts from the earlier step machine are not resumable. */
const STORAGE_VERSION = 2;
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

/** The same deterministic engine UI-B first-run uses: distilled letters + category grid. */
export function formationForLetters(letters: string[], category: AnchorCategory | undefined): SigilFormation {
  return describeTrueSigil(letters, CATEGORY_TO_TIER[category ?? 'custom'], 'balanced');
}

/** The formation behind a draft, for anything that needs to draw or explain it. */
export function formationForDraft(draft: Pick<CreationDraft, 'distilledLetters' | 'category'>): SigilFormation | null {
  if (!draft.distilledLetters?.length) return null;
  return formationForLetters(draft.distilledLetters, draft.category);
}

const freshDraft = (): CreationDraft => ({
  draftId: makeId('creation'),
  clientRequestId: makeId('create-request'),
  intention: '',
  expression: 'original',
  generatedCandidates: [],
  selectedCandidateIndex: 0,
  generationState: 'idle',
  saveState: 'draft',
  saveAttempted: false,
  anchorPersisted: false,
  currentStep: 'intention',
  updatedAt: now(),
});

/**
 * Editing the intention invalidates everything formed from it. Expression is kept — it is a
 * preference about appearance, not something derived from the words.
 */
export const invalidateFromIntention = (draft: CreationDraft, intention: string): CreationDraft => ({
  ...draft,
  // Before any save was sent the key is free to change, and must: a new intention is a new
  // Anchor. After one was sent, a lost response may already have created an Anchor under the
  // old key, so the key stays and the server remains the judge.
  clientRequestId: draft.saveAttempted ? draft.clientRequestId : makeId('create-request'),
  intention,
  normalizedIntention: undefined,
  category: undefined,
  distilledLetters: undefined,
  structureType: undefined,
  structureSvg: undefined,
  generatedCandidates: [],
  selectedCandidateIndex: 0,
  generationState: 'idle',
  generationError: undefined,
  enhancementMetadata: undefined,
  enhancedImageUrl: undefined,
  saveState: 'draft',
  saveFailure: undefined,
  currentStep: 'intention',
  formationError: undefined,
  updatedAt: now(),
});

/** Steps Back returns to. Handoff is terminal and returns false. */
const BACK: Partial<Record<CreationStep, CreationStep>> = {
  distillation: 'intention',
  formation: 'intention',
  reveal: 'intention',
  expression: 'reveal',
  generating: 'expression',
  choose: 'expression',
};

type CreationStore = {
  draft: CreationDraft | null;
  start: () => void;
  discard: () => void;
  setIntention: (intention: string) => void;
  /** VALIDATING → DISTILLING. Returns false (with `formationError`) if the intention is not usable. */
  distill: () => boolean;
  /** DISTILLING → GENERATING: forms the structure from the distilled letters. */
  formAnchor: () => boolean;
  /** GENERATING → REVEALING, once the structure exists. */
  completeFormation: () => void;
  openExpression: () => void;
  /** Appearance only. Never touches the structure; refused once the Anchor is being saved. */
  selectExpression: (expression: AnchorExpression) => void;
  beginGeneration: () => boolean;
  completeGeneration: (candidates: GeneratedAnchorCandidate[], metadata?: Record<string, unknown>) => void;
  failGeneration: (message?: string) => void;
  selectCandidate: (index: number) => void;
  /** Expression → saving for original, or expression → generating for AI. */
  keepOriginal: () => void;
  /** Deterministic back. Returns false when Back should leave the flow instead. */
  goBack: () => boolean;
  /** Returns the idempotency key, or null when a save is already running or not allowed. */
  beginSave: () => string | null;
  completeSave: (anchorId: string) => void;
  failSave: (failure: SaveFailure) => void;
};

const update = (draft: CreationDraft, patch: Partial<CreationDraft>): { draft: CreationDraft } => ({
  draft: { ...draft, ...patch, updatedAt: now() },
});

export const useCreationStore = create<CreationStore>()(
  persist(
    (set, get) => ({
      draft: null,
      start: () => set({ draft: freshDraft() }),
      discard: () => set({ draft: null }),

      setIntention: (intention) => set((state) => {
        const draft = state.draft ?? freshDraft();
        if (draft.anchorPersisted || draft.saveState === 'saving') return state;
        return { draft: invalidateFromIntention(draft, intention) };
      }),

      distill: () => {
        const draft = get().draft;
        if (!draft || draft.currentStep !== 'intention') return false;
        // Same gate UI-B first-run applies before forming an Anchor.
        const validation = validateIntention(draft.intention, CREATION_MAX_INTENTION_LENGTH);
        if (!validation.isValid) {
          set(update(draft, { formationError: validation.error ?? 'Write a little more before continuing.' }));
          return false;
        }
        const result = distillIntention(draft.intention);
        if (!result.finalLetters.length) {
          set(update(draft, { formationError: 'Use a few more letters so your Anchor has something to be made from.' }));
          return false;
        }
        set(update(draft, {
          normalizedIntention: draft.intention.trim().replace(/\s+/g, ' '),
          category: detectCategoryFromText(draft.intention),
          distilledLetters: result.finalLetters,
          formationError: undefined,
          currentStep: 'distillation',
        }));
        return true;
      },

      formAnchor: () => {
        const draft = get().draft;
        if (!draft || (draft.currentStep !== 'distillation' && draft.currentStep !== 'formation')) return false;
        if (!draft.distilledLetters?.length) return false;
        try {
          const { svg } = formationForLetters(draft.distilledLetters, draft.category);
          set(update(draft, {
            structureType: CREATION_STRUCTURE,
            structureSvg: svg,
            formationError: undefined,
            currentStep: 'formation',
          }));
          return true;
        } catch {
          set(update(draft, { structureSvg: undefined, formationError: 'formation_failed', currentStep: 'formation' }));
          return false;
        }
      },

      completeFormation: () => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'formation' || !draft.structureSvg) return state;
        return update(draft, { currentStep: 'reveal' });
      }),

      openExpression: () => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'reveal') return state;
        return update(draft, { currentStep: 'expression' });
      }),

      selectExpression: (expression) => set((state) => {
        const draft = state.draft;
        if (!draft || draft.anchorPersisted || draft.saveState === 'saving' || draft.expression === expression) return state;
        if (draft.expression === expression) return state;
        return update(draft, {
          expression,
          // A new expression invalidates previously rendered candidates; backing out of the
          // choice screen without changing expression leaves them intact for comparison.
          generatedCandidates: [],
          selectedCandidateIndex: 0,
          enhancedImageUrl: undefined,
          generationState: 'idle',
          generationError: undefined,
          saveState: draft.saveState === 'error' ? 'draft' : draft.saveState,
          saveFailure: undefined,
        });
      }),

      beginGeneration: () => {
        const draft = get().draft;
        if (!draft || (draft.currentStep !== 'expression' && draft.currentStep !== 'generating' && draft.currentStep !== 'choose') || draft.expression === 'original' || draft.saveState === 'saving' || draft.generationState === 'generating') return false;
        set(update(draft, { currentStep: 'generating', generationState: 'generating', generationError: undefined }));
        return true;
      },

      completeGeneration: (generatedCandidates, enhancementMetadata) => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'generating') return state;
        const candidates = (generatedCandidates ?? []).filter((candidate) => candidate.imageUrl).slice(0, 2);
        if (candidates.length < 2) return update(draft, { generationState: 'error', generationError: 'We could not finish both interpretations. Try again.' });
        return update(draft, {
          generatedCandidates: candidates,
          selectedCandidateIndex: 0,
          enhancedImageUrl: candidates[0]?.imageUrl,
          generationState: 'complete',
          generationError: undefined,
          enhancementMetadata,
          currentStep: 'choose',
        });
      }),

      failGeneration: (message) => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'generating') return state;
        return update(draft, { currentStep: 'generating', generationState: 'error', generationError: message ?? 'Your Anchor is safe. Try generating the expression again.' });
      }),

      selectCandidate: (index) => set((state) => {
        const draft = state.draft;
        const candidates = draft?.generatedCandidates ?? [];
        if (!draft || draft.currentStep !== 'choose' || index < 0 || index >= candidates.length) return state;
        return update(draft, { selectedCandidateIndex: index, enhancedImageUrl: candidates[index]?.imageUrl });
      }),

      keepOriginal: () => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'expression' || draft.expression !== 'original') return state;
        return update(draft, { enhancedImageUrl: undefined, generatedCandidates: [], generationState: 'idle' });
      }),

      goBack: () => {
        const draft = get().draft;
        if (!draft || draft.saveState === 'saving' || draft.anchorPersisted) return draft ? draft.currentStep !== 'intention' : false;
        const target = BACK[draft.currentStep];
        if (!target) return false;
        set(update(draft, { currentStep: target, formationError: undefined }));
        return true;
      },

      beginSave: () => {
        const draft = get().draft;
        if (!draft || (draft.currentStep !== 'expression' && draft.currentStep !== 'choose') || !draft.structureSvg) return null;
        if (draft.saveState === 'saving' || draft.anchorPersisted) return null;
        set(update(draft, { saveState: 'saving', saveFailure: undefined, saveAttempted: true }));
        return draft.clientRequestId;
      },

      completeSave: (persistedAnchorId) => set((state) => {
        const draft = state.draft;
        if (!draft) return state;
        return update(draft, {
          saveState: 'saved',
          saveFailure: undefined,
          anchorPersisted: true,
          persistedAnchorId,
          currentStep: 'handoff',
        });
      }),

      failSave: (saveFailure) => set((state) => (state.draft ? update(state.draft, { saveState: 'error', saveFailure }) : state)),

    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => encryptedPersistStorage),
      partialize: (state) => ({ draft: state.draft }),
      // A draft from the earlier step machine has no path through this flow.
      migrate: () => ({ draft: null }),
      merge: (persisted, current) => ({ ...current, draft: resumableDraft((persisted as { draft?: CreationDraft | null } | undefined)?.draft ?? null) }),
    },
  ),
);

/**
 * What a draft read back from storage may resume as.
 *
 * - A draft whose Anchor was saved is finished work, never progress: resuming it would land
 *   the user in the middle of a flow for an Anchor that already exists. It is dropped.
 * - A save that was in flight when the app died has an unknown outcome. It resumes as a
 *   failed save; retrying reuses the same key, so the server either finishes it or returns
 *   the Anchor it already made.
 */
export function resumableDraft(draft: CreationDraft | null): CreationDraft | null {
  if (!draft || draft.anchorPersisted) return null;
  const normalized: CreationDraft = {
    ...draft,
    generatedCandidates: Array.isArray(draft.generatedCandidates) ? draft.generatedCandidates : [],
    selectedCandidateIndex: Number.isFinite(draft.selectedCandidateIndex) ? draft.selectedCandidateIndex : 0,
    generationState: draft.generationState ?? 'idle',
  };
  if (normalized.saveState === 'saving') return { ...normalized, saveState: 'error', saveFailure: 'network' };
  return normalized;
}

/** Resolves once the persisted draft has been read back (immediately if it already has). */
export function whenCreationHydrated(): Promise<void> {
  if (useCreationStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useCreationStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
