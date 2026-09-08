import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useRoute: () => ({ params: {}, name: 'V2Home', key: 'k' }),
}));

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type { CourseDetail } from '@/types/chart';

const renderHome = (intents = {}) =>
  render(
    <V2DailyShellIntentsProvider intents={intents}>
      <V2HomeScreen />
    </V2DailyShellIntentsProvider>,
  );

beforeEach(() => {
  mockNavigate.mockClear();
  useSettingsStore.setState({ reduceMotion: 'on' });
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  useAuthStore.setState({ user: { id: 'u', email: 'e', displayName: 'Deontrez' } as never });
  useCourseStore.setState({ activeCourse: null });
  useVisualizationSceneStore.setState({ scenes: {} });
});

describe('V2HomeScreen', () => {
  it('renders the selected Anchor as the primary context', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', intentionText: 'Anchor has ten thousand users', category: 'career', threadStrength: 79 })],
      currentAnchorId: 'a',
    });
    renderHome();
    expect(screen.getByText('Anchor has ten thousand users')).toBeTruthy();
    expect(screen.getByTestId('v2-home-thread')).toBeTruthy();
    expect(screen.getByTestId('v2-thread-strength-value').props.children).toBe(79);
  });

  it('shows the empty state with no Anchor and routes create-intent', () => {
    const onCreateAnchor = jest.fn();
    renderHome({ onCreateAnchor });
    expect(screen.getByText('No Anchor yet')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create your first Anchor'));
    expect(onCreateAnchor).toHaveBeenCalled();
  });

  it('switches the selected Anchor in place via the quick-switch rail', () => {
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'a', intentionText: 'First', threadStrength: 79 }),
        makeAnchor({ id: 'b', intentionText: 'Second', threadStrength: 92 }),
      ],
      currentAnchorId: 'a',
    });
    renderHome();
    fireEvent.press(screen.getByLabelText('Select Second, Thread Strength 92'));
    expect(useAnchorStore.getState().currentAnchorId).toBe('b');
  });

  it('supports the Vision-missing and Vision-ready states honestly', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const first = renderHome();
    expect(first.getByLabelText('Add a Vision')).toBeTruthy();
    first.unmount();

    useVisualizationSceneStore.setState({
      scenes: { a: { anchorId: 'a', currentText: 'A bright open studio', id: 's1' } as never },
    });
    renderHome();
    expect(screen.getByText('A bright open studio')).toBeTruthy();
  });

  it('supports the no-Chart and Chart states from real course data', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })], currentAnchorId: 'a' });
    const first = renderHome();
    expect(first.getByLabelText('Start a Chart')).toBeTruthy();
    first.unmount();

    useCourseStore.setState({
      activeCourse: {
        id: 'c1',
        destinationText: 'Reach 1,000 active users',
        status: 'ACTIVE',
        currentWaypointId: 'w1',
        waypointCount: 5,
        reachedCount: 2,
        waypoints: [{ id: 'w1', state: 'CURRENT', title: 'Contact 3 creators' }],
      } as unknown as CourseDetail,
    });
    renderHome();
    expect(screen.getByText('Reach 1,000 active users')).toBeTruthy();
    expect(screen.getByText('Contact 3 creators')).toBeTruthy();
    expect(screen.getByText('2 of 5 waypoints')).toBeTruthy();
  });

  it('does not fabricate Thread movement when no server delta exists', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', threadStrength: 40 })], currentAnchorId: 'a' });
    renderHome();
    expect(screen.queryByText(/this week/i)).toBeNull();
    expect(screen.queryByText(/\+\d/)).toBeNull();
  });

  it('routes Practice, Progress and details as navigation intents only', () => {
    const onOpenPractice = jest.fn();
    const onOpenProgress = jest.fn();
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Deep work' })], currentAnchorId: 'a' });
    renderHome({ onOpenPractice, onOpenProgress });

    fireEvent.press(screen.getByLabelText('Practice this Anchor'));
    expect(onOpenPractice).toHaveBeenCalledWith('a');

    fireEvent.press(screen.getByTestId('v2-home-thread-strength'));
    expect(onOpenProgress).toHaveBeenCalledWith('a');

    fireEvent.press(screen.getByTestId('v2-home-hero'));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });
});
