import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGet = jest.fn();

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: jest.fn() },
  ApiClientError: class ApiClientError extends Error {},
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useRoute: () => ({ params: {}, name: 'V2Home', key: 'k' }),
}));

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type { CourseDetail } from '@/types/chart';

const recommendation = {
  success: true,
  data: {
    anchorId: 'a',
    completionSignal: null,
    vision: { exists: false, seenToday: false },
    thread: { delta7d: null, delta7dStatus: 'UNAVAILABLE', status: 'AVAILABLE' },
    recommendation: { action: 'Focus', reason: 'Your saved daily practice is ready.' },
  },
};

const visionRecord = {
  id: 'vision-a',
  anchorId: 'a',
  title: 'A bright open studio',
  description: 'A calm studio at dawn',
  status: 'ACTIVE',
  scenes: [{
    id: 'scene-a', visionId: 'vision-a', sourceType: 'USER_UPLOAD', assetId: 'asset-a',
    resolvedImageUrl: 'https://example.com/vision-a.jpg', prompt: 'A calm studio at dawn', sortOrder: 0,
    isArchived: false, createdAt: '', updatedAt: '',
  }],
  seenToday: false, createdAt: '', updatedAt: '',
};

const renderHome = (intents = {}) => render(
  <V2DailyShellIntentsProvider intents={intents}>
    <V2HomeScreen />
  </V2DailyShellIntentsProvider>,
);

const makeCourse = (): CourseDetail => ({
  id: 'c1', destinationText: 'Reach 1,000 active users', status: 'ACTIVE', version: 1,
  currentWaypointId: 'w3', waypointCount: 5, reachedCount: 2, plottedAt: '', completedAt: null,
  archivedAt: null, destinationAnchorLink: null,
  waypoints: [
    { id: 'w1', courseId: 'c1', position: 1, title: 'Define target user', description: null, state: 'REACHED', blockedReason: null, reachedAt: '2026-09-01', skippedAt: null, cancelledAt: null, anchorLink: null },
    { id: 'w2', courseId: 'c1', position: 2, title: 'Build landing page', description: null, state: 'REACHED', blockedReason: null, reachedAt: '2026-09-02', skippedAt: null, cancelledAt: null, anchorLink: null },
    { id: 'w3', courseId: 'c1', position: 3, title: 'Contact 3 creators', description: null, state: 'CURRENT', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
    { id: 'w4', courseId: 'c1', position: 4, title: 'Launch beta', description: null, state: 'UPCOMING', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
    { id: 'w5', courseId: 'c1', position: 5, title: 'Reach 1,000 active users', description: null, state: 'UPCOMING', blockedReason: null, reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string) => {
    if (path.includes('/vision')) return Promise.reject({ status: 404 });
    if (path.includes('/recommendation-context')) return Promise.resolve({ data: recommendation });
    return Promise.reject({ status: 404 });
  });
  useSettingsStore.setState({ reduceMotion: 'on' });
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined, isLoading: false, error: null });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'Deontrez' } as never });
  useCourseStore.setState({ accountId: 'user-1', initializationStatus: 'ready', activeCourse: null, loading: false, refreshing: false, errorCode: null });
});

describe('V2HomeScreen', () => {
  it('renders the selected Anchor and only its stored thread value', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Anchor has ten thousand users', category: 'career', threadStrength: 79 })], currentAnchorId: 'a' });
    renderHome();
    expect(screen.getAllByText('Anchor has ten thousand users').length).toBeGreaterThan(0);
    expect(screen.getByTestId('v2-home-thread')).toBeTruthy();
    expect(screen.getByTestId('v2-thread-strength-value').props.children).toBe(79);
  });

  it('shows only the real empty Anchor state and routes create-intent', () => {
    const onCreateAnchor = jest.fn();
    renderHome({ onCreateAnchor });
    expect(screen.getByText('No Anchor yet')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-quick-switch')).toBeNull();
    fireEvent.press(screen.getByLabelText('Create your first Anchor'));
    expect(onCreateAnchor).toHaveBeenCalled();
  });

  it('keeps Anchor loading/error distinct from a confirmed empty account', () => {
    useAnchorStore.setState({ isLoading: true });
    const loading = renderHome();
    expect(loading.getByLabelText('Loading your Anchors')).toBeTruthy();
    loading.unmount();

    useAnchorStore.setState({ isLoading: false, error: 'Anchor sync unavailable.' });
    renderHome();
    expect(screen.getByText('Anchor sync unavailable.')).toBeTruthy();
    expect(screen.queryByText('No Anchor yet')).toBeNull();
  });

  it('switches selected Anchor and clears optional modules until the new records load', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'First', threadStrength: 79 }), makeAnchor({ id: 'b', intentionText: 'Second', threadStrength: 92 })], currentAnchorId: 'a' });
    renderHome();
    fireEvent.press(screen.getByLabelText('Select Second, Thread Strength 92'));
    expect(useAnchorStore.getState().currentAnchorId).toBe('b');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/v2/anchors/b/vision'), expect.anything()));
  });

  it('omits absent Vision instead of showing a create placeholder, then renders persisted Vision data', async () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const first = renderHome();
    await waitFor(() => expect(first.queryByTestId('v2-home-vision')).toBeNull());
    first.unmount();

    mockGet.mockImplementation((path: string) => {
      if (path.includes('/vision')) return Promise.resolve({ data: visionRecord });
      if (path.includes('/recommendation-context')) return Promise.resolve({ data: recommendation });
      return Promise.reject({ status: 404 });
    });
    renderHome();
    expect(await screen.findByText('A bright open studio')).toBeTruthy();
    expect(screen.getByText('A calm studio at dawn')).toBeTruthy();
  });

  it('renders Vision loading and recommendation error as intentional states', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.includes('/vision')) return new Promise(() => undefined);
      if (path.includes('/recommendation-context')) return Promise.reject(new Error('Recommendation unavailable.'));
      return Promise.reject({ status: 404 });
    });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    renderHome();
    expect(screen.getByTestId('v2-home-vision-loading')).toBeTruthy();
    expect(await screen.findByText('Recommendation unavailable.')).toBeTruthy();
    expect(screen.queryByLabelText('Start Focus practice')).toBeNull();
  });

  it('omits absent Chart and renders the authoritative five-waypoint route', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const first = renderHome();
    expect(first.queryByTestId('v2-home-chart')).toBeNull();
    first.unmount();

    useCourseStore.setState({ activeCourse: makeCourse() });
    renderHome();
    expect(screen.getAllByText('Reach 1,000 active users').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contact 3 creators').length).toBeGreaterThan(0);
    expect(screen.getByText('2 of 5 waypoints')).toBeTruthy();
  });

  it('does not show a Course linked to another Anchor after switching selection', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'First' }), makeAnchor({ id: 'b', intentionText: 'Second' })],
      currentAnchorId: 'b',
    });
    useCourseStore.setState({
      activeCourse: { ...makeCourse(), destinationAnchorLink: { anchorId: 'a' } as never },
    });
    renderHome();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
  });

  it('renders a Chart error without substituting a fake route', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    useCourseStore.setState({ errorCode: 'NETWORK', loading: false, initializationStatus: 'ready', activeCourse: null });
    renderHome();
    expect(screen.getByTestId('v2-home-chart-error')).toBeTruthy();
    expect(screen.queryByText('2 of 5 waypoints')).toBeNull();
  });

  it('uses Today recommendation mode and user-selected duration', async () => {
    useSettingsStore.setState({ focusSessionDuration: 60 });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Deep work' })], currentAnchorId: 'a' });
    const onOpenPractice = jest.fn();
    renderHome({ onOpenPractice });
    fireEvent.press(await screen.findByLabelText('Start Focus practice'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus');
    expect(screen.getByText('1 min Focus')).toBeTruthy();
  });

  it('does not fabricate Thread movement or an unmeasured score', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', threadStrength: undefined })], currentAnchorId: 'a' });
    renderHome();
    expect(screen.getByTestId('v2-thread-strength-value').props.children).toBe('Not yet measured');
    expect(screen.queryByText(/this week/i)).toBeNull();
  });

  it('routes Progress and details as navigation intents only', () => {
    const onOpenProgress = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Deep work' })], currentAnchorId: 'a' });
    renderHome({ onOpenProgress });
    fireEvent.press(screen.getByTestId('v2-home-thread-strength'));
    expect(onOpenProgress).toHaveBeenCalledWith('a');
    fireEvent.press(screen.getByTestId('v2-home-hero'));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });
});
