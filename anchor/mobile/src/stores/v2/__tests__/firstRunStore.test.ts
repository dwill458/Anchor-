import { formFirstRunAnchor, invalidateFormation, useFirstRunStore } from '../firstRunStore';

describe('V2 first-run draft', () => {
  beforeEach(() => useFirstRunStore.getState().reset());

  it('keeps one draft through forward and back state changes', () => {
    const store = useFirstRunStore.getState();
    store.setDirection('work');
    store.setIntention('I lead my work with clarity');
    store.form();
    store.setStep('anchor');
    store.setStep('formation');
    expect(useFirstRunStore.getState().draft).toMatchObject({ direction: 'work', intention: 'I lead my work with clarity', currentStep: 'formation' });
  });

  it('uses the existing distillation implementation in formation', () => {
    const formed = formFirstRunAnchor({ direction: 'work', intention: 'Close the deal', currentStep: 'intention' });
    expect(formed.distilledLetters).toEqual(['C', 'L', 'S', 'T', 'H', 'D']);
    expect(formed.anchorSvg).toContain('<svg');
  });

  it('invalidates formation descendants when intention changes', () => {
    const next = invalidateFormation({ intention: 'Old intention', category: 'health', distilledLetters: ['L'], structure: 'balanced', anchorSvg: '<svg/>', expression: 'foil', focusSessionId: 'session', currentStep: 'anchor' });
    expect(next.category).toBe('health');
    expect(next.distilledLetters).toBeUndefined();
    expect(next.anchorSvg).toBeUndefined();
    expect(next.focusSessionId).toBeUndefined();
  });

  it('changes expression without invalidating the formed structure', () => {
    const store = useFirstRunStore.getState();
    store.setDirection('work'); store.setIntention('I lead my work with clarity'); store.form();
    const structure = useFirstRunStore.getState().draft.structure;
    const svg = useFirstRunStore.getState().draft.anchorSvg;
    store.setExpression('cutpaper');
    expect(useFirstRunStore.getState().draft).toMatchObject({ expression: 'cutpaper', structure, anchorSvg: svg });
  });

  it('supports Anchor only, Chart only, Vision, and Vision plus Chart decisions', () => {
    const store = useFirstRunStore.getState();
    store.setVisionChoice('skip_for_now'); expect(useFirstRunStore.getState().draft.visionDraft).toEqual({ requested: false, chartRequested: false });
    store.setVisionChoice('chart_only'); expect(useFirstRunStore.getState().draft.visionDraft).toEqual({ requested: false, chartRequested: true });
    store.setVisionChoice('create_now'); expect(useFirstRunStore.getState().draft.visionDraft).toEqual({ requested: true, chartRequested: false });
    store.setVisionChoice('vision_and_chart'); expect(useFirstRunStore.getState().draft.visionDraft).toEqual({ requested: true, chartRequested: true });
  });

  it('keeps a completed run complete, preventing replay after resume', () => {
    useFirstRunStore.getState().complete();
    expect(useFirstRunStore.getState().draft.currentStep).toBe('complete');
  });
});
