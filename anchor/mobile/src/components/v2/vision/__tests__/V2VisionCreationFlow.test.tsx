import { ActionSheetIOS } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { V2VisionCreationFlow } from '../V2VisionCreationFlow';
import type { VisionAnchorArt } from '../VisionChrome';
import type { UploadAssetResult } from '@/hooks/v2/vision';

const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestPermission = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockUseScene = jest.fn();
const mockPickVisionPhoto = jest.fn();
const mockUploadVisionPhoto = jest.fn();
const mockUseAppearance = jest.fn(() => ({
  profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false,
  upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: () => mockRequestPermission(),
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
}));
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => mockUseScene(),
  useVisionAppearanceReference: () => mockUseAppearance(),
  pickVisionPhoto: (...args: unknown[]) => mockPickVisionPhoto(...args),
  uploadVisionPhoto: (...args: unknown[]) => mockUploadVisionPhoto(...args),
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
  anchorArt?: VisionAnchorArt;
  initialStep?: 'empty' | 'prompt';
  job?: any;
  start?: jest.Mock;
  retry?: jest.Mock;
  onSaveDescription?: (description: string) => Promise<boolean>;
  onUploadAsset?: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  onAssemble?: (input: any) => Promise<boolean | void>;
  resumeGeneration?: boolean;
  onResumeGenerationConsumed?: () => void;
  photoPath?: boolean;
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
    <V2VisionCreationFlow {...baseProps} anchorArt={overrides.anchorArt} initialStep={overrides.initialStep ?? 'prompt'} initialDescription="A studio full of finished work."
      onSaveDescription={overrides.onSaveDescription} resumeGeneration={overrides.resumeGeneration}
      onResumeGenerationConsumed={overrides.onResumeGenerationConsumed}
      onUploadAsset={onUploadAsset} onAssemble={onAssemble} />,
  );
  // The photo path is the default; the description-led tests below exercise the words path.
  if ((overrides.initialStep ?? 'prompt') === 'prompt' && !overrides.photoPath) fireEvent.press(utils.getByTestId('vision-path-words'));
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

  describe('starting from a photo', () => {
    const photo = { status: 'picked', photo: { uri: 'file:///room.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } };
    // The "Take or choose" sheet answers "Choose from library" straight away.
    beforeEach(() => {
      jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(((_options: unknown, callback: (index: number) => void) => callback(2)) as never);
    });

    it('opens on the photo path with the picker first and Create off until a photo is set', () => {
      const utils = renderFlow({ photoPath: true });
      expect(utils.getByTestId('vision-start-photo-pick')).toBeTruthy();
      expect(utils.getByText('Take or choose a photo')).toBeTruthy();
      expect(utils.getByText('What should change?')).toBeTruthy();
      expect(utils.queryByText('Where are you?')).toBeNull();
      expect(utils.queryByText('Make it look like you')).toBeNull();
      expect(utils.getByTestId('vision-generate').props.accessibilityState.disabled).toBe(true);
    });

    it('uploads the photo, saves the Vision and starts one request with the photo and no description', async () => {
      mockPickVisionPhoto.mockResolvedValue(photo);
      mockUploadVisionPhoto.mockResolvedValue({ ok: true, assetId: 'start-asset-1' });
      const onSaveDescription = jest.fn(async () => true);
      const start = jest.fn(async () => true);
      mockUseScene.mockReturnValue({ job: null, error: null, start, retry: jest.fn(), refresh: jest.fn() });
      const utils = render(
        <V2VisionCreationFlow {...baseProps} initialStep="prompt" initialDescription="" onSaveDescription={onSaveDescription}
          onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
      );
      await act(async () => { fireEvent.press(utils.getByTestId('vision-start-photo-pick')); });
      await waitFor(() => expect(utils.getByTestId('vision-start-photo-replace')).toBeTruthy());
      expect(mockPickVisionPhoto).toHaveBeenCalledWith('library', 0.6);
      expect(utils.getByTestId('vision-generate').props.accessibilityState.disabled).toBe(false);
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(onSaveDescription).toHaveBeenCalledWith(expect.stringContaining('I build what matters.'));
      expect(start).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledWith(expect.stringMatching(/^The same place, once this is true: I build what matters\./), null, 'start-asset-1');
    });

    it('does not create a Vision when the photo cannot be uploaded', async () => {
      mockPickVisionPhoto.mockResolvedValue(photo);
      mockUploadVisionPhoto.mockResolvedValue({ ok: false, message: 'Photo is too large.' });
      const onSaveDescription = jest.fn(async () => true);
      const utils = renderFlow({ photoPath: true, onSaveDescription });
      await act(async () => { fireEvent.press(utils.getByTestId('vision-start-photo-pick')); });
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(onSaveDescription).not.toHaveBeenCalled();
      expect(utils.start).not.toHaveBeenCalled();
      expect(utils.getByText('Photo is too large.')).toBeTruthy();
    });

    it('removes the photo, and the words path never sends one', async () => {
      mockPickVisionPhoto.mockResolvedValue(photo);
      const utils = renderFlow({ photoPath: true });
      await act(async () => { fireEvent.press(utils.getByTestId('vision-start-photo-pick')); });
      fireEvent.press(utils.getByTestId('vision-start-photo-remove'));
      expect(utils.getByTestId('vision-start-photo-pick')).toBeTruthy();
      fireEvent.press(utils.getByTestId('vision-path-words'));
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(utils.start).toHaveBeenCalledWith('A studio full of finished work.', null);
      expect(mockUploadVisionPhoto).not.toHaveBeenCalled();
    });
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
    it('only fills the Anchor example when requested and submits the edited suggestion', async () => {
      const utils = renderFlow();
      expect(utils.queryByTestId('vision-use-suggested-description')).toBeNull();
      fireEvent.changeText(utils.getByTestId('vision-prompt-input'), '');
      expect(utils.getByTestId('vision-prompt-input').props.value).toBe('');
      const example = utils.getByTestId('vision-prompt-input').props.placeholder;
      expect(example).toContain(baseProps.anchorIntention);
      fireEvent.press(utils.getByTestId('vision-use-suggested-description'));
      expect(utils.getByTestId('vision-prompt-input').props.value).toBe(example);
      expect(utils.queryByTestId('vision-use-suggested-description')).toBeNull();
      const edited = `${example} Warm light comes through the window.`;
      fireEvent.changeText(utils.getByTestId('vision-prompt-input'), edited);
      await act(async () => { fireEvent.press(utils.getByTestId('vision-generate')); });
      expect(utils.start).toHaveBeenCalledWith(edited, null);
    });

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
      fireEvent.press(getByTestId('vision-path-words'));
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
      expect(utils.getByText('Reading your moment…')).toBeTruthy();
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

    it('previews a candidate and saves only after Use this one', async () => {
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
        expect(utils.onAssemble).not.toHaveBeenCalled();
        await act(async () => { fireEvent.press(utils.getByLabelText('Use this one')); });
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
        expect(utils.onAssemble).not.toHaveBeenCalled();
        await act(async () => { fireEvent.press(utils.getByLabelText('Use this one')); });
        await act(async () => { jest.advanceTimersByTime(800); });
        await waitFor(() => expect(utils.getByText('Your Vision could not be saved. Please try again.')).toBeTruthy());
        expect(utils.getByLabelText('Use this one').props.accessibilityState.disabled).toBe(false);
        fireEvent.press(utils.getByLabelText('Back to images'));
        expect(utils.getByTestId('scene-candidate-candidate-0').props.accessibilityState.disabled).toBe(false);
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
        expect(utils.onAssemble).not.toHaveBeenCalled();
        await act(async () => { fireEvent.press(utils.getByLabelText('Use this one')); });
        await act(async () => { jest.advanceTimersByTime(800); });
        await waitFor(() => expect(utils.onAssemble).toHaveBeenCalledTimes(1));
        fireEvent.press(utils.getByLabelText('Edit description'));
        expect(utils.getByTestId('vision-prompt-input')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps enhanced Anchor artwork on generation and preview with an SVG fallback', async () => {
      const utils = renderFlow({ job: job('COMPLETE'), anchorArt: { svg: '<svg />', imageUrl: 'https://cdn.example.com/enhanced.png', category: 'career' } });
      await reachTwoUp(utils);
      const artwork = utils.getByTestId('v2-vision-creation-flow-generating-anchor-artwork');
      const { Image } = require('react-native');
      expect(artwork.findByType(Image).props.source.uri).toBe('https://cdn.example.com/enhanced.png');
      await act(async () => { fireEvent.press(utils.getByTestId('scene-candidate-candidate-0')); });
      const preview = utils.getByTestId('v2-vision-creation-flow-generating-preview-anchor-artwork');
      expect(preview.findByType(Image).props.source.uri).toBe('https://cdn.example.com/enhanced.png');
    });

    it('advances wait copy without enabling unfinished candidates', async () => {
      const beats: Record<number, () => void> = {};
      const schedule = global.setTimeout;
      const spy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay?: number, ...args: any[]) => {
        if (delay && [9000, 20000, 40000].includes(delay)) beats[delay] = callback;
        return schedule(callback, delay, ...args);
      });
      try {
        const utils = renderFlow({ job: job('RUNNING', []) });
        await reachTwoUp(utils);
        expect(utils.getByText('Reading your moment\u2026')).toBeTruthy();
        await act(async () => { beats[9000](); });
        expect(utils.getByText('Composing the scene\u2026')).toBeTruthy();
        await act(async () => { beats[20000](); });
        expect(utils.getByText('Developing the images\u2026')).toBeTruthy();
        await act(async () => { beats[40000](); });
        expect(utils.getByText('Giving your images time to develop\u2026')).toBeTruthy();
        expect(utils.getByTestId('v2-vision-creation-flow-generating-slot-0').props.accessibilityState.disabled).toBe(true);
        expect(utils.onAssemble).not.toHaveBeenCalled();
        utils.unmount();
      } finally { spy.mockRestore(); }
    });

    it('keeps the prompt when neither candidate feels right', async () => {
      const utils = renderFlow({ job: job('COMPLETE') });
      await reachTwoUp(utils);
      fireEvent.press(utils.getByText('Neither feels right — try again'));
      expect(utils.getByTestId('vision-prompt-input').props.value).toBe('A studio full of finished work.');
      expect(utils.onAssemble).not.toHaveBeenCalled();
    });

    it('returns from preview to editing without saving a candidate', async () => {
      const utils = renderFlow({ job: job('COMPLETE') });
      await reachTwoUp(utils);
      await act(async () => { fireEvent.press(utils.getByTestId('scene-candidate-candidate-0')); });
      fireEvent.press(utils.getByText('Try again'));
      expect(utils.getByTestId('vision-prompt-input').props.value).toBe('A studio full of finished work.');
      expect(utils.onAssemble).not.toHaveBeenCalled();
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
      // Photo-first is the default path; the selfie card belongs to the words path only.
      expect(utils.queryByText('Make it look like you')).toBeNull();
      fireEvent.press(utils.getByTestId('vision-path-words'));
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
