import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnchorShareStudio } from '../AnchorShareStudio';
import { VisionExportTemplate } from '../templates/VisionExportTemplate';
import { VISION_SHARE_BACKGROUNDS, getVisionShareBackground } from '../visionShareBackgrounds';
import { useSharePrefsStore } from '@/stores/sharePrefsStore';
import type { ShareExportData } from '../shareTypes';
import { saveShareExport, sharePngViaSystemSheet } from '@/services/anchorExportService';

const mockPreview = jest.fn();
jest.mock('../AnchorSharePreview', () => ({
  AnchorSharePreview: (props: unknown) => {
    mockPreview(props);
    return null;
  },
}));

const mockPrepare = jest.fn();
const mockRelease = jest.fn();
const mockRenderPng = jest.fn().mockResolvedValue('file://fake-export.png');
jest.mock('../useShareExportRenderer', () => ({
  useShareExportRenderer: () => ({
    prepare: mockPrepare,
    release: mockRelease,
    renderPng: mockRenderPng,
    exportNode: null,
  }),
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ isPro: true }),
}));

jest.mock('@/services/anchorExportService', () => ({
  saveShareExport: jest.fn().mockResolvedValue('saved'),
  sharePngViaSystemSheet: jest.fn().mockResolvedValue(true),
}));

const tile = { id: 'tile-1', sceneId: 'scene-1', imageUrl: 'https://img.test/photo.jpg', prompt: null, sortOrder: 0, isHero: true };
const note = {
  id: 'note-1',
  visionId: 'vision-1',
  content: { text: 'Clarity and peace' },
  presentation: {
    styleId: 'sticky_blush_pink' as const,
    x: 0.5,
    y: 0.5,
    width: 0.3,
    height: 0.2,
    rotation: 0,
    scale: 1,
    layerOrder: 1,
  },
  createdAt: '',
  updatedAt: '',
};

const sampleData: ShareExportData = {
  intention: 'A life of clarity and purpose',
  category: 'wisdom',
  categoryLabel: 'Wisdom',
  svg: '<svg id="test-anchor" />',
  imageUrl: 'https://img.test/anchor.png',
  visionImageUrl: tile.imageUrl,
  visionTiles: [tile],
  visionNotes: [note],
  visionAnnotation: 'Handwritten note',
};

describe('Vision Share Background Customization', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    await AsyncStorage.clear();
    useSharePrefsStore.setState({ visionBackgroundId: 'canvas' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. defaults to Canvas background when no preference is set', () => {
    const state = useSharePrefsStore.getState();
    expect(state.visionBackgroundId).toBe('canvas');
    const bg = getVisionShareBackground(state.visionBackgroundId);
    expect(bg.name).toBe('Canvas');
    expect(bg.assetFilename).toBe('vision_canvas.png');
  });

  it('2. provides all five selectable backgrounds in correct order', () => {
    expect(VISION_SHARE_BACKGROUNDS).toHaveLength(5);
    expect(VISION_SHARE_BACKGROUNDS.map((b) => b.name)).toEqual([
      'Canvas',
      'Scrapbook',
      'Soft Focus',
      'Midnight',
      'Editorial',
    ]);
    expect(VISION_SHARE_BACKGROUNDS.map((b) => b.assetFilename)).toEqual([
      'vision_canvas.png',
      'vision_scrapbook.png',
      'vision_soft_focus.png',
      'vision_midnight.png',
      'vision_editorial.png',
    ]);
  });

  it('3. reveals background picker under Vision layout and updates preview upon selection', () => {
    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />
    );

    expect(view.getByTestId('vision-background-picker')).toBeTruthy();
    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('canvas');

    // Tap Scrapbook option
    const scrapbookButton = view.getByTestId('vision-background-option-scrapbook');
    fireEvent.press(scrapbookButton);

    expect(useSharePrefsStore.getState().visionBackgroundId).toBe('scrapbook');
    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('scrapbook');

    // Tap Midnight option
    const midnightButton = view.getByTestId('vision-background-option-midnight');
    fireEvent.press(midnightButton);

    expect(useSharePrefsStore.getState().visionBackgroundId).toBe('midnight');
    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('midnight');
  });

  it('4. persists selection across reopening Share Studio', () => {
    useSharePrefsStore.setState({ visionBackgroundId: 'midnight' });

    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />
    );

    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('midnight');
    view.unmount();

    // Reopen
    render(<AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />);
    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('midnight');
  });

  it('5. applies readable typography on Midnight (dark tone)', () => {
    const canvasBg = getVisionShareBackground('canvas');
    expect(canvasBg.tone).toBe('light');

    const midnightBg = getVisionShareBackground('midnight');
    expect(midnightBg.tone).toBe('dark');

    const lightView = render(
      <VisionExportTemplate data={sampleData} width={360} showMark visionBackgroundId="canvas" />
    );
    expect(lightView.getByText('A life of clarity and purpose')).toBeTruthy();

    const darkView = render(
      <VisionExportTemplate data={sampleData} width={360} showMark visionBackgroundId="midnight" />
    );
    expect(darkView.getByText('A life of clarity and purpose')).toBeTruthy();
  });

  it('uses the selected 1080p background image in the Vision card', () => {
    const view = render(
      <VisionExportTemplate data={sampleData} width={360} showMark visionBackgroundId="canvas" />
    );

    expect(view.getByTestId('vision-share-background').props.source).toEqual(
      getVisionShareBackground('canvas').source
    );

    view.rerender(
      <VisionExportTemplate data={sampleData} width={360} showMark visionBackgroundId="editorial" />
    );

    expect(view.getByTestId('vision-share-background').props.source).toEqual(
      getVisionShareBackground('editorial').source
    );
  });

  it('fits the entire background to the preview rather than its intrinsic asset size', () => {
    const view = render(<VisionExportTemplate data={sampleData} width={180} showMark visionBackgroundId="scrapbook" />);
    const background = view.getByTestId('vision-share-background');
    expect(StyleSheet.flatten(background.props.style)).toMatchObject({ width: 180, height: 320 });
    expect(background.props.resizeMethod).toBe('resize');
  });

  it('keeps the Vision layout thumbnail consistent with the selected background', () => {
    const view = render(<AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />);
    fireEvent.press(view.getByTestId('vision-background-option-midnight'));
    expect(view.getByTestId('share-layout-vision').findByProps({ testID: 'vision-share-background' }).props.source)
      .toEqual(getVisionShareBackground('midnight').source);
  });

  it('does not mount a full-size export while browsing backgrounds', () => {
    jest.useFakeTimers();
    const view = render(<AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />);
    fireEvent.press(view.getByTestId('vision-background-option-scrapbook'));
    act(() => { jest.advanceTimersByTime(500); });
    expect(mockPrepare).not.toHaveBeenCalled();
    view.unmount();
    jest.useRealTimers();
  });

  it('fits the preview inside the measured space left by the controls', () => {
    const view = render(<AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />);
    fireEvent(view.getByTestId('share-preview-room'), 'layout', { nativeEvent: { layout: { height: 240 } } });
    const preview = mockPreview.mock.calls.at(-1)?.[0];
    expect(preview.width * 16 / 9).toBeCloseTo(224);
    fireEvent(view.getByTestId('share-preview-room'), 'layout', { nativeEvent: { layout: { height: 200 } } });
    expect(mockPreview.mock.calls.at(-1)?.[0].width * 16 / 9).toBeCloseTo(184);
  });

  it('6. Anchor mark toggle still works and does not affect background selection', () => {
    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />
    );

    const toggle = view.getByTestId('share-studio-mark-toggle');
    expect(toggle.props.value).toBe(true);

    fireEvent(toggle, 'valueChange', false);
    expect(mockPreview.mock.calls.at(-1)?.[0].showMark).toBe(false);
    expect(mockPreview.mock.calls.at(-1)?.[0].visionBackgroundId).toBe('canvas');
  });

  it('7. other share formats remain unchanged and do not show background picker', () => {
    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="minimal" />
    );

    expect(view.queryByTestId('vision-background-picker')).toBeNull();
    expect(mockPreview.mock.calls.at(-1)?.[0].layout).toBe('minimal');
  });

  it('8. Save and Share execute using the selected vision background', async () => {
    useSharePrefsStore.setState({ visionBackgroundId: 'editorial' });

    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />
    );

    const saveButton = view.getByTestId('share-studio-save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockRenderPng).toHaveBeenCalledWith(
        'vision',
        true,
        expect.objectContaining({ visionBackgroundId: 'editorial' })
      );
      expect(saveShareExport).toHaveBeenCalledWith('file://fake-export.png', 'vision');
    });

    const shareButton = view.getByTestId('share-studio-share');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(sharePngViaSystemSheet).toHaveBeenCalledWith('file://fake-export.png');
    });
  });

  it('9. rapid selection changes always pass the latest background to renderPng', async () => {
    const view = render(
      <AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />
    );

    fireEvent.press(view.getByTestId('vision-background-option-soft_focus'));
    fireEvent.press(view.getByTestId('vision-background-option-midnight'));

    const saveButton = view.getByTestId('share-studio-save');
    fireEvent.press(saveButton);

    expect(mockRenderPng).toHaveBeenLastCalledWith(
      'vision',
      true,
      expect.objectContaining({ visionBackgroundId: 'midnight' })
    );
  });

  it('re-enables both buttons after a loading failure so Save and Share can be retried', async () => {
    mockRenderPng.mockRejectedValueOnce(new Error('Vision image loading timed out. Please try again.'));
    const view = render(<AnchorShareStudio visible onClose={jest.fn()} data={sampleData} initialLayout="vision" />);
    fireEvent.press(view.getByTestId('share-studio-save'));
    await waitFor(() => {
      expect(view.getByTestId('share-studio-save').props.accessibilityState?.disabled).toBe(false);
      expect(view.getByTestId('share-studio-share').props.accessibilityState?.disabled).toBe(false);
    });
    fireEvent.press(view.getByTestId('share-studio-save'));
    await waitFor(() => expect(saveShareExport).toHaveBeenCalledWith('file://fake-export.png', 'vision'));
    fireEvent.press(view.getByTestId('share-studio-share'));
    await waitFor(() => expect(sharePngViaSystemSheet).toHaveBeenCalledWith('file://fake-export.png'));
  });

  it('10. existing vision collage data (tiles, notes, mark, annotation) remains unchanged', () => {
    const view = render(
      <VisionExportTemplate data={sampleData} width={360} showMark visionBackgroundId="canvas" />
    );
    expect(sampleData.visionTiles).toHaveLength(1);
    expect(sampleData.visionTiles?.[0].sceneId).toBe('scene-1');
    expect(sampleData.visionNotes).toHaveLength(1);
    expect(sampleData.visionNotes?.[0].content.text).toBe('Clarity and peace');
    expect(sampleData.svg).toBe('<svg id="test-anchor" />');
    expect(view.getByText('Handwritten note')).toBeTruthy();
  });

  it('11. prewarms all tiles in multi-image vision collages upon opening Share Studio', () => {
    const prefetchSpy = jest.spyOn(Image, 'prefetch');
    const multiTileData: ShareExportData = {
      ...sampleData,
      visionTiles: [
        { id: 't1', sceneId: 's1', imageUrl: 'https://img.test/photo1.jpg', prompt: null, sortOrder: 0, isHero: true },
        { id: 't2', sceneId: 's2', imageUrl: 'https://img.test/photo2.jpg', prompt: null, sortOrder: 1, isHero: false },
        { id: 't3', sceneId: 's3', imageUrl: 'https://img.test/photo3.jpg', prompt: null, sortOrder: 2, isHero: false },
      ],
    };
    render(<AnchorShareStudio visible onClose={jest.fn()} data={multiTileData} initialLayout="vision" />);
    expect(prefetchSpy).toHaveBeenCalledWith('https://img.test/photo1.jpg');
    expect(prefetchSpy).toHaveBeenCalledWith('https://img.test/photo2.jpg');
    expect(prefetchSpy).toHaveBeenCalledWith('https://img.test/photo3.jpg');
  });
});
