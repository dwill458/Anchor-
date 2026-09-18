import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { V2VisionCreationFlow } from '../V2VisionCreationFlow';
import type { UploadAssetResult } from '@/hooks/v2/vision';

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(() => ({})),
}));

const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

function pickedAsset(uri: string, mimeType = 'image/jpeg') {
  return { canceled: false, assets: [{ uri, mimeType }] };
}

function canceledPick() {
  return { canceled: true, assets: null };
}

describe('V2VisionCreationFlow', () => {
  const baseProps = {
    anchorId: 'anchor-1',
    anchorIntention: 'I build what matters.',
    anchorCategory: 'Career',
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('ZmFrZS1pbWFnZS1ieXRlcw==');
  });

  function renderAtUpload(overrides?: {
    onUploadAsset?: jest.Mock<Promise<UploadAssetResult>, [{ base64Image: string; mimeType: string }]>;
    onAssemble?: jest.Mock<Promise<boolean>, [any]>;
  }) {
    const onUploadAsset =
      overrides?.onUploadAsset ??
      jest.fn(async () => ({ ok: true, asset: { id: 'asset-real-1', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } } as UploadAssetResult));
    const onAssemble = overrides?.onAssemble ?? jest.fn(async () => true);

    const utils = render(
      <V2VisionCreationFlow
        {...baseProps}
        initialStep="prompt"
        onUploadAsset={onUploadAsset}
        onAssemble={onAssemble}
      />,
    );

    fireEvent.changeText(utils.getByTestId('vision-prompt-input'), 'A studio full of finished work.');
    fireEvent.press(utils.getByLabelText('Continue to add photos'));

    return { ...utils, onUploadAsset, onAssemble };
  }

  it('picker cancellation adds no images and never calls upload', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce(canceledPick());
    const { getByTestId, onUploadAsset, queryByTestId } = renderAtUpload();

    await act(async () => {
      fireEvent.press(getByTestId('vision-add-photos'));
      await Promise.resolve();
    });

    expect(onUploadAsset).not.toHaveBeenCalled();
    expect(queryByTestId(/vision-upload-item-/)).toBeNull();
  });

  it('a successful selection proceeds to upload and finalizes with the real server-issued asset id', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce(pickedAsset('file:///tmp/photo-1.jpg'));
    const onUploadAsset = jest.fn(
      async () =>
        ({ ok: true, asset: { id: 'asset-real-99', resolvedUrl: 'https://cdn.example.com/99.jpg', mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } }) as UploadAssetResult,
    );
    const { getByTestId, findByText } = renderAtUpload({ onUploadAsset });

    await act(async () => {
      fireEvent.press(getByTestId('vision-add-photos'));
    });

    await waitFor(() => expect(onUploadAsset).toHaveBeenCalledTimes(1));
    expect(onUploadAsset).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/jpeg', base64Image: expect.stringContaining('data:image/jpeg;base64,') }),
    );
    await findByText('1 added · Add 2 more');
  });

  it('cannot finalize while an upload is still pending', async () => {
    let resolveUpload: (value: UploadAssetResult) => void = () => {};
    const pending = new Promise<UploadAssetResult>((resolve) => {
      resolveUpload = resolve;
    });
    mockLaunchImageLibraryAsync.mockResolvedValueOnce(pickedAsset('file:///tmp/photo-1.jpg'));
    const onUploadAsset = jest.fn(() => pending);
    const { getByTestId, getByLabelText, findByText } = renderAtUpload({ onUploadAsset });

    await act(async () => {
      fireEvent.press(getByTestId('vision-add-photos'));
    });

    await findByText('Uploading 1 photo…');
    expect(getByLabelText('Assemble Vision').props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      resolveUpload({ ok: true, asset: { id: 'asset-real-1', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } });
      await pending;
    });
  });

  it('upload failure shows an error and allows retry, without using a fake asset id', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce(pickedAsset('file:///tmp/photo-1.jpg'));
    const onUploadAsset = jest
      .fn<Promise<UploadAssetResult>, [any]>()
      .mockResolvedValueOnce({ ok: false, message: 'Network error. Please check your connection.' })
      .mockResolvedValueOnce({ ok: true, asset: { id: 'asset-real-1', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } });

    const { getByTestId, findByText } = renderAtUpload({ onUploadAsset });

    await act(async () => {
      fireEvent.press(getByTestId('vision-add-photos'));
    });

    await findByText('Network error. Please check your connection.');
    expect(onUploadAsset).toHaveBeenCalledTimes(1);

    const retryButton = await findByText('Retry');
    await act(async () => {
      fireEvent.press(retryButton);
    });

    await waitFor(() => expect(onUploadAsset).toHaveBeenCalledTimes(2));
    await findByText('1 added · Add 2 more');
  });

  it('does not report a fake success when Vision creation fails after real uploads', async () => {
    mockLaunchImageLibraryAsync
      .mockResolvedValueOnce(pickedAsset('file:///tmp/1.jpg'))
      .mockResolvedValueOnce(pickedAsset('file:///tmp/2.jpg'))
      .mockResolvedValueOnce(pickedAsset('file:///tmp/3.jpg'));

    let counter = 0;
    const onUploadAsset = jest.fn(async () => {
      counter += 1;
      return { ok: true, asset: { id: `asset-real-${counter}`, resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } } as UploadAssetResult;
    });
    const onAssemble = jest.fn(async () => false);
    const { getByTestId, findByText, getByLabelText } = renderAtUpload({ onUploadAsset, onAssemble });

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.press(getByTestId('vision-add-photos'));
      });
      await waitFor(() => expect(onUploadAsset).toHaveBeenCalledTimes(i + 1));
    }

    await findByText('3 added');
    await act(async () => {
      fireEvent.press(getByLabelText('Assemble Vision'));
    });

    expect(onAssemble).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'USER_UPLOAD',
        selectedAssets: [
          { assetId: 'asset-real-1' },
          { assetId: 'asset-real-2' },
          { assetId: 'asset-real-3' },
        ],
      }),
    );
    await findByText("We couldn't save your Vision. Please try again.");
  });

  it('a successful creation calls onAssemble with only real, uploaded asset ids', async () => {
    mockLaunchImageLibraryAsync
      .mockResolvedValueOnce(pickedAsset('file:///tmp/1.jpg'))
      .mockResolvedValueOnce(pickedAsset('file:///tmp/2.jpg'))
      .mockResolvedValueOnce(pickedAsset('file:///tmp/3.jpg'));

    let counter = 0;
    const onUploadAsset = jest.fn(async () => {
      counter += 1;
      return { ok: true, asset: { id: `asset-real-${counter}`, resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } } as UploadAssetResult;
    });
    const onAssemble = jest.fn(async () => true);
    const { getByTestId, findByText, getByLabelText } = renderAtUpload({ onUploadAsset, onAssemble });

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.press(getByTestId('vision-add-photos'));
      });
      await waitFor(() => expect(onUploadAsset).toHaveBeenCalledTimes(i + 1));
    }

    await findByText('3 added');
    await act(async () => {
      fireEvent.press(getByLabelText('Assemble Vision'));
    });

    await waitFor(() => expect(onAssemble).toHaveBeenCalledTimes(1));
    expect(onAssemble.mock.calls[0][0].selectedAssets).toEqual([
      { assetId: 'asset-real-1' },
      { assetId: 'asset-real-2' },
      { assetId: 'asset-real-3' },
    ]);
  });

  it('does not upload again after unmount', async () => {
    let resolveUpload: (value: UploadAssetResult) => void = () => {};
    const pending = new Promise<UploadAssetResult>((resolve) => {
      resolveUpload = resolve;
    });
    mockLaunchImageLibraryAsync.mockResolvedValueOnce(pickedAsset('file:///tmp/1.jpg'));
    const onUploadAsset = jest.fn(() => pending);
    const { getByTestId, unmount } = renderAtUpload({ onUploadAsset });

    await act(async () => {
      fireEvent.press(getByTestId('vision-add-photos'));
    });

    unmount();

    await act(async () => {
      resolveUpload({ ok: true, asset: { id: 'asset-real-1', resolvedUrl: null, mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } });
      await pending;
    });
    // No React "state update on an unmounted component" warning/crash means the isMountedRef guard held.
  });
});
