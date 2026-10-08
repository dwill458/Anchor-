import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockPopToTop = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    popToTop: mockPopToTop,
    getState: () => undefined,
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
import { useHomeArrivalStore, type HomeArrivalKind } from '@/stores/v2/homeArrivalStore';
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

const GHOST = { svg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>', category: 'creativity' };

/** An evolved arrival, staged for the successor the way the hand-off leaves it. */
const stageEvolved = (ghost: typeof GHOST | null = GHOST) =>
  useHomeArrivalStore.getState().stage({ anchorId: 'new-1', kind: 'evolved', svg: '<svg/>', fromRect: null, ghost });

const seedAnchors = (evolvedFrom: { anchorId: string; intention: string } | undefined) =>
  useAnchorStore.setState({
    anchors: [
      makeAnchor({
        id: 'new-1', localId: 'new-1', intentionText: 'Finish my novel this year', category: 'creativity', threadStrength: 0,
        ...(evolvedFrom ? { evolvedFrom } : {}),
      }),
      makeAnchor({ id: 'other', localId: 'other', intentionText: 'I am present with my family', category: 'family' }),
      makeAnchor({ id: 'old-1', localId: 'old-1', intentionText: 'Publish my novel', isReleased: true }),
    ],
    currentAnchorId: 'new-1',
  });

beforeEach(() => {
  resetHomeArrivalSoundClaimForTests();
  resetPlayedPracticeArrivalsForTests();
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockPopToTop.mockClear();
  mockPlayCreationSound.mockClear();
  useSettingsStore.setState({ reduceMotion: 'off' });
  seedAnchors({ anchorId: 'old-1', intention: 'Publish my novel' });
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

describe('Home: Evolved anchor lands on Home (EV1)', () => {
  it('plays as one skippable level 3 scene on the successor, with the released art behind and no overlay', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 3, skippable: true });
    expect(screen.getByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('v2-home-underline-draw')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-arrival')).toBeNull();
    expect(screen.getByTestId('v2-home-intention').props.children).toBe('Finish my novel this year');
  });

  it('shows the approved line under the intention, with typographic quotes', () => {
    renderHome();
    expect(screen.getByTestId('v2-home-evolved-from').props.children).toBe('Evolved from “Publish my novel”');
  });

  it('omits the line when the Anchor has no evolvedFrom, and changes nothing else', () => {
    seedAnchors(undefined);
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(screen.queryByTestId('v2-home-evolved-from')).toBeNull();
    expect(screen.queryByText(/Evolved from/)).toBeNull();
    expect(screen.getByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 3, skippable: true });
  });

  it('skips the ghost when the released art is not known', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(null); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(screen.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('v2-home-evolved-from')).toBeTruthy();
  });

  it('leaves the counter unchanged: one released, one new', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(screen.queryByTestId('v2-home-counter-roll')).toBeNull();
    expect(screen.getByText('1 OF 2')).toBeTruthy();
  });

  it('offers the transparent Skip layer while it plays; a tap lands on the settled state with the line shown', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    const skip = screen.getByTestId('v2-home-arrival-skip');
    expect(skip.props.accessibilityLabel).toBe('Skip');
    fireEvent.press(skip);

    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
    expect(screen.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('v2-home-evolved-from').props.children).toBe('Evolved from “Publish my novel”');
    expect(screen.queryByTestId('v2-home-underline-draw')).toBeNull();
  });

  it('under Reduce Motion crossfades, offers no skip, and lands with the line shown', () => {
    useSettingsStore.setState({ reduceMotion: 'on' });
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
    expect(screen.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('v2-home-evolved-from')).toBeTruthy();
  });

  it('plays no wake note: no sound of its own', () => {
    renderHome();
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(mockPlayCreationSound.mock.calls.filter(([key]) => key !== 'homeArrival')).toHaveLength(0);
  });
});

describe('Home: the other arrivals are unchanged by EV1', () => {
  const FROM = { x: 40, y: 200, width: 130, height: 130 };
  const TARGET = { x: 140, y: 180, width: 110, height: 110 };
  const arriving = (kind: HomeArrivalKind, extra: Record<string, unknown> = {}) =>
    useHomeArrivalStore.setState({
      arrival: { id: 9, anchorId: 'new-1', kind, svg: '<svg/>', category: 'creativity', fromRect: FROM, targetRect: TARGET, phase: 'arriving', ...extra } as never,
    });

  it('a first Anchor that flies keeps its skip layer and level 4', () => {
    renderHome();
    act(() => arriving('first'));
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(9), level: 4, skippable: true });
    expect(screen.getByTestId('v2-home-arrival-skip')).toBeTruthy();
    expect(screen.getByTestId('v2-home-arrival')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-home-underline-draw')).toBeNull();
  });

  it.each(['repeat', 'practice'] as const)('a %s arrival stays level 2 with no skip layer, no ghost and no draw', (kind) => {
    renderHome();
    act(() => arriving(kind, { sessionId: 's1' }));
    expect(useCelebrationStore.getState().active).toMatchObject({ level: 2, skippable: false });
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
    expect(screen.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-home-underline-draw')).toBeNull();
  });
});
