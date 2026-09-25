import { formFirstRunAnchor, invalidateFormation, useFirstRunStore } from '../firstRunStore';
import { buildOnboardingContext } from '@/services/v2/onboardingContext';

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

  it('keeps the motivation, outcome, multi-selects, and need for account save', () => {
    const store = useFirstRunStore.getState();
    store.setMotivation('Something else');
    store.setCustomDesiredChange('  I want more room to create  ');
    store.setDesiredOutcome('  I finish a personal project and share it.  ');
    store.toggleLifeChange('What I do every day');
    store.toggleLifeChange('Where I spend my time');
    store.setPrimaryNeed('Staying consistent');
    expect(buildOnboardingContext(useFirstRunStore.getState().draft)).toEqual({
      motivation: 'Something else',
      customAnswer: 'I want more room to create',
      desiredChange: 'I finish a personal project and share it.',
      lifeChanges: ['What I do every day', 'Where I spend my time'],
      primaryNeed: 'Staying consistent',
    });
    store.toggleLifeChange('What I do every day');
    expect(useFirstRunStore.getState().draft.lifeChanges).toEqual(['Where I spend my time']);
    store.setDesiredOutcome('');
    expect(useFirstRunStore.getState().draft.desiredOutcome).toBe('');
    expect(() => buildOnboardingContext(useFirstRunStore.getState().draft)).toThrow('Finish the onboarding questions');
  });
});

describe('adoptCreation', () => {
  it('keeps the Anchor the shared creation flow made, locally, for the end of onboarding', () => {
    const id = useFirstRunStore.getState().adoptCreation({
      intention: 'I finish the project',
      category: 'career',
      distilledLetters: ['F', 'N', 'S'],
      anchorSvg: '<svg/>',
      expression: 'cut_paper',
      styleChoice: 'ember_trace',
      enhancedImageUrl: 'https://assets.test/chosen.png',
    });
    const draft = useFirstRunStore.getState().draft;
    expect(draft.anchorLocalId).toBe(id);
    expect(draft).toMatchObject({ intention: 'I finish the project', anchorSvg: '<svg/>', expression: 'cutpaper', styleChoice: 'ember_trace', enhancedImageUrl: 'https://assets.test/chosen.png', anchorPersisted: false });
    // A second creation (the user went back) replaces it under the same local id.
    expect(useFirstRunStore.getState().adoptCreation({ intention: 'x', distilledLetters: ['X'], anchorSvg: '<svg/>', expression: 'original' })).toBe(id);
  });
});
