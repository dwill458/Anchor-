import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { V2ReleaseAdapter, V2ReleaseResult } from '@/adapters/v2/release';

const mockReleaseAnchor = jest.fn();
const mockAnchorStoreState: { anchors: Array<Record<string, unknown>>; releaseAnchor: jest.Mock; linkEvolvedFrom: jest.Mock } = {
  anchors: [],
  releaseAnchor: mockReleaseAnchor,
  linkEvolvedFrom: jest.fn(),
};
const mockCourseStoreState: { activeCourse: unknown } = { activeCourse: null };
const mockReduceMotion = jest.fn(() => false);
const mockAudioEvents: string[] = [];
const mockPlayCreationSound = jest.fn((key: string) => {
  mockAudioEvents.push(`play:${key}`);
  return { stop: () => mockAudioEvents.push(`stop:${key}`) };
});

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (key: string) => mockPlayCreationSound(key) }));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: unknown) => unknown) => selector(mockAnchorStoreState),
}));
jest.mock('@/stores/courseStore', () => ({
  useCourseStore: (selector: (s: unknown) => unknown) => selector(mockCourseStoreState),
}));
// An entitled user: Evolve proceeds exactly as before (the gate is covered in V2ReleaseScreen.evolve.test).
jest.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({
    canCreateAnchor: true, anchorCreationLimitReason: null, entitlementReady: true,
    anchorsCreatedToday: 0, anchorsCreatedDuringTrial: 0, tier: 'pro',
  }),
}));
jest.mock('@/hooks/v2', () => ({
  useV2ReduceMotion: () => mockReduceMotion(),
  useCreationReduceMotion: () => mockReduceMotion(),
  v2Haptics: {
    selection: jest.fn(),
    completion: jest.fn(),
    confirmation: jest.fn(),
    warning: jest.fn(),
    destructiveCommit: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import { V2ReleaseScreen } from '../V2ReleaseScreen';
import { RELEASE_COPY, RELEASE_ENDINGS, RELEASE_ENDING_REDUCED_MS, RELEASE_ENDING_SETTLE_MS } from '@/constants/v2/release';
import { V2ReleaseCompletion } from '@/components/v2/release/V2ReleaseCompletion';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { Skia } from '@shopify/react-native-skia';

const exhaleCount = () => mockPlayCreationSound.mock.calls.filter(([key]) => key === 'releaseResolve').length;

const anchor = {
  id: 'anchor-1',
  localId: 'anchor-1',
  intentionText: 'Publish my novel',
  category: 'creativity',
  baseSigilSvg: '<svg />',
  reinforcedSigilSvg: null,
};

function fakeAdapter(result: V2ReleaseResult): V2ReleaseAdapter {
  return { submitRelease: jest.fn(async () => result) };
}

const flush = () => act(async () => { await Promise.resolve(); });

describe('V2ReleaseScreen', () => {
  it('uses the finished enhanced artwork for the tinted completion ghost', async () => {
    const view = render(<V2ReleaseCompletion ending={{ ...RELEASE_ENDINGS.no_longer_aligned,
      secondary: RELEASE_ENDINGS.no_longer_aligned.secondary ?? null, reason: 'no_longer_aligned',
      intentionText: anchor.intentionText, successor: null }} ghostSvg={anchor.baseSigilSvg}
      ghostImageUrl="https://cdn.example.com/enhanced.png" reduceMotion onAction={jest.fn()} />);
    await flush();
    expect(view.getByTestId('v2-release-completion-enhanced-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(Skia.Data.fromURI).toHaveBeenCalledWith('https://cdn.example.com/enhanced.png');
    expect(view.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('ColorMatrix' as never))).toHaveLength(1);
  });

  it('keeps the stored SVG as fallback when enhanced artwork cannot load', async () => {
    jest.mocked(Skia.Data.fromURI).mockRejectedValueOnce(new Error('Artwork unavailable'));
    const view = render(<V2ReleaseCompletion ending={{ ...RELEASE_ENDINGS.no_longer_aligned,
      secondary: RELEASE_ENDINGS.no_longer_aligned.secondary ?? null, reason: 'no_longer_aligned',
      intentionText: anchor.intentionText, successor: null }} ghostSvg={anchor.baseSigilSvg}
      ghostImageUrl="https://cdn.example.com/unavailable.png" reduceMotion onAction={jest.fn()} />);
    await flush();
    expect(view.queryByTestId('v2-release-completion-enhanced-ghost', { includeHiddenElements: true })).toBeNull();
    expect(view.getByTestId('v2-release-completion-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(view.UNSAFE_root.findAll((node: { type: unknown }) => node.type === ('SvgXml' as never))).toHaveLength(1);
  });

  it('replaces the old preflight subtitle with the locked kicker', () => {
    const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })}
      onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    expect(view.getByText(RELEASE_COPY.preflightKicker)).toBeTruthy();
    expect(view.queryByText(RELEASE_COPY.preflightSubtitle)).toBeNull();
  });

  it('shows the stored ghost and keeps completion actions disabled until the paper settles', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={{ ...RELEASE_ENDINGS.no_longer_aligned, secondary: RELEASE_ENDINGS.no_longer_aligned.secondary ?? null, reason: 'no_longer_aligned', intentionText: anchor.intentionText, successor: null }}
      ghostSvg={anchor.baseSigilSvg} category={anchor.category} onAction={onAction} />);
    expect(view.getByTestId('v2-release-completion-ghost', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(view.getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
    expect(onAction).not.toHaveBeenCalled();
    // The reveal settles at 450ms delay + 1000ms; the fixed 1250ms timer no longer gates actions.
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS - 1));
    fireEvent.press(view.getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
    expect(onAction).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    fireEvent.press(view.getByTestId('v2-release-completion-primary'));
    expect(onAction).toHaveBeenCalledWith('home');
  });

  it('renders every completion element with Reduced Motion and enables actions at its 120ms settle', () => {
    const onAction = jest.fn();
    const view = render(<V2ReleaseCompletion ending={{ ...RELEASE_ENDINGS.no_longer_aligned, secondary: RELEASE_ENDINGS.no_longer_aligned.secondary ?? null, reason: 'no_longer_aligned', intentionText: anchor.intentionText, successor: null }}
      ghostSvg={anchor.baseSigilSvg} reduceMotion onAction={onAction} />);
    expect(view.getByTestId('v2-release-completion-ghost', { includeHiddenElements: true })).toBeTruthy();
    for (const id of ['eyebrow', 'heading', 'body', 'primary', 'secondary']) {
      expect(view.getByTestId(`v2-release-completion-${id}`, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(view.getByText(`“${anchor.intentionText}”`)).toBeTruthy();
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS));
    fireEvent.press(view.getByTestId('v2-release-completion-primary'));
    expect(onAction).toHaveBeenCalledWith('home');
    view.unmount();
    // Flush the test renderer's queued animation frames after cancellation.
    act(() => jest.runOnlyPendingTimers());
    expect(jest.getTimerCount()).toBe(0);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    useCelebrationStore.getState().reset();
    mockReleaseAnchor.mockClear();
    mockReduceMotion.mockReturnValue(false);
    mockAudioEvents.length = 0;
    mockPlayCreationSound.mockClear();
    mockAnchorStoreState.anchors = [anchor];
    mockCourseStoreState.activeCourse = null;
    // The global Skia double omits remote decoding; model success/failure here.
    Object.defineProperty(Skia.Data, 'fromURI', { configurable: true, value: jest.fn().mockResolvedValue({}) });
    Object.defineProperty(Skia.Image, 'MakeImageFromEncoded', {
      configurable: true, value: jest.fn(() => ({ width: () => 132, height: () => 132 })),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('preflight shows the intention and the consequence snapshot', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(getByText('What changes when you release')).toBeTruthy();
    expect(getByText(/Publish my novel/)).toBeTruthy();
    expect(getByTestId('v2-release-intention')).toBeTruthy();
    expect(queryByTestId('v2-release-consequence-intention')).toBeNull();
    expect(getByTestId('v2-release-consequence-anchor')).toBeTruthy();
    expect(getByTestId('v2-release-consequence-history')).toBeTruthy();
  });

  it('a hold shorter than 1.8s cancels: no ceremony, no release request', () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const submit = adapter.submitRelease as jest.Mock;
    const { getByTestId, queryByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={adapter}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const target = getByTestId('v2-hold-to-release-target');
    act(() => {
      fireEvent(target, 'pressIn');
    });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => {
      fireEvent(target, 'pressOut');
    });

    expect(submit).not.toHaveBeenCalled();
    expect(queryByTestId('v2-dissolution-ceremony')).toBeNull();
    expect(getByTestId('v2-release-preflight')).toBeTruthy();
  });

  it('completing the 1.8s hold triggers the dissolution ceremony and an idempotent submit', async () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const submit = adapter.submitRelease as jest.Mock;
    const { getByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={adapter}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    act(() => {
      fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn');
    });
    act(() => {
      jest.advanceTimersByTime(1850);
    });
    await flush();

    expect(getByTestId('v2-dissolution-ceremony')).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ anchorId: 'anchor-1', idempotencyKey: expect.stringMatching(/^release-/) }),
    );
  });

  it('stops the hold fall before the burn one-shot starts', async () => {
    const { getByTestId } = render(<V2ReleaseScreen anchorId="anchor-1"
      releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })}
      onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);

    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    expect(mockPlayCreationSound).toHaveBeenCalledWith('releaseFall');
    act(() => jest.advanceTimersByTime(1850));
    await flush();

    const fallPlay = mockAudioEvents.indexOf('play:releaseFall');
    const fallStop = mockAudioEvents.indexOf('stop:releaseFall');
    const burnPlay = mockAudioEvents.indexOf('play:releaseBurn');
    expect(fallPlay).toBeGreaterThanOrEqual(0);
    expect(fallStop).toBeGreaterThan(fallPlay);
    expect(burnPlay).toBeGreaterThan(fallStop);
  });

  it('Reduced Motion runs an accessible non-animated dissolution and reaches completion', async () => {
    mockReduceMotion.mockReturnValue(true);
    const onReleaseCompleted = jest.fn();
    const { getByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1', lifecycleState: 'released' })}
        onReleaseCompleted={onReleaseCompleted}
        onCancel={jest.fn()}
      />,
    );

    act(() => {
      fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn');
    });
    act(() => {
      jest.advanceTimersByTime(1850);
    });
    await flush();

    // Reduced ceremony has no ember particles.
    expect(getByTestId('v2-dissolution-ceremony')).toBeTruthy();
    act(() => jest.advanceTimersByTime(650));
    expect(exhaleCount()).toBe(0);
    expect(() => getByTestId('ember-0')).toThrow();

    // Reduced timeline resolves quickly (< 1s of ceremony).
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    await flush();

    const completion = getByTestId('v2-release-completion');
    expect(completion).toBeTruthy();
    expect(mockReleaseAnchor).toHaveBeenCalledWith('anchor-1');
    // The reduced crossfade settles, and only then does the exhale play, exactly once.
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS));
    expect(exhaleCount()).toBe(1);

    fireEvent.press(getByTestId('v2-release-completion-primary'));
    expect(onReleaseCompleted).toHaveBeenCalledWith('anchor-1', expect.objectContaining({ reason: 'no_longer_aligned', eyebrow: 'Released' }));
    // Return Home is taken once: the ending is leaving, so a second tap starts nothing more.
    fireEvent.press(getByTestId('v2-release-completion-primary', { includeHiddenElements: true }));
    expect(onReleaseCompleted).toHaveBeenCalledTimes(1);
  });

  it('renders an empty state when the Anchor is gone', () => {
    mockAnchorStoreState.anchors = [];
    const { getByText } = render(
      <V2ReleaseScreen
        anchorId="missing"
        releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'missing' })}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Anchor unavailable')).toBeTruthy();
  });

  it('a definitive failure keeps the Anchor active and never calls destructive reconciliation', async () => {
    mockReduceMotion.mockReturnValue(true);
    const { getByTestId, queryByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={fakeAdapter({ status: 'failed', anchorId: 'anchor-1', message: 'server refused', retryable: false })}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    act(() => {
      fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn');
    });
    act(() => {
      jest.advanceTimersByTime(1850);
    });
    await flush();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    await flush();

    await waitFor(() => expect(getByTestId('v2-release-status-failed')).toBeTruthy());
    expect(mockReleaseAnchor).not.toHaveBeenCalled();
    expect(queryByTestId('v2-release-completion')).toBeNull();
  });
  it('plays the exhale exactly once, at the ending settle, never in the empty pause', async () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1', lifecycleState: 'released' });
    const { getByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    // Hold completes at 1800ms; the empty pause starts 3050ms later and the ceremony completes at +3350ms.
    act(() => jest.advanceTimersByTime(1800));
    await flush();
    act(() => jest.advanceTimersByTime(3050));
    await flush();
    expect(getByTestId('v2-dissolution-phase-emptyPause')).toBeTruthy();
    expect(exhaleCount()).toBe(0);
    act(() => jest.advanceTimersByTime(300));
    await flush();
    await flush();
    expect(getByTestId('v2-release-completion')).toBeTruthy();
    expect(useCelebrationStore.getState().active?.id).toBe('release-ending:anchor-1');
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_SETTLE_MS - 1));
    expect(exhaleCount()).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(exhaleCount()).toBe(1);
    act(() => jest.advanceTimersByTime(5000));
    expect(exhaleCount()).toBe(1);
  });

  it.each([360, 900, 1620])('cancels at %sms and never submits after leaving preflight', (duration) => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const { getByTestId, unmount } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(duration));
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressOut'));
    unmount();
    act(() => jest.advanceTimersByTime(5000));
    expect(adapter.submitRelease).not.toHaveBeenCalled();
  });

  it('keeps the 300ms empty interval and never claims pending is success', async () => {
    const adapter = fakeAdapter({ status: 'pending', anchorId: 'anchor-1', retryable: true });
    const { getByTestId, queryByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1800));
    await flush();
    act(() => jest.advanceTimersByTime(3050));
    expect(getByTestId('v2-dissolution-phase-emptyPause')).toBeTruthy();
    // The exhale belongs to the ending's settle, so the empty pause plays nothing.
    expect(exhaleCount()).toBe(0);
    expect(queryByTestId('v2-release-status-confirming')).toBeNull();
    expect(queryByTestId('v2-release-completion')).toBeNull();
    act(() => jest.advanceTimersByTime(299));
    expect(queryByTestId('v2-release-status-confirming')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(getByTestId('v2-release-status-confirming')).toBeTruthy();
    expect(mockReleaseAnchor).not.toHaveBeenCalled();
  });


  it('repeated input after the threshold submits exactly once', async () => {
    const adapter = fakeAdapter({ status: 'pending', anchorId: 'anchor-1', retryable: true });
    const { getByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    const target = getByTestId('v2-hold-to-release-target');
    act(() => fireEvent(target, 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => { fireEvent(target, 'pressOut'); fireEvent(target, 'pressIn'); fireEvent(target, 'pressIn'); });
    act(() => jest.advanceTimersByTime(2500));
    await flush();
    expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
  });

  it('an early lift sends no request and the target stays available for a fresh hold', () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const { getByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    const target = getByTestId('v2-hold-to-release-target');
    act(() => fireEvent(target, 'pressIn'));
    act(() => jest.advanceTimersByTime(900));
    act(() => fireEvent(target, 'pressOut'));
    act(() => jest.advanceTimersByTime(600));
    expect(adapter.submitRelease).not.toHaveBeenCalled();
    expect(getByTestId('v2-hold-to-release-label').props.children).toBe('Hold to release');
  });

  it('losing focus mid-hold cancels it without a request', () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const view = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(view.getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(700));
    view.rerender(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} focused={false} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => jest.advanceTimersByTime(3000));
    expect(adapter.submitRelease).not.toHaveBeenCalled();
  });

  it('a blank Skia capture keeps the native artwork and the fixed fade: no empty fire canvas', async () => {
    const adapter = fakeAdapter({ status: 'pending', anchorId: 'anchor-1', retryable: true });
    const { getByTestId, queryByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => jest.advanceTimersByTime(1200));
    expect(getByTestId('v2-release-artwork')).toBeTruthy();
    expect(queryByTestId('v2-release-fire')).toBeNull();
  });

  it('Reduced Motion never mounts fire or embers', async () => {
    mockReduceMotion.mockReturnValue(true);
    const adapter = fakeAdapter({ status: 'pending', anchorId: 'anchor-1', retryable: true });
    const { getByTestId, queryByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" releaseAdapter={adapter} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => jest.advanceTimersByTime(400));
    expect(queryByTestId('v2-release-fire')).toBeNull();
    expect(queryByTestId('ember-0')).toBeNull();
  });

  it('evolve without a valid successor disables the hold and offers to create one', () => {
    const adapter = fakeAdapter({ status: 'released', anchorId: 'anchor-1' });
    const onCreateSuccessor = jest.fn();
    const { getByTestId, queryByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" releaseAdapter={adapter}
      onReleaseCompleted={jest.fn()} onCancel={jest.fn()} onCreateSuccessor={onCreateSuccessor} />);
    expect(queryByTestId('v2-hold-to-release-target')).toBeNull();
    fireEvent.press(getByTestId('v2-release-create-successor'));
    expect(onCreateSuccessor).toHaveBeenCalledTimes(1);
    expect(adapter.submitRelease).not.toHaveBeenCalled();
  });

  it('evolve with a valid successor releases and continues with the new Anchor', async () => {
    mockAnchorStoreState.anchors = [anchor, { ...anchor, id: 'anchor-2', localId: 'anchor-2', intentionText: 'Ship the second draft' }];
    mockReduceMotion.mockReturnValue(true);
    const onContinueWithSuccessor = jest.fn();
    const { getByTestId, getByText } = render(<V2ReleaseScreen anchorId="anchor-1" reason="evolve" successor={{ anchorId: 'anchor-2', intentionText: 'Ship the second draft' }}
      releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} onContinueWithSuccessor={onContinueWithSuccessor} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    await flush();
    expect(getByTestId('v2-release-completion-heading').props.children).toBe('Evolved');
    expect(getByText(/Linked to your previous intention\./)).toBeTruthy();
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS));
    fireEvent.press(getByTestId('v2-release-completion-primary'));
    // The released Anchor's artwork travels with it, from the release snapshot, for the Evolved arrival's ghost.
    expect(onContinueWithSuccessor).toHaveBeenCalledWith('anchor-2', { svg: '<svg />', imageUrl: undefined, category: 'creativity', expression: undefined });
  });

  it('waypoint completion confirmed by the synced Chart continues to Chart with the course', async () => {
    mockCourseStoreState.activeCourse = {
      id: 'course-9', status: 'ACTIVE', version: 2, waypointCount: 3, reachedCount: 1, destinationAnchorLink: null,
      waypoints: [
        { id: 'w1', position: 1, title: 'Outline', state: 'REACHED', anchorLink: { anchorId: 'anchor-1' } },
        { id: 'w2', position: 2, title: 'Draft chapter one', state: 'CURRENT', anchorLink: null },
      ],
    };
    mockReduceMotion.mockReturnValue(true);
    const onContinueToChart = jest.fn();
    const { getByTestId, getByText } = render(<V2ReleaseScreen anchorId="anchor-1" reason="waypoint_completed"
      releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} onContinueToChart={onContinueToChart} />);
    expect(getByText(/Next: Draft chapter one/)).toBeTruthy();
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    await flush();
    expect(getByTestId('v2-release-completion-heading').props.children).toBe('Waypoint complete');
    act(() => jest.advanceTimersByTime(RELEASE_ENDING_REDUCED_MS));
    fireEvent.press(getByTestId('v2-release-completion-primary'));
    expect(onContinueToChart).toHaveBeenCalledWith('course-9', 'anchor-1');
  });

  it('an unconfirmed waypoint claim falls back to a plain release', async () => {
    mockReduceMotion.mockReturnValue(true);
    const { getByTestId } = render(<V2ReleaseScreen anchorId="anchor-1" reason="waypoint_completed"
      releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })} onReleaseCompleted={jest.fn()} onCancel={jest.fn()} />);
    act(() => fireEvent(getByTestId('v2-hold-to-release-target'), 'pressIn'));
    act(() => jest.advanceTimersByTime(1850));
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    await flush();
    expect(getByTestId('v2-release-completion-eyebrow').props.children).toBe('Released');
  });

});
