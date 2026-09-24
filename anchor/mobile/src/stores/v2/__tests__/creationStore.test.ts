import { GENERATION_ERRORS, formationForDraft, resumableDraft, useCreationStore, type CreationDraft } from '../creationStore';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { distillIntention } from '@/utils/sigil/distillation';
import { CATEGORY_TO_TIER } from '@/types';

const store = () => useCreationStore.getState();
const draft = () => useCreationStore.getState().draft!;

const fresh = () => {
  useCreationStore.setState({ draft: null });
  store().start();
};

/** From intention (already holding an intention) to expression. */
function walkToExpressionFromIntention() {
  expect(store().distill()).toBe(true);
  store().formAnchor();
  store().completeFormation();
  store().openExpression();
}

/** Intention → distillation → formation → reveal → expression. */
const walkToExpression = (intention = 'I finish the project') => {
  store().setIntention(intention);
  walkToExpressionFromIntention();
  expect(draft().currentStep).toBe('expression');
};

describe('v2 creation state machine', () => {
  beforeEach(fresh);

  it('distils with the production algorithm and detects the category', () => {
    store().setIntention('I finish the project');
    store().distill();
    expect(draft().currentStep).toBe('distillation');
    expect(draft().normalizedIntention).toBe('I finish the project');
    expect(draft().distilledLetters).toEqual(distillIntention('I finish the project').finalLetters);
    expect(draft().category).toBe('career');
  });

  it('refuses an unusable intention without leaving the intention step', () => {
    store().setIntention('a');
    expect(store().distill()).toBe(false);
    expect(draft().currentStep).toBe('intention');
    expect(draft().formationError).toBeTruthy();
    store().setIntention('I finish the project');
    expect(draft().formationError).toBeUndefined();
  });

  it('forms the structure with the real generator on the category grid', () => {
    store().setIntention('I finish the project');
    store().distill();
    store().formAnchor();
    const expected = generateTrueSigil(draft().distilledLetters, CATEGORY_TO_TIER.career, 'balanced').svg;
    expect(draft().structureSvg).toBe(expected);
    expect(draft().structureType).toBe('focused');
    expect(formationForDraft(draft())?.svg).toBe(expected);
    expect(draft().currentStep).toBe('formation');
  });

  it('only reveals once a structure exists', () => {
    store().setIntention('I finish the project');
    store().distill();
    store().completeFormation();
    expect(draft().currentStep).toBe('distillation');
    store().formAnchor();
    store().completeFormation();
    expect(draft().currentStep).toBe('reveal');
  });

  it('never changes the structure when the expression changes', () => {
    walkToExpression();
    const structure = draft().structureSvg;
    for (const expression of ['foil', 'ink', 'monoline', 'cut_paper'] as const) {
      store().selectExpression(expression);
      expect(draft().expression).toBe(expression);
      expect(draft().structureSvg).toBe(structure);
      expect(draft().distilledLetters).toEqual(distillIntention('I finish the project').finalLetters);
    }
  });

  it('keeps the expression but drops everything formed when the intention is edited', () => {
    walkToExpression();
    store().selectExpression('etched');
    store().goBack(); // expression → reveal
    store().goBack(); // reveal → intention
    store().setIntention('I lead with calm');
    expect(draft().expression).toBe('etched');
    expect(draft().structureSvg).toBeUndefined();
    expect(draft().distilledLetters).toBeUndefined();
    expect(draft().currentStep).toBe('intention');
  });

  describe('back', () => {
    it('is deterministic: distillation/formation/reveal return to intention, expression to reveal', () => {
      store().setIntention('I finish the project');
      store().distill();
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('intention');

      store().distill();
      store().formAnchor();
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('intention');

      walkToExpressionFromIntention();
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('reveal');
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('intention');
      // Intention is the first step: Back leaves the flow.
      expect(store().goBack()).toBe(false);
    });

    it('is held while a save is running and after the Anchor exists', () => {
      walkToExpression();
      store().beginSave();
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('expression');
      store().completeSave('anchor-1');
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('handoff');
    });
  });

  describe('save', () => {
    it('hands out the key once while a save runs, so a double tap cannot double-save', () => {
      walkToExpression();
      const key = store().beginSave();
      expect(key).toBe(draft().clientRequestId);
      expect(store().beginSave()).toBeNull();
      expect(draft().saveState).toBe('saving');
    });

    it('retries with the same key after a failure', () => {
      walkToExpression();
      const first = store().beginSave();
      store().failSave('network');
      expect(draft().saveState).toBe('error');
      expect(draft().saveFailure).toBe('network');
      expect(store().beginSave()).toBe(first);
    });

    it('rotates the key for a new intention only if no save was ever sent', () => {
      walkToExpression();
      const untouched = draft().clientRequestId;
      store().goBack();
      store().goBack();
      store().setIntention('I lead with calm');
      expect(draft().clientRequestId).not.toBe(untouched);

      walkToExpressionFromIntention();
      const sent = store().beginSave();
      store().failSave('network');
      store().goBack();
      store().goBack();
      store().setIntention('I rest well');
      // A lost response may already have created an Anchor under this key; the server decides.
      expect(draft().clientRequestId).toBe(sent);
    });

    it('locks the draft once the Anchor exists', () => {
      walkToExpression();
      store().beginSave();
      store().completeSave('anchor-1');
      expect(draft().anchorPersisted).toBe(true);
      expect(draft().persistedAnchorId).toBe('anchor-1');
      expect(draft().currentStep).toBe('handoff');
      store().selectExpression('foil');
      store().setIntention('something else');
      expect(draft().expression).toBe('original');
      expect(draft().intention).toBe('I finish the project');
      expect(store().beginSave()).toBeNull();
    });

    it('does not save from anywhere but the expression or choose step', () => {
      store().setIntention('I finish the project');
      store().distill();
      store().formAnchor();
      store().completeFormation();
      expect(store().beginSave()).toBeNull();
    });
  });

  describe('generation and final choice', () => {
    const A = { imageUrl: 'https://cdn.test/a.png', variationId: 'a' };
    const B = { imageUrl: 'https://cdn.test/b.png', variationId: 'b' };

    it('keeps the canonical structure fixed while generation and candidate selection change', () => {
      walkToExpression();
      store().selectStyle('gold_leaf', 'foil');
      const structure = draft().structureSvg;
      const plan = store().beginGeneration();
      expect(plan).toMatchObject({ missing: 2, attempt: 1 });
      expect(draft().currentStep).toBe('generating');
      store().completeGeneration(plan!.requestId, [A, B]);
      expect(draft().currentStep).toBe('choose');
      // The choice is the user's: nothing is pre-selected and nothing can be kept yet.
      expect(draft().selectedCandidateIndex).toBe(-1);
      expect(store().beginSave()).toBeNull();
      store().selectCandidate(1);
      expect(draft().enhancedImageUrl).toBe(B.imageUrl);
      expect(draft().structureSvg).toBe(structure);
      expect(store().beginSave()).toBe(draft().clientRequestId);
    });

    it('records the library style alongside the local treatment that previews it', () => {
      walkToExpression();
      store().selectStyle('cosmic', 'etched');
      expect(draft()).toMatchObject({ styleChoice: 'cosmic', expression: 'etched' });
      store().selectStyle(null, 'original');
      expect(draft().styleChoice).toBeUndefined();
      expect(draft().expression).toBe('original');
    });

    it('keeps a failed generation retryable without losing the structure or expression', () => {
      walkToExpression();
      store().selectStyle('lunar_etch', 'etched');
      const structure = draft().structureSvg;
      const plan = store().beginGeneration()!;
      store().failGeneration(plan.requestId, GENERATION_ERRORS.offline);
      expect(draft().currentStep).toBe('generating');
      expect(draft().generationState).toBe('error');
      expect(draft().generationError).toBe(GENERATION_ERRORS.offline);
      expect(draft().expression).toBe('etched');
      expect(draft().structureSvg).toBe(structure);
      // A retry after a failure is not a regeneration: it does not escalate the attempt.
      expect(store().beginGeneration()).toMatchObject({ missing: 2, attempt: 1 });
    });

    it('never discards a finished interpretation, and retries only the missing one', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const first = store().beginGeneration()!;
      store().completeGeneration(first.requestId, [A]);
      expect(draft().currentStep).toBe('generating');
      expect(draft().generationState).toBe('error');
      expect(draft().generationError).toBe(GENERATION_ERRORS.partial);
      expect(draft().generatedCandidates).toEqual([A]);

      const second = store().beginGeneration()!;
      expect(second.missing).toBe(1);
      expect(draft().generatedCandidates).toEqual([A]);
      store().failGeneration(second.requestId);
      expect(draft().generatedCandidates).toEqual([A]);
      expect(draft().generationError).toBe(GENERATION_ERRORS.partial);

      const third = store().beginGeneration()!;
      store().completeGeneration(third.requestId, [B]);
      expect(draft().currentStep).toBe('choose');
      expect(draft().generatedCandidates).toEqual([A, B]);
    });

    it('ignores a response from a request that is no longer current', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const stale = store().beginGeneration()!;
      store().goBack();
      store().selectStyle('gold_leaf', 'foil');
      const current = store().beginGeneration()!;
      store().completeGeneration(stale.requestId, [A, B]);
      expect(draft().currentStep).toBe('generating');
      expect(draft().generatedCandidates).toEqual([]);
      store().failGeneration(stale.requestId, 'late failure');
      expect(draft().generationState).toBe('generating');
      store().completeGeneration(current.requestId, [A, B]);
      expect(draft().currentStep).toBe('choose');
    });

    it('asks for a fresh pair only from the choice itself, and escalates the attempt there', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const first = store().beginGeneration()!;
      store().completeGeneration(first.requestId, [A, B]);
      const again = store().beginGeneration()!;
      expect(again).toMatchObject({ missing: 2, attempt: 2 });
      expect(draft().generatedCandidates).toEqual([]);
    });

    it('shows an existing pair again instead of spending a new one after backing out', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const first = store().beginGeneration()!;
      store().completeGeneration(first.requestId, [A, B]);
      store().goBack();
      expect(draft().currentStep).toBe('expression');
      expect(store().beginGeneration()).toBeNull();
      expect(draft().currentStep).toBe('choose');
      expect(draft().generatedCandidates).toEqual([A, B]);
    });

    it('stepping back during development neither loses the request nor blocks Generate', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const plan = store().beginGeneration()!;
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('expression');
      // Generate again with the same style returns to the development already under way.
      expect(store().beginGeneration()).toBeNull();
      expect(draft().currentStep).toBe('generating');
      expect(draft().generationRequestId).toBe(plan.requestId);
      store().completeGeneration(plan.requestId, [A, B]);
      expect(draft().currentStep).toBe('choose');
    });

    it('keeps a result that arrives while the user is back on Expression', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const plan = store().beginGeneration()!;
      store().goBack();
      store().completeGeneration(plan.requestId, [A, B]);
      expect(draft().currentStep).toBe('expression');
      expect(draft().generatedCandidates).toEqual([A, B]);
      // The finished pair is shown on the next Generate; nothing new is requested.
      expect(store().beginGeneration()).toBeNull();
      expect(draft().currentStep).toBe('choose');
    });

    it('gives back the previous pair when a fresh one cannot be made', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const first = store().beginGeneration()!;
      store().completeGeneration(first.requestId, [A, B]);
      const again = store().beginGeneration()!;
      expect(draft().generatedCandidates).toEqual([]);
      store().failGeneration(again.requestId, GENERATION_ERRORS.failed);
      expect(draft().currentStep).toBe('choose');
      expect(draft().generatedCandidates).toEqual([A, B]);
      expect(draft().generationError).toBe(GENERATION_ERRORS.kept);
      expect(draft().selectedCandidateIndex).toBe(-1);
      store().selectCandidate(0);
      expect(draft().generationError).toBeUndefined();
    });

    it('lets the user return to the set-aside pair after a partial fresh development fails', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const first = store().beginGeneration()!;
      store().completeGeneration(first.requestId, [A, B]);
      const again = store().beginGeneration()!;
      store().completeGeneration(again.requestId, [{ imageUrl: 'https://cdn.test/c.png' }]);
      expect(draft().currentStep).toBe('generating');
      expect(draft().previousCandidates).toEqual([A, B]);
      store().returnToPrevious();
      expect(draft().currentStep).toBe('choose');
      expect(draft().generatedCandidates).toEqual([A, B]);
      expect(draft().previousCandidates).toBeUndefined();
    });

    it('backs from candidate choice to expression without discarding candidates', () => {
      walkToExpression();
      store().selectStyle('ink_brush', 'ink');
      const plan = store().beginGeneration()!;
      store().completeGeneration(plan.requestId, [{ imageUrl: 'a' }, { imageUrl: 'b' }]);
      expect(store().goBack()).toBe(true);
      expect(draft().currentStep).toBe('expression');
      expect(draft().generatedCandidates).toHaveLength(2);
    });
  });
});

describe('resumableDraft', () => {
  const base = (overrides: Partial<CreationDraft>): CreationDraft => ({
    draftId: 'd',
    clientRequestId: 'k',
    intention: 'I finish the project',
    expression: 'original',
    generatedCandidates: [],
    selectedCandidateIndex: 0,
    generationState: 'idle',
    saveState: 'draft',
    saveAttempted: false,
    anchorPersisted: false,
    currentStep: 'reveal',
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('never resumes a finished Anchor', () => {
    expect(resumableDraft(base({ anchorPersisted: true, currentStep: 'choose' }))).toBeNull();
    expect(resumableDraft(base({ anchorPersisted: true, currentStep: 'handoff' }))).toBeNull();
  });

  it('turns a save interrupted by the app dying into a retryable failure with the same key', () => {
    const resumed = resumableDraft(base({ currentStep: 'expression', saveState: 'saving', saveAttempted: true }));
    expect(resumed?.saveState).toBe('error');
    expect(resumed?.saveFailure).toBe('network');
    expect(resumed?.clientRequestId).toBe('k');
  });

  it('turns a development the app died during into a retry that keeps what finished', () => {
    const interrupted = resumableDraft(base({ currentStep: 'generating', expression: 'ink', styleChoice: 'ink_brush', generationState: 'generating', generationRequestId: 'g1' }));
    expect(interrupted).toMatchObject({ currentStep: 'generating', generationState: 'error', generationError: GENERATION_ERRORS.interrupted, styleChoice: 'ink_brush' });
    expect(interrupted?.generationRequestId).toBeUndefined();
    const partial = resumableDraft(base({ currentStep: 'generating', expression: 'ink', generationState: 'generating', generatedCandidates: [{ imageUrl: 'a' }] }));
    expect(partial?.generatedCandidates).toEqual([{ imageUrl: 'a' }]);
    expect(partial?.generationError).toBe(GENERATION_ERRORS.partial);
  });

  it('resumes a choice with the user\'s selection, and no selection it never made', () => {
    const pair = [{ imageUrl: 'a' }, { imageUrl: 'b' }];
    expect(resumableDraft(base({ currentStep: 'choose', generatedCandidates: pair, selectedCandidateIndex: 1 }))?.enhancedImageUrl).toBe('b');
    const unchosen = resumableDraft(base({ currentStep: 'choose', generatedCandidates: pair, selectedCandidateIndex: -1, enhancedImageUrl: 'a' }));
    expect(unchosen?.selectedCandidateIndex).toBe(-1);
    expect(unchosen?.enhancedImageUrl).toBeUndefined();
  });

  it('resumes unfinished work where it was', () => {
    expect(resumableDraft(base({ currentStep: 'formation' }))?.currentStep).toBe('formation');
    expect(resumableDraft(null)).toBeNull();
  });
});
