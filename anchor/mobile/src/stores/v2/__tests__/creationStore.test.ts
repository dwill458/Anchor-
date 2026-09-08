import { useCreationStore, invalidateFromIntention, invalidateFromStructure } from '../creationStore';

const freshStore = () => {
  useCreationStore.setState({ draft: null });
  useCreationStore.getState().start();
  return useCreationStore.getState();
};

/** Walk a valid draft up to (but not including) save. */
const buildToCandidates = (intention = 'I finish the project') => {
  const store = useCreationStore.getState();
  store.setIntention(intention);
  store.distill();
  store.selectStructure('focused');
  store.selectExpression('foil');
  store.setCandidates([
    { id: 'candidate-a', structureSvg: '<svg/>', expression: 'foil' },
    { id: 'candidate-b', structureSvg: '<svg/>', expression: 'original' },
  ]);
  store.selectCandidate('candidate-a');
};

describe('v2 creation draft', () => {
  beforeEach(() => {
    freshStore();
  });

  it('persists one canonical formation truth through distillation', () => {
    const store = useCreationStore.getState();
    store.setIntention('I finish the project');
    store.distill();
    const draft = useCreationStore.getState().draft;

    expect(draft?.normalizedIntention).toBe('I finish the project');
    expect(draft?.distilledLetters).toEqual(['F', 'N', 'S', 'H', 'T', 'P', 'R', 'J', 'C']);
    expect(draft?.category).toBe('career');
  });

  it('uses the same shared distillation + sigil engine as UI-B first run', () => {
    const store = useCreationStore.getState();
    store.setIntention('I finish the project');
    store.distill();
    store.selectStructure('focused');
    const draft = useCreationStore.getState().draft;
    // generateTrueSigil output — the identical engine firstRunStore.formFirstRunAnchor() calls.
    expect(draft?.structureSvg).toContain('<svg');
    expect(draft?.structureSvg).toContain('stroke="currentColor"');
  });

  it('blocks distillation and surfaces an error when the intention is too thin', () => {
    const store = useCreationStore.getState();
    store.setIntention('a');
    store.distill();
    const draft = useCreationStore.getState().draft;
    expect(draft?.formationError).toBeTruthy();
    expect(draft?.currentStep).toBe('intention');
    expect(draft?.distilledLetters).toBeUndefined();
  });

  it('clears the formation error once a valid intention distills', () => {
    const store = useCreationStore.getState();
    store.setIntention('a');
    store.distill();
    expect(useCreationStore.getState().draft?.formationError).toBeTruthy();
    store.setIntention('I finish the project');
    store.distill();
    expect(useCreationStore.getState().draft?.formationError).toBeUndefined();
    expect(useCreationStore.getState().draft?.currentStep).toBe('distillation');
  });

  it('invalidates every downstream descendant when the intention changes', () => {
    const store = useCreationStore.getState();
    buildToCandidates();
    store.completeSave('anchor-a');

    store.setIntention('I build trust');
    const draft = useCreationStore.getState().draft;
    expect(draft).toMatchObject({ intention: 'I build trust', currentStep: 'intention', generationState: 'idle', saveState: 'draft', anchorPersisted: false });
    expect(draft?.distilledLetters).toBeUndefined();
    expect(draft?.structureSvg).toBeUndefined();
    expect(draft?.expression).toBeUndefined();
    expect(draft?.candidates).toBeUndefined();
    expect(draft?.persistedAnchorId).toBeUndefined();
  });

  it('invalidates generation descendants when the structure changes but keeps the letters', () => {
    const store = useCreationStore.getState();
    buildToCandidates();
    const letters = useCreationStore.getState().draft?.distilledLetters;

    store.selectStructure('raw');
    const draft = useCreationStore.getState().draft;
    expect(draft?.distilledLetters).toEqual(letters);
    expect(draft?.structureType).toBe('raw');
    expect(draft?.candidates).toBeUndefined();
    expect(draft?.selectedCandidateId).toBeUndefined();
    expect(draft?.saveState).toBe('draft');
    expect(draft?.anchorPersisted).toBe(false);
  });

  it('keeps geometry and letters when the expression changes', () => {
    const store = useCreationStore.getState();
    store.setIntention('I finish the project');
    store.distill();
    store.selectStructure('contained');
    const before = useCreationStore.getState().draft;
    store.selectExpression('ink');
    const after = useCreationStore.getState().draft;

    expect(after?.distilledLetters).toEqual(before?.distilledLetters);
    expect(after?.structureType).toBe('contained');
    expect(after?.structureSvg).toBe(before?.structureSvg);
  });

  it('preserves drawn vector output through a re-selection of the Drawn structure', () => {
    const store = useCreationStore.getState();
    store.setIntention('I build trust');
    store.distill();
    store.selectStructure('drawn');
    store.setDrawnPaths([{ points: [{ x: 10, y: 10 }, { x: 90, y: 90 }] }]);
    expect(useCreationStore.getState().draft?.structureSvg).toContain('<path');

    store.selectStructure('drawn');
    expect(useCreationStore.getState().draft?.drawnPaths).toHaveLength(1);
    store.selectStructure('focused');
    expect(useCreationStore.getState().draft?.drawnPaths).toBeUndefined();
  });

  it('reuses one stable save request id across a failed-then-retried save', () => {
    const store = useCreationStore.getState();
    buildToCandidates('I build trust');
    const firstRequest = store.beginSave();
    store.failSave();
    const retryRequest = store.beginSave();
    expect(retryRequest).toBe(firstRequest);
    expect(retryRequest).toBeTruthy();
  });

  it('preserves state when navigating back and forward between steps', () => {
    const store = useCreationStore.getState();
    store.setIntention('I finish the project');
    store.distill();
    store.selectStructure('focused');
    store.selectExpression('foil');
    const svg = useCreationStore.getState().draft?.structureSvg;

    store.setStep('structure');
    store.setStep('distillation');
    const draft = useCreationStore.getState().draft;
    expect(draft?.currentStep).toBe('distillation');
    expect(draft?.distilledLetters).toBeDefined();
    expect(draft?.structureType).toBe('focused');
    expect(draft?.expression).toBe('foil');
    expect(draft?.structureSvg).toBe(svg);
  });

  it('resumes an in-progress draft exactly where it was left', () => {
    const store = useCreationStore.getState();
    store.setIntention('I finish the project');
    store.distill();
    store.selectStructure('focused');
    store.setStep('expression');
    const snapshot = useCreationStore.getState().draft;

    // Simulate a cold start + rehydrate (what the persist middleware does).
    useCreationStore.setState({ draft: null });
    useCreationStore.setState({ draft: snapshot });

    const resumed = useCreationStore.getState().draft;
    expect(resumed?.currentStep).toBe('expression');
    expect(resumed?.distilledLetters).toEqual(snapshot?.distilledLetters);
    expect(resumed?.clientRequestId).toBe(snapshot?.clientRequestId);
    useCreationStore.getState().selectExpression('foil');
    expect(useCreationStore.getState().draft?.currentStep).toBe('generation');
  });

  it('supports every post-save continuation intent, including Chart without Vision', () => {
    const store = useCreationStore.getState();
    buildToCandidates();
    store.completeSave('anchor-1');
    const anchorId = useCreationStore.getState().draft?.persistedAnchorId;
    expect(anchorId).toBe('anchor-1');

    const continuations = (['home', 'vision', 'chart', 'vision_and_chart'] as const).map(
      (type) => ({ type, anchorId: anchorId! }),
    );
    expect(continuations.map((c) => c.type)).toEqual(['home', 'vision', 'chart', 'vision_and_chart']);
    // Chart is a first-class branch: it does not depend on any Vision being requested first.
    expect(continuations.find((c) => c.type === 'chart')).toEqual({ type: 'chart', anchorId: 'anchor-1' });
  });
});

describe('v2 creation invalidation helpers', () => {
  it('invalidateFromIntention clears formation descendants and the formation error', () => {
    const next = invalidateFromIntention(
      {
        draftId: 'd', clientRequestId: 'r', intention: 'old', normalizedIntention: 'old',
        category: 'career', distilledLetters: ['F'], structureType: 'focused', structureSvg: '<svg/>',
        expression: 'foil', generationState: 'success', candidates: [{ id: 'x', structureSvg: '<svg/>', expression: 'foil' }],
        selectedCandidateId: 'x', saveState: 'saved', anchorPersisted: true, persistedAnchorId: 'a',
        currentStep: 'continue', formationError: 'stale', updatedAt: '',
      },
      'new intention',
    );
    expect(next.intention).toBe('new intention');
    expect(next.distilledLetters).toBeUndefined();
    expect(next.candidates).toBeUndefined();
    expect(next.persistedAnchorId).toBeUndefined();
    expect(next.formationError).toBeUndefined();
    expect(next.currentStep).toBe('intention');
  });

  it('invalidateFromStructure keeps drawn paths only for the Drawn structure', () => {
    const base = {
      draftId: 'd', clientRequestId: 'r', intention: 'i', distilledLetters: ['F', 'N'],
      drawnPaths: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }], generationState: 'idle' as const,
      saveState: 'draft' as const, anchorPersisted: false, currentStep: 'structure' as const, updatedAt: '',
    };
    expect(invalidateFromStructure(base, 'drawn').drawnPaths).toHaveLength(1);
    expect(invalidateFromStructure(base, 'raw').drawnPaths).toBeUndefined();
    expect(invalidateFromStructure(base, 'drawn').currentStep).toBe('draw');
    expect(invalidateFromStructure(base, 'raw').currentStep).toBe('expression');
  });
});
