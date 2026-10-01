import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
        eventType: 'MOVE_COMPLETED',
        occurredAt: '2026-03-02T14:30:00.000Z',
        snapshot: {
          moveTitle: 'Buy new running shoes',
        },
      },
      {
        id: 'entry-wp-1',
        eventType: 'WAYPOINT_REACHED',
        occurredAt: '2026-03-01T12:00:00.000Z',
        snapshot: {
          waypointTitle: 'Complete 10k run',
        },
      },
      {
        id: 'entry-course-created',
        eventType: 'COURSE_CREATED',
        occurredAt: '2026-02-15T10:00:00.000Z',
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

    // Check practice session appears
    await waitFor(() => expect(screen.getByText('Practice session')).toBeTruthy());
    expect(screen.getByText(/Practice completed\./)).toBeTruthy();
    expect(screen.getByText(/5m · Focus/)).toBeTruthy();

    // Check move completed appears with move text
    await waitFor(() => expect(screen.getByText('Move completed')).toBeTruthy());
    expect(screen.getByText('Buy new running shoes')).toBeTruthy();

    // Check waypoint reached appears
    expect(screen.getByText('Waypoint reached')).toBeTruthy();
    expect(screen.getByText('Complete 10k run')).toBeTruthy();

    // Check course created appears with 5 waypoints copy
    expect(screen.getByText('Course created')).toBeTruthy();
    expect(screen.getByText('Five waypoints plotted toward your destination.')).toBeTruthy();
  });

  it('shows synthesized Course created item in empty state', async () => {
    (chartApiClient.getCourseLog as jest.Mock).mockResolvedValue({ data: [] });
    useSessionStore.setState({ practiceHistory: [] });

    const screen = render(<V2ChartJourneyScreen />);
    await waitFor(() => expect(screen.getByText('Course created')).toBeTruthy());
    expect(screen.getByText('Five waypoints plotted toward your destination.')).toBeTruthy();
  });
});
