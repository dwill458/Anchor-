import React from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { V2ChartAdjustScreen } from '../V2ChartAdjustScreen';
import { apiClient } from '@/services/ApiClient';
import { resetAnchorChartCache } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';

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

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => true }));

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

  it('displays serif heading "Where does the route need to change?" without redundant eyebrow', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    expect(screen.getByText('Where does the route need to change?')).toBeTruthy();
    expect(screen.getByText('Tell us what isn’t working and we’ll suggest a new route.')).toBeTruthy();
  });

  it('renders all required adjustment reason chips', async () => {
    const screen = render(<V2ChartAdjustScreen />);
    await screen.findByTestId('v2-chart-adjust');

    expect(screen.getByTestId('chart-adjust-TOO_MANY_STEPS')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-TOO_FEW_STEPS')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-DIFFERENT_MILESTONES')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-FURTHER_ALONG')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-CHANGE_DESTINATION')).toBeTruthy();
    expect(screen.getByTestId('chart-adjust-OTHER')).toBeTruthy();
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
    fireEvent.press(screen.getByTestId('chart-adjust-TOO_MANY_STEPS'));
    expect(submitBtn.props.accessibilityState).toMatchObject({ disabled: false });

    // Deselecting chip disables CTA again
    fireEvent.press(screen.getByTestId('chart-adjust-TOO_MANY_STEPS'));
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
});
