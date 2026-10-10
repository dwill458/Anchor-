import { act, fireEvent, render } from '@testing-library/react-native';
import { ActionSheetIOS, AppState, Image, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { playCreationSound } from '@/services/CreationSounds';
import * as FileSystem from 'expo-file-system/legacy';
import { VisionCeremony, type VisionCeremonyProps } from '../VisionCeremony';
import { ENTRANCE } from '../VisionEntrance';
import { CEREMONY, ceremonyDuration } from '../VisionDevelop';
import { visionCeremonyCopy as copy, prefillVisionCaption } from '../visionCeremonyCopy';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { safeHaptics } from '@/utils/haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
let mockExamples: Array<{ image: { uri: string }; caption: string; moment: string }> = [];
jest.mock('../visionExamples', () => ({ ...jest.requireActual('../visionExamples'), visionExamplesFor: () => mockExamples }));

let mockJob: any = null;
let mockReduced = false;
let mockError: string | null = null, mockErrorCode: string | null = null;
const mockStart = jest.fn(async () => true), mockRetry = jest.fn(async () => true), mockRefresh = jest.fn(async () => undefined);
const mockPicker = jest.fn(), mockSinglePick = jest.fn(), mockSourceUpload = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => ({ job: mockJob, error: mockError, errorCode: mockErrorCode, lastErrorCode: () => mockErrorCode, start: mockStart, retry: mockRetry, refresh: mockRefresh }),
  pickVisionPhoto: (...args: unknown[]) => mockSinglePick(...args),
  uploadVisionPhoto: (...args: unknown[]) => mockSourceUpload(...args),
  useVisionAppearanceReference: () => ({ profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false, upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn() }),
}));
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => mockReduced, v2Haptics: { selection: jest.fn(), warning: jest.fn() } }));
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => mockReduced }));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' }, requestMediaLibraryPermissionsAsync: async () => ({ status: 'granted' }), launchImageLibraryAsync: (...args: unknown[]) => mockPicker(...args) }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/services/audio/SoundPool', () => ({ SoundPool: { prewarm: jest.fn(), releaseIdle: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

const candidates = [0, 1].map(i => ({ id: `c${i}`, assetId: `asset-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: `Moment ${i}`, sortOrder: i, role: 'SCENE' }));
const job = (status = 'COMPLETE', list = candidates) => ({ id: 'job', status, candidates: list, retryCount: 0, visionId: 'vision' });
const base = { anchorId: 'anchor', anchorIntention: 'I build what matters.', initialDescription: 'A studio full of finished work.', onBack: jest.fn() };
/** Past the open's hand-off and the persistent anchor's fade, so the Ask controls are live. */
const SETTLED = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 50;
function setup(overrides: Partial<VisionCeremonyProps> = {}, settle = true) {
  const onAssemble = jest.fn(async (_result: Parameters<VisionCeremonyProps['onAssemble']>[0]) => true), onPinned = jest.fn();
  const onUploadAsset = jest.fn(async () => ({ ok: true as const, asset: { id: 'photo-asset', resolvedUrl: 'file:///saved.jpg', mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } }));
  const props: VisionCeremonyProps = { ...base, mode: 'create', onAssemble, onPinned, onUploadAsset, ...overrides };
  const view = render(<VisionCeremony {...props} />);
  if (settle && (overrides.startAt ?? 'ask') === 'ask') act(() => { jest.advanceTimersByTime(SETTLED); });
  return { ...view, props, onAssemble, onPinned, onUploadAsset };
}
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
async function develop(view: ReturnType<typeof setup>, count: number) {
  for (let i = 0; i < count; i++) fireEvent(view.getByTestId(`vision-ceremony-print-${i}-sharp`), 'load', { nativeEvent: { source: { width: 800, height: 1000 } } });
  await advance(0); await advance(2800); await advance(3600);
}
async function choose(view: ReturnType<typeof setup>, index = 0) {
  fireEvent.press(view.getByLabelText(copy.words));
  await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
  await develop(view, mockJob.candidates.length);
  fireEvent.press(view.getByTestId(`scene-candidate-c${index}`));
}
async function seal(view: ReturnType<typeof setup>) {
  fireEvent.press(view.queryByTestId('vision-complete-vision') ?? view.getByTestId('vision-ceremony-keep'));
  await advance(200);
  await advance(CEREMONY.printMoveMs + CEREMONY.stampMs + CEREMONY.sealHoldMs + CEREMONY.boardRiseMs + 1);
}

describe('Vision ceremony', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockJob = null; mockReduced = false; mockError = null; mockErrorCode = null; mockExamples = [];
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it.each(['create', 'add'] as const)('%s starts at Ask with all three paths and launches nothing', mode => {
    const view = setup({ mode });
    expect(view.getByText(mode === 'create' ? copy.askCreate : copy.askAdd)).toBeTruthy();
    expect(view.getByLabelText(copy.words)).toBeTruthy(); expect(view.getByLabelText(copy.ownPhoto)).toBeTruthy(); expect(view.getByLabelText(copy.camera)).toBeTruthy();
    expect(mockPicker).not.toHaveBeenCalled(); expect(view.onAssemble).not.toHaveBeenCalled();
  });
  it('words enters the existing Describe screen with words selected and preserves edited input', () => {
    const view = setup(); fireEvent.press(view.getByLabelText(copy.words));
    expect(view.getByTestId('vision-path-words').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(view.getByTestId('vision-prompt-input'), 'My new description');
    fireEvent.press(view.getByLabelText('Go back')); fireEvent.press(view.getByLabelText(copy.words));
    expect(view.getByTestId('vision-prompt-input').props.value).toBe('My new description');
  });
  it('a PARTIAL job develops only its real image and never reveals a missing slot', async () => {
    mockJob = job('PARTIAL', candidates.slice(0, 1));
    const view = setup(); fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    expect(view.queryByTestId('vision-ceremony-print-1-sharp')).toBeNull();
    await develop(view, 1);
    expect(view.getByText(copy.second)).toBeTruthy(); expect(view.queryByTestId('scene-candidate-c0')).toBeNull();
    expect(view.onAssemble).not.toHaveBeenCalled();
  });
  it('Choose is one tap, Keep edits the caption, and Seal saves once with that caption', async () => {
    mockJob = job(); const view = setup(); await choose(view, 1);
    expect(view.getByTestId('vision-ceremony-print-1-caption').props.value).toBe(base.anchorIntention);
    fireEvent.changeText(view.getByTestId('vision-ceremony-print-1-caption'), 'This future is mine.');
    expect(view.onAssemble).not.toHaveBeenCalled(); await seal(view);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
    expect(view.onAssemble).toHaveBeenCalledWith(expect.objectContaining({ selectedAssets: [expect.objectContaining({ assetId: 'asset-1', caption: 'This future is mine.' })] }));
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_caption_edited', { anchor_id: 'anchor', length: 20 });
    expect(view.getByText(copy.sealed)).toBeTruthy();
    await advance(3500); await advance(1200); await advance(200);
    expect(view.onPinned).toHaveBeenCalledTimes(1);
  });
  it('personal-photo completion uses Complete Vision and starts sealing on that tap', async () => {
    const view = setup({ startAt: 'develop', photo: { uri: 'file:///one.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    await develop(view, 1);
    expect(view.getByLabelText(copy.completeVision)).toBeTruthy();
    fireEvent.press(view.getByTestId('vision-complete-vision'));
    expect(view.queryByTestId('vision-seal-hold')).toBeNull();
    expect(view.getByTestId('vision-seal-stamp-line')).toBeTruthy();
    await advance(200);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
  });
  it('finalizes an AI Vision when a terminal job has only one usable generated image', async () => {
    mockJob = job('COMPLETE', candidates.slice(0, 1));
    const view = setup();
    fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    await develop(view, 1);
    fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(view.getByLabelText(copy.completeVision)).toBeTruthy();
    expect(view.queryByText(copy.both)).toBeNull();
  });
  it.each([1, 2, 4, 7, 8])('retains and develops every selected personal photo (%i)', async count => {
    const assets = Array.from({ length: count }, (_, index) => ({ uri: `file:///personal-${index}.jpg`, mimeType: 'image/jpeg' }));
    mockPicker.mockResolvedValueOnce({ canceled: false, assets });
    const view = setup();
    await act(async () => { fireEvent.press(view.getByLabelText(copy.ownPhoto)); });
    expect(view.getAllByTestId(/vision-ceremony-print-\d+-sharp/)).toHaveLength(count);
    await develop(view, count);
    expect(view.getByLabelText(copy.completeVision)).toBeTruthy();
    if (count > 1) expect(view.getAllByTestId(/vision-photo-stack-dot-\d/)).toHaveLength(count);
  });
  it('edits and persists the caption with the photo currently in front, preserving every selected image', async () => {
    mockPicker.mockResolvedValueOnce({ canceled: false, assets: [
      { uri: 'file:///first.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///second.jpg', mimeType: 'image/jpeg' },
    ] });
    let uploadCount = 0;
    const upload = jest.fn(async () => ({ ok: true as const, asset: { id: `photo-${++uploadCount}`, resolvedUrl: `file:///saved-${uploadCount}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } }));
    const view = setup({ onUploadAsset: upload });
    await act(async () => { fireEvent.press(view.getByLabelText(copy.ownPhoto)); });
    await develop(view, 2);
    fireEvent(view.getByTestId('vision-photo-stack-hit-target'), 'accessibilityTap');
    expect(view.getByTestId('vision-photo-stack-dot-1').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(view.getByTestId('vision-ceremony-print-1-caption'), 'The second photo is mine.');
    await seal(view);
    const selected = view.onAssemble.mock.calls[0][0].selectedAssets;
    expect(selected).toHaveLength(2);
    expect(selected.map((asset: any) => asset.caption)).toEqual([base.anchorIntention, 'The second photo is mine.']);
    expect(selected.map((asset: any) => asset.sourceType)).toEqual(['USER_UPLOAD', 'USER_UPLOAD']);
    expect(view.onAssemble.mock.calls[0][0].arrivingAssetId).toBe('photo-2');
  });
  it('replaces a failed photo in place and keeps the other selected images', async () => {
    mockPicker.mockResolvedValueOnce({ canceled: false, assets: [
      { uri: 'file:///bad.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///good.jpg', mimeType: 'image/jpeg' },
    ] });
    mockSinglePick.mockResolvedValueOnce({ status: 'picked', photo: { uri: 'file:///replacement.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    const view = setup();
    await act(async () => { fireEvent.press(view.getByLabelText(copy.ownPhoto)); });
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'error');
    expect(view.queryByLabelText(copy.completeVision)).toBeNull();
    expect(view.getByText(copy.replace)).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByText(copy.replace)); });
    expect(view.getAllByTestId(/vision-ceremony-print-\d+-sharp/)).toHaveLength(2);
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load');
    fireEvent(view.getByTestId('vision-ceremony-print-1-sharp'), 'load');
    await develop(view, 2);
    expect(view.getByLabelText(copy.completeVision)).toBeTruthy();
  });
  it('See both again and neither retain the description without saving', async () => {
    mockJob = job(); const view = setup(); await choose(view);
    fireEvent.press(view.getByText(copy.both)); expect(view.getByText(copy.choose)).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByText(copy.neither)); });
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockStart).toHaveBeenLastCalledWith(base.initialDescription, undefined);
    expect(view.onAssemble).not.toHaveBeenCalled();
  });
  it('failed save stays sealed; retry repeats the save without another hold', async () => {
    mockJob = job(); const save = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = setup({ onAssemble: save }); await choose(view); await seal(view);
    expect(view.getByText(copy.saveError)).toBeTruthy(); expect(view.queryByTestId('vision-seal-hold')).toBeNull();
    await act(async () => { fireEvent.press(view.getByTestId('vision-ceremony-save-retry')); }); await advance(200);
    expect(save).toHaveBeenCalledTimes(2); expect(view.queryByTestId('vision-seal-hold')).toBeNull();
  });
  it('retrying a partial failure keeps the already developed candidate selectable', async () => {
    mockJob = job('FAILED', candidates.slice(0, 1));
    const view = setup({ startAt: 'develop' }); await develop(view, 1);
    await act(async () => { fireEvent.press(view.getByText(copy.retry)); });
    expect(mockRetry).toHaveBeenCalledTimes(1);
    await advance(2800);
    fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(view.getByText(copy.caption)).toBeTruthy();
    expect(view.onAssemble).not.toHaveBeenCalled();
  });
  it('own-photo multi-select uploads while settling and saves the set only at Seal in picker order', async () => {
    mockPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///one.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///two.png', mimeType: 'image/png' }] });
    const view = setup(); await act(async () => { fireEvent.press(view.getByLabelText(copy.ownPhoto)); });
    expect(view.onUploadAsset).toHaveBeenCalledTimes(2); expect(view.onAssemble).not.toHaveBeenCalled(); await develop(view, 2);
    expect(view.getByText(copy.caption)).toBeTruthy(); expect(view.onAssemble).not.toHaveBeenCalled(); await seal(view);
    expect(view.onUploadAsset).toHaveBeenCalledTimes(2); expect(mockStart).not.toHaveBeenCalled();
    expect(view.onAssemble.mock.calls[0][0].selectedAssets.map((asset: any) => asset.sourceType)).toEqual(['USER_UPLOAD', 'USER_UPLOAD']);
    expect(view.onAssemble.mock.calls[0][0].selectedAssets[0].caption).toBe(base.anchorIntention);
  });
  it('own-photo retry reuses uploaded assets after a failed save', async () => {
    const save = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = setup({ startAt: 'develop', photo: { uri: 'file:///one.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' }, onAssemble: save });
    await develop(view, 1); await seal(view); expect(view.onUploadAsset).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(view.getByTestId('vision-ceremony-save-retry')); }); await advance(200);
    expect(view.onUploadAsset).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(2);
  });
  it('regenerate enters Describe, then follows Develop, Choose, Keep and Seal', async () => {
    mockJob = job(); const onAdd = jest.fn(async () => true);
    const view = setup({ mode: 'add', startAt: 'describe', regenerating: true, onAdd });
    expect(view.getAllByText('Describe another moment from this future.').length).toBeGreaterThan(0);
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); }); await develop(view, 2);
    fireEvent.press(view.getByTestId('scene-candidate-c0')); await seal(view);
    expect(onAdd).toHaveBeenCalledWith({ assetId: 'asset-0', prompt: 'Moment 0', caption: base.anchorIntention });
  });
  it('records an added generated selection at Choose before persistence', async () => {
    mockJob = job(); const onAdd = jest.fn(async () => true);
    const view = setup({ mode: 'add', visionId: 'existing-vision', onAdd });
    fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    await develop(view, 2);
    fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_image_selected', {
      anchor_id: 'anchor', vision_id: 'existing-vision', asset_id: 'asset-0', source_type: 'AI_GENERATED',
    });
  });
  it('resumeGeneration consumes the saved request once and enters Develop', async () => {
    mockJob = job('RUNNING', []); const consume = jest.fn();
    const view = setup({ resumeGeneration: true, onResumeGenerationConsumed: consume }, false); await advance(0);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(consume).toHaveBeenCalledTimes(1); expect(view.getByText(copy.reading)).toBeTruthy();
  });
  it('all decorative durations collapse to 200ms or less while hold remains 1600ms', () => {
    for (const key of ['stageFadeMs', 'printMoveMs', 'revealInkMs', 'revealBlurMs', 'sealDecayMs', 'stampMs', 'rippleMs', 'pressMs', 'boardRiseMs', 'pinDropMs'] as const) expect(ceremonyDuration(CEREMONY[key], true)).toBeLessThanOrEqual(200);
    expect(CEREMONY.sealHoldMs).toBe(1600);
    expect(CEREMONY.printMoveMs + CEREMONY.stampMs + CEREMONY.sealedMinHoldMs + CEREMONY.boardRiseMs).toBeLessThanOrEqual(2200);
  });
  it('approved copy contains no forbidden vocabulary and prefill never exceeds 80 characters', () => {
    expect(Object.values(copy).join(' ')).not.toMatch(/\b(sigil|ritual|charge|spell|streak|attract|mindfulness|meditation|vision board|occult|prime|priming)\b/i);
    expect(prefillVisionCaption('a'.repeat(100))).toHaveLength(80);
  });
  it('add mode accepts the existing six-character scene minimum', async () => {
    const view = setup({ mode: 'add', initialDescription: 'Studio' });
    fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    expect(mockStart).toHaveBeenCalledWith('Studio', null);
  });
  it('photo-based generation with no written description saves the same valid draft at Seal', async () => {
    mockJob = job();
    mockSinglePick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///starting.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    mockSourceUpload.mockResolvedValue({ ok: true, assetId: 'start-photo' });
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_options, callback) => callback(2));
    const draft = jest.fn(async () => true);
    const view = setup({ initialDescription: '', onSaveDescription: draft });
    fireEvent.press(view.getByLabelText(copy.words)); fireEvent.press(view.getByTestId('vision-path-photo')); fireEvent.press(view.getByTestId('vision-start-photo-pick'));
    const library = view.queryByTestId('vision-photo-source-sheet-library'); if (library) fireEvent.press(library);
    await advance(500);
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    expect(mockStart).toHaveBeenCalledWith(expect.any(String), null, 'start-photo'); expect(draft).toHaveBeenCalledWith(base.anchorIntention);
    await develop(view, 2); fireEvent.press(view.getByTestId('scene-candidate-c0')); await seal(view);
    expect(view.onAssemble).toHaveBeenCalledWith(expect.objectContaining({ description: base.anchorIntention })); sheet.mockRestore();
  });
  it('one loaded candidate remains choosable when the other cannot load', async () => {
    mockJob = job(); const view = setup(); fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    fireEvent(view.getByTestId('vision-ceremony-print-1-sharp'), 'error'); await develop(view, 1);
    expect(view.getByTestId('scene-candidate-c0').props.accessibilityState.disabled).toBeFalsy();
    expect(view.getByTestId('scene-candidate-c1').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByTestId('scene-candidate-c0')); expect(view.getByTestId('vision-complete-vision')).toBeTruthy();
  });
  it('retry retains development readiness for a partial image reused by the server', async () => {
    mockJob = job('FAILED', candidates.slice(0, 1)); const view = setup();
    fireEvent.press(view.getByLabelText(copy.words)); await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); }); await develop(view, 1);
    mockRetry.mockImplementationOnce(async () => { mockJob = job('COMPLETE', candidates.slice(0, 1)); return true; });
    await act(async () => { fireEvent.press(view.getByText(copy.retry)); }); await advance(3600);
    expect(view.getByText(copy.choose)).toBeTruthy(); fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(view.getByTestId('vision-complete-vision')).toBeTruthy();
  });
  it('retries a failed generated image URL and lets the user choose it after reload', async () => {
    mockJob = job(); const view = setup(); await choose(view, 0);
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'error');
    expect(view.getByText(copy.retry)).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByText(copy.retry)); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    await advance(0); fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load');
    // Re-entering Develop starts its reading beat before the image's reveal can finish.
    await advance(CEREMONY.wordLightTotalMs); await advance(CEREMONY.revealBlurMs);
    expect(view.getByTestId('scene-candidate-c0').props.accessibilityState.disabled).toBeFalsy();
    expect(view.queryByText(copy.unavailable)).toBeNull();
    expect(view.getByTestId('scene-candidate-c0')).toBeTruthy();
    fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(view.getByTestId('vision-ceremony-keep')).toBeTruthy();
  });
  it('create starts once across Describe re-entry and Add source follows the selected path', async () => {
    const view = setup(); fireEvent.press(view.getByLabelText(copy.words)); fireEvent.press(view.getByLabelText('Go back')); fireEvent.press(view.getByLabelText(copy.words));
    expect((AnalyticsService.track as jest.Mock).mock.calls.filter(([name]) => name === 'vision_create_started')).toHaveLength(1);
    view.unmount(); jest.clearAllMocks();
    const add = setup({ mode: 'add' });
    expect(AnalyticsService.track).not.toHaveBeenCalledWith('vision_image_add_started', expect.anything());
    mockSinglePick.mockResolvedValue({ status: 'cancelled' });
    await act(async () => { fireEvent.press(add.getByLabelText(copy.camera)); });
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_image_add_started', { anchor_id: 'anchor', source_type: 'camera' });
  });
  const bedCalls = () => (playCreationSound as jest.Mock).mock.calls.filter(([id]) => id === 'formBed').length;
  it('plays the bed only during the Develop wait and stops it at the first reveal', async () => {
    mockJob = job(); const view = setup();
    expect(bedCalls()).toBe(0);
    fireEvent.press(view.getByLabelText(copy.words)); expect(bedCalls()).toBe(0);
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    expect(bedCalls()).toBe(1);
    const bed = (playCreationSound as jest.Mock).mock.results.find((_, i) => (playCreationSound as jest.Mock).mock.calls[i][0] === 'formBed')!.value;
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load', { nativeEvent: { source: { width: 800, height: 1000 } } });
    await advance(0); await advance(2800);
    expect(bed.stop).toHaveBeenCalledWith(550);
    await develop(view, 2); fireEvent.press(view.getByTestId('scene-candidate-c0'));
    expect(view.getByTestId('vision-ceremony-keep')).toBeTruthy(); expect(bedCalls()).toBe(1);
  });
  it('stops the bed when the app backgrounds', async () => {
    mockJob = job('RUNNING', []);
    const add = AppState.addEventListener as unknown as jest.Mock;
    const before = add.mock.calls.length;
    setup({ startAt: 'develop' });
    const bed = (playCreationSound as jest.Mock).mock.results[(playCreationSound as jest.Mock).mock.calls.findIndex(([id]) => id === 'formBed')].value;
    act(() => { add.mock.calls.slice(before).forEach(([, handler]) => handler('background')); });
    expect(bed.stop).toHaveBeenCalledWith(550);
  });
  it('Ask buttons and Keep play the tap cue', async () => {
    mockJob = job(); const view = setup(); await choose(view);
    const taps = () => (playCreationSound as jest.Mock).mock.calls.filter(([id]) => id === 'uiTap').length;
    expect(taps()).toBe(1);
    fireEvent.press(view.getByTestId('vision-ceremony-keep')); expect(taps()).toBe(2);
  });
  const example = (i: number) => ({ image: { uri: `file:///example-${i}.webp` }, caption: `Example ${i}`, moment: `Moment ${i}: I am standing in the light, and it is quiet.` });
  const anchorOpacity = (view: ReturnType<typeof setup>) => { const node = view.getByTestId('vision-ceremony-anchor'); return node.props.jestAnimatedStyle?.value?.opacity ?? StyleSheet.flatten(node.props.style).opacity; };
  const soundCalls = (id: string) => (playCreationSound as jest.Mock).mock.calls.filter(([name]) => name === id);
  it('tapping an example opens Describe from that moment, and generation uses the typed text', async () => {
    mockExamples = [example(1), example(2), example(3)]; mockJob = job(); const view = setup();
    fireEvent.press(view.getByLabelText('Start from this example: Example 2')); await advance(ENTRANCE.pickMs + 50);
    expect(view.getByText(copy.makeItYours)).toBeTruthy(); expect(view.getByText(copy.fromExample)).toBeTruthy(); expect(view.getByTestId('vision-example-thumb')).toBeTruthy();
    // A bundled picture keeps its own pixel size unless the frame pins it, so it must not overflow the 120pt print.
    expect(StyleSheet.flatten(view.getByTestId('vision-example-thumb-image').props.style)).toMatchObject({ width: '100%', height: '100%' });
    expect(StyleSheet.flatten(view.getByTestId('vision-example-thumb').props.style)).toMatchObject({ width: 120 });
    expect(view.getByTestId('vision-path-words').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('vision-prompt-input').props.value).toBe(example(2).moment);
    fireEvent.changeText(view.getByTestId('vision-prompt-input'), `${example(2).moment} My own details.`);
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    expect(mockStart).toHaveBeenCalledWith(`${example(2).moment} My own details.`, null);
    const edited = (AnalyticsService.track as jest.Mock).mock.calls.find(([name]) => name === 'vision_example_edited');
    expect(edited[1]).toEqual(expect.objectContaining({ anchor_id: 'anchor', index: 1, category: 'custom' }));
    expect(edited[1].edit_distance_pct).toBeGreaterThan(0); expect(edited[1].edit_distance_pct).toBeLessThan(50);
  });
  it('an untouched example reports an edit distance of 0', async () => {
    mockExamples = [example(1)]; mockJob = job(); const view = setup();
    fireEvent.press(view.getByLabelText('Start from this example: Example 1')); await advance(ENTRANCE.pickMs + 50);
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_example_edited', { anchor_id: 'anchor', category: 'custom', index: 0, edit_distance_pct: 0 });
  });
  it('Back from Describe shows the entrance at rest without replaying the open', async () => {
    mockExamples = [example(1), example(2), example(3)]; const view = setup();
    expect(soundCalls('anchorPulse')).toHaveLength(1); expect(soundCalls('formTick')).toHaveLength(3);
    fireEvent.press(view.getByLabelText(copy.words)); await advance(2000);
    fireEvent.press(view.getByLabelText('Go back')); await advance(2000);
    expect(view.getByTestId('vision-entrance')).toBeTruthy(); expect(view.queryByTestId('vision-entrance-anchor')).toBeNull();
    expect(soundCalls('anchorPulse')).toHaveLength(1); expect(soundCalls('formTick')).toHaveLength(3);
    expect(anchorOpacity(view)).toBe(1);
  });
  it('backing out of an untouched example does not leave its moment as a prefill', async () => {
    mockExamples = [example(1)]; const view = setup();
    fireEvent.press(view.getByLabelText('Start from this example: Example 1')); await advance(ENTRANCE.pickMs + 50);
    fireEvent.press(view.getByLabelText('Go back')); await advance(2000);
    fireEvent.press(view.getByLabelText(copy.words));
    expect(view.getByTestId('vision-prompt-input').props.value).toBe(base.initialDescription); expect(view.queryByText(copy.makeItYours)).toBeNull();
  });
  it('the persistent Anchor stays hidden during the open and appears when the lift lands', async () => {
    const view = setup({}, false);
    expect(anchorOpacity(view)).toBe(0); await advance(ENTRANCE.liftAt + ENTRANCE.liftMs - 100); expect(anchorOpacity(view)).toBe(0);
    await advance(2000); await advance(1000); expect(anchorOpacity(view)).toBe(1);
  });
  it('Reduce Motion skips the open and shows the persistent Anchor at once', async () => {
    mockReduced = true; const view = setup({}, false); await advance(400);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull(); expect(anchorOpacity(view)).toBe(1);
    expect(soundCalls('anchorPulse')).toHaveLength(0); fireEvent.press(view.getByLabelText(copy.words)); expect(view.getByTestId('vision-prompt-input')).toBeTruthy();
  });
  it('hides the Anchor mark on Describe and brings it back on Develop', async () => {
    mockJob = job('RUNNING', []); const view = setup();
    const opacity = () => anchorOpacity(view);
    await advance(2000); expect(opacity()).toBe(1);
    fireEvent.press(view.getByLabelText(copy.words)); await advance(2000); expect(opacity()).toBe(0);
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); }); await advance(2000); expect(opacity()).toBe(1);
  });
  it('Keep has no reframe gesture and no reframe hint', async () => {
    mockJob = job(); const view = setup(); await choose(view);
    expect(view.getByText(copy.hint)).toBeTruthy(); expect(view.queryByText(/reframe/i)).toBeNull();
    for (const detector of view.UNSAFE_getAllByType(GestureDetector)) expect((detector.props.gesture as any).config.enabled).toBe(false);
  });
  it('hides "Neither" after a generation-limit error and stays on the developed pair', async () => {
    mockJob = job(); const view = setup(); await choose(view);
    fireEvent.press(view.getByText(copy.both));
    mockStart.mockImplementationOnce(async () => { mockError = 'You have reached the limit for generated scenes on this Vision.'; mockErrorCode = 'VISION_GENERATION_LIMIT'; return false; });
    await act(async () => { fireEvent.press(view.getByText(copy.neither)); });
    expect(view.queryByText(copy.neither)).toBeNull();
    expect(view.getByTestId('vision-ceremony-limit').props.children).toBe(mockError);
    expect(view.getByTestId('scene-candidate-c0').props.accessibilityState.disabled).toBeFalsy();
  });
  it('catches an active transition between mounting and subscribing to AppState', () => {
    const descriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
    let reads = 0;
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => ++reads === 1 ? 'background' : 'active' });
    try {
      const view = setup({ startAt: 'develop', photo: { uri: 'file:///one.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
      expect(view.getByTestId('vision-ceremony-print-0-sharp')).toBeTruthy();
      expect(require('@/services/CreationSounds').playCreationSound).not.toHaveBeenCalledWith('formTick');
    } finally { Object.defineProperty(AppState, 'currentState', descriptor); }
  });
});

describe('Vision celebration scene', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockJob = job(); mockReduced = false; mockError = null; mockErrorCode = null; mockExamples = [];
    useCelebrationStore.getState().reset();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });
  afterEach(() => { useCelebrationStore.getState().reset(); jest.clearAllTimers(); jest.useRealTimers(); });
  const scene = () => useCelebrationStore.getState().active;
  const impacts = () => (safeHaptics.impact as jest.Mock).mock.calls.map(call => call[0]);
  async function sealNow(view: ReturnType<typeof setup>, _holdMs: number) {
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await advance(200);
  }

  it('the first-image completion tap starts the L4 scene on the shortened timeline', async () => {
    const view = setup(); await choose(view);
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await advance(200);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
    expect(scene()).toEqual({ id: expect.stringMatching(/^vision-ceremony:/), level: 4, skippable: false });
  });
  it('a later image completion tap starts the L2 scene immediately', async () => {
    const view = setup({ firstImage: false }); await choose(view);
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await advance(200);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
    expect(scene()).toEqual({ id: expect.stringMatching(/^vision-ceremony:/), level: 2, skippable: false });
  });
  it('completion fires one Heavy haptic after the print movement and no Medium haptic', async () => {
    const view = setup(); await choose(view);
    (safeHaptics.impact as jest.Mock).mockClear();
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await advance(CEREMONY.printMoveMs + CEREMONY.stampMs);
    expect(impacts()).not.toContain(ImpactFeedbackStyle.Medium);
    expect(impacts().filter(style => style === ImpactFeedbackStyle.Heavy)).toHaveLength(1);
  });
  it('the short seal scene is not skippable and lands the print on the board once', async () => {
    const view = setup(); await choose(view);
    expect(view.queryByLabelText('Skip')).toBeNull();
    await sealNow(view, 1600);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
    expect(view.queryByLabelText('Skip')).toBeNull();
    await advance(CEREMONY.printMoveMs + CEREMONY.stampMs + CEREMONY.sealHoldMs);
    await advance(CEREMONY.boardRiseMs);
    await advance(200); await advance(0);
    expect(view.getByLabelText(copy.back)).toBeTruthy();
    expect(view.onPinned).toHaveBeenCalledTimes(1);
  });
  it('a pending save remains visible until completion without a skip affordance', async () => {
    let resolveSave: (value: boolean) => void = () => undefined;
    const onAssemble = jest.fn((_result: unknown) => new Promise<boolean>(resolve => { resolveSave = resolve; }));
    const view = setup({ onAssemble: onAssemble as any }); await choose(view);
    await sealNow(view, 1600);
    expect(view.queryByLabelText('Skip')).toBeNull();
    expect(view.queryByTestId('vision-ceremony-saving')).toBeTruthy();
    expect(scene()?.id).toMatch(/^vision-ceremony:/);
    await act(async () => { resolveSave(true); });
    await advance(CEREMONY.printMoveMs + CEREMONY.stampMs + CEREMONY.sealHoldMs);
    await advance(CEREMONY.boardRiseMs);
    await advance(200); await advance(0);
    expect(view.onPinned).toHaveBeenCalledTimes(1);
    await advance(5000); expect(view.onPinned).toHaveBeenCalledTimes(1);
  });
  it('Reduce Motion resolves to a short L2 scene that is not skippable; the seal cue and Heavy haptic still fire', async () => {
    mockReduced = true; const view = setup({}, false); await advance(400);
    await choose(view);
    await sealNow(view, 1600); await advance(200);
    expect(scene()).toEqual({ id: expect.stringMatching(/^vision-ceremony:/), level: 2, skippable: false });
    expect(view.queryByLabelText('Skip')).toBeNull();
    expect(require('@/services/CreationSounds').playCreationSound).toHaveBeenCalledWith('seal');
    expect(impacts()).toContain(ImpactFeedbackStyle.Heavy);
    await advance(2500); await advance(1000); expect(view.onPinned).toHaveBeenCalledTimes(1);
  });
  it('a higher scene that preempts a later-image seal lands it on the settled board', async () => {
    const view = setup({ firstImage: false }); await choose(view);
    await sealNow(view, 900);
    expect(view.onPinned).not.toHaveBeenCalled();
    act(() => { useCelebrationStore.getState().request(4, 'test-higher-scene', { durationMs: 6000 }); });
    expect(view.onPinned).toHaveBeenCalledTimes(1);
    await advance(6000);
    expect(view.onPinned).toHaveBeenCalledTimes(1);
    expect(scene()?.id).toBe('test-higher-scene');
  });
  it('a seal deferred behind a higher scene still saves, and leaves the queue at its hand-off', async () => {
    const view = setup(); await choose(view);
    act(() => { useCelebrationStore.getState().request(4, 'test-higher-scene', { durationMs: 6000 }); });
    await sealNow(view, 1600);
    expect(view.onAssemble).toHaveBeenCalledTimes(1);
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    await advance(3500); await advance(1200); await advance(200);
    expect(view.onPinned).toHaveBeenCalledTimes(1);
    expect(useCelebrationStore.getState().queueLength).toBe(0);
  });
  it('holds the completed-board handoff while backgrounded and exposes Back after resume', async () => {
    mockJob = job();
    const onBack = jest.fn();
    const view = setup({ onBack }); await choose(view);
    const add = AppState.addEventListener as unknown as jest.Mock;
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await advance(200);
    const emit = (value: string) => act(() => { add.mock.calls.forEach(([, handler]) => handler(value)); });
    emit('background'); await advance(3000);
    expect(view.onPinned).not.toHaveBeenCalled();
    expect(view.queryByLabelText(copy.back)).toBeNull();
    emit('active'); await advance(1200); await advance(200);
    expect(view.onPinned).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText(copy.back));
    expect(onBack).toHaveBeenCalledTimes(1);
    await advance(4000); expect(view.onPinned).toHaveBeenCalledTimes(1);
  });
});

describe('Vision double-fire guards', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockJob = job(); mockReduced = false; mockError = null; mockErrorCode = null; mockExamples = [];
    useCelebrationStore.getState().reset();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });
  afterEach(() => { useCelebrationStore.getState().reset(); jest.clearAllTimers(); jest.useRealTimers(); });
  const calls = (name: string) => (playCreationSound as jest.Mock).mock.calls.filter(([key]) => key === name);
  const selection = () => require('@/hooks/v2').v2Haptics.selection as jest.Mock;
  const photo = { uri: 'file:///one.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } as const;

  it('own photos have no develop cue or copy across background and foreground transitions', async () => {
    const add = AppState.addEventListener as unknown as jest.Mock;
    const before = add.mock.calls.length;
    const view = setup({ startAt: 'develop', photo });
    expect(calls('formTick')).toHaveLength(0); expect(selection()).not.toHaveBeenCalled();
    expect(view.queryByText(copy.placing)).toBeNull();
    const emit = (value: string) => act(() => { add.mock.calls.slice(before).forEach(([, handler]) => handler(value)); });
    await advance(500);
    emit('background');
    await advance(3000);
    emit('active');
    await advance(0);
    // The status the clock reached while away is shown, and nothing was replayed for it.
    expect(calls('formTick')).toHaveLength(0); expect(selection()).not.toHaveBeenCalled();
    expect(view.queryByText(copy.developing)).toBeNull();
    // The sequence goes on to completion from where it was, with no further cue.
    await advance(2000);
    expect(calls('formTick')).toHaveLength(0); expect(selection()).not.toHaveBeenCalled();
    expect(view.queryByText(copy.developing)).toBeNull();
  });
  it('own photos enter Keep after decoding and a 600ms settle without a develop wait', async () => {
    const view = setup({ startAt: 'develop', photo });
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load');
    await advance(599); expect(view.queryByTestId('vision-complete-vision')).toBeNull();
    await advance(1); expect(view.getByTestId('vision-complete-vision')).toBeTruthy();
    expect(view.queryByText(copy.light)).toBeNull(); expect(view.queryByText(copy.developing)).toBeNull();
    expect(calls('formTick')).toHaveLength(0); expect(selection()).not.toHaveBeenCalled();
    await advance(5000);
    expect(calls('formTick')).toHaveLength(0); expect(selection()).not.toHaveBeenCalled();
  });
  it('a replacement photo settles without replaying develop cues', async () => {
    mockPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///two.jpg', mimeType: 'image/jpeg' }] });
    mockSinglePick.mockResolvedValueOnce({ status: 'picked', photo: { uri: 'file:///two.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    const view = setup({ startAt: 'develop', photo }); await develop(view, 1);
    expect(view.getByText(copy.caption)).toBeTruthy();
    const before = calls('formTick').length;
    await act(async () => { fireEvent.press(view.getByText(copy.replace)); });
    expect(calls('formTick').length).toBe(before);
    expect(view.queryByTestId('vision-ceremony-print-0-ink')).toBeNull();
  });

  it('two quick taps on a candidate choose once: one cue, one haptic, one event', async () => {
    const view = setup(); fireEvent.press(view.getByLabelText(copy.words));
    await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); });
    await develop(view, 2);
    // The prints' own reveal also uses this cue; only the choice's share is counted.
    const revealed = calls('revealSettle').length;
    const candidate = view.getByTestId('scene-candidate-c0');
    selection().mockClear();
    act(() => { fireEvent.press(candidate); fireEvent.press(candidate); });
    expect(calls('revealSettle')).toHaveLength(revealed + 1);
    expect(selection()).toHaveBeenCalledTimes(1);
    expect((AnalyticsService.track as jest.Mock).mock.calls.filter(([name]) => name === 'vision_image_selected')).toHaveLength(1);
    expect(view.getByTestId('vision-ceremony-keep')).toBeTruthy();
    // A stale handler fired after the beat has moved on is still ignored.
    act(() => { fireEvent.press(candidate); });
    expect(calls('revealSettle')).toHaveLength(revealed + 1);
  });
  it('choosing works again when Choose is entered again', async () => {
    const view = setup(); await choose(view);
    const first = calls('revealSettle').length;
    fireEvent.press(view.getByText(copy.both));
    expect(view.getByText(copy.choose)).toBeTruthy();
    fireEvent.press(view.getByTestId('scene-candidate-c1'));
    expect(calls('revealSettle')).toHaveLength(first + 1);
    expect(view.getByTestId('vision-ceremony-keep')).toBeTruthy();
  });
});
