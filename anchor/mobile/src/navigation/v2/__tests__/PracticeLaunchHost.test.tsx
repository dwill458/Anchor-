import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('@/navigation/PracticeStackNavigator', () => ({
  PracticeStackNavigator: () => {
    const RN = require('react-native');
    return <RN.Text>MaturePracticeStack</RN.Text>;
  },
}));

jest.mock('../AnchorV2Navigator', () => ({
  AnchorV2Navigator: () => {
    const RN = require('react-native');
    const { usePracticeLaunch, usePracticeCompletionReturn } = require('../PracticeLaunchHost');
    mockCapturedLaunch = usePracticeLaunch();
    mockCapturedCompletion = usePracticeCompletionReturn();
    return <RN.Text>V2Navigator</RN.Text>;
  },
}));

import { AnchorV2PracticeHost } from '../PracticeLaunchHost';
import { notifyPracticeCompletionReturned } from '@/navigation/practiceCompletionReturn';
import type { PracticeLaunchRequest } from '@/types/practice';

let mockCapturedLaunch: ((request: PracticeLaunchRequest) => void) | null = null;
let mockCapturedCompletion: unknown = null;

const baseRequest = (sessionId: string): PracticeLaunchRequest => ({
  anchorId: 'anchor-1',
  mode: 'focus',
  durationSeconds: 60,
  source: 'practice_focus_card',
  sessionId,
  returnTarget: 'v2_practice',
});

describe('AnchorV2PracticeHost', () => {
  beforeEach(() => {
    mockCapturedLaunch = null;
    mockCapturedCompletion = null;
  });

  it('shows only the V2 navigator until a practice launch is requested', () => {
    const { getByText, queryByText } = render(<AnchorV2PracticeHost />);

    expect(getByText('V2Navigator')).toBeTruthy();
    expect(queryByText('MaturePracticeStack')).toBeNull();
  });

  it('mounts the one mature practice stack after a launch request and returns to V2 on authoritative completion', () => {
    const { getByText, queryByText } = render(<AnchorV2PracticeHost />);

    act(() => {
      mockCapturedLaunch?.(baseRequest('session-a'));
    });
    expect(getByText('MaturePracticeStack')).toBeTruthy();

    act(() => {
      notifyPracticeCompletionReturned({
        sessionId: 'session-a',
        anchorId: 'anchor-1',
        mode: 'focus',
        completedAt: '2026-09-12T00:00:00.000Z',
        source: 'practice_screen',
        returnTarget: 'v2_practice',
        beforeStrength: 10,
        afterStrength: 30,
        delta: 20,
      });
    });

    expect(queryByText('MaturePracticeStack')).toBeNull();
    expect(mockCapturedCompletion).toEqual(expect.objectContaining({ sessionId: 'session-a', delta: 20 }));
  });

  it('does not re-navigate on a duplicate completion callback for the same session', () => {
    const { queryByText } = render(<AnchorV2PracticeHost />);

    act(() => {
      mockCapturedLaunch?.(baseRequest('session-b'));
    });

    const completionPayload = {
      sessionId: 'session-b',
      anchorId: 'anchor-1',
      mode: 'focus',
      completedAt: '2026-09-12T00:00:00.000Z',
      source: 'practice_screen',
      returnTarget: 'v2_practice' as const,
      beforeStrength: 10,
      afterStrength: 30,
      delta: 20,
    };

    act(() => {
      notifyPracticeCompletionReturned(completionPayload);
    });
    expect(queryByText('MaturePracticeStack')).toBeNull();

    // Re-launch, then fire the exact same (already-delivered) session id again —
    // the boundary contract's dedupe must swallow it, so the host must stay on V2.
    act(() => {
      mockCapturedLaunch?.(baseRequest('session-b'));
    });
    expect(queryByText('MaturePracticeStack')).toBeTruthy();

    act(() => {
      notifyPracticeCompletionReturned(completionPayload);
    });
    expect(queryByText('MaturePracticeStack')).toBeTruthy();
  });

  it('ignores a completion that is not targeted at V2 (e.g. release), leaving the mature stack mounted', () => {
    const { getByText } = render(<AnchorV2PracticeHost />);

    act(() => {
      mockCapturedLaunch?.(baseRequest('session-c'));
    });
    expect(getByText('MaturePracticeStack')).toBeTruthy();

    act(() => {
      notifyPracticeCompletionReturned({
        sessionId: 'session-c-release',
        anchorId: 'anchor-1',
        mode: 'release',
        completedAt: '2026-09-12T00:00:00.000Z',
        source: 'practice_screen',
        returnTarget: null,
        beforeStrength: null,
        afterStrength: null,
        delta: null,
      });
    });

    expect(getByText('MaturePracticeStack')).toBeTruthy();
  });
});
