import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { CATEGORY_TO_TIER, type AnchorCategory } from '@/types';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import type { FirstRunDirection } from '@/constants/v2/firstRun';
import type { OnboardingStep } from '@/constants/v2/onboarding';

export type FirstRunStep = OnboardingStep | 'direction' | 'intention' | 'formation' | 'anchor' | 'expression' | 'vision' | 'focus';
export type FirstRunExpression = 'original' | 'monoline' | 'architectural' | 'foil' | 'embossed' | 'etched' | 'ink' | 'halo' | 'glass' | 'radiant' | 'organic' | 'woven' | 'cutpaper';
export type VisionChoice = 'create_now' | 'chart_only' | 'skip_for_now' | 'vision_and_chart';
export type FirstRunDraft = {
  direction?: FirstRunDirection;
  intention?: string;
  normalizedFormationInput?: string;
  category?: AnchorCategory;
  focusCategory?: AnchorCategory;
  selectedCategory?: AnchorCategory;
  motivation?: string;
  desiredOutcome?: string;
  selectedOutcome?: string;
  desiredWhy?: string;
  selectedWhy?: string;
  desiredFriction?: string;
  selectedFriction?: string;
  customDesiredChange?: string;
  desiredChange?: string;
  lifeChanges?: string[];
  primaryNeed?: string;
  onboardingAnswersComplete?: boolean;
  accountId?: string;
  distilledLetters?: string[];
  structure?: 'balanced';
  anchorSvg?: string;
  expression?: FirstRunExpression;
  styleChoice?: string;
  enhancedImageUrl?: string;
  selectedAnchorCandidate?: string;
  anchorLocalId?: string;
  focusSessionId?: string;
  visionChoice?: VisionChoice;
  visionDraft?: { requested: boolean; chartRequested: boolean };
  firstFocusCompleted?: boolean;
  focusCompletionRecorded?: boolean;
  authCompleted?: boolean;
  anchorPersisted?: boolean;
  currentStep: FirstRunStep;
};

const initialDraft = (): FirstRunDraft => ({ currentStep: 'welcome', lifeChanges: [] });
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Intention changes invalidate only formation descendants; category and later Vision choice remain. */
export function invalidateFormation(draft: FirstRunDraft): FirstRunDraft {
  return { ...draft, normalizedFormationInput: undefined, distilledLetters: undefined, structure: undefined, anchorSvg: undefined, expression: undefined, selectedAnchorCandidate: undefined, anchorLocalId: undefined, focusSessionId: undefined, firstFocusCompleted: false, focusCompletionRecorded: false, anchorPersisted: false };
}

export function formFirstRunAnchor(draft: FirstRunDraft): FirstRunDraft {
  const intention = draft.intention?.trim() ?? '';
  const validation = validateIntention(intention);
  if (!validation.isValid) throw new Error(validation.error ?? 'Write a little more before continuing.');
  // Direction is onboarding copy only. Category/formative treatment is decided
  // from the actual intention, never from a Work/Performance/Growth shortcut.
  const category = detectCategoryFromText(intention);
  const letters = distillIntention(intention).finalLetters;
  const expression = draft.expression ?? 'foil';
  // The generator is invoked once for the underlying structure. Expression is
  // intentionally held separately: it must never recalculate this geometry.
  const anchor = generateTrueSigil(letters, CATEGORY_TO_TIER[category], 'balanced');
  return { ...draft, normalizedFormationInput: intention, category, distilledLetters: letters, structure: 'balanced', expression, anchorSvg: anchor.svg, selectedAnchorCandidate: anchor.svg, anchorLocalId: draft.anchorLocalId ?? id('v2-first-anchor'), focusSessionId: draft.focusSessionId ?? id('v2-first-focus') };
}

/** What the shared creation flow hands first-run once the user has made their first Anchor. */
export type FirstRunCreation = { intention: string; category?: AnchorCategory; distilledLetters: string[]; anchorSvg: string; expression: string; styleChoice?: string; enhancedImageUrl?: string };

type FirstRunState = {
  draft: FirstRunDraft;
  hydrated: boolean;
  adoptCreation: (creation: FirstRunCreation) => string;
  setFocusCategory: (category: AnchorCategory) => void;
  setMotivation: (motivation: string) => void;
  setDesiredOutcome: (outcome: string) => void;
  setDesiredWhy: (why: string) => void;
  setDesiredFriction: (friction: string) => void;
  setCustomDesiredChange: (change: string) => void;
  setDesiredChange: (change: string) => void;
  toggleLifeChange: (change: string) => void;
  setPrimaryNeed: (need: string) => void;
  markAnswersComplete: () => void;
  bindAccount: (accountId: string) => void;
  setDirection: (direction: FirstRunDirection) => void;
  setIntention: (intention: string) => void;
  form: () => void;
  setExpression: (expression: FirstRunExpression) => void;
  setVisionChoice: (choice: VisionChoice) => void;
  setStep: (step: FirstRunStep) => void;
  markFocusCompleted: () => void;
  markFocusRecorded: () => void;
  markAuthCompleted: () => void;
  markAnchorPersisted: () => void;
  complete: () => void;
  reset: () => void;
};
export const useFirstRunStore = create<FirstRunState>()(persist((set, get) => ({
  draft: initialDraft(), hydrated: false,
  // The first Anchor is made by the same creation flow as every other; first-run keeps it
  // locally (there is no account yet) until the user saves it at the end of onboarding.
  adoptCreation: (creation) => {
    const current = get().draft;
    const anchorLocalId = current.anchorLocalId ?? id('v2-first-anchor');
    const expression = (creation.expression === 'cut_paper' ? 'cutpaper' : creation.expression) as FirstRunExpression;
    set({ draft: { ...current, intention: creation.intention, normalizedFormationInput: creation.intention, category: creation.category, distilledLetters: creation.distilledLetters, structure: 'balanced', anchorSvg: creation.anchorSvg, selectedAnchorCandidate: creation.anchorSvg, expression, styleChoice: creation.styleChoice, enhancedImageUrl: creation.enhancedImageUrl, anchorLocalId, focusSessionId: current.focusSessionId ?? id('v2-first-focus'), firstFocusCompleted: false, focusCompletionRecorded: false, anchorPersisted: false } });
    return anchorLocalId;
  },
  setFocusCategory: (focusCategory) => set((state) => ({ draft: { ...state.draft, focusCategory, selectedCategory: focusCategory, desiredChange: undefined, customDesiredChange: undefined } })),
  setMotivation: (motivation) => set((state) => ({ draft: { ...state.draft, motivation, customDesiredChange: undefined, desiredOutcome: undefined, currentStep: 'motivation' } })),
  setDesiredOutcome: (desiredOutcome) => set((state) => ({ draft: { ...state.draft, desiredOutcome, selectedOutcome: desiredOutcome, currentStep: 'outcome' } })),
  setDesiredWhy: (desiredWhy) => set((state) => ({ draft: { ...state.draft, desiredWhy, selectedWhy: desiredWhy, currentStep: 'meaning' } })),
  setDesiredFriction: (desiredFriction) => set((state) => ({ draft: { ...state.draft, desiredFriction, selectedFriction: desiredFriction, currentStep: 'friction' } })),
  setDesiredChange: (desiredChange) => set((state) => ({ draft: { ...state.draft, desiredChange, currentStep: 'motivation' } })),
  setCustomDesiredChange: (customDesiredChange) => set((state) => ({ draft: { ...state.draft, customDesiredChange } })),
  toggleLifeChange: (change) => set((state) => ({ draft: { ...state.draft, lifeChanges: state.draft.lifeChanges?.includes(change) ? state.draft.lifeChanges.filter((item) => item !== change) : [...(state.draft.lifeChanges ?? []), change] } })),
  setPrimaryNeed: (primaryNeed) => set((state) => ({ draft: { ...state.draft, primaryNeed } })),
  markAnswersComplete: () => set((state) => ({ draft: { ...state.draft, onboardingAnswersComplete: true } })),
  bindAccount: (accountId) => set((state) => ({ draft: { ...state.draft, accountId } })),
  setDirection: (direction) => set((state) => ({ draft: { ...state.draft, direction, currentStep: 'intention' } })),
  setIntention: (intention) => set((state) => { const unchanged = state.draft.intention === intention; const draft = unchanged ? state.draft : invalidateFormation({ ...state.draft, intention }); return { draft: { ...draft, intention, currentStep: 'intention' } }; }),
  form: () => set((state) => ({ draft: { ...formFirstRunAnchor(state.draft), currentStep: 'formation' } })),
  setExpression: (expression) => set((state) => ({ draft: { ...state.draft, expression } })),
  setVisionChoice: (visionChoice) => set((state) => ({ draft: { ...state.draft, visionChoice, visionDraft: { requested: visionChoice === 'create_now' || visionChoice === 'vision_and_chart', chartRequested: visionChoice === 'chart_only' || visionChoice === 'vision_and_chart' } } })),
  setStep: (currentStep) => set((state) => ({ draft: { ...state.draft, currentStep } })),
  markFocusCompleted: () => set((state) => ({ draft: { ...state.draft, firstFocusCompleted: true } })),
  markFocusRecorded: () => set((state) => ({ draft: { ...state.draft, focusCompletionRecorded: true } })),
  markAuthCompleted: () => set((state) => ({ draft: { ...state.draft, authCompleted: true } })),
  markAnchorPersisted: () => set((state) => ({ draft: { ...state.draft, anchorPersisted: true } })),
  complete: () => set((state) => ({ draft: { ...state.draft, currentStep: 'complete' } })), reset: () => set({ draft: initialDraft() }),
}), {
  name: 'anchor:v2:first-run',
  storage: createJSONStorage(() => encryptedPersistStorage),
  partialize: (state) => ({ draft: state.draft.accountId ? state.draft : initialDraft() }),
  onRehydrateStorage: () => (state) => {
    if (state && !state.draft?.accountId) {
      state.reset();
    }
    useFirstRunStore.setState({ hydrated: true });
  },
}));
