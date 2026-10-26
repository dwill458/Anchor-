jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withRepeat: (value: unknown) => value, withDelay: (_ms: number, value: unknown) => value, withSequence: (...values: unknown[]) => values[values.length - 1], withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; } };
});
jest.mock('@/components/v2/chart/panel/ChartStaticMap', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const actual = jest.requireActual('@/components/v2/chart/panel/ChartStaticMap');
  return {
    ...actual,
    ChartStaticMap: (props: { introProgress?: unknown; onArtReady?: (ready: boolean) => void; onIntroSurfaceSized?: () => void; testID?: string }) => {
      ReactActual.useEffect(() => {
        if (props.introProgress) {
          // Native Skia canvases report both positive sizes before the covered intro releases.
          props.onArtReady?.(true);
          props.onIntroSurfaceSized?.();
        }
      }, [props.introProgress, props.onArtReady, props.onIntroSurfaceSized]);
      return props.introProgress
        ? ReactActual.createElement(View, { testID: props.testID ?? 'chart-static-map-test' })
        : ReactActual.createElement(actual.ChartStaticMap, props);
    },
  };
});
import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { V2ChartScreen } from '../V2ChartScreen';
import { ChartSheet } from '@/components/v2/chart/sheet/ChartSheet';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import type { ChartForAnchor, ChartProposal } from '@/services/v2/chartV2Api';
import type { CourseDetail } from '@/types/chart';
import { queueMilestoneAction } from '@/milestones/queueMilestoneAction';

jest.mock('@/milestones/queueMilestoneAction', () => ({ queueMilestoneAction: jest.fn(async () => undefined) }));

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const mockReplace = jest.fn();
const mockNavigation = { navigate: mockNavigate, replace: mockReplace, goBack: jest.fn(), canGoBack: () => true, setParams: mockSetParams };
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
jest.mock('expo/fetch', () => ({ fetch: jest.fn(async () => { throw new Error('no streaming under jest'); }) }));
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
    if (url.endsWith('/chart/ask')) return { data: { success: true, data: { conversationId: null, messages: [], mode: 'CREATE', courseId: null } } };
    if (url.startsWith('/api/courses/')) return { data: { success: true, data: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: true, isSubscribed: true, isInTrial: false, remoteCompedAccess: false, legacyMigrationAccess: false, devOverrideEnabled: false });
  useAuthStore.setState({ user: { id: 'chart-screen-user' } as never });
  await encryptedPersistStorage.removeItem('anchor:v2:chart2:chart-screen-user:anchor-1');
  mockParams = { anchorId: 'anchor-1' };
  mockReduceMotion = true;
  resetAnchorChartCache();
  resetV2VisionReadCache();
  useAnchorStore.setState({ anchors: [anchor as never] });
});
async function openFullSheet(screen: ReturnType<typeof render>) {
  await screen.findByTestId('chart-sheet-grabber');
  for (let i = 0; i < 8 && screen.getByTestId('chart-sheet-grabber').props.accessibilityLabel !== 'Collapse panel'; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 240)); });
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
  }
  expect(screen.getByTestId('chart-sheet-grabber').props.accessibilityLabel).toBe('Collapse panel');
}

async function renderChartScreen(prepareIntro = false) {
  const screen = render(<V2ChartScreen />);
  const root = prepareIntro ? await screen.findByTestId('v2-chart-screen-empty') : null;
  if (root) {
    fireEvent(root, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 844 } } });
  }
  return screen;
}

/** One assistant message as the server stores it. */
function assistantMessage(text: string, extra: Record<string, unknown> = {}) {
  return {
    id: `assistant-${text.length}-${Math.random().toString(36).slice(2, 8)}`, role: 'ASSISTANT', text, createdAt: '2026-10-21T00:00:00Z',
    attachments: [], suggestions: [], requestPhoto: null, readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, ...extra,
  };
}

/** Plays the server for creation: the next Ask Chart reply, the planner, and the create call. */
function serveCreation(options: { replies?: Array<ReturnType<typeof assistantMessage> | Error>; plan?: 'proposal' | Error } = {}) {
  const replies = [...(options.replies ?? [assistantMessage('You’re working toward ten thousand users. Where is Anchor today?')])];
  post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    if (url.endsWith('/chart/ask')) {
      const next = replies.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error('no scripted Ask Chart reply');
      const userMessage = body.opening
        ? null
        : { id: `user-${Math.random().toString(36).slice(2, 8)}`, role: 'USER', text: body.text, createdAt: '2026-10-21T00:00:01Z', attachments: [], suggestions: [], requestPhoto: null, readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null };
      return { data: { success: true, data: { conversationId: 'conv-1', mode: 'CREATE', userMessage, assistantMessage: next, remembered: null, generation: { source: 'ai', fallbackUsed: false }, replayed: false } } };
    }
    if (url.endsWith('/chart/plan')) {
      if (options.plan instanceof Error) throw options.plan;
      return { data: { success: true, data: { status: 'proposal', proposal } } };
    }
    if (url.endsWith('/chart')) return { data: { success: true, data: activeChart({ id: 'course-new' }) } };
    throw new Error(`unexpected POST ${url} ${JSON.stringify(body)}`);
  });
}

const askCalls = () => post.mock.calls.filter(([url]) => String(url).endsWith('/chart/ask')).map(([, body]) => body as Record<string, unknown>);
const planCalls = () => post.mock.calls.filter(([url]) => String(url).endsWith('/chart/plan')).map(([, body]) => body as Record<string, unknown>);

async function openConversation() {
  const screen = await renderChartScreen(true);
  fireEvent.press(await screen.findByTestId('chart-create-cta'));
  await screen.findByTestId('chart-ask');
  return screen;
}

describe('V2ChartScreen — no Chart', () => {
  it('shows the existing opening, then Continue goes straight into the cream Ask Chart conversation', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation();
    const screen = await renderChartScreen(true);
    expect(await screen.findByText('Let’s chart the distance between here and there.')).toBeTruthy();
    // The etched map replaces the old road art.
    expect(screen.getByTestId('chart-intro-map', { includeHiddenElements: true })).toBeTruthy();

    fireEvent.press(screen.getByTestId('chart-create-cta'));
    expect(await screen.findByTestId('chart-ask')).toBeTruthy();
    expect(screen.getByText('Ask Chart')).toBeTruthy();
    // No standalone starting-photo screen, no written-question screen, no photo requirement.
    expect(screen.queryByTestId('chart-context-step')).toBeNull();
    expect(screen.queryByTestId('chart-starting-context')).toBeNull();
    expect(screen.queryByText('SHOW WHERE YOU ARE NOW')).toBeNull();
    // Photos are optional and always available; voice is offered only where the device can recognise speech.
    expect(screen.getByTestId('ask-plus')).toBeTruthy();
    expect(screen.queryByTestId('ask-mic')).toBeNull();
  });

  it('greets from what the app already knows: an opening turn with no typed text', async () => {
    serve({ chart: readModel(null), vision });
    serveCreation();
    const screen = await openConversation();
    expect(await screen.findByText('You’re working toward ten thousand users. Where is Anchor today?')).toBeTruthy();
    expect(askCalls()).toHaveLength(1);
    expect(askCalls()[0]).toMatchObject({ opening: true });
    expect(askCalls()[0].text).toBeUndefined();
  });

  it('shows the person’s message at once, clears the composer, and offers the route when Ask Chart says it is ready', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({
      replies: [
        assistantMessage('Where is Anchor today?', { suggestions: ['Just launched', 'Pre-launch'] }),
        assistantMessage('That’s enough to draft a route.', {
          readyToPlan: true,
          planInput: { actualStartingPoint: 'App is launched but only has 100 users.', startingContext: 'Solo founder, evenings only', photoAssetIds: [] },
        }),
      ],
    });
    const screen = await openConversation();
    expect(await screen.findByText('Where is Anchor today?')).toBeTruthy();
    expect(screen.getByText('Just launched')).toBeTruthy();
    // No route yet, and drafting early waits until the person has answered twice.
    expect(screen.queryByTestId('ask-build-route')).toBeNull();
    expect(screen.queryByTestId('ask-draft-now')).toBeNull();

    fireEvent.changeText(screen.getByTestId('ask-input'), 'App is launched but only has 100 users.');
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(screen.getByTestId('ask-input').props.value).toBe('');
    expect(await screen.findByText('App is launched but only has 100 users.')).toBeTruthy();
    expect(await screen.findByText('That’s enough to draft a route.')).toBeTruthy();
    expect(await screen.findByTestId('ask-build-route')).toBeTruthy();
    expect(screen.queryByTestId('ask-draft-now')).toBeNull();
    expect(askCalls()[1]).toMatchObject({ text: 'App is launched but only has 100 users.', skill: 'FREE' });
  });

  it('plans from the conversation, then reviews, edits and saves the route — and reveals it', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({
      replies: [
        assistantMessage('Where is Anchor today?'),
        assistantMessage('That’s enough to draft a route.', {
          readyToPlan: true,
          planInput: { actualStartingPoint: 'App is launched but only has 100 users.', startingContext: 'Solo founder, evenings only', photoAssetIds: [] },
        }),
      ],
    });
    const screen = await openConversation();
    await screen.findByText('Where is Anchor today?');
    fireEvent.changeText(screen.getByTestId('ask-input'), 'App is launched but only has 100 users.');
    fireEvent.press(screen.getByTestId('ask-send'));
    fireEvent.press(await screen.findByTestId('ask-build-route'));

    expect(await screen.findByText('Mapping the way there.')).toBeTruthy();
    expect(await screen.findByText(/Here['’]s the course I['’]d start with\./, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("We found 4 meaningful waypoints for this destination. Keep what fits. Change what doesn't.")).toBeTruthy();

    // The route and the One Move are different things: four numbered waypoints, then a separate move for waypoint 1.
    expect(screen.getByText('YOUR ROUTE')).toBeTruthy();
    expect(screen.getByText('4 waypoints')).toBeTruthy();
    expect(screen.getByText('YOUR NEXT MOVE')).toBeTruthy();
    expect(screen.getByTestId('chart-review-one-move-card')).toBeTruthy();

    // The existing planner receives exactly what the conversation produced.
    expect(planCalls()).toHaveLength(1);
    expect(planCalls()[0]).toMatchObject({ actualStartingPoint: 'App is launched but only has 100 users.', startingContext: 'Solo founder, evenings only', followUp: null });
    expect(planCalls()[0].references).toBeUndefined();

    // Rename the first waypoint.
    fireEvent.press(screen.getByLabelText('Waypoint 1 of 4: Validate product-market fit'));
    fireEvent.changeText(screen.getByLabelText('Waypoint 1 title'), 'Validate repeatable acquisition');
    fireEvent(screen.getByLabelText('Waypoint 1 title'), 'submitEditing');

    // The saved Chart exists on the server once the create call lands.
    serve({ chart: readModel(activeChart({ id: 'course-new' })), vision: null });
    // "Looks right" is the confirmation: the existing First Waypoint reveal plays and flows into the permanent Chart.
    fireEvent.press(screen.getByTestId('chart-review-confirm'));
    expect(await screen.findByTestId('chart-current-waypoint', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.queryByTestId('chart-explore')).toBeNull();
    const createCall = post.mock.calls.find(([url]) => url === '/api/v2/anchors/anchor-1/chart')!;
    expect(createCall[1]).toMatchObject({
      destinationText: 'Reach 10,000 active users',
      proposalId: 'proposal-1',
      complexity: 'MODERATE',
      actualStartingPoint: 'App is launched but only has 100 users.',
      oneMove: { title: 'Finish onboarding redesign' },
    });
    expect((createCall[1] as { waypoints: Array<{ title: string }> }).waypoints.map((w) => w.title)).toEqual([
      'Validate repeatable acquisition',
      'Reach 500 active users',
      'Reach 1,000 active users',
      'Reach 10,000 active users',
    ]);
  });

  it('“Draft my route now” plans from what the person wrote, without waiting for the assistant', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({ replies: [assistantMessage('Where is Anchor today?'), assistantMessage('Tell me a bit more?'), assistantMessage('And what is in the way?')] });
    const screen = await openConversation();
    await screen.findByText('Where is Anchor today?');
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Launched, 100 users.');
    fireEvent.press(screen.getByTestId('ask-send'));
    await screen.findByText('Tell me a bit more?');
    expect(screen.queryByTestId('ask-draft-now')).toBeNull();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Mostly evenings.');
    fireEvent.press(screen.getByTestId('ask-send'));
    await screen.findByText('And what is in the way?');
    fireEvent.press(screen.getByTestId('ask-draft-now'));
    expect(await screen.findByText(/Here['’]s the course I['’]d start with\./, {}, { timeout: 3000 })).toBeTruthy();
    expect(planCalls()[0]).toMatchObject({ actualStartingPoint: 'Launched, 100 users. Mostly evenings.', followUp: null });
    expect(planCalls()[0].startingContext).toBeNull();
  });

  it('photos sent in the conversation reach the planner by asset id', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({
      replies: [
        assistantMessage('Where is Anchor today?'),
        assistantMessage('Thanks.', { readyToPlan: true, planInput: { actualStartingPoint: 'See the photo', startingContext: null, photoAssetIds: ['asset-1', 'asset-2'] } }),
      ],
    });
    const screen = await openConversation();
    await screen.findByText('Where is Anchor today?');
    fireEvent.changeText(screen.getByTestId('ask-input'), 'See the photo');
    fireEvent.press(screen.getByTestId('ask-send'));
    fireEvent.press(await screen.findByTestId('ask-build-route'));
    await waitFor(() => expect(planCalls()).toHaveLength(1));
    expect(planCalls()[0].references).toEqual([
      { kind: 'photo', assetId: 'asset-1', role: 'start' },
      { kind: 'photo', assetId: 'asset-2', role: 'extra' },
    ]);
  });

  it('when Ask Chart cannot answer, the message is kept, the reason is shown, and a draft is still possible', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({ replies: [new ApiClientError('down', 'ASK_UNAVAILABLE', 503)] });
    const screen = await openConversation();
    expect(await screen.findByTestId('ask-error')).toBeTruthy();
    expect(screen.getByText(/can’t answer right now/)).toBeTruthy();
    // The person can still get a route from the intention alone.
    fireEvent.press(screen.getByTestId('ask-draft-now'));
    expect(await screen.findByText(/Here['’]s the course I['’]d start with\./, {}, { timeout: 3000 })).toBeTruthy();
    expect(planCalls()[0].actualStartingPoint).toBe('Anchor has ten thousand users');
  });

  it('never strands the user: when generation fails, an outline can be named and saved', async () => {
    serve({ chart: readModel(null), vision: null });
    serveCreation({ plan: new Error('Network error. Please check your connection.'), replies: [assistantMessage('Where is Anchor today?'), assistantMessage('And what is in the way?'), assistantMessage('Got it.')] });
    const screen = await openConversation();
    await screen.findByText('Where is Anchor today?');
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Launched.');
    fireEvent.press(screen.getByTestId('ask-send'));
    await screen.findByText('And what is in the way?');
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Time.');
    fireEvent.press(screen.getByTestId('ask-send'));
    await screen.findByText('Got it.');
    fireEvent.press(screen.getByTestId('ask-draft-now'));
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
    expect(within(current).getByText('Waypoint 2 of 3 · Current')).toBeTruthy();
    expect(within(current).getAllByText('Reach 1,000 active users').length).toBeGreaterThanOrEqual(1);
    await openFullSheet(screen);
    expect(screen.getByText(/^642 \/ 1,000\s*$/)).toBeTruthy();
    expect(within(screen.getByTestId('chart-one-move-row')).getByText('Finish onboarding redesign')).toBeTruthy();
    await openFullSheet(screen);
    await waitFor(() => expect(within(screen.getByTestId('chart-destination')).getByText('Reach 10,000 active users')).toBeTruthy());
    fireEvent.press(screen.getByTestId('chart-view-vision'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Vision', { anchorId: 'anchor-1' });
  });

  it('the sheet opens Ask Chart from "Help me move forward" (the Anchor button is covered by its own unit test: this fixture has no Anchor art)', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    await openFullSheet(screen);
    fireEvent.press(await screen.findByTestId('chart-help-forward'));
    expect(mockNavigate).toHaveBeenCalledWith('V2ChartAsk', { anchorId: 'anchor-1', source: 'sheet' });
  });

  it('without Vision: shows the destination with no stand-in image and no View Vision', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    await openFullSheet(screen);
    await screen.findByTestId('chart-destination');
    expect(screen.queryByTestId('chart-view-vision')).toBeNull();
    expect(screen.queryByLabelText('Your Vision')).toBeNull();
  });

  it('keeps the One Move at peek without inventing a number when the waypoint has no measure', async () => {
    const chart = activeChart();
    chart.waypoints[1] = { ...chart.waypoints[1], kind: 'MILESTONE', metric: null };
    serve({ chart: readModel(chart), vision: null });
    const screen = render(<V2ChartScreen />);
    const current = await screen.findByTestId('chart-current-waypoint');
    expect(within(current).queryByText(/\/ 1,000/)).toBeNull();
    expect(within(screen.getByTestId('chart-one-move-row')).getByText('Finish onboarding redesign')).toBeTruthy();
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
    expect(screen.getByTestId('chart-one-move-title').props.children).toBe('Finish onboarding redesign');
    screen.unmount();
    serve({ chart: readModel(next), vision: null });
    const refreshed = render(<V2ChartScreen />);
    expect(await refreshed.findByText('Launch creator campaign')).toBeTruthy();
  });

  // DEFERRED: (replaced: the current waypoint is no longer a card that opens a separate view; markers focus waypoints in place)
  // DEFERRED: it('opens waypoints, adjustment and the course log', async () => {
  // DEFERRED: serve({ chart: readModel(activeChart()), vision: null });
  // DEFERRED: const screen = render(<V2ChartScreen />);
  // DEFERRED: fireEvent.press(await screen.findByTestId('chart-current-waypoint'));
  // DEFERRED: expect(await screen.findByTestId('chart-waypoint-content')).toBeTruthy();
  // DEFERRED: expect(mockNavigate).not.toHaveBeenCalledWith('V2ChartWaypoint', expect.anything());
  // DEFERRED: fireEvent.press(screen.getByLabelText('Back to Chart'));
  // DEFERRED: expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
  // DEFERRED: fireEvent.press(screen.getByTestId('chart-course-log'));
  // DEFERRED: expect(mockNavigate).toHaveBeenCalledWith('V2ChartJourney', { anchorId: 'anchor-1' });
  // DEFERRED: });
  it('focuses waypoints in place from the map, returns to the current one, and opens the course log', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
    expect(await screen.findByTestId('chart-waypoint-content')).toBeTruthy();
    // Skia is mocked, so report its drawn-frame handoff explicitly. A tap
    // while opening only skips the sequence; wait until the panel unlocks.
    await act(async () => { fireEvent(screen.getByTestId('chart-hero-map'), 'shown'); });
    await waitFor(() => {
      expect(screen.UNSAFE_getByType(ChartSheet).props.busy.value).toBe(false);
    }, { timeout: 3000 });
    // Fog of war: the undiscovered final waypoint is not on the map at all.
    expect(screen.queryByLabelText(/^Waypoint 3/)).toBeNull();
    // Tapping a reached marker shows that waypoint in the panel, read-only, with a way back.
    fireEvent.press(screen.getByLabelText('Waypoint 1: Validate acquisition, reached'));
    expect(await screen.findByText('Waypoint 1 of 3 · Reached')).toBeTruthy();
    expect(screen.queryByTestId('chart-current-waypoint')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalledWith('V2ChartWaypoint', expect.anything());
    fireEvent.press(screen.getByText('Back to waypoint 2'));
    expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
    await openFullSheet(screen);
    // Course log single row navigates directly to course log screen
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
    // DEFERRED: expect(screen.getByText('WAYPOINT REACHED')).toBeTruthy();
    expect(screen.getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(screen.getByText("Look how far you've come.")).toBeTruthy();
    expect(screen.getByTestId('chart-commit')).toBeTruthy();
    expect(queueMilestoneAction).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("I'm committed"));
    await waitFor(() => expect(Boolean(screen.queryByTestId('chart-waypoint-reached'))).toBe(false));
    expect(queueMilestoneAction).toHaveBeenCalledTimes(1);
    expect(mockSetParams).toHaveBeenCalledWith({ reached: undefined });
    expect(queueMilestoneAction).toHaveBeenCalledWith('anchor-1', { kind: 'chart', sourceEntityId: 'course-1', eventId: 'w1' }, expect.any(Function));
    const isActive = (queueMilestoneAction as jest.Mock).mock.calls[0][2] as () => boolean;
    expect(isActive()).toBe(true);
    screen.unmount();
    expect(isActive()).toBe(false);
  });
});

describe('V2ChartScreen — destination and errors', () => {
  it('features a confirmed final-waypoint return only after the settled arrival screen', async () => {
    mockParams = { anchorId: 'anchor-1', reached: { completedTitle: 'Reach 10,000 active users', nextTitle: null, reachedCount: 3, total: 3, destinationReached: true } };
    serve({ chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, currentMoveId: null, reachedCount: 3, completedAt: '2026-12-14T00:00:00Z' })), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText("You've arrived.")).toBeTruthy();
    await waitFor(() => expect(queueMilestoneAction).toHaveBeenCalledWith('anchor-1', { kind: 'chart', sourceEntityId: 'course-1', eventId: 'w3' }, expect.any(Function)));
    expect(queueMilestoneAction).toHaveBeenCalledTimes(1);
  });

  it('destination reached: the real Vision returns as the hero, with real journey numbers', async () => {
    serve({
      chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, currentMoveId: null, completedAt: '2026-12-14T00:00:00Z' })),
      vision,
    });
    const screen = render(<V2ChartScreen />);
    // DEFERRED: expect(await screen.findByText('Destination reached.')).toBeTruthy();
    expect(await screen.findByText("You've arrived.")).toBeTruthy();
    expect(screen.getByText('Waypoint 3 of 3 · Reached')).toBeTruthy();
    await openFullSheet(screen);
    await waitFor(() => expect(screen.getByTestId('chart-reached-vision')).toBeTruthy());
    // DEFERRED: expect(screen.getByLabelText('Moves completed: 28')).toBeTruthy();
    // DEFERRED: expect(screen.getByLabelText('Practices: 74')).toBeTruthy();
    // (the journey numbers now live on the released-Anchor history view, covered below)
    fireEvent.press(screen.getByTestId('chart-view-vision'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Vision', { anchorId: 'anchor-1' });
    fireEvent.press(screen.getByTestId('chart-release-anchor'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Release', { anchorId: 'anchor-1', reason: 'destination_completed' });
  });

  it('destination reached without Vision uses the travelled map, never a stand-in photo', async () => {
    serve({ chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, completedAt: '2026-12-14T00:00:00Z' })), vision: null });
    const screen = render(<V2ChartScreen />);
    // DEFERRED: expect(await screen.findByText('Destination reached.')).toBeTruthy();
    expect(await screen.findByText("You've arrived.")).toBeTruthy();
    expect(screen.queryByTestId('chart-reached-vision')).toBeNull();
  });

  it('released Anchors keep their Chart history and cannot be released again', async () => {
    serve({ chart: readModel(activeChart({ status: 'COMPLETED', currentWaypointId: null, completedAt: '2026-12-14T00:00:00Z' }), true), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByText('Destination reached.')).toBeTruthy();
    expect(screen.getByLabelText('Moves completed: 28')).toBeTruthy();
    expect(screen.getByLabelText('Practices: 74')).toBeTruthy();
    expect(screen.queryByTestId('chart-release-anchor')).toBeNull();
  });

  it('loading is closed weather on map paper, not a spinner, and the screen is a real push', async () => {
    const setOptions = jest.fn();
    Object.assign(mockNavigation, { setOptions });
    try {
      get.mockImplementation((url: string) => (url.endsWith('/chart') ? new Promise(() => undefined) : Promise.reject(new ApiClientError('Not found', 'NOT_FOUND', 404))));
      const screen = render(<V2ChartScreen />);
      expect(screen.getByTestId('v2-chart-screen-loading')).toBeTruthy();
      expect(screen.getByLabelText('Opening your Chart')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(0);
      expect(screen.getByTestId('chart-back')).toBeTruthy();
      expect(setOptions).toHaveBeenCalled();
      setOptions.mock.calls.forEach(([options]) => expect(options).not.toHaveProperty('animation'));
      screen.unmount();
    } finally {
      delete (mockNavigation as { setOptions?: unknown }).setOptions;
    }
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

describe('V2ChartScreen — free accounts view but do not create', () => {
  beforeEach(() => useSubscriptionStore.setState({ devOverrideEnabled: true, devTierOverride: 'free' }));
  afterEach(() => useSubscriptionStore.setState({ devOverrideEnabled: false, devTierOverride: 'pro' }));

  it('opens the Chart paywall directly when a free account tries to create a Chart', async () => {
    serve({ chart: readModel(null), vision: null });
    const screen = render(<V2ChartScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('V2Paywall', {
      context: 'CHART',
      resumeIntent: { type: 'open_chart', anchorId: 'anchor-1' },
    }));
    expect(screen.queryByTestId('chart-create-cta')).toBeNull();
    expect(screen.queryByText('See Anchor Pro')).toBeNull();
  });

  it('still opens an existing Chart', async () => {
    serve({ chart: readModel(activeChart()), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByTestId('chart-current-waypoint')).toBeTruthy();
    expect(screen.queryByTestId('v2-chart-screen-locked')).toBeNull();
  });

  it('keeps saved Chart history available after entitlement expiry', async () => {
    serve({ chart: { ...readModel(null), history: [{ id: 'archive-1', destinationText: 'A completed route', status: 'COMPLETED', completedAt: '2026-09-01T00:00:00Z', reachedCount: 3, waypointCount: 3 }] as ChartForAnchor['history'] }, vision: null });
    render(<V2ChartScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('V2ChartJourney', { anchorId: 'anchor-1' }));
    expect(mockReplace).not.toHaveBeenCalledWith('V2Paywall', expect.anything());
  });

  it('lets an active trial create a Chart', async () => {
    useSubscriptionStore.setState({ devOverrideEnabled: true, devTierOverride: 'trial' });
    serve({ chart: readModel(null), vision: null });
    const screen = render(<V2ChartScreen />);
    expect(await screen.findByTestId('chart-create-cta')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
