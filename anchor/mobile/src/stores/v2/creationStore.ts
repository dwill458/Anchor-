import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectCategoryFromText } from '@/utils/categoryDetection';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { generateTrueSigil, type SigilVariant } from '@/utils/sigil/traditional-generator';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { CATEGORY_TO_TIER, type AnchorCategory } from '@/types';
import type { AnchorExpression, CanonicalStructure, CreationStep } from '@/constants/v2/creation';

export type DrawingPoint = { x: number; y: number };
export type DrawnPath = { points: DrawingPoint[]; stroke?: string; strokeWidth?: number };
export type GenerationState = 'idle' | 'generating' | 'success' | 'retry' | 'error';
export type SaveState = 'draft' | 'saving' | 'saved' | 'error';

export interface AnchorCandidate {
  id: string;
  structureSvg: string;
  expression: AnchorExpression;
  /** A future generation provider may add its rendered asset here without changing formation truth. */
  imageUrl?: string;
}

export interface CreationDraft {
  draftId: string;
  clientRequestId: string;
  intention: string;
  normalizedIntention?: string;
  category?: AnchorCategory;
  distilledLetters?: string[];
  structureType?: CanonicalStructure;
  structureSvg?: string;
  drawnPaths?: DrawnPath[];
  expression?: AnchorExpression;
  generationState: GenerationState;
  generationJobId?: string;
  candidates?: AnchorCandidate[];
  selectedCandidateId?: string;
  saveState: SaveState;
  anchorPersisted: boolean;
  persistedAnchorId?: string;
  currentStep: CreationStep;
  /** Set when validateIntention rejects the intention; cleared on the next edit or a valid distill. */
  formationError?: string;
  updatedAt: string;
}

export type CreationContinuation =
  | { type: 'home'; anchorId: string }
  | { type: 'vision'; anchorId: string }
  | { type: 'chart'; anchorId: string }
  | { type: 'vision_and_chart'; anchorId: string };

const STORAGE_KEY = 'anchor-v2-creation-draft';
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

/**
 * The one place UI-C maps its user-facing structures onto the shared sigil engine.
 * This is the SAME engine UI-B first-run uses (`generateTrueSigil`); UI-C only widens
 * the variant it is invoked with. UI-B always uses `balanced`.
 */
const structureVariant = (structure: CanonicalStructure): SigilVariant => {
  if (structure === 'contained') return 'dense';
  if (structure === 'raw') return 'minimal';
  return 'balanced';
};

/** Deterministic structure geometry, shared with UI-B: distilled letters + category tier + variant. */
const generateStructureSvg = (
  letters: string[],
  structure: CanonicalStructure,
  category: AnchorCategory | undefined,
): string =>
  generateTrueSigil(letters, CATEGORY_TO_TIER[category ?? 'custom'], structureVariant(structure)).svg;

export const pathsToSvg = (paths: DrawnPath[]): string => {
  const renderedPaths = paths
    .filter((path) => path.points.length > 1)
    .map((path) => {
      const [first, ...rest] = path.points;
      const data = `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
      return `<path d="${data}" fill="none" stroke="${path.stroke ?? '#171717'}" stroke-width="${path.strokeWidth ?? 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${renderedPaths}</svg>`;
};

const freshDraft = (): CreationDraft => ({
  draftId: makeId('creation'),
  clientRequestId: makeId('create-request'),
  intention: '',
  generationState: 'idle',
  saveState: 'draft',
  anchorPersisted: false,
  currentStep: 'intention',
  updatedAt: now(),
});

/** Intention changes invalidate every formation descendant. Expression changes do not. */
export const invalidateFromIntention = (draft: CreationDraft, intention: string): CreationDraft => ({
  ...draft,
  intention,
  normalizedIntention: undefined,
  category: undefined,
  distilledLetters: undefined,
  structureType: undefined,
  structureSvg: undefined,
  drawnPaths: undefined,
  expression: undefined,
  generationState: 'idle',
  generationJobId: undefined,
  candidates: undefined,
  selectedCandidateId: undefined,
  saveState: 'draft',
  anchorPersisted: false,
  persistedAnchorId: undefined,
  currentStep: 'intention',
  formationError: undefined,
  updatedAt: now(),
});

export const invalidateFromStructure = (draft: CreationDraft, structureType: CanonicalStructure): CreationDraft => ({
  ...draft,
  structureType,
  structureSvg: undefined,
  drawnPaths: structureType === 'drawn' ? draft.drawnPaths : undefined,
  generationState: 'idle',
  generationJobId: undefined,
  candidates: undefined,
  selectedCandidateId: undefined,
  saveState: 'draft',
  anchorPersisted: false,
  persistedAnchorId: undefined,
  currentStep: structureType === 'drawn' ? 'draw' : 'expression',
  updatedAt: now(),
});

type CreationStore = {
  draft: CreationDraft | null;
  start: () => void;
  discard: () => void;
  setStep: (step: CreationStep) => void;
  setIntention: (intention: string) => void;
  distill: () => void;
  selectStructure: (structure: CanonicalStructure) => void;
  setDrawnPaths: (paths: DrawnPath[]) => void;
  selectExpression: (expression: AnchorExpression) => void;
  setGenerationState: (state: GenerationState, jobId?: string) => void;
  setCandidates: (candidates: AnchorCandidate[]) => void;
  selectCandidate: (candidateId: string) => void;
  beginSave: () => string | null;
  completeSave: (anchorId: string) => void;
  failSave: () => void;
};

export const useCreationStore = create<CreationStore>()(
  persist(
    (set, get) => ({
      draft: null,
      start: () => set({ draft: freshDraft() }),
      discard: () => set({ draft: null }),
      setStep: (currentStep) => set((state) => state.draft ? { draft: { ...state.draft, currentStep, updatedAt: now() } } : state),
      setIntention: (intention) => set((state) => ({ draft: invalidateFromIntention(state.draft ?? freshDraft(), intention) })),
      distill: () => set((state) => {
        const draft = state.draft;
        if (!draft) return state;
        // Same gate UI-B first-run applies before forming an Anchor.
        const validation = validateIntention(draft.intention);
        if (!validation.isValid) {
          return { draft: { ...draft, formationError: validation.error ?? 'Write a little more before continuing.', updatedAt: now() } };
        }
        const result = distillIntention(draft.intention);
        return {
          draft: {
            ...draft,
            normalizedIntention: draft.intention.trim().replace(/\s+/g, ' '),
            category: detectCategoryFromText(draft.intention),
            distilledLetters: result.finalLetters,
            formationError: undefined,
            currentStep: 'distillation',
            updatedAt: now(),
          },
        };
      }),
      selectStructure: (structureType) => set((state) => {
        const invalidated = invalidateFromStructure(state.draft ?? freshDraft(), structureType);
        const structureSvg = structureType === 'drawn'
          ? invalidated.structureSvg
          : invalidated.distilledLetters?.length
            ? generateStructureSvg(invalidated.distilledLetters, structureType, invalidated.category)
            : undefined;
        return { draft: { ...invalidated, structureSvg } };
      }),
      setDrawnPaths: (drawnPaths) => set((state) => {
        const draft = state.draft;
        if (!draft) return state;
        return { draft: { ...draft, structureType: 'drawn', drawnPaths, structureSvg: pathsToSvg(drawnPaths), currentStep: 'expression', updatedAt: now() } };
      }),
      selectExpression: (expression) => set((state) => {
        const draft = state.draft;
        if (!draft) return state;
        // Expression changes only rendered treatment, never the distilled or structural source.
        return { draft: { ...draft, expression, generationState: 'idle', candidates: undefined, selectedCandidateId: undefined, saveState: 'draft', anchorPersisted: false, persistedAnchorId: undefined, currentStep: 'generation', updatedAt: now() } };
      }),
      setGenerationState: (generationState, generationJobId) => set((state) => state.draft ? { draft: { ...state.draft, generationState, generationJobId, currentStep: generationState === 'success' ? 'candidates' : 'generation', updatedAt: now() } } : state),
      setCandidates: (candidates) => set((state) => state.draft ? { draft: { ...state.draft, candidates, generationState: 'success', currentStep: 'candidates', updatedAt: now() } } : state),
      selectCandidate: (selectedCandidateId) => set((state) => state.draft ? { draft: { ...state.draft, selectedCandidateId, currentStep: 'save', updatedAt: now() } } : state),
      beginSave: () => {
        const draft = get().draft;
        if (!draft?.selectedCandidateId || draft.saveState === 'saving') return null;
        set({ draft: { ...draft, saveState: 'saving', updatedAt: now() } });
        return draft.clientRequestId;
      },
      completeSave: (persistedAnchorId) => set((state) => state.draft ? { draft: { ...state.draft, saveState: 'saved', anchorPersisted: true, persistedAnchorId, currentStep: 'continue', updatedAt: now() } } : state),
      failSave: () => set((state) => state.draft ? { draft: { ...state.draft, saveState: 'error', updatedAt: now() } } : state),
    }),
    { name: STORAGE_KEY, storage: createJSONStorage(() => encryptedPersistStorage), partialize: (state) => ({ draft: state.draft }) },
  ),
);

/** Uses the established deterministic generator, shared with UI-B. Drawn paths stay untouched. */
export function structureSvgForDraft(draft: CreationDraft): string | undefined {
  if (draft.structureType === 'drawn') return draft.structureSvg;
  if (!draft.structureType || !draft.distilledLetters?.length) return undefined;
  return generateStructureSvg(draft.distilledLetters, draft.structureType, draft.category);
}
