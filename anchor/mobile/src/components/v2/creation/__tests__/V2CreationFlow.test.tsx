import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { V2CreationFlow } from '../V2CreationFlow';
import { useCreationStore, type CreationDraft } from '@/stores/v2/creationStore';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

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
      setDraft({ currentStep: 'intention', intention: '', category: 'focus' });
      const { getByText, getByPlaceholderText } = render(<V2CreationFlow />);

      expect(getByText('INTENTION')).toBeTruthy();
      expect(getByText('Every Anchor starts here.')).toBeTruthy();
      expect(getByText('Write one clear intention.')).toBeTruthy();
      expect(getByText('YOUR INTENTION')).toBeTruthy();
      expect(getByText('0/140')).toBeTruthy();
      expect(getByPlaceholderText('I am fully present with my work.')).toBeTruthy();
      expect(getByText(/Instead of/)).toBeTruthy();
      expect(getByText('“I want to stop getting distracted.”')).toBeTruthy();
      expect(getByText('“I am fully present with my work.”')).toBeTruthy();
      expect(getByText('SHORT · PRESENT · FELT')).toBeTruthy();
      expect(getByText('Continue →')).toBeTruthy();
    });

    it('shows validation error when Continue is pressed with empty intention', () => {
      setDraft({ currentStep: 'intention', intention: '   ' });
      const { getByText, queryByText } = render(<V2CreationFlow />);

      expect(queryByText('Write one clear intention to continue.')).toBeNull();
      fireEvent.press(getByText('Continue →'));
      expect(getByText('Write one clear intention to continue.')).toBeTruthy();
    });

    it('opens and closes the Principles bottom sheet', () => {
      setDraft({ currentStep: 'intention', intention: '' });
      const { getByLabelText, getByText, queryByText } = render(<V2CreationFlow />);

      expect(queryByText('Short · Present · Felt')).toBeNull();
      fireEvent.press(getByLabelText('About these principles'));
      expect(getByText('Short · Present · Felt')).toBeTruthy();
      expect(getByText('One intention. One direction.')).toBeTruthy();

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
