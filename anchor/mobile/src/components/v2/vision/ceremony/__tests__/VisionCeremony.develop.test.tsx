import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { VisionCeremony, type VisionCeremonyProps } from '../VisionCeremony';
import { ENTRANCE } from '../VisionEntrance';
import { visionCeremonyCopy as copy } from '../visionCeremonyCopy';
import { useDevImageModelStore } from '@/stores/devImageModelStore';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/hooks/v2/vision/visionPhotoFitProcessing', () => ({
  ...jest.requireActual('@/hooks/v2/vision/visionPhotoFitProcessing'),
  readPhotoSize: jest.fn(async () => null),
}));
jest.mock('@/hooks/useAppPerformanceTier', () => ({ useAppPerformanceTier: () => 'high' }));

let mockJob: any = null;
const mockStart = jest.fn(async () => true);
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => ({ job: mockJob, error: null, errorCode: null, lastErrorCode: () => null, start: mockStart, retry: jest.fn(async () => true), refresh: jest.fn(async () => undefined), conversation: undefined }),
  pickVisionPhoto: jest.fn(), pickVisionReferences: jest.fn(), uploadVisionPhoto: jest.fn(),
  useVisionAppearanceReference: () => ({ profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false, upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn() }),
}));
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => false, v2Haptics: { selection: jest.fn(), warning: jest.fn() } }));
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => false }));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/services/audio/SoundPool', () => ({ SoundPool: { prewarm: jest.fn(), releaseIdle: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

const candidates = [0, 1].map(i => ({ id: `c${i}`, assetId: `asset-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: `Moment ${i}`, sortOrder: i, role: 'SCENE' }));
const job = (status: string, list: unknown[] = candidates) => ({ id: 'job', status, candidates: list, retryCount: 0, visionId: 'vision' });
const SETTLED = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 50;

function setup(overrides: Partial<VisionCeremonyProps> = {}) {
  const onAssemble = jest.fn(async () => true);
  const props: VisionCeremonyProps = { anchorId: 'anchor', anchorIntention: 'I build what matters.', initialDescription: 'A studio full of finished work.',
    onBack: jest.fn(), mode: 'create', onAssemble, onPinned: jest.fn(), onUploadAsset: jest.fn(), ...overrides };
  const view = render(<VisionCeremony {...props} />);
  act(() => { jest.advanceTimersByTime(SETTLED); });
  const refresh = () => view.rerender(<VisionCeremony {...props} />);
  return { ...view, props, onAssemble, refresh };
}
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
async function startDevelop(view: ReturnType<typeof setup>) {
  fireEvent.press(view.getByLabelText(copy.createVision));
  await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
}
async function load(view: ReturnType<typeof setup>, count: number) {
  for (let i = 0; i < count; i++) fireEvent(view.getByTestId(`vision-ceremony-print-${i}-sharp`), 'load', { nativeEvent: { source: { width: 800, height: 1000 } } });
  await advance(0); await advance(2800); await advance(3600);
}
const rail = (view: ReturnType<typeof setup>) => [0, 1, 2].map(i => Boolean(view.getByTestId(`vision-develop-rail-${i}`).props.accessibilityState?.checked));
const rect = (view: ReturnType<typeof setup>, index: number) => {
  const style = StyleSheet.flatten(view.getByTestId(`vision-ceremony-slot-${index}`).props.style);
  return { left: style.left, top: style.top, width: style.width, height: style.height };
};

describe('Vision ceremony: Develop', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockJob = null;
    useDevImageModelStore.setState({ anchor: null, vision: null });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('advances the rail only on the three real signals, never on a timer', async () => {
    mockJob = job('QUEUED', []);
    const view = setup();
    await startDevelop(view);
    await advance(60000);
    // Queued for a minute: the reading timer and the wait copy have run, but no segment fills.
    expect(rail(view)).toEqual([false, false, false]);

    mockJob = job('RUNNING', []); view.refresh(); await advance(0);
    expect(rail(view)).toEqual([true, true, false]);
    await advance(60000);
    expect(rail(view)).toEqual([true, true, false]);

    mockJob = job('RUNNING', [candidates[0]]); view.refresh(); await advance(0);
    expect(rail(view)).toEqual([true, true, true]);
  });

  it('lays the two prints out on the first frame of Develop and never moves them before a choice', async () => {
    mockJob = job('QUEUED', []);
    const view = setup();
    await startDevelop(view);
    const first = [rect(view, 0), rect(view, 1)];
    expect(first[0].left).toBeLessThan(first[1].left);
    expect(first[0].top).toBe(first[1].top);

    mockJob = job('COMPLETE'); view.refresh();
    await load(view, 2);
    expect(view.getByText(copy.chooseBody)).toBeTruthy();
    expect([rect(view, 0), rect(view, 1)]).toEqual(first);
  });

  it('never leaves a print window empty: the category tint without references, then the image', async () => {
    mockJob = job('QUEUED', []);
    const view = setup();
    await startDevelop(view);
    expect(view.getByTestId('vision-ceremony-print-0-wash-tint')).toBeTruthy();
    expect(view.getByTestId('vision-ceremony-print-1-wash-tint')).toBeTruthy();
  });

  it('uses the first reference photo, blurred, as the wash when there is one', async () => {
    mockJob = job('QUEUED', []);
    const view = setup({ initialReferences: [{ id: 'ref', uri: 'file:///reference.jpg', mimeType: 'image/jpeg', role: 'place' }] });
    await startDevelop(view);
    expect(view.getByTestId('vision-ceremony-print-0-wash-reference')).toBeTruthy();
  });

  it('writes the caption on both prints while it develops, and the chosen print keeps it', async () => {
    mockJob = job('RUNNING', []);
    const view = setup();
    await startDevelop(view);
    expect(view.getByText(copy.whileDeveloping)).toBeTruthy();
    fireEvent.changeText(view.getByTestId('vision-develop-caption'), 'Lifting 405\non a deadlift');
    expect(view.getByTestId('vision-develop-caption').props.value).toBe('Lifting 405 on a deadlift');
    expect(view.getAllByText('Lifting 405 on a deadlift').length).toBe(2);

    mockJob = job('COMPLETE'); view.refresh();
    await load(view, 2);
    fireEvent.press(view.getByTestId('scene-candidate-c1'));
    expect(view.getByTestId('vision-ceremony-print-1-caption').props.value).toBe('Lifting 405 on a deadlift');
  });

  it('shows the static placement line in create mode', async () => {
    mockJob = job('QUEUED', []);
    const view = setup();
    await startDevelop(view);
    expect(view.getByText(copy.opensBoard)).toBeTruthy();
    expect(view.getByText(copy.waitNote)).toBeTruthy();
  });

  it('offers Leave during Develop, which uses the existing leave path', async () => {
    mockJob = job('RUNNING', []);
    const view = setup();
    await startDevelop(view);
    fireEvent.press(view.getByTestId('vision-develop-leave'));
    expect(view.props.onBack).toHaveBeenCalledTimes(1);
  });

  it('does not enter Choose while the keyboard is open; it enters when the keyboard closes', async () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      listeners.set(event, listener as (event?: unknown) => void);
      return { remove: jest.fn() } as never;
    });
    mockJob = job('RUNNING', []);
    const view = setup();
    await startDevelop(view);
    act(() => { (listeners.get('keyboardWillShow') ?? listeners.get('keyboardDidShow'))?.({ endCoordinates: { height: 300 } }); });
    expect(view.queryByText(copy.opensBoard)).toBeNull();

    mockJob = job('COMPLETE'); view.refresh();
    await load(view, 2);
    expect(view.queryByText(copy.chooseBody)).toBeNull();
    expect(view.getByTestId('vision-develop-caption')).toBeTruthy();

    act(() => { (listeners.get('keyboardWillHide') ?? listeners.get('keyboardDidHide'))?.(); });
    await advance(0);
    expect(view.getByText(copy.chooseBody)).toBeTruthy();
    spy.mockRestore();
  });

  it('add mode shows the target slot and lets the person pick another empty one', async () => {
    mockJob = job('RUNNING', []);
    const onChange = jest.fn();
    const occupied = [true, true, false, false, false, false, false, false];
    const view = setup({ mode: 'add', startAt: 'develop', autoStart: true, placement: { occupied, slot: 2, onChange } });
    await advance(0);
    expect(view.getByText(copy.placeAdd(2))).toBeTruthy();
    fireEvent.press(view.getByTestId('vision-develop-placement'));
    expect(view.queryByTestId('vision-develop-placement-picker-slot-0')).toBeNull();
    fireEvent.press(view.getByTestId('vision-develop-placement-picker-slot-5'));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
