import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Text, View } from 'react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
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
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/utils/haptics', () => {
  const actual = jest.requireActual('@/utils/haptics');
  return { ...actual, safeHaptics: { ...actual.safeHaptics, impact: jest.fn(async () => undefined) } };
});

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { VisionHomeReturnProvider, useVisionHomeReturnRequest } from '../visionHomeReturn';
import { VISION_HOME_RETURN, visionHomeReturnCelebrationId } from '@/constants/v2/visionHomeReturn';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { playCreationSound } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';

const mockUseV2HomeModel = useV2HomeModel as jest.Mock;
const mockUseChartPreview = useChartPreview as jest.Mock;
const selectAnchor = jest.fn();

const readyVision = {
  state: 'ready' as const,
  visionId: 'v1',
  previewText: 'A bright open studio at dawn',
  title: 'Studio at dawn',
  tiles: [{ id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/vision.png', prompt: null, sortOrder: 0, isHero: true }],
  featuredTileId: 't1',
  seenToday: false,
};
const noVision = { state: 'none' as const };

const consume = jest.fn();
const refreshVision = jest.fn(async () => undefined);

function setModel(vision: unknown) {
  const anchors = useAnchorStore.getState().anchors.filter((anchor) => anchor.userId === 'user-1');
  const selectedAnchor = anchors[0] ?? null;
  const anchorList = anchors.map((anchor) => ({ anchor, thread: toThreadPresentation(anchor), isSelected: anchor.id === selectedAnchor?.id }));
  mockUseV2HomeModel.mockReturnValue({
    greeting: 'Good morning', profileInitial: 'D', anchorState: 'ready', anchorError: null, hasAnchors: true,
    selectedAnchor, thread: selectedAnchor ? toThreadPresentation(selectedAnchor) : null, anchorList,
    selectedIndex: 0, selectAnchor, vision, chart: { state: 'none' }, progress: { state: 'empty' },
    today: { state: 'ready', mode: 'focus', action: 'Focus', reason: 'daily_focus', completionSignal: null, threadStrength: null,
      threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: 30 },
    refreshVision, refreshToday: jest.fn(), refreshChart: jest.fn(), refreshAnchors: jest.fn(),
  });
}
const tree = (request: { anchorId: string; nonce: number } | null) => (
  <VisionHomeReturnProvider request={request} consume={consume}>
    <V2DailyShellIntentsProvider intents={{}}><V2HomeScreen /></V2DailyShellIntentsProvider>
  </VisionHomeReturnProvider>
);
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }

const REQUEST = { anchorId: 'a', nonce: 1 };
const SCENE = visionHomeReturnCelebrationId(1);
const ticks = () => (playCreationSound as jest.Mock).mock.calls.filter(([key]) => key === 'formTick');
const lightHaptics = () => (safeHaptics.impact as jest.Mock).mock.calls.filter(([style]) => style === ImpactFeedbackStyle.Light);
const active = () => useCelebrationStore.getState().active;

/** Past the focus settle and the Vision read: the scene is playing. */
const PLAYING = 450 + 20;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // The page is measured before the scene plays; answer at once so no measurement timeout sits in the timeline.
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => {
    (callback as (x: number, y: number, width: number, height: number) => void)(0, 0, 300, 120);
  });
  useCelebrationStore.getState().reset();
  useSettingsStore.setState({ reduceMotion: 'off' });
  useAnchorStore.setState({
    anchors: [makeAnchor({ id: 'a', localId: 'a', intentionText: 'I finish what matters', category: 'desire', threadStrength: 74 })],
    currentAnchorId: 'a',
  });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'D' } as never, hasCompletedOnboarding: false });
  useCourseStore.setState({ activeCourse: null });
  useSessionStore.setState({ practiceHistory: [] });
  mockUseChartPreview.mockReturnValue(selectChartPreview(null));
});
afterEach(() => {
  act(() => { useCelebrationStore.getState().reset(); });
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('First Vision image returns to Home', () => {
  it('takes the request, reads the Vision again, and registers an L4 scene once the new image is readable', async () => {
    setModel(noVision);
    const view = render(tree(REQUEST));
    await advance(0);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(refreshVision).toHaveBeenCalledTimes(1);
    // Nothing to show yet: no scene, and the section is not drawn.
    await advance(1000);
    expect(active()).toBeNull();
    expect(screen.queryByText('Your Vision')).toBeNull();

    setModel(readyVision);
    view.rerender(tree(REQUEST));
    await advance(0);
    expect(active()).toEqual({ id: SCENE, level: 4, skippable: true });
    expect(screen.getByText('Your Vision')).toBeTruthy();
    expect(screen.getByLabelText('Skip')).toBeTruthy();
    expect(screen.getByTestId('v2-home-vision-return-skip')).toBeTruthy();
  });

  it('gives the soft tick and a Light haptic once, at the pin, and ends settled', async () => {
    setModel(readyVision);
    render(tree(REQUEST));
    await advance(PLAYING);
    expect(active()?.id).toBe(SCENE);
    expect(ticks()).toHaveLength(0); expect(lightHaptics()).toHaveLength(0);
    await advance(VISION_HOME_RETURN.tickMs + 20);
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
    await advance(VISION_HOME_RETURN.totalMs + 1000);
    expect(active()).toBeNull();
    expect(screen.queryByTestId('v2-home-vision-return-skip')).toBeNull();
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
  });

  it('Skip lands the page settled: the cue once, the scene released, and nothing late', async () => {
    setModel(readyVision);
    render(tree(REQUEST));
    await advance(PLAYING);
    fireEvent.press(screen.getByTestId('v2-home-vision-return-skip'));
    expect(active()).toBeNull();
    expect(screen.queryByTestId('v2-home-vision-return-skip')).toBeNull();
    expect(screen.getByText('Your Vision')).toBeTruthy();
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
    await advance(10000);
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
  });

  it('Reduce Motion is a short, unskippable crossfade; the sound and the haptic still fire', async () => {
    useSettingsStore.setState({ reduceMotion: 'on' });
    setModel(readyVision);
    render(tree(REQUEST));
    await advance(PLAYING);
    expect(active()).toEqual({ id: SCENE, level: 2, skippable: false });
    expect(screen.queryByTestId('v2-home-vision-return-skip')).toBeNull();
    await advance(VISION_HOME_RETURN.reducedFadeMs + 100);
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
    await advance(VISION_HOME_RETURN.reducedTotalMs + 500);
    expect(active()).toBeNull();
    expect(ticks()).toHaveLength(1); expect(lightHaptics()).toHaveLength(1);
  });

  it('waits behind a scene that is already playing, then plays when it ends', async () => {
    setModel(readyVision);
    act(() => { useCelebrationStore.getState().request(4, 'other-scene', { durationMs: 6000 }); });
    render(tree(REQUEST));
    await advance(PLAYING + 2000);
    expect(active()?.id).toBe('other-scene');
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    expect(ticks()).toHaveLength(0);
    act(() => { useCelebrationStore.getState().finish('other-scene'); });
    expect(active()?.id).toBe(SCENE);
    await advance(0);
    await advance(VISION_HOME_RETURN.tickMs + 50);
    expect(ticks()).toHaveLength(1);
    await advance(VISION_HOME_RETURN.totalMs + 1000);
    expect(active()).toBeNull(); expect(useCelebrationStore.getState().queueLength).toBe(0);
  });

  it('does nothing for another Anchor, and nothing without a request', async () => {
    setModel(readyVision);
    const view = render(tree({ anchorId: 'someone-else', nonce: 2 }));
    await advance(PLAYING + 500);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(refreshVision).not.toHaveBeenCalled();
    expect(active()).toBeNull(); expect(ticks()).toHaveLength(0);
    view.rerender(tree(null));
    await advance(PLAYING + 500);
    expect(active()).toBeNull(); expect(ticks()).toHaveLength(0);
    expect(screen.getByText('Your Vision')).toBeTruthy();
  });

  it('gives up when the image never becomes readable, and the section simply appears when it does', async () => {
    setModel(noVision);
    const view = render(tree(REQUEST));
    await advance(VISION_HOME_RETURN.giveUpMs + 500);
    setModel(readyVision);
    view.rerender(tree(REQUEST));
    await advance(PLAYING + 500);
    expect(active()).toBeNull(); expect(ticks()).toHaveLength(0);
    expect(screen.getByText('Your Vision')).toBeTruthy();
  });

  it('never replays for the same request when Home re-renders or the request lingers', async () => {
    setModel(readyVision);
    const view = render(tree(REQUEST));
    await advance(PLAYING);
    await advance(VISION_HOME_RETURN.totalMs + 1500);
    expect(active()).toBeNull(); expect(ticks()).toHaveLength(1);
    view.rerender(tree(REQUEST));
    await advance(PLAYING + 500);
    expect(ticks()).toHaveLength(1); expect(consume).toHaveBeenCalledTimes(1); expect(refreshVision).toHaveBeenCalledTimes(1);
    expect(active()).toBeNull();
  });
});

describe('Vision return request on the Home route', () => {
  it('reaches the screens beneath the provider', () => {
    const Probe = () => { const { request } = useVisionHomeReturnRequest(); return <Text testID="probe">{request ? `${request.anchorId}:${request.nonce}` : 'none'}</Text>; };
    const view = render(<VisionHomeReturnProvider request={REQUEST} consume={consume}><Probe /></VisionHomeReturnProvider>);
    expect(screen.getByTestId('probe').props.children).toBe('a:1');
    view.rerender(<VisionHomeReturnProvider request={null} consume={consume}><Probe /></VisionHomeReturnProvider>);
    expect(screen.getByTestId('probe').props.children).toBe('none');
  });
});
