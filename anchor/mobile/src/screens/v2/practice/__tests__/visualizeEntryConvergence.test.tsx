import { act, fireEvent, render } from '@testing-library/react-native';
import { V2PracticePrepareScreen } from '../V2PracticePrepareScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { getOrderedVisionImages, type VisionReadModel } from '@/adapters/v2/vision';
import { toV2HomeVisionState } from '@/adapters/v2/home';
import { toV2VisionPresentationState } from '@/adapters/v2/vision';

let mockPreparation: any;
jest.mock('../visualize/V2CinematicSessionScreen', () => ({
  V2CinematicSessionScreen: (props: any) => { mockPreparation = props; return null; },
}));
jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({ VisionBoardScene: () => null }));
jest.mock('@/components/v2/vision/board/useVisionBoardScene', () => ({ useVisionBoardScene: () => ({}) }));

const anchor = makeAnchor({ id: 'a1', userId: 'u1', intentionText: 'Anchor has ten thousand users' });

const scene = (id: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id, visionId: 'v1', sourceType: 'AI_GENERATED' as const, assetId: `asset-${id}`, resolvedImageUrl: `https://cdn.example.com/${id}.jpg`,
  prompt: null, sortOrder, isArchived: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', ...extra,
});
const raw = (scenes: ReturnType<typeof scene>[]): VisionReadModel => ({
  id: 'v1', anchorId: 'a1', title: null, description: 'My Vision', status: 'ACTIVE', scenes, seenToday: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
});
const homeVision = (model: VisionReadModel) => toV2HomeVisionState(toV2VisionPresentationState(model, 'a1'));

const prepared: any = { anchor, statement: 'My Vision', visionId: 'v1', assets: { tiles: [], images: [] }, markLocal: {} };

function setup(props: Partial<React.ComponentProps<typeof V2PracticePrepareScreen>> = {}) {
  const onBeginPractice = jest.fn();
  const onPremiumRequired = jest.fn();
  const view = render(
    <V2PracticePrepareScreen anchor={anchor} mode="visualize" vision={homeVision(raw([scene('a', 0), scene('b', 1), scene('c', 2)]))}
      source="practice_hub" onBack={jest.fn()} onCreateVision={jest.fn()} onReleaseRequested={jest.fn()}
      onBeginPractice={onBeginPractice} onPremiumRequired={onPremiumRequired} {...props} />,
  );
  return { ...view, onBeginPractice, onPremiumRequired };
}

function begin(view: ReturnType<typeof setup>, label?: string) {
  act(() => mockPreparation.onPrepared(prepared));
  if (label) fireEvent.press(view.getByLabelText(label));
  fireEvent.press(view.getByLabelText('Begin Visualize'));
  act(() => { jest.advanceTimersByTime(1500); });
}

describe('every way into Visualize reaches the same setup', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it.each(['practice_hub', 'recommended_today'] as const)('shows the cream setup with duration choice for the %s entry', source => {
    const view = setup({ source });
    expect(view.getByTestId('v2-practice-prepare-visualize')).toBeTruthy();
    expect(view.getByText('Step into your Vision')).toBeTruthy();
    expect(view.getByLabelText('1 min')).toBeTruthy();
    expect(view.getByLabelText('3 min, selected')).toBeTruthy();
    expect(view.getByLabelText('5 min')).toBeTruthy();
  });

  it.each([['1 min', 60], ['3 min, selected', 180], ['5 min', 300]] as const)('begins the session for %s with the chosen duration, Anchor and source', (label, seconds) => {
    const view = setup({ source: 'recommended_today' });
    begin(view, label);
    expect(view.onBeginPractice).toHaveBeenCalledTimes(1);
    expect(view.onBeginPractice).toHaveBeenCalledWith(expect.objectContaining({
      anchorId: 'a1', mode: 'visualize', durationSeconds: seconds, source: 'recommended_today',
      preparedVisualize: expect.objectContaining({ visionId: 'v1', beginAtMs: expect.any(Number) }),
    }));
  });

  it('starts from a resumed duration after the paywall', () => {
    const view = setup({ initialDuration: 300 });
    expect(view.getByLabelText('5 min, selected')).toBeTruthy();
  });

  it('hands the setup the Vision in the one display order, so the hero is the Vision screen\'s hero', () => {
    const model = raw([scene('app-store', 2), scene('family', 1), scene('dashboard', 0)]);
    setup({ vision: homeVision(model) });
    expect(mockPreparation.tiles.map((tile: { sceneId: string }) => tile.sceneId)).toEqual(['dashboard', 'family', 'app-store']);
    expect(mockPreparation.tiles[0].sceneId).toBe(getOrderedVisionImages(model, { requireImage: true })[0].sceneId);
  });

  it('works for a one-image Vision, personal photos, generated images and a mix', () => {
    for (const scenes of [
      [scene('one', 0)],
      [scene('u1', 0, { sourceType: 'USER_UPLOAD' }), scene('u2', 1, { sourceType: 'USER_CAMERA' })],
      [scene('g1', 0), scene('g2', 1)],
      [scene('m1', 0), scene('m2', 1, { sourceType: 'USER_UPLOAD' }), scene('m3', 2, { sourceType: 'USER_CAMERA' })],
    ]) {
      const view = setup({ vision: homeVision(raw(scenes)) });
      expect(mockPreparation.tiles).toHaveLength(scenes.length);
      expect(view.getByTestId('v2-visualize-prepare-vision')).toBeTruthy();
      view.unmount();
    }
  });

  it('asks for a Vision first when there is none, with no duration to choose', () => {
    const onCreateVision = jest.fn();
    const view = setup({ vision: { state: 'none' }, onCreateVision });
    expect(view.getByText('Create a Vision first')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Create a Vision for this Anchor'));
    expect(onCreateVision).toHaveBeenCalledWith('a1');
    expect(view.queryByText('HOW LONG?')).toBeNull();
  });

  it('routes to the paywall, with the chosen duration, when the person is not entitled', () => {
    const view = setup({ entitled: false });
    begin(view, '5 min');
    expect(view.onBeginPractice).not.toHaveBeenCalled();
    expect(view.onPremiumRequired).toHaveBeenCalledWith({ capability: 'visualize', anchorId: 'a1', source: 'practice_hub', durationSeconds: 300 });
  });

  it('starts only once however fast Begin is tapped', () => {
    const view = setup();
    act(() => mockPreparation.onPrepared(prepared));
    for (let i = 0; i < 4; i += 1) fireEvent.press(view.getByLabelText('Begin Visualize'));
    act(() => { jest.advanceTimersByTime(1500); });
    expect(view.onBeginPractice).toHaveBeenCalledTimes(1);
  });
});
