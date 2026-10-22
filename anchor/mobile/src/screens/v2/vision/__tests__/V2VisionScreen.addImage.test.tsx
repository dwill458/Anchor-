import { Alert, Image, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { ENTRANCE } from '@/components/v2/vision/ceremony/VisionEntrance';
import { useVisionPresentationStore } from '@/stores/v2/visionPresentationStore';
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockPreventRemove = jest.fn();
let mockVisionUuidSequence = 0;
const mockNavigationListeners: Record<string, (event: any) => void> = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  UNSTABLE_usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions, setParams: jest.fn(), goBack: jest.fn(), canGoBack: () => true,
    addListener: (name: string, handler: (event: any) => void) => { mockNavigationListeners[name] = handler; return () => { delete mockNavigationListeners[name]; }; } }),
  useRoute: () => ({ params: { anchorId: 'anchor-1', initialMode: 'view' } }),
}));
jest.mock('@/services/ApiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  ApiClientError: class extends Error {} }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => {
  mockVisionUuidSequence += 1;
  return `00000000-0000-4000-8000-${mockVisionUuidSequence.toString().padStart(12, '0')}`;
}) }));
const mockSecureValues = new Map<string, string>();
const mockReadSecureValue = jest.fn(async (key: string) => mockSecureValues.get(key) ?? null);
const mockWriteSecureValue = jest.fn(async (key: string, value: string) => { mockSecureValues.set(key, value); });
jest.mock('@/stores/encryptedPersistStorage', () => ({
  readSecureValue: (...args: unknown[]) => mockReadSecureValue(...args as [string]),
  writeSecureValue: (...args: unknown[]) => mockWriteSecureValue(...args as [string, string]),
  encryptedPersistStorage: {
    getItem: (...args: unknown[]) => mockReadSecureValue(...args as [string]),
    setItem: (...args: unknown[]) => mockWriteSecureValue(...args as [string, string]),
    removeItem: async (key: string) => { mockSecureValues.delete(key); },
  },
}));
jest.mock('@/stores/authStore', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ user: { id: 'vision-test-owner' } })) };
});
jest.mock('expo-image-picker', () => ({ MediaTypeOptions: { Images: 'Images' }, requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn(async () => ({ exists: true })),
  readAsStringAsync: jest.fn(async () => 'QUJD'), EncodingType: { Base64: 'base64' } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/utils/premiumAccess', () => ({ ...jest.requireActual('@/utils/premiumAccess'), isProFeatureLocked: () => false }));
jest.mock('@/hooks/useTrialStatus', () => ({ useTrialStatus: () => ({ entitlementReady: true, hasActiveEntitlement: true }) }));
jest.mock('@/hooks/v2/vision/visionPhotoFitProcessing', () => ({
  ...jest.requireActual('@/hooks/v2/vision/visionPhotoFitProcessing'),
  // RN's Image.getSize does not work under the Jest native mock; tests choose the size (null = unreadable, no fit step).
  readPhotoSize: jest.fn(async () => null),
}));
const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const stamp = '2026-10-07T00:00:00Z';
const scene = (i: number, extra = {}) => ({ id: `sc-${i}`, visionId: 'vision-101', sourceType: 'AI_GENERATED', assetId: `ast-${i}`,
  resolvedImageUrl: `https://example.com/${i}.jpg`, prompt: null, sortOrder: i - 1, isArchived: false, createdAt: stamp, updatedAt: stamp, ...extra });
const visionWith = (count: number) => ({ id: 'vision-101', anchorId: 'anchor-1', title: 'Studio', description: 'A quiet studio full of finished work.',
  status: 'ACTIVE', seenToday: false, createdAt: stamp, updatedAt: stamp, scenes: Array.from({ length: count }, (_, i) => scene(i + 1)) });
let currentVision = visionWith(3);
let currentSession: any = null;
const response = (data: any) => ({ data: { success: true, data } });
const activeSessionResponse = () => {
  return response(currentSession?.status === 'ACTIVE' ? currentSession : null);
};
const makeSession = (id: string, description: string) => ({
  id, anchorId: 'anchor-1', visionId: 'vision-101', status: 'ACTIVE', description, draftPrompt: '',
  selectedCandidateId: null, viewedRoundId: null, references: [], rounds: [], expiresAt: '2026-10-20T23:59:59Z',
});
const generationResponse = (input: any, job: any) => response({
  ...job, kind: 'SCENE', anchorId: 'anchor-1', sessionId: input.sessionId ?? currentSession?.id,
  roundNumber: 0, operation: input.operation ?? 'CREATE', parentCandidateId: input.parentCandidateId ?? null,
  description: input.sceneDescription, references: input.references ?? [],
});
const conversationRound = (id: string, roundNumber: number, parentCandidateId: string | null, candidateIds: string[]) => ({
  id, sessionId: 'saved-three-round-session', roundNumber, operation: roundNumber === 0 ? 'CREATE' : 'VARIATE', parentCandidateId,
  description: `Saved scene version ${roundNumber}`, references: [], visionId: 'vision-101', anchorId: 'anchor-1',
  setNumber: roundNumber, retryCount: 0, status: 'COMPLETE', stage: 'complete', error: null,
  candidates: candidateIds.map((candidateId, sortOrder) => ({
    id: candidateId, assetId: `asset-${candidateId}`, role: 'vision', prompt: `Prompt for ${candidateId}`, sortOrder,
    imageUrl: `file:///saved-${candidateId}.jpg`, status: 'SUCCEEDED',
  })),
});
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
// The entrance's controls go live once the open has finished; the persistent Anchor takes over a moment after that.
const ASK_READY = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 50;
// Add Image opens the compact composer sheet over the board; its actions hand off once the sheet has left.
const SHEET_HANDOFF = 450;
/** Add asks where the image goes first; "Use the next free position" is the one-tap default. */
function pressAdd(view: ReturnType<typeof render>) {
  fireEvent.press(view.getByLabelText('Add to Vision'));
  const next = view.queryByLabelText('Use the next free position');
  if (next) fireEvent.press(next);
}
async function openAsk(view: ReturnType<typeof render>) { await view.findByTestId('vision-board'); pressAdd(view); await advance(SHEET_HANDOFF); }
async function waitForGenerationReady(view: ReturnType<typeof render>) {
  await waitFor(() => expect(view.getByTestId('vision-scene-generate').props.accessibilityState?.disabled).toBe(false));
}
async function ownPhoto(view: ReturnType<typeof render>, source: 'camera' | 'library') {
  // Creating a Vision starts at the entrance's one call to action; its photo links sit in the composer. Add Image uses the sheet.
  const cta = view.queryByTestId('vision-entrance-cta');
  if (cta) {
    await act(async () => { fireEvent.press(cta); });
    await act(async () => { fireEvent.press(view.getByTestId(source === 'camera' ? 'vision-add-camera' : 'vision-add-photos')); });
  } else {
    await act(async () => { fireEvent.press(view.getByLabelText(source === 'camera' ? 'Take a photo' : 'Use my own photo')); });
  }
  await advance(SHEET_HANDOFF);
  view.getAllByTestId(/^vision-ceremony-print-\d+-sharp$/).forEach(image => fireEvent(image, 'load'));
  await advance(0); await advance(1000); await advance(4400);
}
/** Confirming personal photos saves once and begins the brief seal directly. */
async function seal(view: ReturnType<typeof render>, _hold = 1600) {
  fireEvent.press(view.getByTestId('vision-complete-vision'));
  await advance(200);
}
describe('V2VisionScreen ceremony additions', () => {
  beforeEach(() => {
    // The arrangement is remembered per Vision on the device; every test starts from a board nobody has arranged.
    useVisionPresentationStore.setState({ byVision: {} });
    jest.useFakeTimers(); jest.clearAllMocks(); mockVisionUuidSequence = 0; mockSecureValues.clear(); currentSession = null; resetV2VisionReadCache(); currentVision = visionWith(3);
    mockReadSecureValue.mockImplementation(async key => mockSecureValues.get(key) ?? null);
    mockWriteSecureValue.mockImplementation(async (key, value) => { mockSecureValues.set(key, value); });
    useAuthStore.setState({ user: { id: 'vision-test-owner' } as never });
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(cb => {
      (cb as (x: number, y: number, width: number, height: number) => void)(10, 20, 150, 180);
    });
    useAnchorStore.setState({ anchors: [{ id: 'anchor-1', userId: 'vision-test-owner', intentionText: 'I build what matters.', intention: 'I build what matters.', category: 'career',
      baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>', status: 'ACTIVE', createdAt: stamp } as never] });
    (apiClient.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith('/creation-sessions')) return activeSessionResponse();
      if (/\/vision(\?|$)/.test(url)) return { data: currentVision };
      throw Object.assign(new Error('Not found'), { status: 404 });
    });
    (apiClient.patch as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url.includes('/creation-sessions/') && currentSession) {
        currentSession = { ...currentSession, ...input };
        return response(currentSession);
      }
      return response(null);
    });
    const granted = { status: 'granted', canAskAgain: true } as never;
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted); picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] } as never);
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url.endsWith('/creation-sessions')) { currentSession = makeSession(input.id ?? 'created-session', input.description); return response(currentSession); }
      if (url === '/api/v2/assets/upload') return { data: { id: 'own-asset', resolvedUrl: 'https://example.com/own.jpg', mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: stamp } };
      const added = scene(4, { ...input, resolvedImageUrl: 'https://example.com/own.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
      return { data: added };
    });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
  it('Add image opens the compact composer over the live board and launches nothing', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    expect(view.getByText('What Else Do You See?')).toBeTruthy(); expect(view.getByTestId('vision-board')).toBeTruthy();
    expect(view.getByTestId('vision-scene-input')).toBeTruthy(); expect(view.getByTestId('vision-scene-generate')).toBeTruthy();
    expect(view.queryByTestId('vision-add-sheet-generate')).toBeNull();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled(); expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });
  it('board Add resumes the active three-round session and keeps the exact earlier candidate asset', async () => {
    currentSession = {
      ...makeSession('saved-three-round-session', 'An evening room with warm lamps'),
      visionId: 'vision-101',
      selectedCandidateId: 'version-1-option-2',
      viewedRoundId: 'round-version-2',
      rounds: [
        conversationRound('round-original', 0, null, ['original-option-1', 'original-option-2']),
        conversationRound('round-version-1', 1, 'original-option-2', ['version-1-option-1', 'version-1-option-2']),
        conversationRound('round-version-2', 2, 'version-1-option-1', ['version-2-option-1', 'version-2-option-2']),
      ],
    };
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    pressAdd(view);

    await view.findByTestId('vision-resume-card');
    expect(view.getByText('Original · Version 1 · Version 2 saved')).toBeTruthy();
    expect(view.getByTestId('vision-resume-card-selected-image').props.source).toEqual({ uri: 'file:///saved-version-1-option-2.jpg' });

    fireEvent.press(view.getByTestId('vision-resume-card-keep'));
    await waitFor(() => expect(view.getByTestId('vision-ceremony-print-1-sharp').props.source).toEqual({ uri: 'file:///saved-version-1-option-2.jpg' }));
    fireEvent.press(view.getByTestId('vision-ceremony-keep'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', expect.objectContaining({
      assetId: 'asset-version-1-option-2', sourceType: 'AI_GENERATED', prompt: 'Prompt for version-1-option-2',
    })));
    expect((apiClient.post as jest.Mock).mock.calls.some(([url]) => url.endsWith('/creation-sessions'))).toBe(false);
    expect((apiClient.post as jest.Mock).mock.calls.some(([url]) => url.endsWith('/scene-generation'))).toBe(false);
  });
  it('persists text changes from the Add sheet callback and restores them after remount', async () => {
    const first = render(<V2VisionScreen anchorId="anchor-1" />);
    await openAsk(first);
    fireEvent.changeText(first.getByTestId('vision-scene-input'), 'A sunlit reading nook beside the window.');
    await advance(450);
    const draftKey = 'vision-conversation.vision-test-owner.anchor-1';
    await waitFor(() => expect(JSON.parse(mockSecureValues.get(draftKey) ?? '{}').description).toBe('A sunlit reading nook beside the window.'));
    expect(JSON.parse(mockSecureValues.get(draftKey)!).id).toMatch(/^[0-9a-f-]{36}$/i);
    first.unmount();

    const resumed = render(<V2VisionScreen anchorId="anchor-1" />);
    await openAsk(resumed);
    await waitFor(() => expect(resumed.getByTestId('vision-scene-input').props.value).toBe('A sunlit reading nook beside the window.'));
  });
  it('opens the note composer from the Add Image sheet with the current Vision context', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    fireEvent.press(view.getByLabelText('Add a note')); await advance(SHEET_HANDOFF);
    expect(mockNavigate).toHaveBeenCalledWith('V2VisionNoteComposer', { anchorId: 'anchor-1', visionId: 'vision-101' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled(); expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  it('keeps note entry available at the image limit and blocks image additions there', async () => {
    currentVision = visionWith(8);
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    expect(view.getByLabelText('Add a note')).toBeTruthy();
    expect(view.getByTestId('vision-add-scene-full')).toBeTruthy();
    expect(view.queryByTestId('vision-scene-generate')).toBeNull(); expect(view.queryByLabelText('Use my own photo')).toBeNull();
    fireEvent.press(view.getByLabelText('Add a note')); await advance(SHEET_HANDOFF);
    expect(mockNavigate).toHaveBeenCalledWith('V2VisionNoteComposer', { anchorId: 'anchor-1', visionId: 'vision-101' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it.each(['camera', 'library'] as const)('%s photos upload during Keep and persist the scene and caption only at Seal', async source => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, source);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/assets/upload', expect.anything());
    expect((apiClient.post as jest.Mock).mock.calls.some(([url]) => url.endsWith('/scenes'))).toBe(false);
    fireEvent.changeText(view.getByTestId('vision-ceremony-print-0-caption'), 'Finished work in my studio.'); await seal(view, 900);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', expect.objectContaining({
      assetId: 'own-asset', sourceType: source === 'camera' ? 'USER_CAMERA' : 'USER_UPLOAD', caption: 'Finished work in my studio.' }));
    await advance(3200); await advance(1200); await advance(200); await advance(600);
    expect(view.getByTestId('vision-just-added')).toBeTruthy(); expect(view.getByTestId('vision-board-photo-sc-4')).toBeTruthy();
  });
  it.each(['add', 'regenerate'] as const)('drops the arrival pin on the saved scene id after %s even when the read model re-signs its URL', async kind => {
    // Every read re-signs URLs: regenerate's archive re-read leaves the save response's URL matching no tile.
    let reads = 0;
    (apiClient.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith('/creation-sessions')) return activeSessionResponse();
      if (!/\/vision(\?|$)/.test(url)) throw Object.assign(new Error('Not found'), { status: 404 });
      reads += 1;
      return { data: { ...currentVision, scenes: currentVision.scenes.map(item => ({ ...item, resolvedImageUrl: `${item.resolvedImageUrl}?sig=${reads}` })) } };
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    if (kind === 'add') { await openAsk(view); await ownPhoto(view, 'library'); await seal(view, 900); }
    else {
      const generated = { id: 'generation', visionId: 'vision-101', status: 'COMPLETE', retryCount: 0,
        candidates: [0, 1].map(i => ({ id: `candidate-${i}`, assetId: `generated-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: 'A new studio.', sortOrder: i })) };
      (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
        if (url.endsWith('/creation-sessions')) { currentSession = makeSession(input.id ?? 'created-session', input.description); return response(currentSession); }
        if (url.endsWith('/scene-generation')) return generationResponse(input, generated);
        const added = scene(4, { ...input, resolvedImageUrl: 'https://example.com/generated.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
        return { data: added };
      });
      (apiClient.delete as jest.Mock).mockImplementation(async () => {
        currentVision = { ...currentVision, scenes: currentVision.scenes.filter(item => item.id !== 'sc-1') }; return { data: { success: true } };
      });
      const first = await view.findByLabelText('Vision image in position 1 of 8'); fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      fireEvent.press(view.getByLabelText('Regenerate')); fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A new studio.');
      await waitForGenerationReady(view);
      await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
      fireEvent(await view.findByTestId('vision-ceremony-print-0-sharp'), 'load'); await advance(0); await advance(2800); await advance(3600);
      fireEvent.press(view.getByTestId('scene-candidate-candidate-0')); fireEvent.press(view.getByTestId('vision-complete-vision'));
      await advance(200);
    }
    await advance(3200); await advance(1200); await advance(200); await advance(600);
    expect(view.getByTestId('vision-board-photo-sc-4-arrival-pin')).toBeTruthy();
    expect(view.queryByTestId('vision-board-photo-sc-2-arrival-pin')).toBeNull();
  });
  it('Back from a generating request returns to the board with the sheet refilled, never the entrance', async () => {
    const generated = { id: 'generation', visionId: 'vision-101', status: 'COMPLETE', retryCount: 0,
      candidates: [0, 1].map(i => ({ id: `candidate-${i}`, assetId: `generated-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: 'The backyard at night.', sortOrder: i })) };
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url.endsWith('/creation-sessions')) { currentSession = makeSession(input.id ?? 'created-session', input.description); return response(currentSession); }
      if (url.endsWith('/scene-generation')) return generationResponse(input, generated);
      throw new Error('unexpected');
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    fireEvent.changeText(view.getByTestId('vision-scene-input'), 'The backyard at night with a fire pit');
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    await advance(300);
    fireEvent.press(view.getByLabelText('Back')); await advance(SHEET_HANDOFF);
    await view.findByTestId('vision-board');
    await view.findByTestId('vision-scene-input');
    expect(view.queryByLabelText('Create My Vision →')).toBeNull();
    expect(view.getByTestId('vision-scene-input').props.value).toBe('The backyard at night with a fire pit');
    const generationCall = (apiClient.post as jest.Mock).mock.calls.find(([url]) => url.endsWith('/scene-generation'));
    expect(generationCall).toBeDefined();
    expect(generationCall?.[1]).toMatchObject({
      sceneDescription: 'The backyard at night with a fire pit',
      operation: 'CREATE',
      sessionId: currentSession.id,
      references: [],
    });
    expect(generationCall?.[1].idempotencyKey).toEqual(expect.any(String));
  });
  it('canceling before Seal saves no image', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, 'library');
    fireEvent.press(view.getByLabelText('Back')); await view.findByTestId('vision-board');
    expect((apiClient.post as jest.Mock).mock.calls.some(([url]) => url.endsWith('/scenes'))).toBe(false);
  });
  it('protects in-flight sealing from route removal and restores navigation on the completed board', async () => {
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await openAsk(view); await ownPhoto(view, 'library');
    const preventDefault = jest.fn();
    act(() => {
      fireEvent.press(view.getByTestId('vision-complete-vision'));
      mockNavigationListeners.beforeRemove({ preventDefault });
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
    await advance(200); await advance(3500); await advance(1200); await advance(200);
    expect(view.getByTestId('vision-board')).toBeTruthy();
    preventDefault.mockClear();
    act(() => mockNavigationListeners.beforeRemove({ preventDefault }));
    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
  });
  it('a permanent camera refusal explains permission and leaves Ask usable', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view);
    await act(async () => { fireEvent.press(view.getByLabelText('Take a photo')); }); await advance(SHEET_HANDOFF);
    expect(alert).toHaveBeenCalledWith('Permission needed', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
    expect(picker.launchCameraAsync).not.toHaveBeenCalled(); expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  it('keeps Add available at the eight-image limit for note entry', async () => {
    currentVision = visionWith(8); const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByTestId('vision-board');
    expect(view.getByLabelText('Add to Vision')).toBeTruthy();
  });
  it('one-image boards retain room to add', async () => {
    currentVision = visionWith(1); const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByTestId('vision-board');
    expect(view.getByLabelText('Add to Vision')).toBeTruthy();
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
    const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, 'library'); await seal(view, 900);
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
    expect(view.getByTestId('vision-seal-stamp-line')).toBeTruthy(); expect(view.queryByTestId('vision-board')).toBeNull();
    await advance(1050); expect(view.getByText('Sealed.')).toBeTruthy();
    await advance(3500); await advance(1200); await advance(200); expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  it.each([7, 8])('persists all %i selected personal photos in picker order with their source metadata', async count => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: Array.from({ length: count }, (_, i) => ({
      uri: `file:///personal-${i}.jpg`, mimeType: 'image/jpeg',
    })) } as never);
    let uploadIndex = 0;
    let savedScenes: any[] | undefined;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url === '/api/v2/assets/upload') {
        const i = uploadIndex++;
        return { data: { id: `personal-asset-${i}`, resolvedUrl: `https://example.com/personal-${i}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: stamp } };
      }
      if (url === '/api/v2/anchors/anchor-1/vision') {
        savedScenes = input.scenes;
        return { data: { ...visionWith(0), description: input.description,
          scenes: input.scenes.map((item: any, i: number) => scene(i + 1, { ...item, resolvedImageUrl: `https://example.com/personal-${i}.jpg` })) } };
      }
      throw new Error(`Unexpected Vision request: ${url}`);
    });

    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByText("When it's true, what do you see?"); await advance(ASK_READY);
    await ownPhoto(view, 'library');
    for (let i = 1; i < count; i++) fireEvent(view.getByTestId('vision-photo-stack-hit-target'), 'accessibilityTap');
    expect(view.getByTestId(`vision-photo-stack-dot-${count - 1}`).props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(view.getByTestId(`vision-ceremony-print-${count - 1}-caption`), 'The final photo is mine.');
    fireEvent.press(view.getByTestId('vision-complete-vision'));
    await advance(200);

    expect(savedScenes).toEqual(Array.from({ length: count }, (_, i) => ({
      assetId: `personal-asset-${i}`, prompt: '', sourceType: 'USER_UPLOAD',
      caption: i === count - 1 ? 'The final photo is mine.' : 'I build what matters.',
    })));
    expect(uploadIndex).toBe(count);
    await advance(3500); await advance(1200); await advance(200);
    expect(view.getByTestId('vision-board')).toBeTruthy();
    expect(view.getByTestId(`vision-board-photo-sc-${count}`)).toBeTruthy();
    expect(view.getByTestId(`vision-board-photo-sc-${count}-arrival-pin`)).toBeTruthy();
  });
  it.each([8, 3])('sealed regeneration on a %i-image board resumes unfinished mutations', async count => {
    currentVision = visionWith(count);
    const generated = { id: 'generation', visionId: 'vision-101', status: 'COMPLETE', retryCount: 0,
      candidates: [0, 1].map(i => ({ id: `candidate-${i}`, assetId: `generated-${i}`, imageUrl: `file:///generated-${i}.jpg`, prompt: 'A new studio.', sortOrder: i })) };
    let addFailed = false, deleteFailed = false;
    (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
      if (url.endsWith('/creation-sessions')) { currentSession = makeSession(input.id ?? 'created-session', input.description); return response(currentSession); }
      if (url.endsWith('/scene-generation')) return generationResponse(input, generated);
      if (count === 8 && !addFailed) { addFailed = true; throw new Error('Add unavailable'); }
      const added = scene(9, { ...input, resolvedImageUrl: 'file:///generated-0.jpg' }); currentVision = { ...currentVision, scenes: [...currentVision.scenes, added] };
      return { data: added };
    });
    (apiClient.delete as jest.Mock).mockImplementation(async () => {
      if (count === 3 && !deleteFailed) { deleteFailed = true; throw new Error('Remove unavailable'); }
      currentVision = { ...currentVision, scenes: currentVision.scenes.filter(item => item.id !== 'sc-1') }; return { data: { success: true } };
    });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const first = await view.findByLabelText('Vision image in position 1 of 8'); fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    fireEvent.press(view.getByLabelText('Regenerate')); fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A new studio.');
    await waitForGenerationReady(view);
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    fireEvent(await view.findByTestId('vision-ceremony-print-0-sharp'), 'load'); await advance(0); await advance(2800); await advance(3600);
    fireEvent.press(view.getByTestId('scene-candidate-candidate-0')); fireEvent.press(view.getByTestId('vision-complete-vision'));
    await advance(200);
    expect(view.getByTestId('vision-ceremony-save-retry')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-ceremony-save-retry')); }); await advance(200);
    expect((apiClient.post as jest.Mock).mock.calls.filter(([url]) => url.endsWith('/scenes'))).toHaveLength(count === 8 ? 2 : 1);
    expect(apiClient.delete).toHaveBeenCalledTimes(count === 8 ? 1 : 2);
    expect(currentVision.scenes.filter(item => item.assetId === 'generated-0')).toHaveLength(1);
    expect(currentVision.scenes.find(item => item.assetId === 'generated-0')?.sortOrder).toBe(0);
    await advance(3500); await advance(1200); await advance(200); expect(view.getByTestId('vision-board')).toBeTruthy();
  });
  describe('the first image remains on its completed board', () => {
    const goHome = () => mockNavigate.mock.calls.filter(([name]) => name === 'V2DevelopmentHome');
    /** A first own-photo Vision, sealed and pinned: the board shows the print with "Sit with it now". */
    async function firstImageOnBoard() {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
      const post = (apiClient.post as jest.Mock).getMockImplementation()!;
      (apiClient.post as jest.Mock).mockImplementation(async (url: string, input: any) => {
        if (url === '/api/v2/anchors/anchor-1/vision') return { data: { ...visionWith(0), description: input.description,
          scenes: input.scenes.map((item: any, i: number) => scene(i + 1, { ...item, resolvedImageUrl: 'https://example.com/own.jpg' })) } };
        return post(url, input);
      });
      const view = render(<V2VisionScreen anchorId="anchor-1" />); await view.findByText("When it's true, what do you see?"); await advance(ASK_READY);
      await ownPhoto(view, 'library'); await seal(view);
      // Step to the moment the board shows the pinned print: the sit beat is timed from there.
      for (let waited = 0; waited < 12000 && !view.queryByTestId('vision-board'); waited += 50) await advance(50);
      expect(view.getByTestId('vision-board')).toBeTruthy(); expect(view.getByTestId('vision-just-added')).toBeTruthy();
      return view;
    }
    it('stays on the completed board after the pinned board has been sat with', async () => {
      const view = await firstImageOnBoard();
      expect(goHome()).toHaveLength(0);
      await advance(20000);
      expect(view.getByTestId('vision-board')).toBeTruthy();
      expect(goHome()).toHaveLength(0);
      view.unmount();
    });
    it('does not automatically navigate after Reduce Motion sealing either', async () => {
      useSettingsStore.setState({ reduceMotion: 'on' });
      try {
        const view = await firstImageOnBoard();
        await advance(20000);
        expect(view.getByTestId('vision-board')).toBeTruthy();
        expect(goHome()).toHaveLength(0);
        view.unmount();
      } finally { useSettingsStore.setState({ reduceMotion: 'off' }); }
    });
    it('does not go Home if the person leaves the screen first', async () => {
      const view = await firstImageOnBoard();
      await advance(1000); view.unmount();
      await advance(10000); expect(goHome()).toHaveLength(0);
    });
    it('does not go Home when the person starts adding an image first', async () => {
      const view = await firstImageOnBoard();
      await advance(1000);
      pressAdd(view);
      await advance(10000); expect(goHome()).toHaveLength(0);
    });
    it('a later image never navigates', async () => {
      const view = render(<V2VisionScreen anchorId="anchor-1" />); await openAsk(view); await ownPhoto(view, 'library'); await seal(view, 900);
      await advance(3500); await advance(1200); await advance(200); await advance(600);
      expect(view.getByTestId('vision-just-added')).toBeTruthy();
      await advance(20000); expect(goHome()).toHaveLength(0);
    });
  });
});
