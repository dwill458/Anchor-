import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { V2ReleaseAdapter, V2ReleaseResult } from '@/adapters/v2/release';

const mockReleaseAnchor = jest.fn();
const mockAnchorStoreState: { anchors: Array<Record<string, unknown>>; releaseAnchor: jest.Mock } = {
  anchors: [],
  releaseAnchor: mockReleaseAnchor,
};
const mockCourseStoreState: { activeCourse: unknown } = { activeCourse: null };
const mockReduceMotion = jest.fn(() => false);

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: unknown) => unknown) => selector(mockAnchorStoreState),
}));
jest.mock('@/stores/courseStore', () => ({
  useCourseStore: (selector: (s: unknown) => unknown) => selector(mockCourseStoreState),
}));
jest.mock('@/hooks/v2', () => ({
  useV2ReduceMotion: () => mockReduceMotion(),
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
  beforeEach(() => {
    jest.useFakeTimers();
    mockReleaseAnchor.mockClear();
    mockReduceMotion.mockReturnValue(false);
    mockAnchorStoreState.anchors = [anchor];
    mockCourseStoreState.activeCourse = null;
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
    expect(() => getByTestId('ember-0')).toThrow();

    // Reduced timeline resolves quickly (< 1s of ceremony).
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await flush();
    await flush();

    const completion = getByTestId('v2-release-completion');
    expect(completion).toBeTruthy();
    expect(getByTestId('v2-release-completion-primary')).toBeTruthy();
    expect(mockReleaseAnchor).toHaveBeenCalledWith('anchor-1');

    fireEvent.press(getByTestId('v2-release-completion-primary'));
    expect(onReleaseCompleted).toHaveBeenCalledWith('anchor-1', expect.objectContaining({ reason: 'no_longer_aligned', eyebrow: 'Released' }));
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
    fireEvent.press(getByTestId('v2-release-completion-primary'));
    expect(onContinueWithSuccessor).toHaveBeenCalledWith('anchor-2');
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
