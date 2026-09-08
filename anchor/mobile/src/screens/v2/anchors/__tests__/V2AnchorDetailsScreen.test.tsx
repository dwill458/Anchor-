import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

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

  it('shows editorial formation provenance', () => {
    useAnchorStore.setState({
      anchors: [
        makeAnchor({
          id: 'a',
          intentionText: 'I finish what I start',
          distilledLetters: ['F', 'N', 'S', 'H', 'W', 'T', 'R'],
          structureVariant: 'balanced',
        }),
      ],
    });
    renderDetails();
    fireEvent.press(screen.getByLabelText('How this Anchor was formed'));
    expect(screen.getByText('F N S H W T R')).toBeTruthy();
    expect(screen.getByText('Focused')).toBeTruthy();
    expect(screen.getByText(/Vowels removed/)).toBeTruthy();
  });

  it('fires Practice, Vision and Chart as navigation callbacks', () => {
    const onOpenPractice = jest.fn();
    const onOpenVision = jest.fn();
    const onOpenChart = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    renderDetails({ onOpenPractice, onOpenVision, onOpenChart });

    fireEvent.press(screen.getByLabelText('Practice this Anchor'));
    expect(onOpenPractice).toHaveBeenCalledWith('a');

    fireEvent.press(screen.getByText('Vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');

    fireEvent.press(screen.getByText('Chart'));
    expect(onOpenChart).toHaveBeenCalledWith('a');
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
