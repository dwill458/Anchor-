import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockPopToTop = jest.fn();
let mockNavState: { index: number; routes: Array<{ name: string }> } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    popToTop: mockPopToTop,
    getState: () => mockNavState,
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {}, name: 'V2Home', key: 'k' }),
}));

jest.mock('@/adapters/v2/home', () => ({
  ...jest.requireActual('@/adapters/v2/home'),
  useV2HomeModel: jest.fn(),
}));

jest.mock('@/hooks/useChartPreview', () => ({
  ...jest.requireActual('@/hooks/useChartPreview'),
  useChartPreview: jest.fn(),
}));

const mockPlayCreationSound = jest.fn();
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlayCreationSound(...args) }));

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { V2HomeScreen, resetHomeArrivalSoundClaimForTests } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { homeArrivalCelebrationId, resetPlayedPracticeArrivalsForTests } from '@/components/v2/home/homeArrival';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';

const mockUseV2HomeModel = useV2HomeModel as jest.Mock;
const mockUseChartPreview = useChartPreview as jest.Mock;

const renderHome = () => {
  const anchors = useAnchorStore.getState().anchors.filter((anchor) => anchor.userId === 'user-1' && !anchor.isReleased);
  const selectedAnchor = anchors[0] ?? null;
  const anchorList = anchors.map((anchor, index) => ({ anchor, thread: toThreadPresentation(anchor), isSelected: index === 0 }));
  mockUseV2HomeModel.mockReturnValue({
    greeting: 'Good morning',
    profileInitial: 'D',
    anchorState: 'ready',
    anchorError: null,
    hasAnchors: true,
    selectedAnchor,
    thread: selectedAnchor ? toThreadPresentation(selectedAnchor) : null,
    anchorList,
    selectedIndex: 0,
    selectAnchor: jest.fn(),
    vision: { state: 'none' },
    chart: { state: 'none' },
    progress: { state: 'empty' },
    today: {
      state: 'ready', mode: 'focus', action: 'Focus', reason: 'daily_focus', completionSignal: null,
      threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: 30,
    },
    refreshVision: jest.fn(),
    refreshToday: jest.fn(),
    refreshChart: jest.fn(),
    refreshAnchors: jest.fn(),
  });
  return render(
    <V2DailyShellIntentsProvider intents={{}}>
      <V2HomeScreen />
    </V2DailyShellIntentsProvider>,
  );
};

/** A release arrival as the hand-off stages it: it names no Anchor. */
const stageRelease = (countBefore: number | null) =>
  useHomeArrivalStore.getState().stage({ anchorId: '', kind: 'release', svg: '', fromRect: null, countBefore });

beforeEach(() => {
  resetHomeArrivalSoundClaimForTests();
  resetPlayedPracticeArrivalsForTests();
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockPopToTop.mockClear();
  mockPlayCreationSound.mockClear();
  mockNavState = undefined;
  useSettingsStore.setState({ reduceMotion: 'off' });
  useAnchorStore.setState({
    anchors: [
      makeAnchor({ id: 'next-1', localId: 'next-1', intentionText: 'I finish what matters', category: 'desire', threadStrength: 41 }),
      makeAnchor({ id: 'next-2', localId: 'next-2', intentionText: 'I am present with my family', category: 'family', threadStrength: 30 }),
      makeAnchor({ id: 'gone', localId: 'gone', intentionText: 'Released one', isReleased: true }),
    ],
    currentAnchorId: 'next-1',
  });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'D' } as never, hasCompletedOnboarding: false });
  useCourseStore.setState({ activeCourse: null });
  useSessionStore.setState({ practiceHistory: [] });
  mockUseChartPreview.mockReturnValue(selectChartPreview(null));
  useHomeArrivalStore.setState({ arrival: null });
  useCelebrationStore.getState().reset();
});
afterEach(() => {
  act(() => {
    useHomeArrivalStore.setState({ arrival: null });
    useCelebrationStore.getState().reset();
  });
});

describe('Home: Return Home arrival (RL1)', () => {
  it('poses under the Release route without tearing it down, and is ready at once with no overlay', () => {
    mockNavState = { index: 1, routes: [{ name: 'V2DevelopmentHome' }, { name: 'V2Release' }] };
    renderHome();
    let id = 0;
    act(() => { id = stageRelease(3); });
    expect(mockPopToTop).not.toHaveBeenCalled();
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ id, phase: 'ready', targetRect: null });
    expect(screen.queryByTestId('v2-home-arrival')).toBeNull();
  });

  it('still pops a pushed Details screen when a release arrival poses there', () => {
    mockNavState = { index: 1, routes: [{ name: 'V2DevelopmentHome' }, { name: 'V2AnchorDetails' }] };
    renderHome();
    act(() => { stageRelease(3); });
    expect(mockPopToTop).toHaveBeenCalledTimes(1);
  });

  it('plays as one non-skippable level 2 scene on the Anchor Home now shows, rolling the counter down by one', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageRelease(3); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
    expect(screen.getByTestId('v2-home-counter-roll')).toBeTruthy();
    expect(screen.getByTestId('v2-home-counter-before').props.children).toBe(3);
    expect(screen.getByTestId('v2-home-counter-after').props.children).toBe(2);
    expect(screen.getByTestId('v2-home-intention').props.children).toBe('I finish what matters');
  });

  it('does not roll the counter when the count did not decrease, and leaves the plain counter once it ends', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageRelease(2); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(screen.queryByTestId('v2-home-counter-roll')).toBeNull();
    expect(screen.getByText('1 OF 2')).toBeTruthy();
    act(() => { useHomeArrivalStore.getState().clear(id); });
    expect(screen.getByText('1 OF 2')).toBeTruthy();
  });

  it('plays no sound of its own', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageRelease(3); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(mockPlayCreationSound.mock.calls.filter(([key]) => key !== 'homeArrival')).toHaveLength(0);
  });
});
