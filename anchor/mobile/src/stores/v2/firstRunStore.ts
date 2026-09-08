import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { distillIntention, validateIntention } from '@/utils/sigil/distillation';
import { CATEGORY_TO_TIER, type AnchorCategory } from '@/types';
import { detectCategoryFromText } from '@/utils/categoryDetection';
import type { FirstRunDirection } from '@/constants/v2/firstRun';

export type FirstRunStep = 'direction' | 'intention' | 'formation' | 'anchor' | 'expression' | 'vision' | 'focus' | 'auth' | 'complete';
export type FirstRunExpression = 'original' | 'monoline' | 'architectural' | 'foil' | 'embossed' | 'etched' | 'ink' | 'halo' | 'glass' | 'radiant' | 'organic' | 'woven' | 'cutpaper';
export type VisionChoice = 'create_now' | 'chart_only' | 'skip_for_now' | 'vision_and_chart';
export type FirstRunDraft = { direction?: FirstRunDirection; intention?: string; normalizedFormationInput?: string; category?: AnchorCategory; distilledLetters?: string[]; structure?: 'balanced'; anchorSvg?: string; expression?: FirstRunExpression; selectedAnchorCandidate?: string; anchorLocalId?: string; focusSessionId?: string; visionChoice?: VisionChoice; visionDraft?: { requested: boolean; chartRequested: boolean }; firstFocusCompleted?: boolean; focusCompletionRecorded?: boolean; authCompleted?: boolean; anchorPersisted?: boolean; currentStep: FirstRunStep };

const initialDraft = (): FirstRunDraft => ({ currentStep: 'direction' });
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

type FirstRunState = { draft: FirstRunDraft; hydrated: boolean; setDirection: (direction: FirstRunDirection) => void; setIntention: (intention: string) => void; form: () => void; setExpression: (expression: FirstRunExpression) => void; setVisionChoice: (choice: VisionChoice) => void; setStep: (step: FirstRunStep) => void; markFocusCompleted: () => void; markFocusRecorded: () => void; markAuthCompleted: () => void; markAnchorPersisted: () => void; complete: () => void; reset: () => void };
export const useFirstRunStore = create<FirstRunState>()(persist((set) => ({
  draft: initialDraft(), hydrated: false,
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
}), { name: 'anchor:v2:first-run', storage: createJSONStorage(() => AsyncStorage), partialize: (state) => ({ draft: state.draft }), onRehydrateStorage: () => () => { useFirstRunStore.setState({ hydrated: true }); } }));
