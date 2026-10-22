import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { V2ReleaseEnding } from '@/adapters/v2/release';
import { RELEASE_ENDINGS, RELEASE_ENDING_REDUCED_MS, RELEASE_ENDING_SCENE_END_MS, RELEASE_ENDING_SETTLE_MS } from '@/constants/v2/release';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';

const mockPlayCreationSound = jest.fn((_key: string) => ({ stop: jest.fn() }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (key: string) => mockPlayCreationSound(key) }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(() => Promise.resolve()), selection: jest.fn(), notification: jest.fn() },
}));

// eslint-disable-next-line import/first
import { safeHaptics } from '@/utils/haptics';
// eslint-disable-next-line import/first
import { V2ReleaseCompletion } from '../V2ReleaseCompletion';

const intention = 'Publish my novel';
const ending = (overrides: Partial<V2ReleaseEnding> = {}): V2ReleaseEnding => ({
  ...RELEASE_ENDINGS.no_longer_aligned,
  reason: 'no_longer_aligned',
  intentionText: intention,
  successor: null,
  secondary: RELEASE_ENDINGS.no_longer_aligned.secondary ?? null,
  ...overrides,
});
const destination = (): V2ReleaseEnding => ({
  ...RELEASE_ENDINGS.destination_completed,
  reason: 'destination_completed',
  intentionText: intention,
  successor: null,
  secondary: RELEASE_ENDINGS.destination_completed.secondary ?? null,
});

const exhaleCount = () => mockPlayCreationSound.mock.calls.filter(([key]) => key === 'releaseResolve').length;
const hapticCalls = () => jest.mocked(safeHaptics.impact).mock.calls;
const actionsPointerEvents = (view: ReturnType<typeof render>) =>
  view.getByTestId('v2-release-completion-actions', { includeHiddenElements: true }).props.pointerEvents;
const circle = (view: ReturnType<typeof render>) => view.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('Circle' as never))[0];
const endingActive = () => useCelebrationStore.getState().active;

function renderEnding(props: Partial<React.ComponentProps<typeof V2ReleaseCompletion>> = {}) {
  const onAction = jest.fn();
  const view = render(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} {...props} />);
  return { view, onAction };
}

describe('V2ReleaseCompletion: the ending scene', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useCelebrationStore.getState().reset();
    mockPlayCreationSound.mockClear();
    jest.mocked(safeHaptics.impact).mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('opens the paper as a circle from the artwork centre, starting at radius zero', () => {
    const { view } = renderEnding({ artworkRect: { x: 100, y: 200, width: 200, height: 200 } });
    const node = circle(view);
    expect(node.props.cx).toBe(200);
    expect(node.props.cy).toBe(300);
    expect(node.props.r.value).toBe(0);
    expect(view.queryByTestId('v2-release-completion-paper')).toBeNull();
    expect(view.getByTestId('v2-release-completion-reveal')).toBeTruthy();
  });

  it('falls back to the screen centre when the artwork rect is missing', () => {
    const { width, height } = Dimensions.get('window');
    const { view } = renderEnding({ artworkRect: null });
    expect(circle(view).props.cx).toBe(width / 2);
    expect(circle(view).props.cy).toBe(height / 2);
  });

  it('keeps the buttons disabled until the paper settles, then enables them', () => {
    const { view, onAction } = renderEnding({ artworkRect: { x: 100, y: 200, width: 200, height: 200 } });
    expect(actionsPointerEvents(view)).toBe('none');
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS - 1));
    expect(actionsPointerEvents(view)).toBe('none');
    fireEvent.press(view.getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
    expect(onAction).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(actionsPointerEvents(view)).toBe('auto');
    fireEvent.press(view.getByTestId('v2-release-completion-primary'));
    expect(onAction).toHaveBeenCalledWith('home');
  });

  it('plays the exhale once and a Light haptic once, at the settle, and never twice', () => {
    renderEnding();
    expect(exhaleCount()).toBe(0);
    expect(hapticCalls()).toHaveLength(0);
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS));
    expect(mockPlayCreationSound).toHaveBeenCalledWith('releaseResolve');
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toEqual([[Haptics.ImpactFeedbackStyle.Light]]);
    // The scene outlives the settle: it stays active and skippable until the last text has revealed.
    expect(endingActive()).toMatchObject({ level: 3, skippable: true });
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SCENE_END_MS - RELEASE_ENDING_SETTLE_MS));
    expect(endingActive()).toBeNull();
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toHaveLength(1);
  });

  it('is a skippable Level 3 scene: a tap lands it on the settled state with one exhale and one haptic', () => {
    const { view, onAction } = renderEnding();
    expect(endingActive()).toMatchObject({ id: 'release-ending:release', level: 3, skippable: true });
    fireEvent.press(view.getByLabelText('Skip'));
    expect(actionsPointerEvents(view)).toBe('auto');
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toEqual([[Haptics.ImpactFeedbackStyle.Light]]);
    expect(endingActive()).toBeNull();
    expect(view.queryByLabelText('Skip')).toBeNull();
    fireEvent.press(view.getByTestId('v2-release-completion-primary'));
    expect(onAction).toHaveBeenCalledWith('home');
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toHaveLength(1);
  });

  it('a higher scene preempting the ending lands it on its settled state, once', () => {
    const { view } = renderEnding();
    act(() => { useCelebrationStore.getState().request(4, 'other-major-scene'); });
    expect(actionsPointerEvents(view)).toBe('auto');
    expect(exhaleCount()).toBe(1);
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toHaveLength(1);
  });

  it('waits behind a higher scene and starts when that scene finishes', () => {
    useCelebrationStore.getState().request(4, 'other-major-scene');
    const { view } = renderEnding();
    expect(endingActive()?.id).toBe('other-major-scene');
    expect(view.queryByLabelText('Skip')).toBeNull();
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(0);
    expect(actionsPointerEvents(view)).toBe('none');
    act(() => { useCelebrationStore.getState().finish('other-major-scene'); });
    expect(endingActive()?.id).toBe('release-ending:release');
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS));
    expect(exhaleCount()).toBe(1);
    expect(actionsPointerEvents(view)).toBe('auto');
  });

  it('unmounting before the settle finishes the scene and plays nothing', () => {
    const { view } = renderEnding();
    act(() => jest.advanceTimersByTime(500));
    view.unmount();
    expect(endingActive()).toBeNull();
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(0);
    expect(hapticCalls()).toHaveLength(0);
  });

  it('Reduce Motion: a short crossfade, no circle, not skippable, settles at 120ms', () => {
    const { view } = renderEnding({ reduceMotion: true });
    expect(view.getByTestId('v2-release-completion-paper')).toBeTruthy();
    expect(view.queryByTestId('v2-release-completion-reveal')).toBeNull();
    expect(endingActive()).toMatchObject({ level: 3, skippable: false });
    expect(view.queryByLabelText('Skip')).toBeNull();
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS - 1));
    expect(actionsPointerEvents(view)).toBe('none');
    act(() => jest.advanceTimersByTime(1));
    expect(actionsPointerEvents(view)).toBe('auto');
    expect(exhaleCount()).toBe(1);
    expect(hapticCalls()).toEqual([[Haptics.ImpactFeedbackStyle.Light]]);
  });

  it('the destination ending shows the gold flag in the glyph slot and keeps its two button labels', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={destination()} ghostSvg="<svg />" category="creativity" onAction={onAction} />);
    expect(view.getByTestId('v2-release-completion-flag', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByTestId('v2-release-completion-ghost', { includeHiddenElements: true })).toBeNull();
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS));
    expect(view.getByText('View completed Chart')).toBeTruthy();
    expect(view.getByText('Return Home')).toBeTruthy();
    fireEvent.press(view.getByTestId('v2-release-completion-primary'));
    expect(onAction).toHaveBeenCalledWith('completed_chart');
    fireEvent.press(view.getByTestId('v2-release-completion-secondary'));
    expect(onAction).toHaveBeenCalledWith('home');
  });

  it('a non-destination ending keeps the glyph and no flag', () => {
    const { view } = renderEnding();
    expect(view.getByTestId('v2-release-completion-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByTestId('v2-release-completion-flag', { includeHiddenElements: true })).toBeNull();
  });
});

describe('V2ReleaseCompletion: Return Home exit (RL1)', () => {
  const bodyOpacity = (view: ReturnType<typeof render>) => {
    const node = view.getByTestId('v2-release-completion-body-wrap', { includeHiddenElements: true });
    return StyleSheet.flatten(node.props.style)?.opacity ?? 1;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    useCelebrationStore.getState().reset();
    mockPlayCreationSound.mockClear();
    jest.mocked(safeHaptics.impact).mockClear();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const settle = (view: ReturnType<typeof render>) => {
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS));
    expect(actionsPointerEvents(view)).toBe('auto');
    mockPlayCreationSound.mockClear();
    jest.mocked(safeHaptics.impact).mockClear();
  };

  it('fades the ghost, words and buttons over the paper, which stays, with no sound and no haptic', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} />);
    settle(view);
    expect(bodyOpacity(view)).toBe(1);

    view.rerender(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} leavingAction="home" />);
    act(() => jest.advanceTimersByTime(1000));
    // The Jest Reanimated stand-in applies shared-value animation targets synchronously;
    // rerender to expose the updated animated style through React Native's test renderer.
    view.rerender(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} leavingAction="home" />);

    expect(bodyOpacity(view)).toBe(0);
    // The cream paper holds: the reveal circle is still there, fully open.
    expect(view.getByTestId('v2-release-completion-reveal')).toBeTruthy();
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
    expect(hapticCalls()).toHaveLength(0);
  });

  it('blocks a second tap while it is leaving', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} />);
    settle(view);
    view.rerender(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" onAction={onAction} leavingAction="home" />);
    expect(actionsPointerEvents(view)).toBe('none');
    fireEvent.press(view.getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('Reduce Motion plays no exit of its own: the route\'s soft fade carries the change', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" reduceMotion onAction={onAction} />);
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS));
    mockPlayCreationSound.mockClear();
    view.rerender(<V2ReleaseCompletion ending={ending()} ghostSvg="<svg />" category="creativity" reduceMotion onAction={onAction} leavingAction="home" />);
    act(() => jest.advanceTimersByTime(1000));
    expect(bodyOpacity(view)).toBe(1);
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
  });
});
