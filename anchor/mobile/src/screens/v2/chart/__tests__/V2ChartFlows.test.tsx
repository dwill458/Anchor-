import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { V2ChartWaypointScreen } from '../V2ChartWaypointScreen';
import { V2ChartAdjustScreen } from '../V2ChartAdjustScreen';
import { ChartGenerationStage } from '@/components/v2/chart/ChartGenerationStage';
import {
  CHART_HANDOFF_COOLDOWN_MS,
  ChartMoveHandoff,
  markChartHandoffShown,
  resetChartHandoffMemory,
  shouldOfferChartHandoff,
} from '@/components/v2/chart/ChartMoveHandoff';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import type { CourseDetail } from '@/types/chart';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true, setParams: jest.fn() };
let mockParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/services/ApiClient', () => {
  class ApiClientError extends Error {
    code: string | undefined;
    status: number | undefined;
    details: Record<string, unknown> | undefined;
    constructor(message: string, code?: string, status?: number, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ApiClientError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }
  return { apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() }, ApiClientError };
});

const { ApiClientError } = jest.requireMock('@/services/ApiClient');
const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;
const patch = apiClient.patch as jest.Mock;

function chart(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: 'course-1',
    destinationText: 'Reach 10,000 active users',
    status: 'ACTIVE',
    version: 7,
    currentWaypointId: 'w2',
    currentMoveId: 'm1',
    waypointCount: 3,
    reachedCount: 1,
    plottedAt: '2026-05-31T00:00:00Z',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    anchorId: 'anchor-1',
    waypoints: [
      { id: 'w1', courseId: 'course-1', position: 100, title: 'Validate acquisition', description: null, state: 'REACHED', blockedReason: null, reachedAt: '2026-06-01T00:00:00Z', skippedAt: null, cancelledAt: null, anchorLink: null },
      { id: 'w2', courseId: 'course-1', position: 200, title: 'Reach 1,000 active users', description: 'Growth becomes visible.', kind: 'METRIC', metric: { label: 'active users', baseline: null, target: 1000, current: 642 }, state: 'CURRENT', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
      { id: 'w3', courseId: 'course-1', position: 300, title: 'Reach 10,000 active users', description: null, state: 'UPCOMING', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
    ],
    moves: [
      { id: 'm1', courseId: 'course-1', waypointId: 'w2', title: 'Finish onboarding redesign', rationale: null, source: 'USER', status: 'ACTIVE', position: 100, isCurrent: true, completedAt: null, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's1', courseId: 'course-1', waypointId: 'w2', title: 'Launch creator campaign', rationale: null, source: 'AI', status: 'SUGGESTED', position: 200, isCurrent: false, completedAt: null, createdAt: '2026-06-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

function serve(course: CourseDetail) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/chart')) {
      return {
        data: {
          success: true,
          data: {
            anchor: { id: 'anchor-1', intentionText: 'Anchor has ten thousand users', category: 'career', enhancedImageUrl: null, released: false },
            chart: course,
            history: [],
            stats: { completedMoveCount: 3, practiceCount: 12 },
          },
        },
      };
    }
    if (url.endsWith('/vision')) throw new ApiClientError('Not found', 'NOT_FOUND', 404);
    if (url === `/api/courses/${course.id}`) return { data: { success: true, data: course } };
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await encryptedPersistStorage.removeItem('anchor:v2:chart2:anchor-1');
  resetAnchorChartCache();
  resetV2VisionReadCache();
  resetChartHandoffMemory();
  useAnchorStore.setState({
    anchors: [
      {
        id: 'anchor-1',
        localId: 'anchor-1',
        userId: 'u',
        intentionText: 'Anchor has ten thousand users',
        category: 'career',
        baseSigilSvg: '<svg viewBox="0 0 10 10"></svg>',
        distilledLetters: [],
        structureVariant: 'balanced',
        isCharged: false,
        activationCount: 0,
        chargeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ],
  });
});

describe('Waypoint detail', () => {
  beforeEach(() => {
    mockParams = { anchorId: 'anchor-1', waypointId: 'w2' };
  });

  it('shows progress, your moves and AI suggestions separately — suggestions are not commitments', async () => {
    serve(chart());
    const screen = render(<V2ChartWaypointScreen />);
    expect(await screen.findByText('Waypoint 2 of 3')).toBeTruthy();
    expect(screen.getByText('642 / 1,000')).toBeTruthy();
    expect(screen.getByText('YOUR MOVES')).toBeTruthy();
    expect(screen.getByLabelText('One Move: Finish onboarding redesign')).toBeTruthy();
    expect(screen.getByLabelText('Add suggested move: Launch creator campaign')).toBeTruthy();

    patch.mockResolvedValue({ data: { success: true, data: chart() } });
    fireEvent.press(screen.getByLabelText('Add suggested move: Launch creator campaign'));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/v2/charts/course-1/moves/s1', { accept: true, makeCurrent: false })
    );
  });

  it('adds a user move', async () => {
    serve(chart());
    post.mockResolvedValue({ data: { success: true, data: chart() } });
    const screen = render(<V2ChartWaypointScreen />);
    fireEvent.changeText(await screen.findByTestId('chart-add-move'), 'Email three creators');
    fireEvent(screen.getByTestId('chart-add-move'), 'submitEditing');
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/api/v2/charts/course-1/moves');
    expect(post.mock.calls[0][1]).toMatchObject({ waypointId: 'w2', title: 'Email three creators' });
  });

  it('records measurable progress', async () => {
    serve(chart());
    patch.mockResolvedValue({ data: { success: true, data: chart() } });
    const screen = render(<V2ChartWaypointScreen />);
    fireEvent.press(await screen.findByTestId('chart-waypoint-progress'));
    fireEvent.changeText(screen.getByLabelText('Current active users'), '700');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/v2/charts/course-1/waypoints/w2/progress', { expectedCourseVersion: 7, metricCurrent: 700 })
    );
  });

  it('asks before completing a waypoint, uses one stable key, and returns to the Chart with the real result', async () => {
    serve(chart());
    post.mockResolvedValue({
      data: {
        success: true,
        data: {
          course: {},
          completedWaypoint: { title: 'Reach 1,000 active users' },
          nextWaypoint: { title: 'Reach 10,000 active users' },
          courseCompleted: false,
          completionEventId: 'e1',
          replayed: false,
        },
      },
    });
    const screen = render(<V2ChartWaypointScreen />);
    fireEvent.press(await screen.findByTestId('chart-mark-waypoint'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.press(await screen.findByTestId('chart-reach-yes'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/courses/course-1/waypoints/w2/complete');
    expect(body).toEqual({ idempotencyKey: 'chart2:reach:course-1:w2:7', expectedCourseVersion: 7 });
    expect(mockNavigate).toHaveBeenCalledWith('V2Chart', {
      anchorId: 'anchor-1',
      reached: { completedTitle: 'Reach 1,000 active users', nextTitle: 'Reach 10,000 active users', reachedCount: 2, total: 3, destinationReached: false },
    });
  });

  it('shows reached waypoints as history without completion or suggestions', async () => {
    mockParams = { anchorId: 'anchor-1', waypointId: 'w1' };
    serve(chart());
    const screen = render(<V2ChartWaypointScreen />);
    expect(await screen.findByText('Waypoint 1 of 3 · reached')).toBeTruthy();
    expect(screen.queryByTestId('chart-mark-waypoint')).toBeNull();
    expect(screen.queryByTestId('chart-add-move')).toBeNull();
  });
});

describe('Adjust route (active Chart)', () => {
  beforeEach(() => {
    mockParams = { anchorId: 'anchor-1' };
  });

  const revised = {
    status: 'proposal',
    proposal: {
      proposalId: 'p2',
      kind: 'ADJUST',
      anchorId: 'anchor-1',
      courseId: 'course-1',
      baseCourseVersion: 7,
      destination: 'Reach 10,000 active users',
      complexity: 'MODERATE',
      waypoints: ['Retention holds at 40%', 'Reach 10,000 active users'].map((title, index) => ({
        clientKey: `k${index}`,
        title,
        rationale: null,
        kind: 'MILESTONE',
        metricLabel: null,
        metricTarget: null,
        metricBaseline: null,
      })),
      suggestedOneMove: null,
      guidance: null,
      generation: { source: 'ai', fallbackUsed: false, needsNaming: false },
      createdAt: '',
      expiresAt: '',
    },
  };

  it('quick option + free text → revised route that keeps reached history, confirms before rewriting worked waypoints', async () => {
    serve(chart());
    post.mockResolvedValue({ data: { success: true, data: revised } });
    put
      .mockRejectedValueOnce(new ApiClientError('needs confirmation', 'ROUTE_REWRITE_CONFIRMATION_REQUIRED', 409))
      .mockResolvedValueOnce({ data: { success: true, data: chart({ version: 8 }) } });
    const screen = render(<V2ChartAdjustScreen />);
    fireEvent.press(await screen.findByTestId('chart-adjust-FURTHER_ALONG'));
    fireEvent.changeText(screen.getByTestId('chart-adjust-detail'), 'Acquisition is solved. Retention is the problem.');
    fireEvent.press(screen.getByTestId('chart-adjust-submit'));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({
      reason: 'FURTHER_ALONG',
      detail: 'Acquisition is solved. Retention is the problem.',
      courseId: 'course-1',
    });
    expect(await screen.findByText('Here’s the revised route.')).toBeTruthy();
    expect(screen.getByLabelText('Waypoint 1 of 3: Validate acquisition, reached')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chart-adjust-apply'));
    expect(await screen.findByText('Rewrite part of your route?')).toBeTruthy();
    const firstBody = put.mock.calls[0][1];
    expect(firstBody).toMatchObject({ expectedCourseVersion: 7, confirmRewrite: false, proposalId: 'p2' });
    expect(firstBody.waypoints.map((w: { title: string; id: string | null }) => [w.title, w.id])).toEqual([
      ['Retention holds at 40%', null],
      ['Reach 10,000 active users', 'w3'],
    ]);

    fireEvent.press(screen.getByTestId('chart-rewrite-yes'));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][1]).toMatchObject({ confirmRewrite: true, idempotencyKey: firstBody.idempotencyKey });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('keeps the route unchanged and offers manual editing when revision is unavailable', async () => {
    serve(chart());
    post.mockRejectedValue(new ApiClientError('unavailable', 'CHART_ADJUST_UNAVAILABLE', 503));
    const screen = render(<V2ChartAdjustScreen />);
    fireEvent.press(await screen.findByTestId('chart-adjust-TOO_MANY_STEPS'));
    fireEvent.press(screen.getByTestId('chart-adjust-submit'));
    expect(await screen.findByText('We couldn’t revise the route right now. Your route is unchanged.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-adjust-manual'));
    expect(await screen.findByTestId('chart-adjust-editor')).toBeTruthy();
    expect(screen.getByLabelText('Waypoint 1 of 3: Validate acquisition, reached')).toBeTruthy();
  });

  it('requires detail for "Other"', async () => {
    serve(chart());
    const screen = render(<V2ChartAdjustScreen />);
    fireEvent.press(await screen.findByTestId('chart-adjust-OTHER'));
    expect(screen.getByTestId('chart-adjust-submit').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('SEE → MOVE hand-off', () => {
  it('shows the real One Move once, then rests for the cooldown', async () => {
    serve(chart());
    const screen = render(<ChartMoveHandoff anchorId="anchor-1" surface="visualize" tone="ink" />);
    expect(await screen.findByText('Finish onboarding redesign')).toBeTruthy();
    expect(screen.getByText('You’ve seen the destination.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('View Chart. One Move: Finish onboarding redesign'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1', source: 'visualize' });
    expect(await shouldOfferChartHandoff('anchor-1', 'visualize')).toBe(false);
    expect(await shouldOfferChartHandoff('anchor-1', 'visualize', Date.now() + CHART_HANDOFF_COOLDOWN_MS + 1)).toBe(true);
  });

  it('renders nothing without a One Move, and nothing during the cooldown', async () => {
    serve(chart({ currentMoveId: null }));
    const empty = render(<ChartMoveHandoff anchorId="anchor-1" surface="practice" tone="cream" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(empty.queryByTestId('chart-handoff-practice')).toBeNull();
    empty.unmount();

    resetAnchorChartCache();
    serve(chart());
    markChartHandoffShown('anchor-1', 'practice');
    const resting = render(<ChartMoveHandoff anchorId="anchor-1" surface="practice" tone="cream" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(resting.queryByTestId('chart-handoff-practice')).toBeNull();
  });
});

describe('Generation stage honesty', () => {
  it('never shows waypoint markers until real waypoints exist', async () => {
    const onRevealed = jest.fn();
    const screen = render(
      <ChartGenerationStage width={390} height={600} category="career" markers={null} reducedMotion onRevealed={onRevealed} />
    );
    expect(screen.queryAllByLabelText(/^Waypoint \d of/)).toHaveLength(0);
    expect(screen.getByLabelText('Analyzing your intention')).toBeTruthy();
    expect(onRevealed).not.toHaveBeenCalled();

    screen.rerender(
      <ChartGenerationStage
        width={390}
        height={600}
        category="career"
        markers={[
          { id: 'a', number: 1, state: 'upcoming', accessibilityLabel: 'Waypoint 1 of 2: A' },
          { id: 'b', number: 2, state: 'upcoming', accessibilityLabel: 'Waypoint 2 of 2: B' },
        ]}
        reducedMotion
        onRevealed={onRevealed}
      />
    );
    expect(screen.getAllByLabelText(/^Waypoint \d of 2/)).toHaveLength(2);
    await waitFor(() => expect(onRevealed).toHaveBeenCalledTimes(1));
  });
});
