import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectCategoryFromText } from '@/utils/categoryDetection';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { describeTrueSigil, type SigilFormation } from '@/utils/sigil/traditional-generator';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { CATEGORY_TO_TIER, type AIStyle, type AnchorCategory } from '@/types';
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

/** What one press of Generate (or Try again) asks the server for. */
export type GenerationPlan = {
  /** Identifies this request; a response for any other request is ignored. */
  requestId: string;
  /** How many interpretations are still needed: 2 for a fresh pair, 1 to finish a partial one. */
  missing: number;
  /** 1 for the first pair of this expression, higher when the user asks for a new pair. */
  attempt: number;
};

/** The two-candidate contract. */
export const CANDIDATE_COUNT = 2;

export const GENERATION_ERRORS = {
  failed: 'Your structure is safe. We could not finish this expression. Try again.',
  partial: 'One interpretation is ready. The second did not finish. Try again for the second.',
  interrupted: 'Your structure is safe. Development was interrupted. Try again to continue.',
  offline: 'You look to be offline. Your structure is safe. Try again when you are connected.',
  limit: 'You have developed as many expressions as allowed for today. Your structure is safe here.',
  kept: 'We could not develop a new pair. Your previous two are still here.',
} as const;

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
  /**
   * The production style the user chose from the expression library. `expression` is the
   * local treatment that previews it on the structure; this is what generation is asked for.
   * Absent when the original structure is kept.
   */
  styleChoice?: AIStyle;
  /**
   * Finished interpretations. The canonical SVG remains the source of truth. May hold one while
   * the second is being retried — a finished interpretation is never thrown away.
   */
  generatedCandidates: GeneratedAnchorCandidate[];
  /** -1 until the user chooses; the choice is theirs, never a default. */
  selectedCandidateIndex: number;
  generationState: GenerationState;
  generationError?: string;
  /** The request currently allowed to write results (see `GenerationPlan`). */
  generationRequestId?: string;
  /** How many times a fresh pair has been asked for this expression (0 = first pair). */
  generationRound?: number;
  /**
   * The finished pair set aside while a fresh one is being made ("Try again" on the choice).
   * If the new pair cannot be made, these come back; nothing finished is ever lost.
   */
  previousCandidates?: GeneratedAnchorCandidate[];
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
  selectedCandidateIndex: -1,
  generationState: 'idle',
  generationRound: 0,
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
  selectedCandidateIndex: -1,
  generationState: 'idle',
  generationError: undefined,
  generationRequestId: undefined,
  generationRound: 0,
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
  /**
   * Choose a style from the expression library (null keeps the original structure). The
   * structure previews it through its local treatment `expression`.
   */
  selectStyle: (styleChoice: AIStyle | null, expression: AnchorExpression) => void;
  /**
   * Start (or continue) generation. From Expression or Choose it asks for a fresh pair; from a
   * failed or partial Generation it asks only for what is missing. Null when not allowed.
   */
  beginGeneration: () => GenerationPlan | null;
  /** Adds finished interpretations from `requestId`; two of them open the choice. */
  completeGeneration: (requestId: string, candidates: GeneratedAnchorCandidate[], metadata?: Record<string, unknown>) => void;
  failGeneration: (requestId: string, message?: string) => void;
  /** Leave a failed fresh development and choose from the pair set aside for it. */
  returnToPrevious: () => void;
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

/** A fresh pair could not be made: the pair the user already had comes back, unchosen. */
const restorePrevious = (draft: CreationDraft, message: string) => update(draft, {
  generatedCandidates: draft.previousCandidates ?? [],
  previousCandidates: undefined,
  selectedCandidateIndex: -1,
  enhancedImageUrl: undefined,
  generationState: 'complete',
  generationError: message,
  currentStep: draft.currentStep === 'generating' ? 'choose' : draft.currentStep,
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

      selectExpression: (expression) => {
        const draft = get().draft;
        if (!draft) return;
        get().selectStyle(expression === 'original' ? null : draft.styleChoice ?? null, expression);
      },

      selectStyle: (styleChoice, expression) => set((state) => {
        const draft = state.draft;
        if (!draft || draft.anchorPersisted || draft.saveState === 'saving') return state;
        const nextStyle = expression === 'original' ? undefined : styleChoice ?? undefined;
        if (draft.expression === expression && draft.styleChoice === nextStyle) return state;
        return update(draft, {
          expression,
          styleChoice: nextStyle,
          // A new expression invalidates previously rendered candidates; backing out of the
          // choice screen without changing expression leaves them intact for comparison.
          generatedCandidates: [],
          selectedCandidateIndex: -1,
          enhancedImageUrl: undefined,
          generationState: 'idle',
          generationError: undefined,
          generationRequestId: undefined,
          generationRound: 0,
          previousCandidates: undefined,
          saveState: draft.saveState === 'error' ? 'draft' : draft.saveState,
          saveFailure: undefined,
        });
      }),

      beginGeneration: () => {
        const draft = get().draft;
        if (!draft || (draft.currentStep !== 'expression' && draft.currentStep !== 'generating' && draft.currentStep !== 'choose')) return null;
        if (draft.expression === 'original' || draft.saveState === 'saving') return null;
        // Still developing from before the user stepped back: return to it rather than starting
        // (and paying for) a second request.
        if (draft.generationState === 'generating') {
          if (draft.currentStep !== 'generating') set(update(draft, { currentStep: 'generating' }));
          return null;
        }
        const existing = (draft.generatedCandidates ?? []).filter((candidate) => candidate.imageUrl);
        // Continuing a failed or partial development keeps every finished interpretation and
        // asks only for the rest. Coming from Expression with a full pair already made (the
        // user backed out to compare) shows that pair again rather than spending a new one.
        // Only "Try again" on the choice itself asks for a fresh pair.
        const fresh = draft.currentStep === 'choose';
        if (!fresh && existing.length >= CANDIDATE_COUNT) {
          set(update(draft, { currentStep: 'choose', generationState: 'complete', generationError: undefined }));
          return null;
        }
        const kept = fresh ? [] : existing.slice(0, CANDIDATE_COUNT);
        const round = (draft.generationRound ?? 0) + (fresh ? 1 : 0);
        const requestId = makeId('generation');
        set(update(draft, {
          currentStep: 'generating',
          generationState: 'generating',
          generationError: undefined,
          generationRequestId: requestId,
          generationRound: round,
          previousCandidates: fresh ? existing.slice(0, CANDIDATE_COUNT) : draft.previousCandidates,
          generatedCandidates: kept,
          selectedCandidateIndex: -1,
          enhancedImageUrl: undefined,
        }));
        return { requestId, missing: CANDIDATE_COUNT - kept.length, attempt: round + 1 };
      },

      completeGeneration: (requestId, generatedCandidates, enhancementMetadata) => set((state) => {
        const draft = state.draft;
        // The request may finish after the user stepped back to Expression; its result is kept
        // (it is theirs, and it was paid for) and shown when they return to it.
        if (!draft || draft.generationRequestId !== requestId || draft.generationState !== 'generating') return state;
        const watching = draft.currentStep === 'generating';
        const merged: GeneratedAnchorCandidate[] = [];
        for (const candidate of [...(draft.generatedCandidates ?? []), ...(generatedCandidates ?? [])]) {
          if (!candidate?.imageUrl || merged.some((kept) => kept.imageUrl === candidate.imageUrl)) continue;
          merged.push(candidate);
        }
        const candidates = merged.slice(0, CANDIDATE_COUNT);
        if (candidates.length === 0 && draft.previousCandidates?.length === CANDIDATE_COUNT) {
          return restorePrevious(draft, GENERATION_ERRORS.kept);
        }
        if (candidates.length < CANDIDATE_COUNT) {
          return update(draft, {
            generatedCandidates: candidates,
            generationState: 'error',
            generationError: candidates.length ? GENERATION_ERRORS.partial : GENERATION_ERRORS.failed,
            enhancementMetadata: enhancementMetadata ?? draft.enhancementMetadata,
          });
        }
        return update(draft, {
          generatedCandidates: candidates,
          previousCandidates: undefined,
          selectedCandidateIndex: -1,
          enhancedImageUrl: undefined,
          generationState: 'complete',
          generationError: undefined,
          enhancementMetadata: enhancementMetadata ?? draft.enhancementMetadata,
          currentStep: watching ? 'choose' : draft.currentStep,
        });
      }),

      failGeneration: (requestId, message) => set((state) => {
        const draft = state.draft;
        if (!draft || draft.generationRequestId !== requestId || draft.generationState !== 'generating') return state;
        const kept = draft.generatedCandidates ?? [];
        if (!kept.length && draft.previousCandidates?.length === CANDIDATE_COUNT) return restorePrevious(draft, GENERATION_ERRORS.kept);
        const generic = !message || message === GENERATION_ERRORS.failed;
        return update(draft, {
          generationState: 'error',
          generationError: kept.length && generic ? GENERATION_ERRORS.partial : message ?? GENERATION_ERRORS.failed,
        });
      }),

      returnToPrevious: () => set((state) => {
        const draft = state.draft;
        if (!draft || draft.generationState === 'generating' || draft.previousCandidates?.length !== CANDIDATE_COUNT) return state;
        return update(restorePrevious(draft, '').draft, { generationError: undefined, currentStep: 'choose' });
      }),

      selectCandidate: (index) => set((state) => {
        const draft = state.draft;
        const candidates = draft?.generatedCandidates ?? [];
        if (!draft || draft.currentStep !== 'choose' || draft.saveState === 'saving' || index < 0 || index >= candidates.length) return state;
        return update(draft, { selectedCandidateIndex: index, enhancedImageUrl: candidates[index]?.imageUrl, generationError: undefined });
      }),

      keepOriginal: () => set((state) => {
        const draft = state.draft;
        if (!draft || draft.currentStep !== 'expression' || draft.expression !== 'original') return state;
        return update(draft, { enhancedImageUrl: undefined, generatedCandidates: [], selectedCandidateIndex: -1, generationState: 'idle', styleChoice: undefined });
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
        // The final Anchor is the one the user chose; nothing is kept on their behalf.
        if (draft.currentStep === 'choose' && !(draft.selectedCandidateIndex >= 0 && draft.enhancedImageUrl)) return null;
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
  const candidates = Array.isArray(draft.generatedCandidates) ? draft.generatedCandidates.filter((candidate) => candidate?.imageUrl) : [];
  const selected = Number.isFinite(draft.selectedCandidateIndex) && draft.selectedCandidateIndex < candidates.length ? draft.selectedCandidateIndex : -1;
  let normalized: CreationDraft = {
    ...draft,
    generatedCandidates: candidates,
    selectedCandidateIndex: selected,
    enhancedImageUrl: selected >= 0 ? candidates[selected]?.imageUrl : draft.currentStep === 'choose' ? undefined : draft.enhancedImageUrl,
    generationState: draft.generationState ?? 'idle',
    generationRound: draft.generationRound ?? 0,
  };
  // A development the app died during has no response coming. Every finished interpretation
  // (and everything upstream) is kept; the user continues it with one tap.
  if (normalized.generationState === 'generating' && !candidates.length && normalized.previousCandidates?.length === CANDIDATE_COUNT) {
    normalized = {
      ...normalized,
      generatedCandidates: normalized.previousCandidates,
      previousCandidates: undefined,
      selectedCandidateIndex: -1,
      enhancedImageUrl: undefined,
      generationState: 'complete',
      generationError: GENERATION_ERRORS.kept,
      generationRequestId: undefined,
      currentStep: normalized.currentStep === 'generating' ? 'choose' : normalized.currentStep,
    };
  } else if (normalized.generationState === 'generating') {
    normalized = {
      ...normalized,
      currentStep: normalized.currentStep === 'expression' ? 'expression' : 'generating',
      generationState: 'error',
      generationError: candidates.length ? GENERATION_ERRORS.partial : GENERATION_ERRORS.interrupted,
      generationRequestId: undefined,
    };
  }
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
