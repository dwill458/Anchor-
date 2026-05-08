import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { WallpaperPromptScreen } from '../WallpaperPromptScreen';

const mockReplace = jest.fn();
const mockSetWallpaperPromptSeen = jest.fn();
const mockExportAnchorArtwork = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ replace: mockReplace }),
  useRoute: () => ({
    params: {
      anchorId: 'anchor-123',
      intentionText: 'I move with precision.',
      enhancedImageUrl: 'https://example.com/anchor.png',
      sigilSvg: '<svg></svg>',
    },
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      setWallpaperPromptSeen: mockSetWallpaperPromptSeen,
    };
    return selector(state);
  },
}));

jest.mock('@/services/AnchorArtworkExportService', () => ({
  exportAnchorArtwork: (...args: any[]) => mockExportAnchorArtwork(...args),
}));

describe('WallpaperPromptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportAnchorArtwork.mockResolvedValue({
      localUri: 'file:///tmp/anchor.png',
      filename: 'anchor-wallpaper.png',
      mode: 'wallpaper',
    });
  });

  it('uses the shared export flow before continuing', async () => {
    render(<WallpaperPromptScreen />);

    fireEvent.press(screen.getByText('SET AS WALLPAPER'));

    await waitFor(() => {
      expect(mockExportAnchorArtwork).toHaveBeenCalledWith(expect.objectContaining({
        anchor: expect.objectContaining({
          anchorName: 'Anchor',
          intentionText: 'I move with precision.',
        }),
        mode: 'wallpaper',
        captureArtwork: expect.any(Function),
      }));
    });

    expect(mockSetWallpaperPromptSeen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('ChargeSetup', {
      anchorId: 'anchor-123',
      autoStartOnSelection: true,
      returnTo: 'vault',
    });
  });
});
