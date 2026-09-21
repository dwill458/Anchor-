import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getPracticeCardTheme } from '@/theme/v2';
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
import { V2AnchorDetailsScreen } from '../V2AnchorDetailsScreen';
import { V2DailyShellIntentsProvider } from '@/screens/v2/home/dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const destructiveSpy = jest.fn();

const renderDetails = (intents = {}) =>
  render(
    <V2DailyShellIntentsProvider intents={intents}>
      <V2AnchorDetailsScreen />
    </V2DailyShellIntentsProvider>,
  );

beforeEach(() => {
  (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
    recommendation: { action: 'Focus', reason: 'daily_reinforcement' },
    thread: { status: 'AVAILABLE', strength: 50, delta7d: null, delta7dStatus: 'UNAVAILABLE' },
  });
  mockNavigate.mockClear();
  destructiveSpy.mockClear();
  mockParams = { anchorId: 'a' };
  useSettingsStore.setState({ reduceMotion: 'on' });
  // Replace the legacy destructive store actions with a spy: the V2 profile
  // must never call them.
  useAnchorStore.setState({
    anchors: [],
    currentAnchorId: undefined,
    releaseAnchor: destructiveSpy,
    removeAnchor: destructiveSpy,
  });
  useSessionStore.setState({ practiceHistory: [] });
});

describe('V2AnchorDetailsScreen', () => {
  it('renders the correct Anchor profile', () => {
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
    ['Focus', 'focus'],
    ['Deep Prime', 'deep_prime'],
    ['Visualize', 'visualize'],
    ['Release', 'release'],
  ] as const)('renders the Today card on the %s dark practice surface', async (action, mode) => {
    (fetchV2RecommendationContext as jest.Mock).mockResolvedValue({
      recommendation: { action, reason: 'daily_reinforcement' },
      thread: { status: 'AVAILABLE', strength: 42, delta7d: 1, delta7dStatus: 'AVAILABLE' },
    });
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails();

    await waitFor(() => expect(screen.getByTestId('v2-anchor-today')).toBeTruthy());
    const card = screen.getByTestId('v2-anchor-today');
    const flat = StyleSheet.flatten(card.props.style) as { backgroundColor?: string };
    expect(flat.backgroundColor).toBe(getPracticeCardTheme(mode).dark.surface);
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

  it('renders a not-found state for an unknown Anchor', () => {
    mockParams = { anchorId: 'missing' };
    renderDetails();
    expect(screen.getByText('Anchor not found')).toBeTruthy();
  });
});
