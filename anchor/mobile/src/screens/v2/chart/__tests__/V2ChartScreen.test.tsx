import React from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { V2ChartScreen } from '../V2ChartScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import type { ChartForAnchor, ChartProposal } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, setParams: mockSetParams };
let mockParams: Record<string, unknown> = { anchorId: 'anchor-1' };

jest.mock('@react-navigation/native', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: mockParams }),
    // Runs once per mount, like a real focus.
    useFocusEffect: (callback: () => void) => ReactActual.useEffect(() => callback(), []),
  };
});

let mockReduceMotion = true;
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => mockReduceMotion }));

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

const { ApiClientError } = jest.requireMock('@/services/ApiClient');
const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const anchor = {
  id: 'anchor-1',
  localId: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Anchor has ten thousand users',
  category: 'desire',
  baseSigilSvg: '<svg viewBox="0 0 10 10"></svg>',
  distilledLetters: [],
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  chargeCount: 0,
  createdAt: new Date('2026-05-01'),
  updatedAt: new Date('2026-05-01'),
};

const vision = {
  id: 'vision-1',
  anchorId: 'anchor-1',
  title: 'The dashboard',
  description: 'My RevenueCat dashboard shows 10 thousand active users for Anchor.',
  status: 'ACTIVE',
  seenToday: false,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  scenes: [
    {
      id: 'scene-1',
      visionId: 'vision-1',
      sourceType: 'AI_GENERATED',
      assetId: 'asset-1',
      resolvedImageUrl: 'https://example.com/dashboard.jpg',
      prompt: null,
      sortOrder: 0,
      isArchived: false,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ],
};

function activeChart(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: 'course-1',
    destinationText: 'Reach 10,000 active users',
    status: 'ACTIVE',
    version: 5,
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
      {
        id: 'w2',
        courseId: 'course-1',
        position: 200,
        title: 'Reach 1,000 active users',
        description: 'Growth becomes visible.',
        kind: 'METRIC',
        metric: { label: 'active users', baseline: null, target: 1000, current: 642 },
        state: 'CURRENT',
        blockedReason: null,
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        anchorLink: null,
      },
      { id: 'w3', courseId: 'course-1', position: 300, title: 'Reach 10,000 active users', description: null, state: 'UPCOMING', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
    ],
    moves: [
      { id: 'm1', courseId: 'course-1', waypointId: 'w2', title: 'Finish onboarding redesign', rationale: null, source: 'AI', status: 'ACTIVE', position: 100, isCurrent: true, completedAt: null, createdAt: '2026-06-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

function readModel(chart: CourseDetail | null, released = false): ChartForAnchor {
  return {
    anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released },
    chart,
    history: [],
    stats: chart ? { completedMoveCount: 28, practiceCount: 74 } : null,
  };
}

const proposal: ChartProposal = {
  proposalId: 'proposal-1',
  kind: 'CREATE',
  anchorId: 'anchor-1',
  courseId: null,
  baseCourseVersion: null,
  destination: 'Reach 10,000 active users',
  complexity: 'MODERATE',
  waypoints: ['Validate product-market fit', 'Reach 500 active users', 'Reach 1,000 active users', 'Reach 10,000 active users'].map((title, index) => ({
    clientKey: `k${index}`,
    title,
    rationale: null,
    kind: 'MILESTONE',
    metricLabel: null,
    metricTarget: null,
    metricBaseline: null,
  })),
  suggestedOneMove: { title: 'Finish onboarding redesign', rationale: null },
  guidance: null,
  generation: { source: 'ai', fallbackUsed: false, needsNaming: false },
  createdAt: '2026-09-22T00:00:00Z',
  expiresAt: '2026-09-23T00:00:00Z',
};

function serve(options: { chart: ChartForAnchor | Error; vision?: typeof vision | null }) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/chart')) {
      if (options.chart instanceof Error) throw options.chart;
      return { data: { success: true, data: options.chart } };
    }
    if (url.endsWith('/vision')) {
      if (!options.vision) throw new ApiClientError('Not found', 'NOT_FOUND', 404);
      return { data: { success: true, data: options.vision } };
    }
    if (url.startsWith('/api/courses/')) return { data: { success: true, data: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await encryptedPersistStorage.removeItem('anchor:v2:chart2:anchor-1');
  mockParams = { anchorId: 'anchor-1' };
  mockReduceMotion = true;
  resetAnchorChartCache();
  resetV2VisionReadCache();
  useAnchorStore.setState({ anchors: [anchor as never] });
});

describe('V2ChartScreen — no Chart', () => {
  it('without Vision: shows the empty state, asks where they are starting from, no fake imagery', async () => {
    serve({ chart: readModel(null), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Give this Anchor somewhere to go.')).toBeTruthy();
    expect(screen.getByText('REINFORCING')).toBeTruthy();
    expect(screen.queryByText(/Gentle S|Wide zig-zag|Rising arc|Double bend/)).toBeNull();

    fireEvent.press(screen.getByTestId('chart-create-cta'));
    expect(await screen.findByTestId('chart-starting-context')).toBeTruthy();
    expect(screen.queryByTestId('chart-vision-context')).toBeNull();
    expect(screen.getByText('What would make this recognizably real?')).toBeTruthy();
  });

  it('with Vision: acknowledges the real Vision instead of asking for the destination again', async () => {
    serve({ chart: readModel(null), vision });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-create-cta'));
    await waitFor(() => expect(screen.getByTestId('chart-vision-context')).toBeTruthy());
    expect(screen.getByText('YOU’VE ALREADY SEEN IT.')).toBeTruthy();
    expect(screen.getByText(vision.description)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('View Vision'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Vision', { anchorId: 'anchor-1' });
  });

  it('generates, reviews, edits and saves a route — then reveals it', async () => {
    serve({ chart: readModel(null), vision: null });
    post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url.endsWith('/chart/plan')) return { data: { success: true, data: { status: 'proposal', proposal } } };
      if (url.endsWith('/chart')) return { data: { success: true, data: activeChart({ id: 'course-new' }) } };
      throw new Error(`unexpected POST ${url} ${JSON.stringify(body)}`);
    });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-create-cta'));
    fireEvent.changeText(screen.getByTestId('chart-starting-input'), 'App is launched but only has 100 users.');
    fireEvent.press(screen.getByTestId('chart-context-continue'));

    expect(await screen.findByText('Mapping the space between.')).toBeTruthy();
    expect(await screen.findByText('Here’s a route to start with.', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('We found 4 meaningful waypoints for this destination. Keep what fits. Change what doesn’t.')).toBeTruthy();

    const planBody = post.mock.calls.find(([url]) => url.endsWith('/chart/plan'))![1];
    expect(planBody).toMatchObject({ startingContext: 'App is launched but only has 100 users.', followUp: null });

    // Rename the first waypoint.
    fireEvent.press(screen.getByLabelText('Waypoint 1 of 4: Validate product-market fit'));
    fireEvent.changeText(screen.getByLabelText('Waypoint 1 title'), 'Validate repeatable acquisition');
    fireEvent(screen.getByLabelText('Waypoint 1 title'), 'submitEditing');

    fireEvent.press(screen.getByTestId('chart-review-confirm'));
    expect(await screen.findByText('Your route is ready.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-explore'));
    expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
    const createCall = post.mock.calls.find(([url]) => url === '/api/v2/anchors/anchor-1/chart')!;
    expect(createCall[1]).toMatchObject({
      destinationText: 'Reach 10,000 active users',
      proposalId: 'proposal-1',
      complexity: 'MODERATE',
      oneMove: { title: 'Finish onboarding redesign' },
    });
    expect((createCall[1] as { waypoints: Array<{ title: string }> }).waypoints.map((w) => w.title)).toEqual([
      'Validate repeatable acquisition',
      'Reach 500 active users',
      'Reach 1,000 active users',
      'Reach 10,000 active users',
    ]);
  });

  it('asks one follow-up question, then plans with the answer', async () => {
    serve({ chart: readModel(null), vision: null });
    post
      .mockResolvedValueOnce({ data: { success: true, data: { status: 'needs_context', followUpQuestion: 'Where are you starting from now?' } } })
      .mockResolvedValueOnce({ data: { success: true, data: { status: 'proposal', proposal } } });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-create-cta'));
    fireEvent.changeText(screen.getByTestId('chart-starting-input'), 'Just starting');
    fireEvent.press(screen.getByTestId('chart-context-continue'));
    expect(await screen.findByText('Where are you starting from now?')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('chart-follow-up-input'), '100 users, no marketing yet');
    fireEvent.press(screen.getByTestId('chart-follow-up-continue'));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toMatchObject({
      followUp: { question: 'Where are you starting from now?', answer: '100 users, no marketing yet' },
    });
  });

  it('never strands the user: when generation fails, an outline can be named and saved', async () => {
    serve({ chart: readModel(null), vision: null });
    post.mockImplementation(async (url: string) => {
      if (url.endsWith('/chart/plan')) throw new Error('Network error. Please check your connection.');
      return { data: { success: true, data: activeChart() } };
    });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-create-cta'));
    fireEvent.changeText(screen.getByTestId('chart-starting-input'), 'Starting from zero');
    fireEvent.press(screen.getByTestId('chart-context-continue'));
    expect(await screen.findByTestId('chart-generation-failed')).toBeTruthy();
    expect(screen.getByText('You’re offline. Chart needs a connection for this.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chart-generation-manual'));
    expect(await screen.findByTestId('chart-route-editor')).toBeTruthy();
    // Unnamed outline rows must be named before saving.
    expect(screen.getByTestId('chart-review-confirm').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('V2ChartScreen — active Chart', () => {
  it('answers where am I, where am I going, what next — with the real Vision', async () => {
    serve({ chart: readModel(activeChart()), vision });
    const screen = render(<V2ChartScreen />);
    const current = await screen.findByTestId('chart-current-waypoint');
    expect(within(current).getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(within(current).getByText('2 of 3')).toBeTruthy();
    expect(within(current).getByText('Reach 1,000 active users')).toBeTruthy();
    expect(within(current).getByText('642 / 1,000')).toBeTruthy();
    expect(within(screen.getByTestId('chart-one-move')).getByText('Finish onboarding redesign')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByTestId('chart-destination')).getByText(vision.description)).toBeTruthy());
    fireEvent.press(screen.getByTestId('chart-view-vision'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Vision', { anchorId: 'anchor-1' });
  });

  it('without Vision: shows the destination with no stand-in image and no View Vision', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    await screen.findByTestId('chart-destination');
    expect(screen.queryByTestId('chart-view-vision')).toBeNull();
    expect(screen.queryByLabelText('Your Vision')).toBeNull();
  });

  it('shows the rationale instead of a bar when the waypoint has no measure', async () => {
    const chart = activeChart();
    chart.waypoints[1] = { ...chart.waypoints[1], kind: 'MILESTONE', metric: null };
    serve({ chart: readModel(chart), vision: null });
    const screen = render(<V2ChartScreen />);
    const current = await screen.findByTestId('chart-current-waypoint');
    expect(within(current).queryByText(/\/ 1,000/)).toBeNull();
    expect(within(current).getByText('Growth becomes visible.')).toBeTruthy();
  });

  it('completes the One Move through the server and shows the next one', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const next = activeChart({
      currentMoveId: 'm2',
      moves: [
        { ...activeChart().moves![0], status: 'COMPLETED', isCurrent: false, completedAt: '2026-09-22T00:00:00Z' },
        { id: 'm2', courseId: 'course-1', waypointId: 'w2', title: 'Launch creator campaign', rationale: null, source: 'USER', status: 'ACTIVE', position: 200, isCurrent: true, completedAt: null, createdAt: '2026-09-02T00:00:00Z' },
      ],
    });
    post.mockResolvedValue({ data: { success: true, data: { chart: next, completedMoveId: 'm1', nextMoveId: 'm2', replayed: false } } });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-one-move-check'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v2/charts/course-1/moves/m1/complete'));
    expect(await screen.findByText('Launch creator campaign')).toBeTruthy();
  });

  it('opens waypoints, adjustment and the course log', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    fireEvent.press(await screen.findByTestId('chart-current-waypoint'));
    expect(mockNavigate).toHaveBeenCalledWith('V2ChartWaypoint', { anchorId: 'anchor-1', waypointId: 'w2' });
    fireEvent.press(screen.getByTestId('chart-course-log'));
    expect(mockNavigate).toHaveBeenCalledWith('V2ChartJourney', { anchorId: 'anchor-1' });
  });

  it('plays the waypoint-reached moment once, then clears the route param', async () => {
    mockParams = {
      anchorId: 'anchor-1',
      reached: { completedTitle: 'Validate acquisition', nextTitle: 'Reach 1,000 active users', reachedCount: 1, total: 3, destinationReached: false },
    };
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(screen.getByText('WAYPOINT REACHED')).toBeTruthy();
    expect(mockSetParams).toHaveBeenCalledWith({ reached: undefined });
  });
});

describe('V2ChartScreen — destination and errors', () => {
  it('destination reached: the real Vision returns as the hero, with real journey numbers', async () => {
    serve({
      chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, currentMoveId: null, completedAt: '2026-12-14T00:00:00Z' })),
      vision,
    });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Destination reached.')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('chart-reached-vision')).toBeTruthy());
    expect(screen.getByLabelText('Moves completed: 28')).toBeTruthy();
    expect(screen.getByLabelText('Practices: 74')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-release-anchor'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Release', { anchorId: 'anchor-1', reason: 'destination_completed' });
  });

  it('destination reached without Vision uses the travelled map, never a stand-in photo', async () => {
    serve({ chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, completedAt: '2026-12-14T00:00:00Z' })), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Destination reached.')).toBeTruthy();
    expect(screen.queryByTestId('chart-reached-vision')).toBeNull();
  });

  it('released Anchors keep their Chart history and cannot be released again', async () => {
    serve({ chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, completedAt: '2026-12-14T00:00:00Z' }), true), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Destination reached.')).toBeTruthy();
    expect(screen.queryByTestId('chart-release-anchor')).toBeNull();
  });

  it('offers a retry when the Chart cannot be loaded', async () => {
    serve({ chart: new Error('Network error. Please check your connection.'), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('You’re offline. Chart needs a connection for this.')).toBeTruthy();
    serve({ chart: readModel(activeChart()), vision: null });
    fireEvent.press(screen.getByTestId('chart-retry'));
    expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
  });

  it('offline: opens the locally saved Chart and says changes need a connection', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const first = render(<V2ChartScreen />);
    await first.findByTestId('chart-current-waypoint');
    first.unmount();
    // Encrypted writes are debounced; a cold start happens long after the flush.
    await new Promise((resolve) => setTimeout(resolve, 600));
    resetAnchorChartCache();
    serve({ chart: new Error('Network error. Please check your connection.'), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Showing your saved Chart. Changes need a connection.')).toBeTruthy();
    expect(screen.getByTestId('chart-current-waypoint')).toBeTruthy();
  });

  it('a backend without Chart reads as not available yet, not as a missing Anchor', async () => {
    serve({ chart: new ApiClientError('Cannot GET /api/v2/anchors/a1/chart', 'NOT_FOUND', 404), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Chart isn’t available yet.')).toBeTruthy();
    expect(screen.queryByText('This Anchor is no longer available.')).toBeNull();
    expect(screen.getByTestId('chart-retry')).toBeTruthy();
  });

  it('still names a genuinely missing Anchor', async () => {
    serve({ chart: new ApiClientError('Anchor not found', 'ANCHOR_NOT_FOUND', 404), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('This Anchor is no longer available.')).toBeTruthy();
  });

  it('explains when Chart is switched off rather than showing a technical error', async () => {
    serve({ chart: new ApiClientError('Chart is currently disabled', 'FEATURE_DISABLED', 403), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Chart isn’t available yet.')).toBeTruthy();
    expect(screen.queryByText(/disabled/)).toBeNull();
  });
});
