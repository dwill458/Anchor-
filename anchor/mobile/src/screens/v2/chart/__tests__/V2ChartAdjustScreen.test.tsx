import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { V2ChartAdjustScreen } from '../V2ChartAdjustScreen';
import { apiClient } from '@/services/ApiClient';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useChartRouteRevisionStore } from '@/stores/v2/chartRouteRevisionStore';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
let canGoBackValue = true;
const mockNavigation = {
  navigate: mockNavigate,
  replace: mockReplace,
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

// Reduced by default (the pre-existing tests); the motion tests below switch it off.
let mockReduce = true;
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => mockReduce }));
jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay) };
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

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const anchor = {
  id: 'anchor-1',
  localId: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Acquire 10,000 customers',
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
  destinationText: 'Reach $100k ARR',
  status: 'ACTIVE',
  version: 1,
  currentWaypointId: 'wp-1',
  currentMoveId: 'm1',
  waypointCount: 3,
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
      title: 'First 10 paying customers',
      description: 'Initial traction',
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
      title: 'Reach $10k MRR',
      description: 'Repeatable sales',
      kind: 'MILESTONE',
      state: 'CURRENT',
      blockedReason: null,
      reachedAt: null,
      skippedAt: null,
      cancelledAt: null,
      anchorLink: null,
    },
    {
      id: 'wp-3',
      courseId: 'course-1',
      position: 300,
      title: 'Reach $100k ARR',
      description: 'Scale',
      kind: 'MILESTONE',
      state: 'UPCOMING',
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
            stats: { completedMoveCount: 3, practiceCount: 12 },
          },
        },
      };
    }
    return { data: { success: true, data: null } };
  });
}

describe('V2ChartAdjustScreen — Adjust Route redesign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    canGoBackValue = true;
    mockParams = { anchorId: 'anchor-1' };
    useAuthStore.setState({ user: { id: 'test-user' } as never });
    resetAnchorChartCache();
    useAnchorStore.setState({
      anchors: [anchor as never],
    });
    serveChart();
  });

  it('renders header with serif title, category pill, destination, and back button, without menu button', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    const root = await screen.findByTestId('v2-chart-adjust');
    expect(root).toBeTruthy();

    expect(screen.getByText('Adjust Route')).toBeTruthy();
    expect(screen.getByText('DESIRE')).toBeTruthy();
    expect(screen.getByText('Reach $100k ARR')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-back')).toBeTruthy();

    // Verify NO menu button (•••) exists
    expect(screen.queryByLabelText('Chart options')).toBeNull();
    expect(screen.queryByTestId('chart-menu')).toBeNull();
  });

  it('displays serif heading "What should we change?" without redundant eyebrow', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    expect(screen.getByText('What should we change?')).toBeTruthy();
    expect(screen.getByText('Tell Anchor what feels too difficult, too easy, or missing. Use your own words.')).toBeTruthy();
  });

  it('renders all required adjustment reason chips', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    expect(screen.getByTestId('chart-adjust-SMALLER_STEPS')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-STARTING_FROM_ZERO')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-CHANGE_APPROACH')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-FURTHER_ALONG')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-CHANGE_DESTINATION')).toBeTruthy();

  });

  it('displays textarea with 0/500 character counter and protected waypoints note', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    expect(screen.getByTestId('chart-adjust-detail')).toBeTruthy();
    expect(screen.getByText('0/500')).toBeTruthy();
    expect(screen.getByText(/Waypoints you’ve reached stay as they are\./)).toBeTruthy();
  });

  it('Primary CTA is disabled until a chip is selected or text is entered', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    const submitBtn = screen.getByTestId('chart-adjust-submit');
    // Initially disabled
    expect(submitBtn.props.accessibilityState).toMatchObject({ disabled: true });

    // Selecting a standard chip enables CTA
    fireEvent.press(screen.getByTestId('chart-adjust-SMALLER_STEPS'));
    expect(submitBtn.props.accessibilityState).toMatchObject({ disabled: false });

    // Deselecting chip disables CTA again
    fireEvent.press(screen.getByTestId('chart-adjust-SMALLER_STEPS'));
    expect(submitBtn.props.accessibilityState).toMatchObject({ disabled: true });

    // Entering text without chip enables CTA
    fireEvent.changeText(screen.getByTestId('chart-adjust-detail'), 'I need to skip step 2');
    expect(screen.getByText('21/500')).toBeTruthy();
    expect(submitBtn.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('renders "Edit the route yourself" secondary link and opens editor', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    const manualLink = screen.getByTestId('chart-adjust-manual');
    expect(manualLink).toBeTruthy();
    expect(within(manualLink).getByText('Edit the route yourself')).toBeTruthy();

    fireEvent.press(manualLink);
    expect(await screen.findByTestId('chart-adjust-editor')).toBeTruthy();
  });

  it('renders "Archive this route" link and triggers archive on confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: { ...activeCourse, status: 'ARCHIVED' } },
    });

    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    const archiveLink = screen.getByTestId('chart-adjust-archive');
    expect(archiveLink).toBeTruthy();

    fireEvent.press(archiveLink);
    expect(alertSpy).toHaveBeenCalledWith(
      'Archive this Chart?',
      expect.stringContaining('This route will be moved to your history'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const archiveBtn = buttons.find((b: any) => b.text === 'Archive Chart');
    expect(archiveBtn).toBeDefined();

    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released: false },
          chart: null,
          history: [{ ...activeCourse, status: 'ARCHIVED' }],
          stats: null,
        },
      },
    });

    archiveBtn.onPress();

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/charts/course-1/archive',
        { expectedCourseVersion: 1 }
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });

  it('renders "Delete this route" link and triggers delete on confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (apiClient.delete as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: { deleted: true } },
    });

    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    const deleteLink = screen.getByTestId('chart-adjust-delete');
    expect(deleteLink).toBeTruthy();

    fireEvent.press(deleteLink);
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete this Chart?',
      expect.stringContaining('This will permanently remove this route'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const deleteBtn = buttons.find((b: any) => b.text === 'Delete Chart');
    expect(deleteBtn).toBeDefined();

    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released: false },
          chart: null,
          history: [],
          stats: null,
        },
      },
    });

    deleteBtn.onPress();

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/v2/charts/course-1',
        { data: { expectedCourseVersion: 1 } }
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });
});

describe('V2ChartAdjustScreen motion', () => {
  const withDelay = Reanimated.withDelay as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReduce = false;
    canGoBackValue = true;
    mockParams = { anchorId: 'anchor-1' };
    useAuthStore.setState({ user: { id: 'test-user' } as never });
    resetAnchorChartCache();
    useAnchorStore.setState({ anchors: [anchor as never] });
    serveChart();
  });

  afterEach(() => {
    mockReduce = true;
  });

  it('stages the heading and the panel in once, keeping every control on screen', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');
    expect(withDelay).toHaveBeenCalled();
    expect(screen.getByText('What should we change?')).toBeTruthy();
    for (const id of ['chart-adjust-active', 'chart-adjust-manual', 'chart-adjust-archive', 'chart-adjust-delete']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    const longest = Math.max(...withDelay.mock.calls.map(([delay]) => delay as number));
    expect(longest).toBeLessThanOrEqual(6 * 60);
  });

  it('swaps between asking and reviewing in place, without staging the sections in again', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');
    const afterMount = withDelay.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId('chart-adjust-manual'));
    expect(await screen.findByTestId('chart-adjust-editor')).toBeTruthy();
    expect(withDelay.mock.calls.length).toBe(afterMount);

    fireEvent.press(screen.getByTestId('chart-adjust-back'));
    expect(await screen.findByTestId('chart-adjust-active')).toBeTruthy();
    expect(withDelay.mock.calls.length).toBe(afterMount);
  });
});

describe('V2ChartAdjustScreen — route-revised signal (R1)', () => {
  const put = apiClient.put as jest.Mock;
  const pending = () => useChartRouteRevisionStore.getState().pending;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReduce = true;
    canGoBackValue = true;
    mockParams = { anchorId: 'anchor-1' };
    useAuthStore.setState({ user: { id: 'test-user' } as never });
    resetAnchorChartCache();
    useChartRouteRevisionStore.setState({ pending: null, lastNonce: 0 });
    useAnchorStore.setState({ anchors: [anchor as never] });
    serveChart();
  });

  async function openEditorAndApply(screen: ReturnType<typeof render>) {
    await screen.findByTestId('v2-chart-adjust');
    fireEvent.press(screen.getByTestId('chart-adjust-manual'));
    await screen.findByTestId('chart-adjust-editor');
    fireEvent.press(screen.getByTestId('chart-adjust-apply'));
  }

  const changedCourse = () => ({
    ...activeCourse,
    version: 2,
    waypoints: activeCourse.waypoints.map((item) => (item.id === 'wp-3' ? { ...item, title: 'Reach $250k ARR' } : item)),
  });

  it('fires once for a saved revision that changed the route, and confirms it with Route Updated', async () => {
    put.mockResolvedValueOnce({ data: { success: true, data: changedCourse() } });
    const screen = render(<V2ChartAdjustScreen />);
    await openEditorAndApply(screen);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('V2ChartRouteUpdated', expect.objectContaining({ anchorId: 'anchor-1', source: 'adjust', change: expect.objectContaining({ kind: 'ROUTE_REVISED', aheadCount: 2 }) }));
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(pending()).toMatchObject({ nonce: 1, anchorId: 'anchor-1', courseId: 'course-1' });
  });

  it('does not fire for a no-op apply (the server returns the same route)', async () => {
    put.mockResolvedValueOnce({ data: { success: true, data: { ...activeCourse, version: 2 } } });
    const screen = render(<V2ChartAdjustScreen />);
    await openEditorAndApply(screen);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    // Nothing changed, so there is nothing to confirm.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(pending()).toBeNull();
  });

  it('does not fire when the apply fails', async () => {
    put.mockRejectedValueOnce(new Error('network'));
    const screen = render(<V2ChartAdjustScreen />);
    await openEditorAndApply(screen);
    await waitFor(() => expect(put).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('chart-adjust-apply').props.accessibilityState?.busy ?? false).toBe(false));
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(pending()).toBeNull();
  });

  it('does not fire when the user backs out without applying', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');
    fireEvent.press(screen.getByTestId('chart-adjust-manual'));
    await screen.findByTestId('chart-adjust-editor');
    fireEvent.press(screen.getByTestId('chart-adjust-back'));
    fireEvent.press(await screen.findByTestId('chart-adjust-back'));
    expect(put).not.toHaveBeenCalled();
    expect(pending()).toBeNull();
  });

  it('does not fire while the rewrite is only awaiting confirmation, and fires once when it is confirmed', async () => {
    const { ApiClientError } = jest.requireMock('@/services/ApiClient');
    put.mockRejectedValueOnce(new ApiClientError('confirm', 'ROUTE_REWRITE_CONFIRMATION_REQUIRED', 409));
    put.mockResolvedValueOnce({ data: { success: true, data: changedCourse() } });
    const screen = render(<V2ChartAdjustScreen />);
    await openEditorAndApply(screen);
    fireEvent.press(await screen.findByTestId('chart-rewrite-yes'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('V2ChartRouteUpdated', expect.anything()));
    expect(put).toHaveBeenCalledTimes(2);
    expect(pending()).toMatchObject({ nonce: 1, courseId: 'course-1' });
  });
});

describe('V2ChartAdjustScreen — opened on a route Ask Chart prepared', () => {
  const put = apiClient.put as jest.Mock;
  const proposal = {
    proposalId: 'prop-1',
    kind: 'ADJUST',
    anchorId: 'anchor-1',
    courseId: 'course-1',
    baseCourseVersion: 1,
    destination: 'Reach $100k ARR',
    complexity: 'MODERATE',
    waypoints: [
      { clientKey: 'k1', title: 'Reach $10k MRR', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
      { clientKey: 'k2', title: 'Reach $50k ARR', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null },
    ],
    suggestedOneMove: null,
    guidance: null,
    generation: { source: 'ai', fallbackUsed: false, needsNaming: false },
    createdAt: '2026-10-21T00:00:00Z',
    expiresAt: '2026-10-22T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReduce = true;
    canGoBackValue = true;
    mockParams = { anchorId: 'anchor-1', proposalId: 'prop-1', askMessageId: 'msg-1' };
    useAuthStore.setState({ user: { id: 'test-user' } as never });
    resetAnchorChartCache();
    useAnchorStore.setState({ anchors: [anchor as never] });
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/proposals/prop-1')) return { data: { success: true, data: proposal } };
      if (url.endsWith('/chart')) {
        return { data: { success: true, data: { anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released: false }, chart: activeCourse, history: [], stats: { completedMoveCount: 3, practiceCount: 12 } } } };
      }
      return { data: { success: true, data: null } };
    });
  });

  it('opens straight on the review of that route, without asking the question again', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('chart-adjust-editor');
    expect(get).toHaveBeenCalledWith('/api/v2/charts/course-1/proposals/prop-1');
    expect(screen.queryByTestId('chart-adjust-manual')).toBeNull();
    // Reading the proposal changed nothing.
    expect(put).not.toHaveBeenCalled();
  });

  it('applies it against the version it was prepared for, tells Ask Chart once saved, and confirms with Route Updated', async () => {
    put.mockResolvedValueOnce({ data: { success: true, data: { ...activeCourse, version: 2, waypoints: activeCourse.waypoints.map((item) => (item.id === 'wp-3' ? { ...item, title: 'Reach $50k ARR' } : item)) } } });
    post.mockResolvedValue({ data: { success: true, data: { applied: true } } });
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('chart-adjust-editor');
    fireEvent.press(screen.getByTestId('chart-adjust-apply'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toMatchObject({ expectedCourseVersion: 1, proposalId: 'prop-1', adjustmentReason: 'ASK_CHART' });
    expect(post).toHaveBeenCalledWith('/api/v2/charts/course-1/ask/msg-1/route-applied');
    expect(mockReplace).toHaveBeenCalledWith('V2ChartRouteUpdated', expect.objectContaining({ source: 'ask', change: expect.objectContaining({ kind: 'ROUTE_REVISED' }) }));
  });

  it('does not tell Ask Chart anything when the route was not saved', async () => {
    put.mockRejectedValueOnce(new Error('network'));
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('chart-adjust-editor');
    fireEvent.press(screen.getByTestId('chart-adjust-apply'));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(post).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the question with an error when the proposal is no longer available', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/proposals/prop-1')) throw new Error('gone');
      return { data: { success: true, data: { anchor: { id: 'anchor-1', intentionText: anchor.intentionText, category: 'desire', enhancedImageUrl: null, released: false }, chart: activeCourse, history: [], stats: null } } };
    });
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('chart-adjust-manual');
    expect(screen.queryByTestId('chart-adjust-editor')).toBeNull();
  });
});
