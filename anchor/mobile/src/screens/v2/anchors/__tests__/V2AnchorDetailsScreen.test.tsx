import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { fetchV2RecommendationContext } from '@/adapters/v2/practice';
jest.mock('@/adapters/v2/practice', () => ({ fetchV2RecommendationContext: jest.fn() }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ useAnchorChart: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> = { anchorId: 'a' };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, addListener: jest.fn(() => jest.fn()) }),
  useRoute: () => ({ params: mockParams, name: 'V2AnchorDetails', key: 'k' }),
}));

import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCourseStore } from '@/stores/courseStore';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { V2AnchorDetailsScreen } from '../V2AnchorDetailsScreen';
import { ToastProvider } from '@/components/ToastProvider';
import { V2DailyShellIntentsProvider } from '@/screens/v2/home/dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { V2_PRACTICE_ARTWORK } from '@/components/v2/practice';
import { apiClient } from '@/services/ApiClient';

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  ApiClientError: class extends Error {},
}));

const destructiveSpy = jest.fn();
const mockUseAnchorChart = useAnchorChart as jest.MockedFunction<typeof useAnchorChart>;

function chartReadModel(overrides: Record<string, unknown> = {}) {
  return {
    anchor: { id: 'a', intentionText: 'A real intention', category: 'career', enhancedImageUrl: null, released: false },
    chart: {
      id: 'course-1',
      status: 'ACTIVE',
      destinationText: 'Reach 1,000 active users',
      currentWaypointId: 'waypoint-2',
      currentMoveId: 'move-1',
      waypoints: [
        { id: 'waypoint-1', position: 0, title: 'Ship the first version', state: 'REACHED' },
        { id: 'waypoint-2', position: 1, title: 'Reach the first 100 users', state: 'CURRENT' },
      ],
      moves: [{ id: 'move-1', title: 'Ask three users for feedback' }],
    },
    history: [],
    stats: null,
    ...overrides,
  };
}

const renderDetails = (intents = {}) =>
  render(
    <ToastProvider>
      <V2DailyShellIntentsProvider intents={intents}>
        <V2AnchorDetailsScreen />
      </V2DailyShellIntentsProvider>
    </ToastProvider>,
  );

it('keeps an unavailable Vision distinct from absence and offers a real retry', async () => {
  useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
  (apiClient.get as jest.Mock).mockRejectedValue(new Error('Offline'));
  renderDetails();
  await waitFor(() => expect(screen.getByLabelText('Retry Vision')).toBeTruthy());
  expect(screen.queryByText('Add Vision')).toBeNull();
  const calls = (apiClient.get as jest.Mock).mock.calls.length;
  fireEvent.press(screen.getByLabelText('Retry Vision'));
  await waitFor(() => expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(calls));
});

it.each([[true, true], [true, false], [false, true], [false, false]])('keeps the workspace hierarchy with Vision=%s Chart=%s', async (hasVision, hasChart) => {
  useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
  if (hasVision) (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: {
    id: 'v-a', anchorId: 'a', status: 'ACTIVE', description: 'My real future',
    scenes: [{ id: 's-a', resolvedImageUrl: 'https://assets.test/real.jpg', sortOrder: 0, isArchived: false }],
  } } });
  if (hasChart) mockUseAnchorChart.mockReturnValue({ data: chartReadModel() as never, loading: false, error: null, refresh: jest.fn() } as never);
  const onOpenVision = jest.fn();
  renderDetails({ onOpenVision });
  await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
  if (hasVision) {
    await waitFor(() => expect(screen.getByTestId('v2-details-vision')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit Vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a', { edit: true });
  }
  const labels = screen.UNSAFE_getAllByType(Text).map(node => node.props.children);
  const order = ['Recommended practice', 'Vision', 'Chart', 'Recent practice', 'Release this Anchor'].map(label => labels.indexOf(label));
  expect(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1]))).toBe(true);
});

beforeEach(() => {
  resetV2VisionReadCache();
  (apiClient.get as jest.Mock).mockResolvedValue({
    data: {
      success: true,
      data: null,
    },
  });
  (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
    recommendation: { action: 'Focus', reason: 'daily_reinforcement' },
    thread: { status: 'AVAILABLE', strength: 50, delta7d: null, delta7dStatus: 'UNAVAILABLE' },
  });
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  destructiveSpy.mockClear();
  mockParams = { anchorId: 'a' };
  mockUseAnchorChart.mockReturnValue({ data: null, loading: false, error: null, refresh: jest.fn() } as never);
  useSettingsStore.setState({ reduceMotion: 'on', focusSessionDuration: 120 });
  // Replace the legacy destructive store actions with a spy: the V2 profile
  // must never call them.
  useAnchorStore.setState({
    anchors: [],
    currentAnchorId: undefined,
    releaseAnchor: destructiveSpy,
    removeAnchor: destructiveSpy,
  });
  useSessionStore.setState({ practiceHistory: [] });
  useCourseStore.setState({
    flags: {
      chart_enabled: false,
      chart_write_enabled: false,
      chart_ai_planner_enabled: false,
      chart_reflections_enabled: false,
      chart_notifications_enabled: false,
      chart_existing_user_intro_enabled: false,
    },
    courses: [],
    activeCourse: null,
    initializationStatus: 'idle',
    errorCode: null,
  });
});

describe('V2AnchorDetailsScreen', () => {
  it('renders the correct Anchor profile with enlarged artwork and metadata', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'I finish what I start', category: 'career', threadStrength: 50 })],
    });
    renderDetails();
    expect(screen.getByText('I finish what I start')).toBeTruthy();
    expect(screen.getByText('CAREER')).toBeTruthy();
    expect(screen.getByTestId('v2-thread-strength-value').props.children).toBe(50);
    expect(screen.getByText('Thread Strength')).toBeTruthy();
  });

  it('shows the enhanced Anchor image when one exists', () => {
    const enhancedImageUrl = 'https://example.test/enhanced-anchor.png';
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', enhancedImageUrl, category: 'desire' })],
    });
    renderDetails();
    expect(screen.UNSAFE_getAllByType(Image).some((node) => node.props.source?.uri === enhancedImageUrl)).toBe(true);
  });

  it('uses the server recommendation and routes Vision and Chart', async () => {
    const onOpenPractice = jest.fn();
    const onOpenVision = jest.fn();
    const onOpenChart = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice, onOpenVision, onOpenChart });

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus', { anchorTransition: false });

    fireEvent.press(screen.getByLabelText('Vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');

    expect(screen.getByLabelText('Create Chart. Map the path from here.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create Chart. Map the path from here.'));
    expect(onOpenChart).toHaveBeenCalledWith('a', undefined);
  });

  it('opens all practice modes from the CTA under recommended practice', async () => {
    const onOpenPractice = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice });

    await waitFor(() => expect(screen.getByTestId('v2-anchor-all-practices')).toBeTruthy());
    expect(screen.getByText('All practice modes')).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-anchor-all-practices'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', undefined, {
      anchorTransition: false,
      returnRoute: 'V2AnchorDetails',
      source: 'anchor_details',
    });
  });

  it('carries the medallion into Practice setup when motion is allowed', async () => {
    useSettingsStore.setState({ reduceMotion: 'off' });
    // Every mocked native view shares one measureInWindow: answer with an on-screen rect.
    const nativeMethodsModule = require('react-native/jest/MockNativeMethods');
    const nativeMethods = (nativeMethodsModule.default ?? nativeMethodsModule) as { measureInWindow: jest.Mock };
    nativeMethods.measureInWindow.mockImplementation((callback: (...rect: number[]) => void) => callback(90, 60, 210, 210));
    const onOpenPractice = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice });

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    // Practice is not pushed until the medallion has left its place.
    expect(onOpenPractice).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
    await waitFor(() => expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus', { anchorTransition: true }));
    expect(onOpenPractice).toHaveBeenCalledTimes(1);
    nativeMethods.measureInWindow.mockReset();
  });

  it('keeps the Chart portal compact and includes destination and One Move in its accessible summary', () => {
    mockUseAnchorChart.mockReturnValue({ data: chartReadModel() as never, loading: false, error: null, refresh: jest.fn() } as never);
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', category: 'career' })] });
    renderDetails();

    expect(screen.getByTestId('v2-details-chart-map')).toBeTruthy();
    expect(screen.getByText('Reach the first 100 users')).toBeTruthy();
    expect(screen.queryByText('Ask three users for feedback')).toBeNull();
    expect(screen.getByLabelText(/Waypoint 2 of 2: Reach the first 100 users\. Toward: Reach 1,000 active users\. Next move: Ask three users for feedback/)).toBeTruthy();
  });

  it('announces the actual destination for a completed Chart', () => {
    const completed = chartReadModel({
      chart: {
        id: 'course-1', status: 'COMPLETED', destinationText: 'Reach 1,000 active users', currentWaypointId: null,
        waypoints: [{ id: 'waypoint-1', position: 0, title: 'Reach 1,000 active users', state: 'REACHED' }], moves: [],
      },
    });
    mockUseAnchorChart.mockReturnValue({ data: completed as never, loading: false, error: null, refresh: jest.fn() } as never);
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', category: 'career' })] });
    renderDetails();

    expect(screen.getByLabelText('Chart complete. Destination: Reach 1,000 active users. Open Chart.')).toBeTruthy();
    expect(screen.getByText('DESTINATION REACHED')).toBeTruthy();
  });

  it('shows a truthful fetch error and retries it', () => {
    const refresh = jest.fn();
    mockUseAnchorChart.mockReturnValue({ data: null, loading: false, error: { kind: 'offline' } as never, refresh } as never);
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', category: 'career' })] });
    renderDetails();

    expect(screen.getByText('Your Chart could not be reached.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retry Chart'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Desire', 'desire'],
    ['Health', 'health'],
    ['Career', 'career'],
  ])('uses the %s Anchor category and intention', (label, category) => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', category: category as 'desire' | 'health' | 'career', intentionText: 'An actual intention' })] });
    renderDetails();
    expect(screen.getByText(label.toUpperCase())).toBeTruthy();
    expect(screen.getByText('An actual intention')).toBeTruthy();
  });

  it('opens the recommended Visualize practice when vision exists', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'v-123',
          anchorId: 'a',
          status: 'ACTIVE',
          description: 'My Vision',
          scenes: [{ id: 's-1', resolvedImageUrl: 'https://example.test/img.jpg', sortOrder: 0, isArchived: false }],
        },
      },
    });
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action: 'Visualize', reason: 'daily_reinforcement' },
      thread: { status: 'AVAILABLE', strength: 42, delta7d: -4, delta7dStatus: 'AVAILABLE' },
    });
    const onOpenPractice = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice });
    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByLabelText(/Thread Strength 42 percent.*down 4 percent this week/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'visualize', { anchorTransition: false });
  });

  it('opens the recommended Focus practice by default', async () => {
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action: 'Focus', reason: 'daily_reinforcement' },
      thread: { status: 'AVAILABLE', strength: 42, delta7d: -4, delta7dStatus: 'AVAILABLE' },
    });
    const onOpenPractice = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice });
    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByLabelText(/Thread Strength 42 percent.*down 4 percent this week/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus', { anchorTransition: false });
  });

  it('renders the Today card for Release recommendation when chart is complete', async () => {
    const completed = chartReadModel({
      chart: {
        id: 'course-1', status: 'COMPLETED', destinationText: 'Reach 1,000 active users', currentWaypointId: null,
        waypoints: [{ id: 'waypoint-1', position: 0, title: 'Reach 1,000 active users', state: 'REACHED' }], moves: [],
      },
    });
    mockUseAnchorChart.mockReturnValue({ data: completed as never, loading: false, error: null, refresh: jest.fn() } as never);
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText('Release')).toBeTruthy();
    expect(screen.getByText('Your Chart is complete.')).toBeTruthy();
    expect(screen.getByText('Recommended practice')).toBeTruthy();
    expect(screen.getByTestId('v2-anchor-today-art').props.source).toBe(V2_PRACTICE_ARTWORK.release);
  });

  it('renders the Today card for Visualize recommendation when vision exists', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'v-123',
          anchorId: 'a',
          status: 'ACTIVE',
          description: 'My Vision Statement',
          scenes: [{ id: 's-1', resolvedImageUrl: 'https://example.test/img.jpg', sortOrder: 0, isArchived: false }],
        },
      },
    });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText('Visualize')).toBeTruthy();
    expect(screen.getByText('Step back into your Vision.')).toBeTruthy();
    expect(screen.getByText('Recommended practice')).toBeTruthy();
    expect(screen.getByTestId('v2-anchor-today-art').props.source).toBe(V2_PRACTICE_ARTWORK.visualize);
  });

  it('renders the Today card for Focus recommendation otherwise', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText('Focus')).toBeTruthy();
    expect(screen.getByText('Hold your anchor in focus.')).toBeTruthy();
    expect(screen.getByText('Recommended practice')).toBeTruthy();
    expect(screen.getByTestId('v2-anchor-today-art').props.source).toBe(V2_PRACTICE_ARTWORK.focus);
  });

  it('renders Vision photographic section when a vision exists with scenes', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'v-123',
          anchorId: 'a',
          status: 'ACTIVE',
          description: 'My RevenueCat dashboard shows 10 thousand active users for Anchor',
          seenToday: true,
          scenes: [
            {
              id: 's-1',
              resolvedImageUrl: 'https://example.test/vision-cover.jpg',
              prompt: 'Desk setup with monitor',
              sortOrder: 0,
              isArchived: false,
            },
            {
              id: 's-2',
              resolvedImageUrl: 'https://example.test/vision-scene-2.jpg',
              prompt: 'Celebration dinner',
              sortOrder: 1,
              isArchived: false,
            },
          ],
        },
      },
    });

    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() =>
      expect(screen.getByText('My RevenueCat dashboard shows 10 thousand active users for Anchor')).toBeTruthy(),
    );
    expect(screen.getByText('Seen today ✓')).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(Image).some((node) => node.props.source?.uri === 'https://example.test/vision-cover.jpg')).toBe(true);
  });

  it('shows a completed Vision preview when the first scene has no URL and the description is empty', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: {
      id: 'v-123', anchorId: 'a', status: 'ACTIVE', description: '', seenToday: false,
      scenes: [
        { id: 's-1', resolvedImageUrl: null, sortOrder: 0, isArchived: false },
        { id: 's-2', resolvedImageUrl: 'https://example.test/vision-scene-2.jpg', sortOrder: 1, isArchived: false },
      ],
    } } });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();
    await waitFor(() => expect(screen.UNSAFE_getAllByType(Image).some(
      node => node.props.source?.uri === 'https://example.test/vision-scene-2.jpg',
    )).toBe(true));
  });

  it('keeps the intention in the header and opens the full Vision from the richer preview', async () => {
    const intention = 'A real intention';
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: {
      id: 'v-123', anchorId: 'a', status: 'ACTIVE', title: intention, description: intention,
      scenes: [
        { id: 's-1', resolvedImageUrl: 'https://example.test/portrait.jpg', sortOrder: 0, isArchived: false },
        { id: 's-2', resolvedImageUrl: 'https://example.test/vehicle.jpg', sortOrder: 1, isArchived: false },
        { id: 's-3', resolvedImageUrl: 'https://example.test/landscape.jpg', sortOrder: 2, isArchived: false },
      ],
    } } });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: intention })] });
    const onOpenVision = jest.fn();
    renderDetails({ onOpenVision });
    await waitFor(() => expect(screen.getByTestId('v2-details-vision')).toBeTruthy());
    // Both animated header modes carry the same intention; the card adds no third copy.
    expect(screen.getAllByText(intention, { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByText('View Vision', { exact: false })).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-details-vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');
  });

  it('opens Release when the chart is complete', async () => {
    const completed = chartReadModel({
      chart: {
        id: 'course-1', status: 'COMPLETED', destinationText: 'Reach 1,000 active users', currentWaypointId: null,
        waypoints: [{ id: 'waypoint-1', position: 0, title: 'Reach 1,000 active users', state: 'REACHED' }], moves: [],
      },
    });
    mockUseAnchorChart.mockReturnValue({ data: completed as never, loading: false, error: null, refresh: jest.fn() } as never);
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action: 'Release', reason: 'destination_reached' },
      thread: { status: 'AVAILABLE', strength: 78, delta7d: 6, delta7dStatus: 'AVAILABLE' },
    });
    const onReleaseAnchor = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onReleaseAnchor });
    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByLabelText(/Thread Strength 78 percent.*up 6 percent this week/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    expect(onReleaseAnchor).toHaveBeenCalledWith('a');
  });

  it('routes Progress with the canonical Anchor id when a local id also exists', () => {
    mockParams = { anchorId: 'local-a' };
    const onOpenProgress = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'server-a', localId: 'local-a' })] });
    renderDetails({ onOpenProgress });
    fireEvent.press(screen.getByTestId('v2-anchor-thread'));
    expect(onOpenProgress).toHaveBeenCalledWith('server-a');
  });

  it('exposes Release as an intent only — it never calls the legacy destructive store actions', () => {
    const onReleaseAnchor = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onReleaseAnchor });

    fireEvent.press(screen.getByLabelText('Release this Anchor'));
    expect(onReleaseAnchor).toHaveBeenCalledWith('a');
    expect(destructiveSpy).not.toHaveBeenCalled();
  });

  it('renders Recent Practice items with relative dates and duration', () => {
    const onOpenProgress = jest.fn();
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a' })],
    });
    useSessionStore.setState({
      practiceHistory: [
        {
          id: 's1',
          anchorId: 'a',
          mode: 'visualize',
          completedAt: new Date().toISOString(),
          durationSeconds: 5,
        } as any,
        {
          id: 's2',
          anchorId: 'a',
          mode: 'focus',
          completedAt: new Date('2026-09-03T12:00:00Z').toISOString(),
          durationSeconds: 10,
        } as any,
      ],
    });

    renderDetails({ onOpenProgress });
    expect(screen.getByText('Recent practice')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders a not-found state for an unknown Anchor', () => {
    mockParams = { anchorId: 'missing' };
    renderDetails();
    expect(screen.getByText('Anchor not found')).toBeTruthy();
  });
});

describe('V2AnchorDetailsScreen options menu', () => {
  beforeEach(() => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'I finish what I start' })] });
  });

  it('opens a menu with the four actions and keeps the old button testIDs on them', () => {
    renderDetails();
    expect(screen.queryByTestId('anchor-options-menu')).toBeNull();
    fireEvent.press(screen.getByLabelText('More Anchor options'));
    expect(screen.getByTestId('anchor-options-menu')).toBeTruthy();
    expect(screen.getByTestId('anchor-detail-share-button')).toBeTruthy();
    expect(screen.getByTestId('anchor-detail-download-png-button')).toBeTruthy();
    expect(screen.getByTestId('anchor-detail-set-wallpaper-button')).toBeTruthy();
    expect(screen.getByTestId('anchor-detail-copy-intention-button')).toBeTruthy();
    expect(screen.getByText('Share anchor')).toBeTruthy();
    expect(screen.getByText('Download PNG')).toBeTruthy();
    expect(screen.getByText('Save as wallpaper')).toBeTruthy();
    expect(screen.getByText('Copy intention')).toBeTruthy();
    // Release and Edit are not menu items.
    expect(screen.getAllByLabelText('Release this Anchor')).toHaveLength(1);
  });

  it('closes on the scrim', () => {
    renderDetails();
    fireEvent.press(screen.getByLabelText('More Anchor options'));
    // The menu is a modal view, so the scrim is (correctly) hidden from assistive tech.
    fireEvent.press(screen.getByTestId('anchor-options-scrim', { includeHiddenElements: true }));
    expect(screen.queryByTestId('anchor-options-menu')).toBeNull();
  });

  it('copies the intention and confirms with a toast', async () => {
    const Clipboard = require('expo-clipboard');
    renderDetails();
    fireEvent.press(screen.getByLabelText('More Anchor options'));
    fireEvent.press(screen.getByTestId('anchor-detail-copy-intention-button'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('I finish what I start'));
    await waitFor(() => expect(screen.getByText('Intention copied')).toBeTruthy());
    expect(screen.queryByTestId('anchor-options-menu')).toBeNull();
  });

  it('opens Share Studio from Share anchor with Minimal selected', () => {
    renderDetails();
    fireEvent.press(screen.getByLabelText('More Anchor options'));
    fireEvent.press(screen.getByTestId('anchor-detail-share-button'));
    expect(screen.getByText('Share Your Anchor')).toBeTruthy();
    expect(screen.getByText('Choose a style to share or save.')).toBeTruthy();
    expect(screen.getByTestId('share-layout-minimal').props.accessibilityState.selected).toBe(true);
    // No Vision on this Anchor: the Vision layout is omitted, not disabled.
    expect(screen.queryByTestId('share-layout-vision')).toBeNull();
  });

  it('Download PNG exports directly instead of opening Share Studio', () => {
    renderDetails();
    fireEvent.press(screen.getByLabelText('More Anchor options'));
    fireEvent.press(screen.getByTestId('anchor-detail-download-png-button'));
    expect(screen.queryByText('Share Your Anchor')).toBeNull();
    expect(screen.queryByText('Export anchor')).toBeNull();
  });

  it('exposes the draggable sheet handle', () => {
    renderDetails();
    expect(screen.getByTestId('v2-details-sheet-handle')).toBeTruthy();
  });

  describe('Section 11 matrix: 12 combinations (hasVision × chartState × hasPractice)', () => {
    const visionCases = [true, false];
    const chartCases = ['none', 'active', 'complete'] as const;
    const practiceCases = [true, false];

    visionCases.forEach((hasVision) => {
      chartCases.forEach((chartState) => {
        practiceCases.forEach((hasPractice) => {
          it(`renders combination: vision=${hasVision}, chart=${chartState}, practiced=${hasPractice}`, async () => {
            if (hasVision) {
              (apiClient.get as jest.Mock).mockResolvedValue({
                data: {
                  success: true,
                  data: {
                    id: 'v-matrix',
                    anchorId: 'a',
                    status: 'ACTIVE',
                    description: 'Matrix Vision',
                    scenes: [{ id: 's-m', resolvedImageUrl: 'https://example.test/matrix.jpg', sortOrder: 0, isArchived: false }],
                  },
                },
              });
            } else {
              (apiClient.get as jest.Mock).mockResolvedValue({ data: { success: true, data: null } });
            }

            if (chartState === 'complete') {
              mockUseAnchorChart.mockReturnValue({
                data: chartReadModel({
                  chart: {
                    id: 'c-matrix', status: 'COMPLETED', destinationText: 'Finished Goal', currentWaypointId: null,
                    waypoints: [{ id: 'w-m', position: 0, title: 'Finished Goal', state: 'REACHED' }], moves: [],
                  },
                }) as never,
                loading: false, error: null, refresh: jest.fn(),
              } as never);
            } else if (chartState === 'active') {
              mockUseAnchorChart.mockReturnValue({
                data: chartReadModel() as never, loading: false, error: null, refresh: jest.fn(),
              } as never);
            } else {
              mockUseAnchorChart.mockReturnValue({ data: null, loading: false, error: null, refresh: jest.fn() } as never);
            }

            useAnchorStore.setState({
              anchors: [makeAnchor({ id: 'a' })],
            });
            useSessionStore.setState({
              practiceHistory: (hasPractice
                ? [
                    {
                      id: 'p-1',
                      anchorId: 'a',
                      practiceMode: 'focus' as const,
                      completedDurationSeconds: 60,
                      completedAt: '2026-10-03T10:00:00Z',
                    },
                  ]
                : []) as any,
            });

            renderDetails();
            const expectedPractice = chartState === 'complete' ? 'Release' : hasVision ? 'Visualize' : 'Focus';
            await waitFor(() => expect(screen.getByText(expectedPractice)).toBeTruthy());

            // 1. Recommended practice adheres to 3-rule cascade:
            if (chartState === 'complete') {
              expect(screen.getByText('Release')).toBeTruthy();
              expect(screen.getByText('Your Chart is complete.')).toBeTruthy();
            } else if (hasVision) {
              expect(screen.getByText('Visualize')).toBeTruthy();
              expect(screen.getByText('Step back into your Vision.')).toBeTruthy();
            } else {
              expect(screen.getByText('Focus')).toBeTruthy();
              expect(screen.getByText('Hold your anchor in focus.')).toBeTruthy();
            }

            // 2. Vision section
            if (hasVision) {
              expect(screen.getByTestId('v2-details-vision')).toBeTruthy();
            } else {
              expect(screen.getByText('Add Vision')).toBeTruthy();
              expect(screen.getByText('See where this leads.')).toBeTruthy();
            }

            // 3. Chart section
            if (chartState !== 'none') {
              expect(screen.getByTestId('v2-details-chart')).toBeTruthy();
            } else {
              expect(screen.getByText('Create Chart')).toBeTruthy();
              expect(screen.getByText('Map the path from here.')).toBeTruthy();
            }

            // 4. Recent practice
            if (hasPractice) {
              expect(screen.getByText('View all →')).toBeTruthy();
            } else {
              expect(screen.getByText('No practice recorded for this Anchor yet.')).toBeTruthy();
            }
          });
        });
      });
    });
  });

  describe('Section 11 layout & styling constraints', () => {
    it('uses 76pt dashed rows for empty Vision and Chart states with no cream fill', async () => {
      mockUseAnchorChart.mockReturnValue({ data: null, loading: false, error: null, refresh: jest.fn() } as never);
      useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
      renderDetails();

      await waitFor(() => expect(screen.getByLabelText('Vision')).toBeTruthy());
      const emptyVisionBtn = screen.getByLabelText('Vision');
      const visionStyle = StyleSheet.flatten(emptyVisionBtn.props.style);
      expect(visionStyle).toMatchObject({
        height: 76,
        borderStyle: 'dashed',
      });
      // Verify no cream background fill
      expect(visionStyle.backgroundColor).not.toBe('#F4EDE0');

      const emptyChartBtn = screen.getByLabelText('Create Chart. Map the path from here.');
      const chartStyle = StyleSheet.flatten(emptyChartBtn.props.style);
      expect(chartStyle).toMatchObject({
        height: 76,
        borderStyle: 'dashed',
      });
      expect(chartStyle.backgroundColor).not.toBe('#F4EDE0');
    });

    it('renders NOT ESTABLISHED without clipping on 360pt width', () => {
      useAnchorStore.setState({
        anchors: [makeAnchor({ id: 'a', threadStrength: undefined })],
      });
      renderDetails();
      const notEstablished = screen.getAllByText('NOT ESTABLISHED');
      expect(notEstablished.length).toBeGreaterThan(0);
      notEstablished.forEach((el) => {
        expect(el.props.numberOfLines).toBe(1);
      });
    });
  });

});
