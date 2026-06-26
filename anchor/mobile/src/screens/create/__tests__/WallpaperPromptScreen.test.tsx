import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastProvider } from '@/components/ToastProvider';
import { WallpaperPromptScreen } from '../WallpaperPromptScreen';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockSetWallpaperPromptSeen = jest.fn();
const mockExportAnchorArtwork = jest.fn();
let mockAuthState: any = {
  setWallpaperPromptSeen: mockSetWallpaperPromptSeen,
  isAuthenticated: true,
  pendingFirstAnchorDraft: null,
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ replace: mockReplace, navigate: mockNavigate }),
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
    return selector(mockAuthState);
  },
}));

jest.mock('@/services/AnchorArtworkExportService', () => ({
  exportAnchorArtwork: (...args: any[]) => mockExportAnchorArtwork(...args),
}));

describe('WallpaperPromptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      setWallpaperPromptSeen: mockSetWallpaperPromptSeen,
      isAuthenticated: true,
      pendingFirstAnchorDraft: null,
    };
    mockExportAnchorArtwork.mockResolvedValue({
      localUri: 'file:///tmp/anchor.png',
      filename: 'anchor-wallpaper.png',
      mode: 'wallpaper',
    });
  });

  it('uses the shared export flow before continuing', async () => {
    render(
      <ToastProvider>
        <WallpaperPromptScreen />
      </ToastProvider>
    );

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

  it('routes no-account users to account creation instead of exporting', async () => {
    mockAuthState = {
      setWallpaperPromptSeen: mockSetWallpaperPromptSeen,
      isAuthenticated: false,
      pendingFirstAnchorDraft: null,
    };

    render(
      <ToastProvider>
        <WallpaperPromptScreen />
      </ToastProvider>
    );

    fireEvent.press(screen.getByText('CREATE ACCOUNT'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      context: 'save_progress',
      initialTab: 'signup',
    });
    expect(mockExportAnchorArtwork).not.toHaveBeenCalled();
    expect(mockSetWallpaperPromptSeen).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
