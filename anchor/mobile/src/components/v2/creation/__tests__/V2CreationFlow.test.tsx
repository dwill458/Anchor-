import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { V2CreationFlow, sanitizeIntention, type V2CreationFlowProps } from '../V2CreationFlow';
import { useCreationStore, type CreationDraft } from '@/stores/v2/creationStore';
import { distillIntention } from '@/utils/sigil/distillation';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { CATEGORY_TO_TIER } from '@/types';
import { CREATION_EXPRESSIONS, CREATION_MAX_INTENTION_LENGTH } from '@/constants/v2/creation';
import { useV2ReduceMotion } from '@/hooks/v2';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'),
  useV2ReduceMotion: jest.fn(() => true),
}));

const reduceMotion = useV2ReduceMotion as jest.MockedFunction<typeof useV2ReduceMotion>;
const INTENTION = 'I finish the project';
const LETTERS = distillIntention(INTENTION).finalLetters;
const STRUCTURE = generateTrueSigil(LETTERS, CATEGORY_TO_TIER.career, 'balanced').svg;

const draftAt = (overrides: Partial<CreationDraft>): CreationDraft => ({
  draftId: 'creation-1',
  clientRequestId: 'create-request-1',
  intention: INTENTION,
  normalizedIntention: INTENTION,
  category: 'career',
  distilledLetters: LETTERS,
  structureType: 'focused',
  structureSvg: STRUCTURE,
  expression: 'original',
  saveState: 'draft',
  saveAttempted: false,
  anchorPersisted: false,
  destination: '',
  destinationState: 'idle',
  currentStep: 'reveal',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const seed = (draft: CreationDraft | null) => act(() => useCreationStore.setState({ draft }));
const current = () => useCreationStore.getState().draft!;

function setup(overrides: Partial<V2CreationFlowProps> = {}) {
  const props: V2CreationFlowProps = {
    saveAnchor: jest.fn(async () => ({ anchorId: 'server-anchor-1' })),
    saveDestination: jest.fn(async () => undefined),
    onComplete: jest.fn(),
    onExit: jest.fn(),
    onPaywall: jest.fn(),
    onSignIn: jest.fn(),
    ...overrides,
  };
  const screen = render(<V2CreationFlow {...props} />);
  const layoutStage = () => {
    fireEvent(screen.getByTestId('creation-stage'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 420 } } });
    const rail = screen.queryByTestId('expression-rail');
    if (rail) fireEvent(rail, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 70 } } });
  };
  return { screen, props, layoutStage };
}

const SAVED = { saveState: 'saved', saveAttempted: true, anchorPersisted: true, persistedAnchorId: 'server-anchor-1' } as const;

/**
 * A saved draft is finished work and is never resumed on entry, so the saved state can only
 * be reached the way a user reaches it: from inside an open flow.
 */
function setupAtDestination(overrides: Partial<V2CreationFlowProps> = {}, draft: Partial<CreationDraft> = {}) {
  seed(draftAt({ currentStep: 'expression' }));
  const harness = setup(overrides);
  seed(draftAt({ currentStep: 'destination', ...SAVED, ...draft }));
  harness.layoutStage();
  return harness;
}

beforeEach(() => {
  reduceMotion.mockReturnValue(true);
  act(() => useCreationStore.setState({ draft: null }));
});

describe('V2CreationFlow — entry', () => {
  it('starts a fresh draft on the intention page', () => {
    const { screen } = setup();
    expect(screen.getByTestId('v2-creation-intention')).toBeTruthy();
    expect(current().currentStep).toBe('intention');
  });

  it('never resumes an Anchor that was already saved', () => {
    seed(draftAt({ anchorPersisted: true, persistedAnchorId: 'a', currentStep: 'destination' }));
    const { screen } = setup();
    expect(screen.getByTestId('v2-creation-intention')).toBeTruthy();
    expect(current().anchorPersisted).toBe(false);
    expect(current().intention).toBe('');
  });

  it('resumes unfinished work where it was', () => {
    seed(draftAt({ currentStep: 'reveal' }));
    const { screen } = setup();
    expect(screen.getByTestId('v2-creation-reveal')).toBeTruthy();
    expect(screen.getByText('This is your Anchor.')).toBeTruthy();
  });

  it('sanitizes pasted intentions to one bounded line', () => {
    expect(sanitizeIntention('I lead\nwith calm')).toBe('I lead with calm');
    expect(sanitizeIntention('x'.repeat(CREATION_MAX_INTENTION_LENGTH + 20))).toHaveLength(CREATION_MAX_INTENTION_LENGTH);
  });
});

describe('V2CreationFlow — intention → distillation → formation → reveal', () => {
  it('distils the real intention, forms the real structure, and reveals it', async () => {
    const { screen, layoutStage } = setup();
    fireEvent.changeText(screen.getByTestId('intention-input'), INTENTION);
    fireEvent.press(screen.getByTestId('intention-continue'));

    expect(current().currentStep).toBe('distillation');
    expect(current().distilledLetters).toEqual(LETTERS);
    expect(screen.getByText('Your words, taking shape.')).toBeTruthy();
    layoutStage();

    // Distillation hands itself to formation; formation draws the generator's own structure.
    await waitFor(() => expect(current().currentStep).toBe('formation'), { timeout: 4000 });
    expect(current().structureSvg).toBe(STRUCTURE);
    await waitFor(() => expect(current().currentStep).toBe('reveal'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByText('This is your Anchor.')).toBeTruthy());
    expect(screen.getByTestId('reveal-intention').props.children.join('')).toContain(INTENTION);
  });

  it('keeps the user on the intention page when it cannot be used', () => {
    const { screen } = setup();
    fireEvent.changeText(screen.getByTestId('intention-input'), '!!!');
    fireEvent.press(screen.getByTestId('intention-continue'));
    expect(current().currentStep).toBe('intention');
    expect(current().formationError).toBeTruthy();
  });

  it('lets a tap finish formation briskly instead of skipping it', async () => {
    reduceMotion.mockReturnValue(false);
    seed(draftAt({ currentStep: 'formation' }));
    const { screen, layoutStage } = setup();
    layoutStage();
    fireEvent.press(screen.getByTestId('formation-hurry'));
    await waitFor(() => expect(current().currentStep).toBe('reveal'), { timeout: 1500 });
  });
});

describe('V2CreationFlow — expression', () => {
  const atExpression = () => {
    seed(draftAt({ currentStep: 'expression' }));
    const harness = setup();
    harness.layoutStage();
    return harness;
  };

  it('previews every expression over the one stored structure', () => {
    const { screen } = atExpression();
    const preview = screen.getByTestId('expression-preview');
    const drawn = preview.findAll((node: { type: unknown }) => node.type === ('Path' as never)).map((node: { props: { d: string } }) => node.props.d);
    const structural = drawn.filter((d: string) => STRUCTURE.includes(`d="${d}"`));
    // Every expression layer draws the stored path byte for byte; only guides are extra.
    expect(structural.length).toBeGreaterThanOrEqual(CREATION_EXPRESSIONS.length);
    expect(new Set(structural).size).toBe(1);
  });

  it('changes appearance, never structure, as the rail moves', () => {
    const { screen, layoutStage } = atExpression();
    layoutStage();
    fireEvent.press(screen.getByTestId('expression-rail-item-foil', { includeHiddenElements: true }));
    expect(current().expression).toBe('foil');
    fireEvent.press(screen.getByTestId('expression-rail-item-ink', { includeHiddenElements: true }));
    expect(current().expression).toBe('ink');
    expect(current().structureSvg).toBe(STRUCTURE);
  });

  it('keeps the Anchor once, with the chosen expression, even on a double tap', async () => {
    let resolve!: (value: { anchorId: string }) => void;
    const saveAnchor = jest.fn((_input: { draft: CreationDraft; idempotencyKey: string }) => new Promise<{ anchorId: string }>((r) => { resolve = r; }));
    seed(draftAt({ currentStep: 'expression', expression: 'etched' }));
    const { screen } = setup({ saveAnchor });
    fireEvent.press(screen.getByTestId('expression-keep'));
    fireEvent.press(screen.getByTestId('expression-keep'));
    expect(saveAnchor).toHaveBeenCalledTimes(1);
    expect(saveAnchor.mock.calls[0][0]).toMatchObject({ idempotencyKey: 'create-request-1' });
    expect(saveAnchor.mock.calls[0][0].draft.expression).toBe('etched');
    await act(async () => resolve({ anchorId: 'server-anchor-1' }));
    expect(current().anchorPersisted).toBe(true);
    expect(current().currentStep).toBe('destination');
  });

  it('retries a failed save with the same key and no duplicate', async () => {
    const saveAnchor = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { failure: 'network' }))
      .mockResolvedValueOnce({ anchorId: 'server-anchor-1' });
    seed(draftAt({ currentStep: 'expression' }));
    const { screen } = setup({ saveAnchor });
    await act(async () => fireEvent.press(screen.getByTestId('expression-keep')));
    expect(current().saveState).toBe('error');
    expect(screen.getByText(/offline/i)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('expression-keep')));
    expect(saveAnchor).toHaveBeenCalledTimes(2);
    expect(saveAnchor.mock.calls[0][0].idempotencyKey).toBe(saveAnchor.mock.calls[1][0].idempotencyKey);
    expect(current().currentStep).toBe('destination');
  });

  it('sends a refused second Anchor to the paywall and keeps the draft', async () => {
    const saveAnchor = jest.fn().mockRejectedValue(Object.assign(new Error('pro'), { failure: 'second_anchor' }));
    seed(draftAt({ currentStep: 'expression' }));
    const { screen, props } = setup({ saveAnchor });
    await act(async () => fireEvent.press(screen.getByTestId('expression-keep')));
    expect(props.onPaywall).toHaveBeenCalledTimes(1);
    expect(current().anchorPersisted).toBe(false);
    expect(current().structureSvg).toBe(STRUCTURE);
    // Returning from the paywall offers Pro directly rather than re-asking the server.
    fireEvent.press(screen.getByTestId('expression-keep'));
    expect(props.onPaywall).toHaveBeenCalledTimes(2);
    expect(saveAnchor).toHaveBeenCalledTimes(1);
  });

  it('asks a signed-out user to sign in without losing the Anchor', async () => {
    const saveAnchor = jest.fn().mockRejectedValue(Object.assign(new Error('auth'), { failure: 'auth' }));
    seed(draftAt({ currentStep: 'expression' }));
    const { screen, props } = setup({ saveAnchor });
    await act(async () => fireEvent.press(screen.getByTestId('expression-keep')));
    fireEvent.press(screen.getByTestId('creation-sign-in'));
    expect(props.onSignIn).toHaveBeenCalled();
    expect(current().structureSvg).toBe(STRUCTURE);
  });
});

describe('V2CreationFlow — destination and hand-off', () => {
  const atDestination = () => setupAtDestination({}, { expression: 'foil' });

  it('saves the destination against the saved Anchor, then hands the Anchor to Home', async () => {
    const { screen, props } = atDestination();
    fireEvent.changeText(screen.getByTestId('destination-input'), 'I walk out of the review proud of the work.');
    await act(async () => fireEvent.press(screen.getByTestId('destination-submit')));
    expect(props.saveDestination).toHaveBeenCalledWith({ anchorId: 'server-anchor-1', description: 'I walk out of the review proud of the work.' });
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(props.onComplete).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'server-anchor-1', svg: STRUCTURE, expression: 'foil', category: 'career' }));
  });

  it('can be skipped, and still arrives on Home exactly once', async () => {
    const { screen, props } = atDestination();
    fireEvent.press(screen.getByTestId('destination-skip'));
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 400));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(props.saveDestination).not.toHaveBeenCalled();
  });

  it('keeps the words and offers a retry when the destination fails to save', async () => {
    const saveDestination = jest.fn().mockRejectedValue(new Error('offline'));
    const { screen, props } = setupAtDestination({ saveDestination });
    fireEvent.changeText(screen.getByTestId('destination-input'), 'I walk out of the review proud of the work.');
    await act(async () => fireEvent.press(screen.getByTestId('destination-submit')));
    expect(current().destinationState).toBe('error');
    expect(current().destination).toBe('I walk out of the review proud of the work.');
    expect(props.onComplete).not.toHaveBeenCalled();
  });
});

describe('V2CreationFlow — back', () => {
  it('walks back deterministically and leaves from the first page', () => {
    seed(draftAt({ currentStep: 'expression' }));
    const { screen, props } = setup();
    fireEvent.press(screen.getByTestId('creation-back'));
    expect(current().currentStep).toBe('reveal');
    fireEvent.press(screen.getByTestId('creation-back'));
    expect(current().currentStep).toBe('intention');
    expect(current().intention).toBe(INTENTION);
    expect(props.onExit).not.toHaveBeenCalled();
  });

  it('routes Android back through the same state machine', () => {
    const listeners: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return { remove: jest.fn() } as never;
    });
    seed(draftAt({ currentStep: 'reveal' }));
    const { props } = setup();
    const press = () => act(() => { listeners[listeners.length - 1](); });
    press();
    expect(current().currentStep).toBe('intention');
    press();
    expect(props.onExit).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('holds Back while the Anchor is being saved and after it exists', () => {
    const { screen } = setupAtDestination();
    expect(screen.queryByTestId('creation-back')).toBeNull();
    act(() => { useCreationStore.getState().goBack(); });
    expect(current().currentStep).toBe('destination');
  });
});
