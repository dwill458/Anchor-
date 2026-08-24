import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SetWallpaperSheet } from '../SetWallpaperSheet';
import type { Anchor } from '@/types';

const mockExportAnchorArtwork = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/services/AnchorArtworkExportService', () => ({
  exportAnchorArtwork: (...args: unknown[]) => mockExportAnchorArtwork(...args),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => true,
}));

jest.mock('@/components/common', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AnchorArtworkExportCanvas: React.forwardRef((_: unknown, ref: React.Ref<{ capture: () => Promise<string> }>) => {
      React.useImperativeHandle(ref, () => ({ capture: () => Promise.resolve('file:///tmp/anchor.png') }));
      return <View testID="anchor-artwork-export-canvas" />;
    }),
  };
});

jest.mock('@/components/common/OptimizedImage', () => ({
  OptimizedImage: () => null,
}));

const anchor = {
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Move with purpose',
  category: 'personal_growth',
  distilledLetters: ['A'],
  baseSigilSvg: '<svg><circle cx="50" cy="50" r="40" /></svg>',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Anchor;

describe('SetWallpaperSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportAnchorArtwork.mockResolvedValue({ localUri: 'file:///tmp/anchor.png' });
  });

  it('saves the exported artwork to Photos and gives the iOS next step', async () => {
    const onSetWallpaper = jest.fn();
    render(
      <SetWallpaperSheet anchor={anchor} onSetWallpaper={onSetWallpaper} onDismiss={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('set-as-wallpaper-button'));

    await waitFor(() => {
      expect(mockExportAnchorArtwork).toHaveBeenCalledWith(expect.objectContaining({ mode: 'download' }));
      expect(onSetWallpaper).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('SAVED TO PHOTOS')).toBeTruthy();
    expect(screen.getByText('Saved to Photos. Open Settings › Wallpaper to set it.')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith('wallpaper_sheet_save_tapped', { anchor_id: 'anchor-1' });
  });

  it('marks a scrim or Maybe later action as a dismissal', () => {
    const onDismiss = jest.fn();
    render(<SetWallpaperSheet anchor={anchor} onSetWallpaper={jest.fn()} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByTestId('wallpaper-sheet-maybe-later'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('wallpaper_sheet_dismissed', { anchor_id: 'anchor-1' });
  });
});
