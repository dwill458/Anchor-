import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { V2CreationFlow, sanitizeIntention, type V2CreationFlowProps } from '../V2CreationFlow';
import { useCreationStore, type CreationDraft } from '@/stores/v2/creationStore';
import { distillIntention } from '@/utils/sigil/distillation';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { CATEGORY_TO_TIER } from '@/types';
import { CREATION_MAX_INTENTION_LENGTH } from '@/constants/v2/creation';
import { useCreationReduceMotion, useV2ReduceMotion } from '@/hooks/v2';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'),
  useV2ReduceMotion: jest.fn(() => true),
  useCreationReduceMotion: jest.fn(() => true),
}));

const reduceMotion = useCreationReduceMotion as jest.MockedFunction<typeof useCreationReduceMotion>;

const INTENTION = 'I finish the project';
const LETTERS = distillIntention(INTENTION).finalLetters;
const STRUCTURE = generateTrueSigil(LETTERS, CATEGORY_TO_TIER.career, 'balanced').svg;
const CANDIDATES = [
  { imageUrl: 'https://assets.test/anchor-a.png', variationId: 'a', structurePreserved: true },
  { imageUrl: 'https://assets.test/anchor-b.png', variationId: 'b', structurePreserved: true },
];

const draftAt = (overrides: Partial<CreationDraft>): CreationDraft => ({
  draftId: 'creation-1', clientRequestId: 'create-request-1', intention: INTENTION, normalizedIntention: INTENTION,
  category: 'career', distilledLetters: LETTERS, structureType: 'focused', structureSvg: STRUCTURE, expression: 'original',
  generatedCandidates: [], selectedCandidateIndex: 0, generationState: 'idle', saveState: 'draft', saveAttempted: false,
  anchorPersisted: false, currentStep: 'reveal', updatedAt: new Date().toISOString(), ...overrides,
});

const seed = (draft: CreationDraft | null) => act(() => useCreationStore.setState({ draft }));
const current = () => useCreationStore.getState().draft!;

function setup(overrides: Partial<V2CreationFlowProps> = {}) {
  const props: V2CreationFlowProps = {
    saveAnchor: jest.fn(async () => ({ anchorId: 'server-anchor-1' })),
    generateExpression: jest.fn(async () => ({ candidates: CANDIDATES })),
    onComplete: jest.fn(), onExit: jest.fn(), onPaywall: jest.fn(), onSignIn: jest.fn(), ...overrides,
  };
  const screen = render(<V2CreationFlow {...props} />);
  const layoutStage = () => fireEvent(screen.getByTestId('creation-stage'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 420 } } });
  return { screen, props, layoutStage };
}

beforeEach(() => {
  reduceMotion.mockReturnValue(true);
  act(() => useCreationStore.setState({ draft: null }));
});

describe('V2CreationFlow', () => {
  it('starts at intention and preserves the established guidance', () => {
    const { screen } = setup();
    expect(screen.getByTestId('v2-creation-intention')).toBeTruthy();
    expect(screen.getByText('Every Anchor starts')).toBeTruthy();
    expect(screen.getByText('SHORT')).toBeTruthy();
  });

  it('sanitizes pasted intentions', () => {
    expect(sanitizeIntention('I lead\nwith calm')).toBe('I lead with calm');
    expect(sanitizeIntention('x'.repeat(CREATION_MAX_INTENTION_LENGTH + 20))).toHaveLength(CREATION_MAX_INTENTION_LENGTH);
  });

  it('distils the real intention and forms the real deterministic structure', async () => {
    const { screen, layoutStage } = setup();
    fireEvent.changeText(screen.getByTestId('intention-input'), INTENTION);
    fireEvent.press(screen.getByTestId('intention-continue'));
    expect(current().distilledLetters).toEqual(LETTERS);
    layoutStage();
    await waitFor(() => expect(current().currentStep).toBe('formation'), { timeout: 3000 });
    expect(current().structureSvg).toBe(STRUCTURE);
    await waitFor(() => expect(current().currentStep).toBe('reveal'), { timeout: 3000 });
    expect(screen.getByText('This is your Anchor.')).toBeTruthy();
    expect(screen.getByTestId('reveal-intention').props.children.join('')).toContain(INTENTION);
  });

  it('keeps the original structure without calling generation', async () => {
    seed(draftAt({ currentStep: 'expression' }));
    const { screen, props } = setup();
    await act(async () => fireEvent.press(screen.getByTestId('expression-keep')));
    expect(props.generateExpression).not.toHaveBeenCalled();
    expect(props.saveAnchor).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ expression: 'original', enhancedImageUrl: undefined }) }));
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('offers the full expression library with the structure itself in every choice', () => {
    seed(draftAt({ currentStep: 'expression' }));
    const { screen } = setup();
    // Library styles beyond the six the old screen showed.
    expect(screen.getByTestId('expression-style-cosmic')).toBeTruthy();
    expect(screen.getByTestId('expression-style-obsidian_mono')).toBeTruthy();
    expect(screen.getByText('YOUR STRUCTURE')).toBeTruthy();
    expect(screen.getByText('The structure stays the same. Its expression changes.')).toBeTruthy();
  });

  it('starts generation only after an expression is explicitly selected', async () => {
    seed(draftAt({ currentStep: 'expression' }));
    const generateExpression = jest.fn(async () => ({ candidates: CANDIDATES, metadata: { styleApplied: 'architectural_trace' } }));
    const { screen, props, layoutStage } = setup({ generateExpression });
    expect(generateExpression).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('expression-style-architectural_trace'));
    expect(current().expression).toBe('architectural');
    expect(current().styleChoice).toBe('architectural_trace');
    fireEvent.press(screen.getByTestId('expression-generate'));
    expect(current().currentStep).toBe('generating');
    expect(generateExpression).toHaveBeenCalledWith(expect.objectContaining({ count: 2, generationAttempt: 1 }));
    await waitFor(() => expect(current().currentStep).toBe('choose'), { timeout: 3000 });
    layoutStage();
    expect(generateExpression).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Choose your Anchor.')).toBeTruthy();
    expect(screen.getByTestId('candidate-0')).toBeTruthy();
    expect(screen.getByTestId('candidate-1')).toBeTruthy();
    // Nothing is kept until the user chooses.
    expect(screen.getByTestId('choose-keep').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('candidate-1'));
    expect(current().selectedCandidateIndex).toBe(1);
    await act(async () => fireEvent.press(screen.getByTestId('choose-keep')));
    expect(props.saveAnchor).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ enhancedImageUrl: CANDIDATES[1].imageUrl, structureSvg: STRUCTURE }) }));
  });

  it('keeps a finished interpretation and asks only for the missing one', async () => {
    seed(draftAt({ currentStep: 'expression', expression: 'architectural', styleChoice: 'architectural_trace' }));
    const generateExpression = jest.fn()
      .mockResolvedValueOnce({ candidates: [CANDIDATES[0]] })
      .mockResolvedValueOnce({ candidates: [CANDIDATES[1]] });
    const { screen } = setup({ generateExpression });
    fireEvent.press(screen.getByTestId('expression-generate'));
    await waitFor(() => expect(current().generationState).toBe('error'), { timeout: 3000 });
    expect(current().generatedCandidates).toEqual([CANDIDATES[0]]);
    expect(screen.getByText('One interpretation is ready. The second did not finish. Try again for the second.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('generation-retry'));
    expect(generateExpression).toHaveBeenLastCalledWith(expect.objectContaining({ count: 1 }));
    await waitFor(() => expect(current().currentStep).toBe('choose'), { timeout: 3000 });
    expect(current().generatedCandidates).toEqual(CANDIDATES);
  });

  it('preserves the canonical structure when generation fails and retries cleanly', async () => {
    seed(draftAt({ currentStep: 'expression', expression: 'architectural' }));
    const generateExpression = jest.fn().mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ candidates: CANDIDATES });
    const { screen } = setup({ generateExpression });
    fireEvent.press(screen.getByTestId('expression-generate'));
    await waitFor(() => expect(current().generationState).toBe('error'), { timeout: 3000 });
    expect(current().structureSvg).toBe(STRUCTURE);
    fireEvent.press(screen.getByTestId('generation-retry'));
    await waitFor(() => expect(current().currentStep).toBe('choose'), { timeout: 3000 });
    expect(generateExpression).toHaveBeenCalledTimes(2);
  });

  it('never locks Keep after a sign-in failure on the choice', async () => {
    seed(draftAt({ currentStep: 'choose', expression: 'architectural', styleChoice: 'architectural_trace', generatedCandidates: CANDIDATES, generationState: 'complete', selectedCandidateIndex: 1, enhancedImageUrl: CANDIDATES[1].imageUrl }));
    const saveAnchor = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('auth'), { failure: 'auth' }))
      .mockResolvedValueOnce({ anchorId: 'server-anchor-1' });
    const { screen, props, layoutStage } = setup({ saveAnchor });
    layoutStage();
    await act(async () => fireEvent.press(screen.getByTestId('choose-keep')));
    expect(current().saveFailure).toBe('auth');
    expect(screen.getByTestId('choose-sign-in')).toBeTruthy();
    // Back from signing in, Keep still works and saves the chosen interpretation.
    expect(screen.getByTestId('choose-keep').props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => fireEvent.press(screen.getByTestId('choose-keep')));
    expect(saveAnchor).toHaveBeenCalledTimes(2);
    expect(current().anchorPersisted).toBe(true);
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('walks back from choose to expression without discarding candidates', () => {
    seed(draftAt({ currentStep: 'choose', expression: 'architectural', generatedCandidates: CANDIDATES, generationState: 'complete' }));
    const { screen } = setup();
    fireEvent.press(screen.getByTestId('creation-back'));
    expect(current().currentStep).toBe('expression');
    expect(current().generatedCandidates).toEqual(CANDIDATES);
  });

  it('routes Android back through the same state machine', () => {
    const listeners: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return { remove: jest.fn() } as never;
    });
    seed(draftAt({ currentStep: 'reveal' }));
    const { props } = setup();
    act(() => listeners[listeners.length - 1]());
    expect(current().currentStep).toBe('intention');
    act(() => listeners[listeners.length - 1]());
    expect(props.onExit).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
