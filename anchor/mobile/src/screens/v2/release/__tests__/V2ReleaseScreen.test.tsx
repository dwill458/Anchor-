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
    const { getByText, getByTestId } = render(
      <V2ReleaseScreen
        anchorId="anchor-1"
        releaseAdapter={fakeAdapter({ status: 'released', anchorId: 'anchor-1' })}
        onReleaseCompleted={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(getByText('What releasing this Anchor means')).toBeTruthy();
    expect(getByText(/Publish my novel/)).toBeTruthy();
    expect(getByTestId('v2-release-intention')).toBeTruthy();
    expect(getByTestId('v2-release-consequence-intention')).toBeTruthy();
    expect(getByTestId('v2-release-consequence-anchor')).toBeTruthy();
    expect(getByTestId('v2-release-consequence-reminders')).toBeTruthy();
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
    expect(onReleaseCompleted).toHaveBeenCalledWith('anchor-1');
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
});
