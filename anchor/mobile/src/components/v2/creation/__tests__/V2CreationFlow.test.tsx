import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { V2CreationFlow } from '../V2CreationFlow';
import { buildDistillationRenderModel } from '../distillationMotion';
import { structureSvgForDraft, useCreationStore, type CreationDraft } from '@/stores/v2/creationStore';
import { sanitizeIntention } from '../V2CreationFlow';
import { distillIntention } from '@/utils/sigil/distillation';
import { useV2ReduceMotion } from '@/hooks/v2';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'),
  useV2ReduceMotion: jest.fn(() => false),
}));

const reduceMotion = useV2ReduceMotion as jest.MockedFunction<typeof useV2ReduceMotion>;

const baseDraft = (overrides: Partial<CreationDraft> = {}): CreationDraft => ({
  draftId: 'draft-1',
  clientRequestId: 'request-1',
  intention: 'I finish the project',
  normalizedIntention: 'I finish the project',
  category: 'career',
  distilledLetters: ['F', 'N', 'S', 'H', 'T', 'P', 'R', 'J', 'C'],
  structureType: 'focused',
  structureSvg: '<svg viewBox="0 0 100 100"><path d="M10 10" stroke="currentColor"/></svg>',
  expression: 'foil',
  generationState: 'idle',
  saveState: 'draft',
  anchorPersisted: false,
  currentStep: 'intention',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const setDraft = (overrides: Partial<CreationDraft> = {}) =>
  act(() => {
    useCreationStore.setState({ draft: baseDraft(overrides) });
  });

afterEach(() => {
  act(() => useCreationStore.setState({ draft: null }));
  reduceMotion.mockReturnValue(false);
});

/**
 * Letter Distillation is one continuous transformation of the phrase the user just wrote,
 * so these assertions follow what is on screen over time rather than a single snapshot.
 */
describe('V2CreationFlow — Letter Distillation', () => {
  const INTENTION = 'I build the business I envision';
  const atDistillation = () =>
    setDraft({
      currentStep: 'distillation',
      intention: INTENTION,
      normalizedIntention: INTENTION,
      distilledLetters: distillIntention(INTENTION).finalLetters,
      structureType: undefined,
      structureSvg: undefined,
    });

  const status = (screen: ReturnType<typeof render>) =>
    screen.getByTestId('distillation-status').props.children;

  it('opens on the intention itself, not on a finished result', () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);

    // The phrase is the animation object, so every character of it is mounted up front.
    const phrase = screen.getByTestId('distillation-phrase');
    expect(phrase).toBeTruthy();
    expect(phrase.props.accessibilityLabel).toBe(INTENTION);
    expect(status(screen)).toBe('Starting with your intention');
    // The distilled letters are not presented yet — they have to be watched being made.
    expect(screen.queryByText('T H B S')).toBeNull();
  });

  it('narrates each reduction pass in order instead of jumping to the result', async () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);

    await waitFor(() => expect(status(screen)).toBe('Removing vowels'), { timeout: 9000 });
    await waitFor(() => expect(status(screen)).toBe('Removing repeated letters'), { timeout: 9000 });
    await waitFor(() => expect(status(screen)).toBe('Keeping each remaining letter, in order'), { timeout: 9000 });
  });

  it('holds the flow until the letters settle, then opens onto Choose Structure', async () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);

    // Nothing advances on its own, and the action stays shut while the reduction plays.
    const cta = screen.getByTestId('distillation-continue');
    expect(screen.getByText(/Distilling/)).toBeTruthy();
    expect(cta.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(cta);
    expect(useCreationStore.getState().draft?.currentStep).toBe('distillation');

    await waitFor(() => expect(screen.getByText('Choose structure')).toBeTruthy(), { timeout: 9000 });
    expect(useCreationStore.getState().draft?.currentStep).toBe('distillation');

    fireEvent.press(screen.getByTestId('distillation-continue'));
    expect(useCreationStore.getState().draft?.currentStep).toBe('structure');
  });

  it('names the settled form once the letters have landed', async () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);

    await waitFor(() => expect(screen.getByText('DISTILLED FORM')).toBeTruthy(), { timeout: 9000 });
    expect(screen.getByText('These letters become the source material for your Anchor.')).toBeTruthy();
    // The headline moves exactly once, and never shows both states at the same time.
    expect(screen.getByText('The form beneath the words.')).toBeTruthy();
    expect(screen.queryByText('Your words, taking shape.')).toBeNull();
  });

  it('settles immediately when the user has asked for reduced motion', async () => {
    reduceMotion.mockReturnValue(true);
    atDistillation();
    const screen = render(<V2CreationFlow />);

    // No cascade to sit through: the result and the explanation are available at once.
    await waitFor(() => expect(screen.getByText('Choose structure')).toBeTruthy(), { timeout: 1000 });
    expect(screen.getByText('DISTILLED FORM')).toBeTruthy();
  });

  it('walks back to the intention with the text intact', async () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);
    await waitFor(() => expect(screen.getByText('Choose structure')).toBeTruthy(), { timeout: 9000 });

    fireEvent.press(screen.getByLabelText('Go back'));
    const draft = useCreationStore.getState().draft;
    expect(draft?.currentStep).toBe('intention');
    expect(draft?.intention).toBe(INTENTION);
    expect(screen.getByTestId('intention-input').props.value).toBe(INTENTION);
  });

  it('recomputes the distilled letters when the intention is edited', () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);

    fireEvent.press(screen.getByLabelText('Go back'));
    fireEvent.changeText(screen.getByTestId('intention-input'), 'I run every morning');

    // Editing the intention invalidates the prior distillation rather than keeping it.
    expect(useCreationStore.getState().draft?.distilledLetters).toBeUndefined();

    fireEvent.press(screen.getByLabelText('Continue to distillation'));
    expect(useCreationStore.getState().draft?.distilledLetters).toEqual(
      distillIntention('I run every morning').finalLetters,
    );
  });

  it('hands the generator the exact sequence the user watched settle', async () => {
    atDistillation();
    const screen = render(<V2CreationFlow />);
    await waitFor(() => expect(screen.getByText('Choose structure')).toBeTruthy(), { timeout: 9000 });

    // What the animation leaves on screen is the production algorithm's output, not a
    // second opinion computed for display.
    const onScreen = buildDistillationRenderModel(INTENTION).keptLetters;
    expect(onScreen).toEqual(useCreationStore.getState().draft?.distilledLetters);

    fireEvent.press(screen.getByTestId('distillation-continue'));
    fireEvent.press(screen.getByLabelText(/^Contained structure/));

    const draft = useCreationStore.getState().draft;
    expect(draft?.distilledLetters).toEqual(onScreen);
    expect(draft?.structureSvg).toBe(structureSvgForDraft({ ...draft!, structureSvg: undefined }));
  });
});

describe('V2CreationFlow', () => {
  it('renders every step of the flow on the real V2 screen shell', () => {
    const steps: CreationDraft['currentStep'][] = [
      'intention', 'distillation', 'structure', 'draw', 'expression', 'generation', 'candidates', 'save', 'continue',
    ];
    for (const currentStep of steps) {
      setDraft({
        currentStep,
        structureType: currentStep === 'draw' ? 'drawn' : 'focused',
        drawnPaths: currentStep === 'draw' ? [] : undefined,
        candidates: currentStep === 'candidates' || currentStep === 'save'
          ? [
              { id: 'c1', structureSvg: '<svg/>', expression: 'foil' },
              { id: 'c2', structureSvg: '<svg/>', expression: 'original' },
            ]
          : undefined,
        selectedCandidateId: currentStep === 'save' ? 'c1' : undefined,
        persistedAnchorId: currentStep === 'continue' ? 'anchor-1' : undefined,
        saveState: currentStep === 'continue' ? 'saved' : 'draft',
      });
      const { getByTestId, unmount } = render(<V2CreationFlow />);
      expect(getByTestId(`v2-creation-${currentStep}`)).toBeTruthy();
      unmount();
    }
  });

  it('rejects a generation adapter that does not return exactly two candidates', async () => {
    setDraft({ currentStep: 'expression', expression: 'foil' });
    const generateCandidates = jest.fn().mockResolvedValue([
      { id: 'a', structureSvg: '<svg/>', expression: 'foil' },
      { id: 'b', structureSvg: '<svg/>', expression: 'ink' },
      { id: 'c', structureSvg: '<svg/>', expression: 'original' },
    ]);
    const { getByText } = render(<V2CreationFlow generateCandidates={generateCandidates} />);
    fireEvent.press(getByText('Generate two forms'));

    await waitFor(() => expect(getByText(/Generation could not finish/)).toBeTruthy());
    expect(useCreationStore.getState().draft?.candidates).toBeUndefined();
  });

  it('produces exactly two candidates from the built-in fallback', async () => {
    setDraft({ currentStep: 'expression', expression: 'foil' });
    const { getByText } = render(<V2CreationFlow />);
    fireEvent.press(getByText('Generate two forms'));
    await waitFor(() => expect(useCreationStore.getState().draft?.candidates).toHaveLength(2));
    const [one, two] = useCreationStore.getState().draft!.candidates!;
    // One structure, two finishes — geometry is shared, never regenerated per candidate.
    expect(one.structureSvg).toBe(two.structureSvg);
    expect(one.expression).not.toBe(two.expression);
  });

  it('does not persist a duplicate Anchor when Save is pressed twice', async () => {
    setDraft({
      currentStep: 'candidates',
      candidates: [
        { id: 'c1', structureSvg: '<svg/>', expression: 'foil' },
        { id: 'c2', structureSvg: '<svg/>', expression: 'original' },
      ],
      selectedCandidateId: 'c1',
    });
    let resolveSave: (value: { anchorId: string }) => void = () => undefined;
    const saveAnchor = jest.fn().mockImplementation(
      () => new Promise<{ anchorId: string }>((resolve) => { resolveSave = resolve; }),
    );
    const { getByText } = render(<V2CreationFlow saveAnchor={saveAnchor} />);

    fireEvent.press(getByText('Save Anchor'));
    fireEvent.press(getByText('Save Anchor'));
    await act(async () => { resolveSave({ anchorId: 'anchor-9' }); });

    expect(saveAnchor).toHaveBeenCalledTimes(1);
    expect(saveAnchor.mock.calls[0][0].idempotencyKey).toBe('request-1');
    expect(useCreationStore.getState().draft?.persistedAnchorId).toBe('anchor-9');
  });

  it('routes each post-save continuation with its own intent and the saved anchor id', () => {
    setDraft({ currentStep: 'continue', saveState: 'saved', anchorPersisted: true, persistedAnchorId: 'anchor-7' });
    const onContinue = jest.fn();
    const { getByText } = render(<V2CreationFlow onContinue={onContinue} />);

    fireEvent.press(getByText('Return to Anchor'));
    fireEvent.press(getByText('Add a Vision'));
    fireEvent.press(getByText('Create a Chart'));
    fireEvent.press(getByText('Add Vision and Chart'));

    expect(onContinue.mock.calls.map((call) => call[0])).toEqual([
      { type: 'home', anchorId: 'anchor-7' },
      { type: 'vision', anchorId: 'anchor-7' },
      { type: 'chart', anchorId: 'anchor-7' },
      { type: 'vision_and_chart', anchorId: 'anchor-7' },
    ]);
  });

  it('offers Chart without requiring a Vision first', () => {
    setDraft({ currentStep: 'continue', saveState: 'saved', anchorPersisted: true, persistedAnchorId: 'anchor-7' });
    const onContinue = jest.fn();
    const { getByText } = render(<V2CreationFlow onContinue={onContinue} />);
    fireEvent.press(getByText('Create a Chart'));
    expect(onContinue).toHaveBeenCalledWith({ type: 'chart', anchorId: 'anchor-7' });
  });

  describe('intention step visual & behavior', () => {
    it('renders the intention screen with full visual hierarchy and category hint', () => {
      setDraft({ currentStep: 'intention', intention: '', category: 'focus' as any });
      const { getByText, queryByText, getByPlaceholderText } = render(<V2CreationFlow />);

      expect(getByText('INTENTION')).toBeTruthy();
      expect(getByText('Every Anchor starts')).toBeTruthy();
      expect(getByText('here.')).toBeTruthy();
      expect(getByText('Write one clear intention.')).toBeTruthy();
      expect(getByText('YOUR INTENTION')).toBeTruthy();
      expect(getByText('0/140')).toBeTruthy();
      expect(getByPlaceholderText('I am fully present with my work.')).toBeTruthy();
      expect(getByText(/Instead of/)).toBeTruthy();
      expect(getByText('“I want to stop getting distracted.”')).toBeTruthy();
      expect(getByText('“I am fully present with my work.”')).toBeTruthy();
      expect(getByText('SHORT')).toBeTruthy();
      expect(getByText('PRESENT')).toBeTruthy();
      expect(getByText('FELT')).toBeTruthy();
      expect(getByText('Three rules for a stronger intention.')).toBeTruthy();
      // The three principle explanations are progressive disclosure now, not on the main screen.
      expect(queryByText('One clear direction.')).toBeNull();
      expect(getByText('Continue →')).toBeTruthy();
    });

    it('disables Continue until there is an intention, and does not advance when pressed empty', () => {
      setDraft({ currentStep: 'intention', intention: '   ' });
      const { getByText, getByLabelText, getByTestId } = render(<V2CreationFlow />);

      expect(getByLabelText('Continue to distillation').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(getByText('Continue →'));
      expect(getByTestId('v2-creation-intention')).toBeTruthy();
    });

    it('cannot exceed 140 characters, even by paste', () => {
      setDraft({ currentStep: 'intention', intention: '' });
      const { getByTestId } = render(<V2CreationFlow />);
      act(() => { fireEvent.changeText(getByTestId('intention-input'), 'a'.repeat(300)); });
      expect(useCreationStore.getState().draft?.intention).toHaveLength(140);
      expect(getByTestId('intention-input').props.maxLength).toBe(140);
      expect(sanitizeIntention('I am\nfocused\r\nnow')).toBe('I am focused now');
    });

    it('accepts an intention between 101 and 140 characters', () => {
      setDraft({ currentStep: 'intention', intention: '' });
      const { getByText, getByTestId } = render(<V2CreationFlow />);
      act(() => { fireEvent.changeText(getByTestId('intention-input'), `I am ${'focused and present '.repeat(6)}`.trim()); });
      expect(useCreationStore.getState().draft!.intention.length).toBeGreaterThan(100);
      fireEvent.press(getByText('Continue →'));
      expect(getByTestId('v2-creation-distillation')).toBeTruthy();
    });

    it('shows quiet live guidance without any error state', () => {
      setDraft({ currentStep: 'intention', intention: 'I am fully present with my work.' });
      const { getByLabelText } = render(<V2CreationFlow />);
      expect(getByLabelText(/Looks good: short, present./)).toBeTruthy();
    });

    it('opens and closes the Principles bottom sheet', () => {
      setDraft({ currentStep: 'intention', intention: '' });
      const { getByLabelText, getByText, queryByText } = render(<V2CreationFlow />);

      expect(queryByText('Short · Present · Felt')).toBeNull();
      fireEvent.press(getByLabelText(/About these principles/));
      expect(getByText('Short · Present · Felt')).toBeTruthy();
      expect(getByText('One intention. One direction.')).toBeTruthy();
      expect(getByText('Write it as true now, not as something you’re trying to escape.')).toBeTruthy();

      fireEvent.press(getByText('Got it'));
      expect(queryByText('Short · Present · Felt')).toBeNull();
    });

    it('shows word count guidance warning when intention exceeds 14 words', () => {
      const longIntention = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';
      setDraft({ currentStep: 'intention', intention: longIntention });
      const { getByText } = render(<V2CreationFlow />);

      expect(getByText('Keep it short enough to hold in mind.')).toBeTruthy();
    });

    it('transitions to distillation when Continue is pressed with valid intention', () => {
      setDraft({ currentStep: 'intention', intention: 'I compete with calm confidence' });
      const { getByText, getByTestId } = render(<V2CreationFlow />);

      fireEvent.press(getByText('Continue →'));
      expect(getByTestId('v2-creation-distillation')).toBeTruthy();
    });
  });
});
