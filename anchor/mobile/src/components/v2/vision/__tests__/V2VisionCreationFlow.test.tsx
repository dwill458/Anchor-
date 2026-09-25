import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { V2VisionCreationFlow } from '../V2VisionCreationFlow';
import type { UploadAssetResult } from '@/hooks/v2/vision';

const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestPermission = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockUseGeneration = jest.fn();
const mockUseAppearance = jest.fn(() => ({
  profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false,
  upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => mockRequestPermission(),
  launchImageLibraryAsync: () => mockLaunchImageLibraryAsync(),
}));
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionGeneration: () => mockUseGeneration(),
  useVisionAppearanceReference: () => mockUseAppearance(),
}));

const candidates = Array.from({ length: 8 }, (_, index) => ({
  id: `candidate-${index}`,
  assetId: `real-asset-${index}`,
  role: `Scene ${index}`,
  prompt: `A meaningful moment ${index}`,
  sortOrder: index,
  imageUrl: `https://cdn.example.com/${index}.jpg`,
}));

const baseProps = {
  anchorId: 'anchor-1',
  anchorIntention: 'I build what matters.',
  anchorCategory: 'career',
  onBack: jest.fn(),
};

function renderFlow(overrides?: {
  initialStep?: 'prompt' | 'curation';
  job?: any;
  onUploadAsset?: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  onAssemble?: (input: any) => Promise<boolean>;
}) {
  mockUseGeneration.mockReturnValue({
    job: overrides?.job ?? null,
    loading: false,
    error: null,
    start: jest.fn(async () => true),
    retry: jest.fn(async () => true),
  });
  const onUploadAsset = overrides?.onUploadAsset ?? jest.fn(async () => ({
    ok: true,
    asset: { id: 'personal-asset', resolvedUrl: 'https://cdn.example.com/personal.jpg', mimeType: 'image/jpeg', fileSizeBytes: 100, createdAt: 'now' },
  } as UploadAssetResult));
  const onAssemble = overrides?.onAssemble ?? jest.fn(async () => true);
  const utils = render(
    <V2VisionCreationFlow {...baseProps} initialStep={overrides?.initialStep ?? 'prompt'}
      initialDescription="A studio full of finished work." onUploadAsset={onUploadAsset} onAssemble={onAssemble} />,
  );
  return { ...utils, onUploadAsset, onAssemble };
}

describe('V2VisionCreationFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });

  it('keeps generation and upload on the description screen', () => {
    const { getByTestId, getByText } = renderFlow();
    expect(getByText('What does this look like when it’s real?')).toBeTruthy();
    expect(getByTestId('vision-generate')).toBeTruthy();
    expect(getByTestId('vision-add-photos')).toBeTruthy();
  });

  it('does not upload when the picker is cancelled', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    const { getByTestId, onUploadAsset } = renderFlow();
    await act(async () => { fireEvent.press(getByTestId('vision-add-photos')); });
    expect(onUploadAsset).not.toHaveBeenCalled();
  });

  it('saves a real server asset after adding a personal photo', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }],
    });
    const { getByTestId, getByLabelText, onUploadAsset, onAssemble } = renderFlow();
    await act(async () => { fireEvent.press(getByTestId('vision-add-photos')); });
    await waitFor(() => expect(onUploadAsset).toHaveBeenCalledWith({
      base64Image: 'data:image/jpeg;base64,aW1hZ2U=', mimeType: 'image/jpeg',
    }));
    fireEvent.press(getByLabelText('Continue'));
    await waitFor(() => expect(onAssemble).toHaveBeenCalledWith(expect.objectContaining({
      selectedAssets: [expect.objectContaining({ assetId: 'personal-asset', sourceType: 'USER_UPLOAD' })],
    })));
  });

  it('selects generated assets and rejects a sixth selection', async () => {
    const { getByTestId, getByText, onAssemble } = renderFlow({
      initialStep: 'curation',
      job: { id: 'job-1', status: 'COMPLETE', stage: 'complete', setNumber: 1, retryCount: 0, candidates },
    });
    for (let index = 0; index < 6; index++) fireEvent.press(getByTestId(`candidate-card-candidate-${index}`));
    expect(getByText('A Vision can contain up to five images.')).toBeTruthy();
    expect(getByText('Continue (5/5) →')).toBeTruthy();
    fireEvent.press(getByText('Continue (5/5) →'));
    await waitFor(() => expect(onAssemble).toHaveBeenCalledWith(expect.objectContaining({
      selectedAssets: expect.arrayContaining([expect.objectContaining({ assetId: 'real-asset-0', sourceType: 'AI_GENERATED' })]),
    })));
    expect((onAssemble as jest.Mock).mock.calls[0][0].selectedAssets).toHaveLength(5);
  });

  it('saves generated and uploaded images together with server asset IDs', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false, assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }],
    });
    const { getByTestId, getByLabelText, onAssemble } = renderFlow({
      initialStep: 'curation',
      job: { id: 'job-1', status: 'COMPLETE', stage: 'complete', setNumber: 1, retryCount: 0, candidates },
    });
    fireEvent.press(getByTestId('candidate-card-candidate-0'));
    await act(async () => { fireEvent.press(getByTestId('vision-add-photos')); });
    fireEvent.press(getByLabelText('Continue'));
    await waitFor(() => expect(onAssemble).toHaveBeenCalledWith(expect.objectContaining({
      selectedAssets: [
        expect.objectContaining({ assetId: 'real-asset-0', sourceType: 'AI_GENERATED' }),
        expect.objectContaining({ assetId: 'personal-asset', sourceType: 'USER_UPLOAD' }),
      ],
    })));
  });

  it('shows actual job progress and retry after a provider failure', () => {
    const { getByText } = renderFlow({
      job: { id: 'job-1', status: 'FAILED', stage: 'failed', setNumber: 1, retryCount: 0, error: 'Retry this set.', candidates: [] },
    });
    expect(getByText('Retry this set')).toBeTruthy();
    expect(getByText('Your Vision needs another moment.')).toBeTruthy();
  });

  it('reports only images the server has actually created', () => {
    const { getByText, getByTestId } = renderFlow({
      job: { id: 'job-1', status: 'PARTIAL', stage: 'creating_images', setNumber: 1, retryCount: 0, error: null, candidates: candidates.slice(0, 3) },
    });
    expect(getByTestId('v2-vision-creation-flow-generating')).toBeTruthy();
    expect(getByText('Your future\nis taking shape.')).toBeTruthy();
    expect(getByText('Finding the moments that make it real.')).toBeTruthy();
    expect(getByText('Finding another moment…')).toBeTruthy();
  });

  it('shows no empty image frame before the first image exists', () => {
    const { getByTestId } = renderFlow({
      job: { id: 'job-1', status: 'RUNNING', stage: 'planning', setNumber: 1, retryCount: 0, error: null, candidates: [] },
    });
    const stage = getByTestId('vision-generation-stage');
    expect(stage.findAllByType(require('react-native').Image)).toHaveLength(0);
    expect(getByTestId('v2-vision-creation-flow-generating')).toBeTruthy();
  });

  it('keeps finished images when a set pauses and offers both paths', () => {
    const { getByText, queryByTestId } = renderFlow({
      job: { id: 'job-1', status: 'FAILED', stage: 'failed', setNumber: 1, retryCount: 0, error: 'Retry this set.', candidates: candidates.slice(0, 7) },
    });
    expect(queryByTestId('v2-vision-creation-flow-generating')).toBeTruthy();
    expect(getByText('Retry this set')).toBeTruthy();
    expect(getByText('Choose available images')).toBeTruthy();
  });

  it('moves to choosing only after the finished set has been shown', async () => {
    jest.useFakeTimers();
    try {
      const job = (status: string, count: number) => ({
        id: 'job-1', status, stage: status === 'COMPLETE' ? 'complete' : 'creating_images', setNumber: 1, retryCount: 0,
        error: null, candidates: candidates.slice(0, count),
      });
      const generationState = (value: object) => ({ job: value, loading: false, error: null, start: jest.fn(), retry: jest.fn() });
      mockUseGeneration.mockReturnValue(generationState(job('PARTIAL', 7)));
      const onUploadAsset = jest.fn();
      const onAssemble = jest.fn();
      // A fresh element each time: re-rendering the same element object is a no-op.
      const element = () => (
        <V2VisionCreationFlow {...baseProps} initialStep="prompt" onUploadAsset={onUploadAsset} onAssemble={onAssemble} />
      );
      const { queryByTestId, rerender } = render(element());
      expect(queryByTestId('v2-vision-creation-flow-generating')).toBeTruthy();

      // The last image and COMPLETE arrive in the same poll.
      mockUseGeneration.mockReturnValue(generationState(job('COMPLETE', 8)));
      rerender(element());
      const advance = async (ms: number) => {
        await act(async () => { for (let t = 0; t < 6; t++) await Promise.resolve(); jest.advanceTimersByTime(ms); for (let t = 0; t < 6; t++) await Promise.resolve(); });
      };
      await advance(1000);
      // Still showing the eighth image arrive, not jumping straight to choosing.
      expect(queryByTestId('v2-vision-creation-flow-generating')).toBeTruthy();

      for (let i = 0; i < 8; i++) await advance(500);
      expect(queryByTestId('v2-vision-creation-flow-curation')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts one generation however many times Continue is tapped', async () => {
    const start = jest.fn(async () => true);
    let resolveSave: (value: boolean) => void = () => undefined;
    const onSaveDescription = jest.fn(() => new Promise<boolean>(resolve => { resolveSave = resolve; }));
    mockUseGeneration.mockReturnValue({ job: null, loading: false, error: null, start, retry: jest.fn() });
    const { getByTestId } = render(
      <V2VisionCreationFlow {...baseProps} initialStep="prompt" initialDescription="A studio full of finished work."
        onSaveDescription={onSaveDescription} onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
    );
    fireEvent.press(getByTestId('vision-generate'));
    fireEvent.press(getByTestId('vision-generate'));
    fireEvent.press(getByTestId('vision-generate'));
    await act(async () => { resolveSave(true); });
    expect(onSaveDescription).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('uses the ink primary button for Create Vision', () => {
    mockUseGeneration.mockReturnValue({ job: null, loading: false, error: null, start: jest.fn(), retry: jest.fn() });
    const { getByLabelText } = render(
      <V2VisionCreationFlow {...baseProps} initialStep="empty" onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
    );
    const button = getByLabelText('Create Vision');
    const flat = require('react-native').StyleSheet.flatten(button.props.style);
    expect(flat.backgroundColor).toBe('#171717');
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

  it('keeps Continue available beside the focused multiline description and submits from focused state', async () => {
    const { getByTestId, queryByTestId } = renderFlow();
    const input = getByTestId('vision-prompt-input');
    const testVision = 'My RevenueCat dashboard shows 10 thousand active users for Anchor. A recommendation on the App Store. And me working on the beach with the family.';
    fireEvent.changeText(input, testVision);
    expect(input.props.value).toBe(testVision);

    fireEvent(input, 'focus');
    const focusedContinue = getByTestId('vision-generate-focused');
    expect(focusedContinue).toBeTruthy();
    expect(queryByTestId('vision-generate')).toBeNull();

    // Verify submission works directly while focused
    fireEvent.press(focusedContinue);

    fireEvent(input, 'blur');
    expect(getByTestId('vision-generate')).toBeTruthy();
  });

  it('supports multiline input near the 500-character limit without disabling continue', () => {
    const { getByTestId } = renderFlow();
    const input = getByTestId('vision-prompt-input');
    const longVision = 'A'.repeat(480);
    fireEvent.changeText(input, longVision);
    expect(getByTestId('vision-detail-hint')).toBeTruthy();
    expect(getByTestId('vision-generate').props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('uses the Anchor intention to choose its worked example', () => {
    mockUseGeneration.mockReturnValue({ job: null, loading: false, error: null, start: jest.fn(), retry: jest.fn() });
    const { getByTestId, rerender } = render(
      <V2VisionCreationFlow {...baseProps} anchorIntention="Anchor has ten thousand users" anchorCategory="desire"
        onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
    );
    expect(getByTestId('vision-prompt-input').props.placeholder).toMatch(/people using what I built/);
    rerender(
      <V2VisionCreationFlow {...baseProps} anchorIntention="I feel at peace" anchorCategory="spirituality"
        onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
    );
    expect(getByTestId('vision-prompt-input').props.placeholder).not.toMatch(/people using what I built/);
  });

  it('keeps the order images were chosen in, so the first choice is the cover', async () => {
    const { getByTestId, getByLabelText, onAssemble } = renderFlow({
      initialStep: 'curation',
      job: { id: 'job-1', status: 'COMPLETE', stage: 'complete', setNumber: 1, retryCount: 0, candidates },
    });
    fireEvent.press(getByTestId('candidate-card-candidate-4'));
    fireEvent.press(getByTestId('candidate-card-candidate-1'));
    fireEvent.press(getByLabelText('Continue'));
    await waitFor(() => expect(onAssemble).toHaveBeenCalled());
    expect((onAssemble as jest.Mock).mock.calls[0][0].selectedAssets.map((asset: { assetId: string }) => asset.assetId))
      .toEqual(['real-asset-4', 'real-asset-1']);
  });

  it('handles Create Vision CTA tap with cinematic transition handoff', async () => {
    jest.useFakeTimers();
    try {
      mockUseGeneration.mockReturnValue({ job: null, loading: false, error: null, start: jest.fn(), retry: jest.fn() });
      const { getByLabelText, getByTestId, queryByTestId } = render(
        <V2VisionCreationFlow {...baseProps} initialStep="empty" focalPoint={{ x: 0.68, y: 0.62 }} onUploadAsset={jest.fn()} onAssemble={jest.fn()} />,
      );
      expect(getByTestId('v2-vision-creation-flow-empty')).toBeTruthy();
      const button = getByLabelText('Create Vision');
      fireEvent.press(button);

      // Advance timer for transition handoff
      await act(async () => {
        jest.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(queryByTestId('v2-vision-creation-flow-prompt')).toBeTruthy();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
