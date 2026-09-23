import { formationForDraft, resumableDraft, useCreationStore, type CreationDraft } from '../creationStore';
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
    it('keeps the canonical structure fixed while generation and candidate selection change', () => {
      walkToExpression();
      store().selectExpression('foil');
      const structure = draft().structureSvg;
      expect(store().beginGeneration()).toBe(true);
      expect(draft().currentStep).toBe('generating');
      store().completeGeneration([
        { imageUrl: 'https://cdn.test/a.png', variationId: 'a' },
        { imageUrl: 'https://cdn.test/b.png', variationId: 'b' },
      ]);
      expect(draft().currentStep).toBe('choose');
      store().selectCandidate(1);
      expect(draft().enhancedImageUrl).toBe('https://cdn.test/b.png');
      expect(draft().structureSvg).toBe(structure);
    });

    it('keeps a failed generation retryable without losing the structure or expression', () => {
      walkToExpression();
      store().selectExpression('etched');
      const structure = draft().structureSvg;
      store().beginGeneration();
      store().failGeneration('network');
      expect(draft().currentStep).toBe('generating');
      expect(draft().generationState).toBe('error');
      expect(draft().expression).toBe('etched');
      expect(draft().structureSvg).toBe(structure);
      expect(store().beginGeneration()).toBe(true);
    });

    it('backs from candidate choice to expression without discarding candidates', () => {
      walkToExpression();
      store().selectExpression('ink');
      store().beginGeneration();
      store().completeGeneration([{ imageUrl: 'a' }, { imageUrl: 'b' }]);
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

  it('resumes unfinished work where it was', () => {
    expect(resumableDraft(base({ currentStep: 'formation' }))?.currentStep).toBe('formation');
    expect(resumableDraft(null)).toBeNull();
  });
});
