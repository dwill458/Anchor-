
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
  useRoute: () => ({ params: { anchorId: 'anchor-1', initialMode: 'view' } }),
}));
jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, code?: string, status?: number) { super(message); this.status = status; this.code = code; }
  },
}));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  readAsStringAsync: jest.fn(async () => 'QUJD'),
  EncodingType: { Base64: 'base64' },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const granted = { status: 'granted', canAskAgain: true } as never;
const stamp = '2026-09-01T00:00:00Z';

const scene = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `sc-${index}`, visionId: 'vision-101', sourceType: 'AI_GENERATED', assetId: `ast-${index}`,
  resolvedImageUrl: `https://example.com/art${index}.jpg`, prompt: `Scene ${index}`, sortOrder: index - 1,
  isArchived: false, createdAt: stamp, updatedAt: stamp, ...overrides,
});
const visionWith = (count: number, extra: Record<string, unknown> = {}) => ({
  id: 'vision-101', anchorId: 'anchor-1', title: 'Future Studio',
  description: 'A quiet, sunlit workspace with completed projects.', status: 'ACTIVE', seenToday: false,
  createdAt: stamp, updatedAt: stamp, scenes: Array.from({ length: count }, (_, i) => scene(i + 1)), ...extra,
});

const anchor = {
  id: 'anchor-1', intention: 'I build what matters.', intentionText: 'I build what matters.', category: 'career',
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>', status: 'ACTIVE', createdAt: stamp,
};

/** Routes GETs by URL: the Vision read, plus whatever generation job the case needs. */
function serve(vision: unknown, extra: Record<string, unknown> = {}) {
  (apiClient.get as jest.Mock).mockImplementation(async (url: string) => {
    for (const [fragment, data] of Object.entries(extra)) if (url.includes(fragment)) return { data: { success: true, data } };
    if (/\/vision(\?|$)/.test(url)) return { data: { success: true, data: vision } };
    throw Object.assign(new Error('not found'), { status: 404 });
  });
}

async function openSheet(view: ReturnType<typeof render>) {
  await view.findByTestId('vision-board');
  fireEvent.press(view.getByLabelText(/^Add an image/));
  return view.findByTestId('vision-add-sheet-generate');
}

describe('V2VisionScreen: adding to the board', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetV2VisionReadCache();
    useAnchorStore.setState({ anchors: [anchor as never] });
  });

  it('opens a sheet with three ways to add, and launches nothing yet', async () => {
    serve(visionWith(3));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await openSheet(view);
    expect(view.getByText('Add to your Vision')).toBeTruthy();
    expect(view.getByLabelText('Create an image')).toBeTruthy();
    expect(view.getByLabelText('Choose from Photos')).toBeTruthy();
    expect(view.getByLabelText('Take Photo')).toBeTruthy();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('takes a photo, previews it, and saves nothing until it is confirmed', async () => {
    jest.useFakeTimers();
    try {
      serve(visionWith(3));
      picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
      picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg', mimeType: 'image/jpeg' }] } as never);
      (apiClient.post as jest.Mock).mockImplementation(async (url: string) => {
        if (url === '/api/v2/assets/upload') return { data: { success: true, data: { id: 'asset-cam', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: stamp } } };
        return { data: { success: true, data: scene(4, { assetId: 'asset-cam', sourceType: 'USER_CAMERA' }) } };
      });
      const view = render(<V2VisionScreen anchorId="anchor-1" />);
      await openSheet(view);
      fireEvent.press(view.getByLabelText('Take Photo'));
      await act(async () => { jest.advanceTimersByTime(600); });
      const preview = await view.findByTestId('v2-vision-add-photo');
      expect(preview).toBeTruthy();
      expect(view.getByTestId('v2-vision-add-photo-image').props.source).toEqual({ uri: 'file:///cam.jpg' });
      expect(apiClient.post).not.toHaveBeenCalled();

      await act(async () => { fireEvent.press(view.getByLabelText('Use This Image')); });
      await waitFor(() => expect(view.queryByTestId('v2-vision-add-photo')).toBeNull());
      expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/api/v2/assets/upload');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', { assetId: 'asset-cam', sourceType: 'USER_CAMERA' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('adds nothing when the preview is cancelled', async () => {
    jest.useFakeTimers();
    try {
      serve(visionWith(3));
      picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.jpg', mimeType: 'image/jpeg' }] } as never);
      const view = render(<V2VisionScreen anchorId="anchor-1" />);
      await openSheet(view);
      fireEvent.press(view.getByLabelText('Choose from Photos'));
      await act(async () => { jest.advanceTimersByTime(600); });
      await view.findByTestId('v2-vision-add-photo');
      fireEvent.press(view.getByLabelText('Cancel'));
      await view.findByTestId('vision-board');
      expect(apiClient.post).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('records a library photo as an upload', async () => {
    jest.useFakeTimers();
    try {
      serve(visionWith(3));
      picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pic.jpg', mimeType: 'image/jpeg' }] } as never);
      (apiClient.post as jest.Mock).mockImplementation(async (url: string) => (url === '/api/v2/assets/upload'
        ? { data: { success: true, data: { id: 'asset-lib', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: stamp } } }
        : { data: { success: true, data: scene(4, { assetId: 'asset-lib', sourceType: 'USER_UPLOAD' }) } }));
      const view = render(<V2VisionScreen anchorId="anchor-1" />);
      await openSheet(view);
      fireEvent.press(view.getByLabelText('Choose from Photos'));
      await act(async () => { jest.advanceTimersByTime(600); });
      await view.findByTestId('v2-vision-add-photo');
      await act(async () => { fireEvent.press(view.getByLabelText('Use This Image')); });
      await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', { assetId: 'asset-lib', sourceType: 'USER_UPLOAD' }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('explains a refused camera permission and stays on the board', async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      serve(visionWith(3));
      picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
      const view = render(<V2VisionScreen anchorId="anchor-1" />);
      await openSheet(view);
      fireEvent.press(view.getByLabelText('Take Photo'));
      await act(async () => { jest.advanceTimersByTime(600); });
      await waitFor(() => expect(view.getByText('Allow camera access to take a photo for your Vision.')).toBeTruthy());
      expect(alert).toHaveBeenCalledWith('Permission needed', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
      expect(picker.launchCameraAsync).not.toHaveBeenCalled();
      expect(view.getByTestId('vision-board')).toBeTruthy();
    } finally {
      alert.mockRestore();
      jest.useRealTimers();
    }
  });

  it('generates a described scene, offers two candidates, and adds the chosen one', async () => {
    jest.useFakeTimers();
    try {
      serve(visionWith(3));
      const running = { id: 'scene-job-1', kind: 'SCENE', visionId: 'vision-101', anchorId: 'anchor-1', setNumber: 1, retryCount: 0, status: 'RUNNING', stage: 'creating_images', error: null, candidates: [] };
      const complete = {
        ...running, status: 'COMPLETE', stage: 'complete',
        candidates: [
          { id: 'cand-1', assetId: 'gen-1', role: 'The moment itself', prompt: 'Working from a beach house', sortOrder: 0, imageUrl: 'https://example.com/gen1.jpg', status: 'SUCCEEDED' },
          { id: 'cand-2', assetId: 'gen-2', role: 'The place around it', prompt: 'Working from a beach house', sortOrder: 1, imageUrl: 'https://example.com/gen2.jpg', status: 'SUCCEEDED' },
        ],
      };
      serve(visionWith(3), { '/scene-generation/scene-job-1': complete });
      (apiClient.post as jest.Mock).mockImplementation(async (url: string) => {
        if (url.endsWith('/vision/scene-generation')) return { data: { success: true, data: running } };
        return { data: { success: true, data: scene(4, { assetId: 'gen-2', sourceType: 'AI_GENERATED', prompt: 'Working from a beach house' }) } };
      });

      const view = render(<V2VisionScreen anchorId="anchor-1" />);
      await openSheet(view);
      fireEvent.press(view.getByLabelText('Create an image'));
      await act(async () => { jest.advanceTimersByTime(600); });

      await view.findByText('What else do you see?');
      expect(view.getByText('ADD TO YOUR VISION')).toBeTruthy();
      fireEvent.press(view.getByTestId('vision-path-words'));
      const generate = view.getByLabelText('Generate image');
      expect(generate.props.accessibilityState?.disabled).toBe(true);
      fireEvent.changeText(view.getByTestId('vision-scene-input'), 'Working from a beach house');
      await act(async () => { fireEvent.press(view.getByLabelText('Generate image')); });

      expect((apiClient.post as jest.Mock).mock.calls[0][0]).toBe('/api/v2/anchors/anchor-1/vision/scene-generation');
      expect((apiClient.post as jest.Mock).mock.calls[0][1]).toEqual(expect.objectContaining({ sceneDescription: 'Working from a beach house' }));
      expect(view.getByTestId('v2-vision-add-scene-generating')).toBeTruthy();

      // Polling delivers both images; they are the choice, with no button to confirm it.
      for (let i = 0; i < 4; i += 1) await act(async () => { jest.advanceTimersByTime(1000); });
      await view.findByText('Your future\nis ready to choose from.');
      expect(view.getByTestId('scene-candidate-cand-1')).toBeTruthy();
      expect(view.getByTestId('scene-candidate-cand-2')).toBeTruthy();
      expect(view.queryByLabelText('Use This Image')).toBeNull();
      expect(view.queryByLabelText('Generate More')).toBeNull();

      await act(async () => { fireEvent.press(view.getByTestId('scene-candidate-cand-2')); });
      await act(async () => { fireEvent.press(view.getByLabelText('Use this one')); });
      await act(async () => { jest.advanceTimersByTime(800); });
      await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes', {
        assetId: 'gen-2', prompt: 'Working from a beach house', sourceType: 'AI_GENERATED',
      }));
      // The numbered image sets are never touched by adding a scene.
      expect((apiClient.post as jest.Mock).mock.calls.some(([url]) => String(url).endsWith('/vision/generation'))).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows one image on the board with room to add', async () => {
    serve(visionWith(1));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    expect(view.getByTestId('vision-board-photo-sc-1')).toBeTruthy();
    expect(view.getByLabelText('Add an image, 1 of 6')).toBeTruthy();
  });

  it('offers no way to add once the board holds six images', async () => {
    serve(visionWith(6));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    for (let i = 1; i <= 3; i += 1) expect(view.getByTestId(`vision-board-photo-sc-${i}`)).toBeTruthy();
    expect(view.queryByLabelText(/^Add an image/)).toBeNull();
  });

  it('keeps added images after leaving and reopening the Vision', async () => {
    serve(visionWith(4));
    const first = render(<V2VisionScreen anchorId="anchor-1" />);
    await first.findByTestId('vision-board-photo-sc-3');
    fireEvent.press(first.getByLabelText('Vision options'));
    fireEvent.press(first.getByText('Manage images (4)'));
    expect(first.getByLabelText('Manage image 4')).toBeTruthy();
    first.unmount();
    // The reopened screen paints the cached board at once, before any request settles.
    const second = render(<V2VisionScreen anchorId="anchor-1" />);
    fireEvent.press(second.getByLabelText('Vision options'));
    fireEvent.press(second.getByText('Manage images (4)'));
    expect(second.getByLabelText('Manage image 4')).toBeTruthy();
    expect(second.getByLabelText('Add an image, 4 of 6')).toBeTruthy();
  });
});
