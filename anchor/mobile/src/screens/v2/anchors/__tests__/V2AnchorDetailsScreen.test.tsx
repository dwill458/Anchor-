import React from 'react';
import { Image } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fetchV2RecommendationContext } from '@/adapters/v2/practice';
jest.mock('@/adapters/v2/practice', () => ({ fetchV2RecommendationContext: jest.fn() }));

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
import { V2AnchorDetailsScreen } from '../V2AnchorDetailsScreen';
import { V2DailyShellIntentsProvider } from '@/screens/v2/home/dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { apiClient } from '@/services/ApiClient';

jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  ApiClientError: class extends Error {},
}));

const destructiveSpy = jest.fn();

const renderDetails = (intents = {}) =>
  render(
    <V2DailyShellIntentsProvider intents={intents}>
      <V2AnchorDetailsScreen />
    </V2DailyShellIntentsProvider>,
  );

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
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus');

    fireEvent.press(screen.getByLabelText('Vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');

    fireEvent.press(screen.getByLabelText('Chart'));
    expect(onOpenChart).toHaveBeenCalledWith('a', undefined);
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

  it.each([
    ['Deep Prime', 'deep_prime'],
    ['Visualize', 'visualize'],
  ])('opens the server selected %s practice', async (action, mode) => {
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action, reason: 'daily_reinforcement' },
      thread: { status: 'AVAILABLE', strength: 42, delta7d: -4, delta7dStatus: 'AVAILABLE' },
    });
    const onOpenPractice = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice });
    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText('↓ -4% this week')).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-anchor-today'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', mode);
  });

  it.each([
    ['Focus', 'focus', 'Focus'],
    ['Deep Prime', 'deep_prime', 'Deep Focus'],
    ['Visualize', 'visualize', 'Visualize'],
    ['Release', 'release', 'Release'],
  ] as const)('renders the Today card for %s recommendation', async (action, mode, expectedTitle) => {
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action, reason: 'daily_reinforcement' },
      thread: { status: 'AVAILABLE', strength: 42, delta7d: 1, delta7dStatus: 'AVAILABLE' },
    });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText(expectedTitle)).toBeTruthy();
    expect(screen.getByText('Recommended Practice')).toBeTruthy();
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

  it('opens Release when the server recommends it', async () => {
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action: 'Release', reason: 'destination_reached' },
      thread: { status: 'AVAILABLE', strength: 78, delta7d: 6, delta7dStatus: 'AVAILABLE' },
    });
    const onReleaseAnchor = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onReleaseAnchor });
    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    expect(screen.getByText('↑ +6% this week')).toBeTruthy();
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
    expect(screen.getByText('Recent Practice')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders a not-found state for an unknown Anchor', () => {
    mockParams = { anchorId: 'missing' };
    renderDetails();
    expect(screen.getByText('Anchor not found')).toBeTruthy();
  });
});
