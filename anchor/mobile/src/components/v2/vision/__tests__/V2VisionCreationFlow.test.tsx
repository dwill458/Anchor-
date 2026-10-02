import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { V2VisionCreationFlow } from '../V2VisionCreationFlow';
import type { UploadAssetResult } from '@/hooks/v2/vision';

const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestPermission = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockUseScene = jest.fn();
const mockUseAppearance = jest.fn(() => ({
  profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false,
  upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => mockRequestPermission(),
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
}));
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => mockUseScene(),
  useVisionAppearanceReference: () => mockUseAppearance(),
}));

const candidates = Array.from({ length: 2 }, (_, index) => ({
  id: `candidate-${index}`,
  assetId: `real-asset-${index}`,
  role: `Scene ${index}`,
  prompt: `A meaningful moment ${index}`,
  sortOrder: index,
  imageUrl: `https://cdn.example.com/${index}.jpg`,
}));

const job = (status: string, list = candidates) => ({ id: 'job-1', kind: 'SCENE', status, stage: 'creating_images', setNumber: 1, retryCount: 0, error: null, candidates: list });

const baseProps = {
  anchorId: 'anchor-1',
  anchorIntention: 'I build what matters.',
  anchorCategory: 'career',
  onBack: jest.fn(),
};

type Overrides = {
  initialStep?: 'empty' | 'prompt';
  job?: any;
  start?: jest.Mock;
  retry?: jest.Mock;
  onSaveDescription?: (description: string) => Promise<boolean>;
  onUploadAsset?: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  onAssemble?: (input: any) => Promise<boolean | void>;
  resumeGeneration?: boolean;
  onResumeGenerationConsumed?: () => void;
};

function renderFlow(overrides: Overrides = {}) {
  const start = overrides.start ?? jest.fn(async () => true);
  const retry = overrides.retry ?? jest.fn(async () => true);
  mockUseScene.mockReturnValue({ job: overrides.job ?? null, error: null, start, retry, refresh: jest.fn() });
  const onUploadAsset = overrides.onUploadAsset ?? jest.fn(async () => ({
    ok: true,
    asset: { id: 'personal-asset', resolvedUrl: 'https://cdn.example.com/personal.jpg', mimeType: 'image/jpeg', fileSizeBytes: 100, createdAt: 'now' },
  } as UploadAssetResult));
  const onAssemble = overrides.onAssemble ?? jest.fn(async () => true);
  const utils = render(
    <V2VisionCreationFlow {...baseProps} initialStep={overrides.initialStep ?? 'prompt'} initialDescription="A studio full of finished work."
      onSaveDescription={overrides.onSaveDescription} resumeGeneration={overrides.resumeGeneration}
      onResumeGenerationConsumed={overrides.onResumeGenerationConsumed}
      onUploadAsset={onUploadAsset} onAssemble={onAssemble} />,
  );
  return { ...utils, onUploadAsset, onAssemble, start, retry };
}

/** Generates from the description screen, landing on the two-moments stage. */
async function reachTwoUp(utils: ReturnType<typeof renderFlow>) {
  await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
  await waitFor(() => expect(utils.getByTestId('v2-vision-creation-flow-generating')).toBeTruthy());
}

describe('V2VisionCreationFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });

  describe('intro and method', () => {
    it('uses the ink pill for Create my Vision on the intro', () => {
      const { getByLabelText } = renderFlow({ initialStep: 'empty' });
      const flat = require('react-native').StyleSheet.flatten(getByLabelText('Create my Vision').props.style);
      expect(flat.backgroundColor).toBe('#0E151C');
    });

    it('shows the intention on the intro and no "Use my photos" choice there', () => {
      const view = renderFlow({ initialStep: 'empty' });
      expect(view.getByText('See where this is going.')).toBeTruthy();
      expect(view.getByText('Turn your intention into something you can see.')).toBeTruthy();
      expect(view.getByText('I build what matters.')).toBeTruthy();
      expect(view.queryByText('Use my photos')).toBeNull();
    });

    it('walks intro, then the creation method, then the generated description', () => {
      const { getByLabelText, getByTestId, getByText } = renderFlow({ initialStep: 'empty' });
      fireEvent.press(getByLabelText('Create my Vision'));
      expect(getByTestId('v2-vision-creation-flow-method')).toBeTruthy();
      expect(getByText('How do you want to see it?')).toBeTruthy();
      expect(getByText('You can mix generated and personal images later.')).toBeTruthy();
      fireEvent.press(getByTestId('vision-method-generate'));
      expect(getByTestId('v2-vision-creation-flow-prompt')).toBeTruthy();
      expect(getByTestId('vision-generate')).toBeTruthy();
    });

    it('goes back from the description to the method, and from the method to the intro', () => {
      const { getByLabelText, getByTestId, queryByTestId } = renderFlow({ initialStep: 'empty' });
      fireEvent.press(getByLabelText('Create my Vision'));
      fireEvent.press(getByTestId('vision-method-generate'));
      fireEvent.press(getByLabelText('Go back'));
      expect(queryByTestId('v2-vision-creation-flow-method')).toBeTruthy();
      fireEvent.press(getByLabelText('Go back'));
      expect(queryByTestId('v2-vision-creation-flow-empty')).toBeTruthy();
    });
  });

  describe('description', () => {
    it('keeps generation on the description screen', () => {
      const { getByTestId, getByText } = renderFlow();
      expect(getByText('What do you see?')).toBeTruthy();
      expect(getByTestId('vision-generate')).toBeTruthy();
    });

    it('teaches detail without blocking a short description', () => {
      const { getByTestId } = renderFlow();
      const input = getByTestId('vision-prompt-input');
      fireEvent.changeText(input, 'I open my laptop and see ten thousand active users for my app today.');
      expect(getByTestId('vision-detail-hint').props.children).toBe('14 words · Add a little more detail for stronger images');
      expect(getByTestId('vision-generate').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
      fireEvent.changeText(input, Array.from({ length: 60 }, (_, index) => `word${index}`).join(' '));
      expect(getByTestId('vision-detail-hint').props.children).toBe('60 words · Great detail');
    });

    it('keeps Create available above the keyboard while the multiline description is focused', () => {
      const { getByTestId, queryByTestId } = renderFlow();
      const input = getByTestId('vision-prompt-input');
      fireEvent.changeText(input, 'My RevenueCat dashboard shows 10 thousand active users for Anchor, and I work from the beach with my family.');
      fireEvent(input, 'focus');
      expect(getByTestId('vision-generate-focused')).toBeTruthy();
      expect(queryByTestId('vision-generate')).toBeNull();
      fireEvent(input, 'blur');
      expect(getByTestId('vision-generate')).toBeTruthy();
    });

    it('supports a long description without disabling Create', () => {
      const { getByTestId } = renderFlow();
      fireEvent.changeText(getByTestId('vision-prompt-input'), 'A'.repeat(1900));
      expect(getByTestId('vision-generate').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
    });

    it('uses the Anchor intention to choose its worked example', () => {
      mockUseScene.mockReturnValue({ job: null, error: null, start: jest.fn(), retry: jest.fn(), refresh: jest.fn() });
      const { getByTestId, rerender } = render(
        <V2VisionCreationFlow {...baseProps} anchorIntention="Anchor has ten thousand users" anchorCategory="desire"
          onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
      );
      expect(getByTestId('vision-prompt-input').props.placeholder).toMatch(/people who use what I built/);
      rerender(
        <V2VisionCreationFlow {...baseProps} anchorIntention="I feel at peace" anchorCategory="spirituality"
          onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
      );
      expect(getByTestId('vision-prompt-input').props.placeholder).not.toMatch(/people who use what I built/);
    });
  });

  describe('two generated moments', () => {
    it('saves the description once and starts one request however many times Create is tapped', async () => {
      let resolveSave: (value: boolean) => void = () => undefined;
      const onSaveDescription = jest.fn(() => new Promise<boolean>(resolve => { resolveSave = resolve; }));
      const utils = renderFlow({ onSaveDescription });
      fireEvent.press(utils.getByTestId('vision-generate'));
      fireEvent.press(utils.getByTestId('vision-generate'));
      fireEvent.press(utils.getByTestId('vision-generate'));
      await act(async () => { resolveSave(true); });
      expect(onSaveDescription).toHaveBeenCalledTimes(1);
      expect(utils.start).toHaveBeenCalledTimes(1);
    });

    it('passes the identity reference to the request', async () => {
      mockUseAppearance.mockReturnValue({
        profilePhoto: 'https://example.com/avatar.jpg', enabledByPreference: true,
        reference: { id: 'ref-123', previewUrl: 'https://example.com/avatar.jpg', source: 'PROFILE' },
        loading: false, saving: false, upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn(),
      } as any);
      const utils = renderFlow();
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(utils.start).toHaveBeenCalledWith('A studio full of finished work.', 'ref-123');
    });

    it('stays on the description when the description cannot be saved', async () => {
      const utils = renderFlow({ onSaveDescription: jest.fn(async () => false) });
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(utils.start).not.toHaveBeenCalled();
      expect(utils.getByText('Your description could not be saved. Please try again.')).toBeTruthy();
    });

    it('shows the real state while the first moment is made, with no percentage or stage', async () => {
      const utils = renderFlow({ job: job('RUNNING', []) });
      await reachTwoUp(utils);
      expect(utils.getByText('Your future\nis taking shape.')).toBeTruthy();
      expect(utils.getByText('Finding the moments that make it real.')).toBeTruthy();
      expect(utils.queryByText(/%/)).toBeNull();
    });

    it('reveals a finished moment while the second continues, and does not allow choosing yet', async () => {
      const utils = renderFlow({ job: job('PARTIAL', candidates.slice(0, 1)) });
      await reachTwoUp(utils);
      const first = utils.getByTestId('scene-candidate-candidate-0');
      expect(first.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
      expect(utils.getByText('Your future\nis taking shape.')).toBeTruthy();
      fireEvent.press(first);
      expect(utils.onAssemble).not.toHaveBeenCalled();
    });

    it('chooses by tapping the image itself, with no Choose or Continue button', async () => {
      jest.useFakeTimers();
      try {
        const utils = renderFlow({ job: job('COMPLETE') });
        await reachTwoUp(utils);
        expect(utils.getByText('Your future\nis ready to choose from.')).toBeTruthy();
        expect(utils.getByText('Tap the one that feels right.')).toBeTruthy();
        expect(utils.queryByLabelText('Use This Image')).toBeNull();
        expect(utils.queryByLabelText('Continue')).toBeNull();
        expect(utils.getByLabelText('Choose this moment, option 1 of 2')).toBeTruthy();
        await act(async () => { fireEvent.press(utils.getByTestId('scene-candidate-candidate-1')); });
        await act(async () => { jest.advanceTimersByTime(800); });
        await waitFor(() => expect(utils.onAssemble).toHaveBeenCalledTimes(1));
        expect(utils.onAssemble).toHaveBeenCalledWith(expect.objectContaining({
          description: 'A studio full of finished work.',
          selectedAssets: [expect.objectContaining({ assetId: 'real-asset-1', sourceType: 'AI_GENERATED', prompt: 'A meaningful moment 1' })],
        }));
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns to a choosable screen when the chosen image could not be saved', async () => {
      jest.useFakeTimers();
      try {
        const utils = renderFlow({ job: job('COMPLETE'), onAssemble: jest.fn(async () => false) });
        await reachTwoUp(utils);
        await act(async () => { fireEvent.press(utils.getByTestId('scene-candidate-candidate-0')); });
        await act(async () => { jest.advanceTimersByTime(800); });
        await waitFor(() => expect(utils.getByText('Your Vision could not be saved. Please try again.')).toBeTruthy());
        expect(utils.getByTestId('scene-candidate-candidate-0').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps a finished moment choosable after a failure, and offers Try again and Edit description', async () => {
      jest.useFakeTimers();
      try {
        const utils = renderFlow({ job: job('FAILED', candidates.slice(0, 1)) });
        await reachTwoUp(utils);
        expect(utils.getByText('Your Vision needs another moment.')).toBeTruthy();
        fireEvent.press(utils.getByLabelText('Retry this set'));
        expect(utils.retry).toHaveBeenCalledTimes(1);
        await act(async () => { fireEvent.press(utils.getByTestId('scene-candidate-candidate-0')); });
        await act(async () => { jest.advanceTimersByTime(800); });
        await waitFor(() => expect(utils.onAssemble).toHaveBeenCalledTimes(1));
        fireEvent.press(utils.getByLabelText('Edit description'));
        expect(utils.getByTestId('vision-prompt-input')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });

    it('offers only Try again when a failure produced nothing', async () => {
      const utils = renderFlow({ job: job('FAILED', []) });
      await reachTwoUp(utils);
      expect(utils.getByText('We could not bring your Vision into view just yet. Please try again.')).toBeTruthy();
    });

    it('resumes the request made before the paywall, once', async () => {
      const onResumeGenerationConsumed = jest.fn();
      const utils = renderFlow({ resumeGeneration: true, onResumeGenerationConsumed });
      await waitFor(() => expect(utils.start).toHaveBeenCalledTimes(1));
      expect(onResumeGenerationConsumed).toHaveBeenCalled();
    });
  });

  describe('personal photos', () => {
    async function startPhotoPath(utils: ReturnType<typeof renderFlow>) {
      fireEvent.press(utils.getByLabelText('Create my Vision'));
      await act(async () => { fireEvent.press(utils.getByTestId('vision-method-photos')); });
    }

    it('opens the photo picker straight away and never the AI description screen', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
      const utils = renderFlow({ initialStep: 'empty' });
      await startPhotoPath(utils);
      expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);
      expect(utils.queryByText('What do you see?')).toBeNull();
      expect(utils.queryByText('What does your Vision look like?')).toBeNull();
      expect(utils.queryByTestId('vision-generate')).toBeNull();
      expect(utils.start).not.toHaveBeenCalled();
    });

    it('stays on the method screen when the picker is cancelled', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
      const utils = renderFlow({ initialStep: 'empty' });
      await startPhotoPath(utils);
      expect(utils.getByTestId('vision-method-photos')).toBeTruthy();
      expect(utils.onUploadAsset).not.toHaveBeenCalled();
    });

    it('the generate branch still asks for a description and keeps the identity reference', () => {
      const utils = renderFlow({ initialStep: 'empty' });
      fireEvent.press(utils.getByLabelText('Create my Vision'));
      fireEvent.press(utils.getByTestId('vision-method-generate'));
      expect(utils.getByText('What do you see?')).toBeTruthy();
      expect(utils.getByText('Make it look like you')).toBeTruthy();
      expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('uploads the chosen photo and makes it the Vision without a description step', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] });
      mockUseScene.mockReturnValue({ job: null, error: null, start: jest.fn(), retry: jest.fn(), refresh: jest.fn() });
      const onUploadAsset = jest.fn(async () => ({ ok: true, asset: { id: 'personal-asset', resolvedUrl: 'https://cdn.example.com/personal.jpg', mimeType: 'image/jpeg', fileSizeBytes: 1, createdAt: 'now' } } as UploadAssetResult));
      const onAssemble = jest.fn(async () => true);
      const rendered = render(<V2VisionCreationFlow {...baseProps} initialStep="empty" onUploadAsset={onUploadAsset} onAssemble={onAssemble} />);
      const utils = { ...rendered, onUploadAsset, onAssemble, start: mockUseScene().start } as unknown as ReturnType<typeof renderFlow>;
      await startPhotoPath(utils);
      await waitFor(() => expect(utils.onUploadAsset).toHaveBeenCalledWith({ base64Image: 'data:image/jpeg;base64,aW1hZ2U=', mimeType: 'image/jpeg' }));
      await waitFor(() => expect(utils.onAssemble).toHaveBeenCalledWith(expect.objectContaining({
        description: baseProps.anchorIntention,
        selectedAssets: [expect.objectContaining({ assetId: 'personal-asset', sourceType: 'USER_UPLOAD' })],
      })));
      expect(utils.start).not.toHaveBeenCalled();
    });

    it('keeps several photos, all personal uploads, in the order chosen', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [
        { uri: 'file:///a.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///b.png', mimeType: 'image/png' },
      ] });
      let count = 0;
      const onUploadAsset = jest.fn(async () => {
        count += 1;
        return { ok: true, asset: { id: `asset-${count}`, resolvedUrl: `https://cdn.example.com/${count}.jpg`, mimeType: 'image/jpeg', fileSizeBytes: 1, createdAt: 'now' } } as UploadAssetResult;
      });
      const utils = renderFlow({ initialStep: 'empty', onUploadAsset });
      await startPhotoPath(utils);
      await waitFor(() => expect(utils.onAssemble).toHaveBeenCalled());
      const assets = (utils.onAssemble as jest.Mock).mock.calls[0][0].selectedAssets;
      expect(assets).toHaveLength(2);
      expect(assets.every((asset: { sourceType: string }) => asset.sourceType === 'USER_UPLOAD')).toBe(true);
    });

    it('offers a retry when a photo does not upload, and does not make a Vision without it', async () => {
      mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }] });
      const onUploadAsset = jest.fn(async () => ({ ok: false, message: 'Upload failed' } as UploadAssetResult));
      const utils = renderFlow({ initialStep: 'empty', onUploadAsset });
      await startPhotoPath(utils);
      await waitFor(() => expect(utils.getByText('One photo needs another try.')).toBeTruthy());
      expect(utils.getByLabelText('Retry image upload')).toBeTruthy();
      expect(utils.onAssemble).not.toHaveBeenCalled();
    });
  });
});
