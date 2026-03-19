import { Share } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import {
  exportAnchorArtwork,
} from '../AnchorArtworkExportService';

describe('AnchorArtworkExportService', () => {
  const captureArtwork = jest.fn(async () => 'file:///tmp/anchor.png');

  beforeEach(() => {
    jest.clearAllMocks();
    captureArtwork.mockResolvedValue('file:///tmp/anchor.png');
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
  });

  it('shares generated artwork for wallpaper export', async () => {
    const result = await exportAnchorArtwork({
      anchor: {
        anchorName: 'Morning Focus',
        intentionText: 'I move with clarity.',
      },
      mode: 'wallpaper',
      captureArtwork,
    });

    expect(captureArtwork).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Morning Focus wallpaper',
      url: 'file:///tmp/anchor.png',
    }));
    expect(result).toEqual({
      filename: 'morning-focus-wallpaper.png',
      localUri: 'file:///tmp/anchor.png',
      mode: 'wallpaper',
    });
  });

  it('saves generated artwork when downloading png', async () => {
    const result = await exportAnchorArtwork({
      anchor: {
        anchorName: 'Sacred Loop',
        intentionText: 'I return to the practice.',
      },
      mode: 'download',
      captureArtwork,
    });

    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/anchor.png');
    expect(result).toEqual({
      filename: 'sacred-loop-wallpaper.png',
      localUri: 'file:///tmp/anchor.png',
      mode: 'download',
    });
  });

  it('surfaces a permission error when photo access is denied', async () => {
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await expect(exportAnchorArtwork({
      anchor: {
        anchorName: 'Field Note',
        intentionText: 'I stay with what matters.',
      },
      mode: 'download',
      captureArtwork,
    })).rejects.toMatchObject({
      code: 'artwork/permission-denied',
      message: 'Photo library permission is required to save this PNG.',
    });
  });

  it('wraps capture failures', async () => {
    captureArtwork.mockRejectedValue(new Error('capture failed'));

    await expect(exportAnchorArtwork({
      anchor: {
        anchorName: 'Field Note',
        intentionText: 'I stay with what matters.',
      },
      mode: 'wallpaper',
      captureArtwork,
    })).rejects.toMatchObject({
      code: 'artwork/export-failed',
      message: 'Unable to generate your anchor artwork right now.',
    });
  });
});
