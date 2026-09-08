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
});
