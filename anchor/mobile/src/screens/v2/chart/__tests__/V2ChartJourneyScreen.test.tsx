import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { V2ChartJourneyScreen } from '../V2ChartJourneyScreen';
import { apiClient } from '@/services/ApiClient';
import { chartApiClient } from '@/services/ChartApiClient';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { CourseLogEntry } from '@/types/chart';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let canGoBackValue = true;
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: () => canGoBackValue,
};

let mockParams: Record<string, unknown> = { anchorId: 'anchor-1' };

jest.mock('@react-navigation/native', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (callback: () => void) => {
      ReactActual.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock('@/services/ApiClient', () => {
  class ApiClientError extends Error {
    code: string | undefined;
    status: number | undefined;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.code = code;
      this.status = status;
    }
  }
  return {
    apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
    ApiClientError,
  };
});

jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: {
    getCourseLog: jest.fn(),
  },
}));

const get = apiClient.get as jest.Mock;

const anchor = {
  id: 'anchor-1',
  localId: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Run a marathon',
  category: 'desire',
  baseSigilSvg: '<svg viewBox="0 0 10 10"></svg>',
  distilledLetters: [],
  structureVariant: 'balanced',
  isCharged: false,
  isStabilized: false,
  status: 'active',
  created_at: '2026-02-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
};

const activeCourse = {
  id: 'course-1',
  destinationText: 'Run a marathon in under 4 hours',
  status: 'ACTIVE',
  version: 1,
  currentWaypointId: 'wp-1',
  currentMoveId: 'm1',
  waypointCount: 2,
  reachedCount: 1,
  plottedAt: '2026-02-15T10:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
  anchorId: 'anchor-1',
  waypoints: [
    {
      id: 'wp-1',
      courseId: 'course-1',
      position: 100,
      title: 'Complete 10k run',
      description: 'Establish running base',
      kind: 'MILESTONE',
      state: 'REACHED',
      blockedReason: null,
      reachedAt: '2026-03-01T12:00:00.000Z',
      skippedAt: null,
      cancelledAt: null,
      anchorLink: null,
    },
    {
      id: 'wp-2',
      courseId: 'course-1',
      position: 200,
      title: 'Complete half marathon',
      description: 'Midway checkpoint',
      kind: 'MILESTONE',
      state: 'CURRENT',
      blockedReason: null,
      reachedAt: null,
      skippedAt: null,
      cancelledAt: null,
      anchorLink: null,
    },
  ],
  moves: [],
};

function serveChart() {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/chart')) {
      return {
        data: {
          success: true,
          data: {
            anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released: false },
            chart: activeCourse,
            history: [],
            stats: { completedMoveCount: 5, practiceCount: 10 },
          },
        },
      };
    }
    return { data: { success: true, data: null } };
  });
}

describe('V2ChartJourneyScreen — Course log redesign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canGoBackValue = true;
    mockParams = { anchorId: 'anchor-1' };
    useAuthStore.setState({ user: { id: 'test-user' } as never });
    resetAnchorChartCache();
    useAnchorStore.setState({
      anchors: [anchor as never],
    });
    useSessionStore.setState({
      practiceHistory: [],
    });
    serveChart();
  });

  it('renders with cream background, serif title, category pill, and destination', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'log-1',
          eventType: 'COURSE_CREATED',
          occurredAt: '2026-02-15T10:00:00.000Z',
        },
      ],
    });

    const screen = render(<V2ChartJourneyScreen />);
    const root = await screen.findByTestId('v2-chart-journey');
    expect(root).toBeTruthy();

    expect(screen.getByText('Course log')).toBeTruthy();
    expect(screen.getByText('DESIRE')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Run a marathon in under 4 hours')).toBeTruthy());
    expect(screen.getByText(/days on course/)).toBeTruthy();
  });

  it('navigates back on back button press', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({ data: [] });
    const screen = render(<V2ChartJourneyScreen />);
    const backBtn = await screen.findByTestId('chart-course-log-back');
    fireEvent.press(backBtn);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders unified timeline with moves, course created, and practice sessions', async () => {
    const mockEntries: CourseLogEntry[] = [
      {
        id: 'entry-move-1',
                waypointId: null,
        eventType: 'MOVE_COMPLETED',
        message: 'Completed move',
        reflection: null,
        recordedAt: '2026-03-02T14:30:00.000Z',
        occurredAt: '2026-03-02T14:30:00.000Z',
        snapshot: {
          moveTitle: 'Buy new running shoes',
        },
        practiceSession: null,
        anchorLink: null,
      },
      {
        id: 'entry-wp-1',
                waypointId: 'wp-1',
        eventType: 'WAYPOINT_REACHED',
        message: 'Reached waypoint',
        reflection: null,
        recordedAt: '2026-03-01T12:00:00.000Z',
        occurredAt: '2026-03-01T12:00:00.000Z',
        snapshot: {
          waypointTitle: 'Complete 10k run',
        },
        practiceSession: null,
        anchorLink: null,
      },
      {
        id: 'entry-course-created',
                waypointId: null,
        eventType: 'COURSE_CREATED',
        message: 'Course created',
        reflection: null,
        recordedAt: '2026-02-15T10:00:00.000Z',
        occurredAt: '2026-02-15T10:00:00.000Z',
        snapshot: {},
        practiceSession: null,
        anchorLink: null,
      },
    ];

    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({ data: mockEntries });

    useSessionStore.setState({
      practiceHistory: [
        {
          id: 'session-1',
          accountId: 'acc-1',
          anchorId: 'anchor-1',
          anchorLocalId: null,
          anchorServerId: null,
          practiceMode: 'focus',
          plannedDurationSeconds: 300,
          completedDurationSeconds: 300,
          completionStatus: 'completed',
          startedAt: '2026-03-03T09:00:00.000Z',
          completedAt: '2026-03-03T09:05:00.000Z',
          localDateKey: '2026-03-03',
          timeZone: 'UTC',
          utcOffsetMinutesAtCompletion: 0,
          completionSource: 'practice_screen',
          schemaVersion: 1,
          legacyType: null,
          guidanceVoice: 'female',
          backgroundAudio: 'silent',
          sceneSnapshot: null,
          nextAction: null,
          clientVersion: '1.0.0',
          syncState: 'synced',
        } as any,
      ],
    });

    const screen = render(<V2ChartJourneyScreen />);

    // The session shows its mode name and duration separately; there is no "Practice completed." filler.
    await waitFor(() => expect(screen.getByText(/^Focus/)).toBeTruthy());
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.queryByText('Practice completed.')).toBeNull();

    // Moves and waypoints stay on the thread as plain event rows, outside the session counts.
    await waitFor(() => expect(screen.getByText('Completed')).toBeTruthy());
    expect(screen.getByText('Buy new running shoes')).toBeTruthy();
    expect(screen.getByText('Reached')).toBeTruthy();
    expect(screen.getAllByText('Complete 10k run').length).toBeGreaterThanOrEqual(1);

    // Course created is the closing "Course started" row, not a timeline item.
    expect(screen.getByText(/^Course started /)).toBeTruthy();
    expect(screen.queryByText('Course created')).toBeNull();
  });

  it('shows the Course started row in the empty state', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({ data: [] });
    useSessionStore.setState({ practiceHistory: [] });

    const screen = render(<V2ChartJourneyScreen />);
    await waitFor(() => expect(screen.getByText(/^Course started /)).toBeTruthy());
    expect(screen.queryByTestId('course-log-banner')).toBeNull();
  });

  const session = (id: string, mode: string, seconds: number, completedAt: string) => ({
    id, accountId: 'acc-1', anchorId: 'anchor-1', anchorLocalId: null, anchorServerId: null, practiceMode: mode,
    plannedDurationSeconds: seconds, completedDurationSeconds: seconds, completionStatus: 'completed', startedAt: completedAt, completedAt,
    localDateKey: '2026-03-03', timeZone: 'UTC', utcOffsetMinutesAtCompletion: 0, completionSource: 'practice_screen', schemaVersion: 1,
    legacyType: null, guidanceVoice: 'female', backgroundAudio: 'silent', sceneSnapshot: null, nextAction: null, clientVersion: '1.0.0', syncState: 'synced',
  }) as never;

  it('gives each session its own mode icon tile and sums a day and the list with one duration helper', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({ data: [] });
    useSessionStore.setState({ practiceHistory: [
      session('s1', 'focus', 60, '2026-03-03T09:00:00.000Z'),
      session('s2', 'visualize', 180, '2026-03-03T10:00:00.000Z'),
      session('s3', 'focus', 30, '2026-03-04T09:00:00.000Z'),
      session('s4', 'visualize', 180, '2026-03-04T10:00:00.000Z'),
    ] });
    const screen = render(<V2ChartJourneyScreen />);
    await waitFor(() => expect(screen.getAllByTestId('course-log-row')).toHaveLength(4));
    expect(screen.getAllByTestId('course-log-tile-focus')).toHaveLength(2);
    expect(screen.getAllByTestId('course-log-tile-visualize')).toHaveLength(2);
    const { getPracticeColor } = require('@/theme/v2');
    const tile = screen.getAllByTestId('course-log-tile-visualize')[0];
    expect(JSON.stringify(tile.props.style)).toContain(getPracticeColor('visualize'));
    // 60s + 180s = "4 min"; 30s + 180s = "3.5 min"; list total 450s = "7.5 min".
    expect(screen.getByText(/2 sessions · 4 min$/)).toBeTruthy();
    expect(screen.getByText(/2 sessions · 3\.5 min$/)).toBeTruthy();
    expect(screen.getByTestId('course-log-total').props.children).toBe('4 sessions · 7.5 min');
    expect(screen.getByText('Sessions')).toBeTruthy();
  });

  it('keeps a failed load out of the page: a banner with Retry sits above the saved sessions, and a good retry says Up to date and goes away', async () => {
    jest.useFakeTimers();
    try {
      const getLog = chartApiClient.getCourseLog as jest.Mock;
      getLog.mockRejectedValueOnce(new Error('network'));
      useSessionStore.setState({ practiceHistory: [session('s1', 'focus', 60, '2026-03-03T09:00:00.000Z')] });
      const screen = render(<V2ChartJourneyScreen />);
      await waitFor(() => expect(screen.getByTestId('course-log-banner')).toBeTruthy());
      expect(screen.getByText("Couldn\u2019t refresh. Showing saved sessions.")).toBeTruthy();
      expect(screen.queryByText('Check your connection and try again.')).toBeNull();
      expect(screen.getAllByTestId('course-log-row')).toHaveLength(1);

      getLog.mockResolvedValueOnce({ data: [] });
      await act(async () => { fireEvent.press(screen.getByTestId('course-log-retry')); });
      expect(getLog).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(screen.getByText('Up to date.')).toBeTruthy());
      act(() => { jest.advanceTimersByTime(900); });
      expect(screen.queryByTestId('course-log-banner')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('with no data at all the banner is the empty state and Retry is the way forward', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockRejectedValue(new Error('network'));
    useSessionStore.setState({ practiceHistory: [] });
    const screen = render(<V2ChartJourneyScreen />);
    await waitFor(() => expect(screen.getByTestId('course-log-retry')).toBeTruthy());
    expect(screen.queryAllByTestId('course-log-row')).toHaveLength(0);
    expect(screen.queryByText('Sessions')).toBeNull();
  });

  it('shows a reflection under its session when the record carries one, and omits the total while the list is paged', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({
      data: [{
        id: 'p1', eventType: 'PRACTICE_COMPLETED', message: '', waypointId: null, recordedAt: '2026-03-03T09:00:00.000Z', occurredAt: '2026-03-03T09:00:00.000Z',
        snapshot: null, anchorLink: null, practiceSession: { id: 'ps1', practiceMode: 'visualize', completedDurationSeconds: 180 },
        reflection: { id: 'r1', promptType: 'PRACTICE', body: 'Saw the finished paint under the garage lights.', structuredContent: null, moodAfter: null },
      }],
      pagination: { nextCursor: 'c2', hasMore: true },
    });
    const screen = render(<V2ChartJourneyScreen />);
    await waitFor(() => expect(screen.getByTestId('course-log-note')).toBeTruthy());
    expect(screen.getByText('Saw the finished paint under the garage lights.')).toBeTruthy();
    expect(screen.getByTestId('course-log-total').props.children).toBe('1 session');
  });
});
