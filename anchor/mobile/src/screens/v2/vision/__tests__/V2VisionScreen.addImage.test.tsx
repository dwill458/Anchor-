import { Alert, Image, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { ENTRANCE } from '@/components/v2/vision/ceremony/VisionEntrance';
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
  useRoute: () => ({ params: { anchorId: 'anchor-1', initialMode: 'view' } }),
}));
jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  ApiClientError: class extends Error {} }));
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' }, requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn(async () => ({ exists: true })),
  readAsStringAsync: jest.fn(async () => 'QUJD'), EncodingType: { Base64: 'base64' } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/utils/premiumAccess', () => ({ ...jest.requireActual('@/utils/premiumAccess'), isProFeatureLocked: () => false }));
const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const stamp = '2026-10-07T00:00:00Z';
const scene = (i: number, extra = {}) => ({ id: `sc-${i}`, visionId: 'vision-101', sourceType: 'AI_GENERATED', assetId: `ast-${i}`,
  resolvedImageUrl: `https://example.com/${i}.jpg`, prompt: null, sortOrder: i - 1, isArchived: false, createdAt: stamp, updatedAt: stamp, ...extra });
const visionWith = (count: number) => ({ id: 'vision-101', anchorId: 'anchor-1', title: 'Studio', description: 'A quiet studio full of finished work.',
  status: 'ACTIVE', seenToday: false, createdAt: stamp, updatedAt: stamp, scenes: Array.from({ length: count }, (_, i) => scene(i + 1)) });
let currentVision = visionWith(3);
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
// The entrance's controls go live once the open has finished; the persistent Anchor takes over a moment after that.
const ASK_READY = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 50;
async function openAsk(view: ReturnType<typeof render>) { await view.findByTestId('vision-board'); fireEvent.press(view.getByLabelText(/^Add an image/)); await advance(ASK_READY); }
async function ownPhoto(view: ReturnType<typeof render>, source: 'camera' | 'library') {
  await act(async () => { fireEvent.press(view.getByLabelText(source === 'camera' ? 'Take a photo' : 'Use my own photo')); });
  fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load'); await advance(0); await advance(600); await advance(4400);
}
async function seal(view: ReturnType<typeof render>) {
  fireEvent.press(view.getByTestId('vision-ceremony-keep')); fireEvent(view.getByTestId('vision-seal-hold'), 'pressIn');
  await advance(1599); expect(apiClient.post).not.toHaveBeenCalled(); await advance(1); await advance(200);
}
describe('V2VisionScreen ceremony additions', () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); resetV2VisionReadCache(); currentVision = visionWith(3);
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(cb => cb(10, 20, 150, 180));
    useAnchorStore.setState({ anchors: [{ id: 'anchor-1', intentionText: 'I build what matters.', intention: 'I build what matters.', category: 'career',
      baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>', status: 'ACTIVE', createdAt: stamp } as never] });
    (apiClient.get as jest.Mock).mockImplementation(async (url: string) => {
      if (/\/vision(\?|$)/.test(url)) return { data: currentVision };
      throw Object.assign(new Error('Not found'), { status: 404 });
    });
    const granted = { status: 'granted', canAskAgain: true } as never;
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted); picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] } as never);
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url === '/api/v2/assets/upload') return { data: { id: 'own-asset', resolvedUrl: 'https://example.com/own.jpg', mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: stamp } };
      const added = scene(4, { ...input, resolvedImageUrl: 'https://example.com/own.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
      return { data: added };
    });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
  it('Add image opens Ask directly with all three paths and launches nothing', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    expect(view.getByText('What else do you see?')).toBeTruthy(); expect(view.queryByTestId('vision-add-sheet-generate')).toBeNull();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled(); expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });
  it.each(['camera', 'library'] as const)('%s photos stay local through Keep and persist caption at Seal', async source => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, source);
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByTestId('vision-ceremony-print-0-caption'), 'Finished work in my studio.'); await seal(view);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', expect.objectContaining({
      assetId: 'own-asset', sourceType: source === 'camera' ? 'USER_CAMERA' : 'USER_UPLOAD', caption: 'Finished work in my studio.' }));
    await advance(3200); await advance(1200); await advance(200); await advance(600);
    expect(view.getByTestId('vision-just-added')).toBeTruthy(); expect(view.getByTestId('vision-board-photo-sc-4')).toBeTruthy();
  });
  it.each(['add', 'regenerate'] as const)('drops the arrival pin on the saved scene id after %s even when the read model re-signs its URL', async kind => {
    // Every read re-signs URLs: regenerate's archive re-read leaves the save response's URL matching no tile.
    let reads = 0;
    (apiClient.get as jest.Mock).mockImplementation(async (url: string) => {
      if (!/\/vision(\?|$)/.test(url)) throw Object.assign(new Error('Not found'), { status: 404 });
      reads += 1;
      return { data: { ...currentVision, scenes: currentVision.scenes.map(item => ({ ...item, resolvedImageUrl: `${item.resolvedImageUrl}?sig=${reads}` })) } };
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    if (kind === 'add') { await openAsk(view); await ownPhoto(view, 'library'); await seal(view); }
    else {
      const generated = { id: 'generation', visionId: 'vision-101', status: 'COMPLETE', retryCount: 0,
        candidates: [0, 1].map(i => ({ id: `candidate-${i}`, assetId: `generated-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: 'A new studio.', sortOrder: i })) };
      (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
        if (url.endsWith('/scene-generation')) return { data: generated };
        const added = scene(4, { ...input, resolvedImageUrl: 'https://example.com/generated.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
        return { data: added };
      });
      (apiClient.delete as jest.Mock).mockImplementation(async () => {
        currentVision = { ...currentVision, scenes: currentVision.scenes.filter(item => item.id !== 'sc-1') }; return { data: { success: true } };
      });
      const first = await view.findByLabelText('Vision image 1 of 3'); fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      fireEvent.press(view.getByLabelText('Regenerate')); fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A new studio.');
      await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
      fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load'); await advance(0); await advance(2800); await advance(3600);
      fireEvent.press(view.getByTestId('scene-candidate-candidate-0')); fireEvent.press(view.getByTestId('vision-ceremony-keep'));
      fireEvent(view.getByTestId('vision-seal-hold'), 'pressIn'); await advance(1600); await advance(200);
    }
    await advance(3200); await advance(1200); await advance(200); await advance(600);
    expect(view.getByTestId('vision-board-photo-sc-4-arrival-pin')).toBeTruthy();
    expect(view.queryByTestId('vision-board-photo-sc-2-arrival-pin')).toBeNull();
  });
  it('canceling before Seal saves no image', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, 'library');
    fireEvent.press(view.getByLabelText('Back')); await view.findByTestId('vision-board'); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('a permanent camera refusal explains permission and leaves Ask usable', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    await act(async () => { fireEvent.press(view.getByLabelText('Take a photo')); });
    expect(alert).toHaveBeenCalledWith('Permission needed', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
    expect(picker.launchCameraAsync).not.toHaveBeenCalled(); expect(view.getByText('What else do you see?')).toBeTruthy();
  });
  it('offers no add action when the real board holds six images', async () => {
    currentVision = visionWith(6); const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByTestId('vision-board');
    expect(view.queryByLabelText(/^Add an image/)).toBeNull();
  });
  it('one-image boards retain room to add', async () => {
    currentVision = visionWith(1); const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByTestId('vision-board');
    expect(view.getByLabelText('Add an image, 1 of 6')).toBeTruthy();
  });
  it('keeps added images when the Vision is reopened', async () => {
    currentVision = visionWith(4); const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByTestId('vision-board-photo-sc-4'); view.unmount();
    const reopened = render(<V2VisionScreen anchorId="anchor-1" />); expect(reopened.getByTestId('vision-board-photo-sc-4')).toBeTruthy();
  });
  it('keeps a failed add sealed and retries without another upload or hold', async () => {
    const post = (apiClient.post as jest.Mock).getMockImplementation()!;
    let failed = false;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: unknown) => {
      if (url.endsWith('/scenes') && !failed) { failed = true; throw new Error('Save unavailable'); }
      return post(url, input);
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, 'library'); await seal(view);
    expect(view.getByTestId('vision-ceremony-save-retry')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-ceremony-save-retry')); }); await advance(200);
    expect((apiClient.post as jest.Mock).mock.calls.filter(([url]) => url === '/api/v2/assets/upload')).toHaveLength(1);
    await advance(3500); await advance(1200); await advance(200);
    expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  it('first own-photo creation remains mounted through Sealed and Pinned', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
    const post = (apiClient.post as jest.Mock).getMockImplementation()!;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url === '/api/v2/anchors/anchor-1/vision') return { data: { ...visionWith(0), description: input.description,
        scenes: input.scenes.map((item: any, i: number) => scene(i + 1, { ...item, resolvedImageUrl: 'https://example.com/own.jpg' })) } };
      return post(url, input);
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByText("When it's true, what do you see?"); await advance(ASK_READY);
    await ownPhoto(view, 'library'); await seal(view);
    expect(view.getByText('Sealed.')).toBeTruthy(); expect(view.queryByTestId('vision-board')).toBeNull();
    await advance(3500); await advance(1200); await advance(200); expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  it.each([6, 3])('sealed regeneration on a %i-image board resumes unfinished mutations', async count => {
    currentVision = visionWith(count);
    const generated = { id: 'generation', visionId: 'vision-101', status: 'COMPLETE', retryCount: 0,
      candidates: [0, 1].map(i => ({ id: `candidate-${i}`, assetId: `generated-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: 'A new studio.', sortOrder: i })) };
    let addFailed = false, deleteFailed = false;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url.endsWith('/scene-generation')) return { data: generated };
      if (count === 6 && !addFailed) { addFailed = true; throw new Error('Add unavailable'); }
      const added = scene(7, { ...input, resolvedImageUrl: 'file:///generated-0.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
      return { data: added };
    });
    (apiClient.delete as jest.Mock).mockImplementation(async () => {
      if (count === 3 && !deleteFailed) { deleteFailed = true; throw new Error('Remove unavailable'); }
      currentVision = { ...currentVision, scenes: currentVision.scenes.filter(item => item.id !== 'sc-1') }; return { data: { success: true } };
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const first = await view.findByLabelText(`Vision image 1 of ${count}`); fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    fireEvent.press(view.getByLabelText('Regenerate')); fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A new studio.');
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    fireEvent(view.getByTestId('vision-ceremony-print-0-sharp'), 'load'); await advance(0); await advance(2800); await advance(3600);
    fireEvent.press(view.getByTestId('scene-candidate-candidate-0')); fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    fireEvent(view.getByTestId('vision-seal-hold'), 'pressIn'); await advance(1600); await advance(200);
    expect(view.getByTestId('vision-ceremony-save-retry')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-ceremony-save-retry')); }); await advance(200);
    expect((apiClient.post as jest.Mock).mock.calls.filter(([url]) => url.endsWith('/scenes'))).toHaveLength(count === 6 ? 2 : 1);
    expect(apiClient.delete).toHaveBeenCalledTimes(count === 6 ? 1 : 2);
    expect(currentVision.scenes.filter(item => item.assetId === 'generated-0')).toHaveLength(1);
    expect(currentVision.scenes.find(item => item.assetId === 'generated-0')?.sortOrder).toBe(0);
    await advance(3500); await advance(1200); await advance(200); expect(view.getByTestId('vision-board')).toBeTruthy();
  });
});
