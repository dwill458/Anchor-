import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Dimensions, Image } from 'react-native';
import { getVisionShareBackground } from '../visionShareBackgrounds';
import type { ShareExportData } from '../shareTypes';
import { VisionExportTemplate, annotationGeometry, headingReserve, wrappedLineCount } from '../templates/VisionExportTemplate';
import { detailBoardSizeForWidth, selectDetailBoardLayout } from '@/components/v2/vision/board/visionBoardLayouts';
import { visionBoardExportFrame } from '../visionBoardExportFrame';
import { composeVisionBoard } from '@/components/v2/vision/board/visionBoardComposition';
import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';

const mockSceneProps = jest.fn();

jest.mock('@/components/v2/vision/board/VisionBoardScene', () => ({
  VisionBoardScene: (props: unknown) => {
    mockSceneProps(props);
    return null;
  },
}));

jest.mock('@/components/v2/vision/board/useVisionBoardScene', () => ({
  useVisionBoardScene: (tiles: Array<{ sceneId: string }>, scene: { width: number; height: number },_scale:number,_detail:boolean,_slots:unknown,composition:any) => {
    const { BOARD_FRAME_KINDS, selectDetailBoardLayout, toSceneRect } = require('@/components/v2/vision/board/visionBoardLayouts');
    const layout = composition?.layout??selectDetailBoardLayout(tiles.length);
    const slots = layout.photos.map((slot: any) => ({ ...toSceneRect(slot, scene), frame: BOARD_FRAME_KINDS.indexOf(slot.frame) }));
    const order = composition?.order??tiles.slice(0,layout.photos.length).map(tile=>tile.sceneId);
    return {
      roster: tiles.map(tile => ({ tile, exiting: false })),
      entering: new Set(),
      layout,
      shared: { slots: { value: slots }, order: { value: order }, layoutVersion: { value: 0 }, dragging: { value: '' }, cameraScale: { value: 1 } },
      initialRectFor: (sceneId: string) => {
        const index = order.indexOf(sceneId);
        return index >= 0 ? slots[index] : null;
      },
    };
  },
}));

jest.mock('../templates/shared', () => {
  const { View } = require('react-native');
  return {
    POSTER_CREAM: '#F4EDE0',
    ShareCanvas: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    ShareBrandMark: () => null,
    ShareAnchorDisc: () => null,
    ShareIntention: () => null,
    ShareMetaLine: () => null,
    ShareScrim: () => null,
    intentionFontSize: () => 20,
    shareHeight: (width: number) => width * 16 / 9,
    useAssetGate: () => jest.fn(),
  };
});

const tile = { id: 'tile-1', sceneId: 'scene-1', imageUrl: 'https://img.test/board.jpg', prompt: null, sortOrder: 0, isHero: true };
const note = { id: 'note-1', visionId: 'vision-1', content: { text: 'Home by the sea' }, presentation: {
  styleId: 'sticky_blush_pink' as const, x: 0.72, y: 0.61, width: 0.3, height: 0.2, rotation: 9, scale: 1.1, layerOrder: 24,
}, createdAt: '', updatedAt: '' };
const data: ShareExportData = {
  svg: '<svg id="real-anchor" />', imageUrl: 'https://img.test/anchor.png', category: 'abundance', categoryLabel: 'Abundance',
  intention: 'A life with room to breathe', visionImageUrl: tile.imageUrl, visionTiles: [tile], visionNotes: [note], visionAnnotation: 'A quiet life',
};

describe('VisionExportTemplate board composition', () => {
  beforeEach(() => mockSceneProps.mockClear());

  it('waits for the actual rendered caption after font measurement and photo decode before capture', () => {
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 0; });
    const ready = jest.fn();
    const view = render(<VisionExportTemplate data={{ ...data, imageUrl: null, visionNotes: [], visionAnnotation: null,
      visionTiles: [{ ...tile, caption: 'A future worth seeing' }], visionBoardLayout: 'SCRAPBOOK' }} width={360} showMark={false} onAssetsReady={ready} />);
    expect(mockSceneProps).not.toHaveBeenCalled();
    for (const text of view.UNSAFE_getAllByType(require('react-native').Text).filter(text => text.props.onTextLayout)) {
      fireEvent(text, 'textLayout', { nativeEvent: { lines: [{ y: 0, height: 24 }] } });
    }
    fireEvent(view.getByTestId('vision-share-background'), 'load');
    act(() => { mockSceneProps.mock.calls.at(-1)![0].onPhotoAssetReady('scene-1'); jest.runOnlyPendingTimers(); });
    expect(ready).not.toHaveBeenCalled();
    act(() => { mockSceneProps.mock.calls.at(-1)![0].onCaptionReady('scene-1'); });
    act(() => { jest.runOnlyPendingTimers(); });
    expect(ready).toHaveBeenCalledTimes(1);
    raf.mockRestore();
  });

  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const)('exports the saved %s composition at its original measurement width with intact focal points and notes', boardLayout => {
    const photographs: V2VisionTile[] = [0, 3, 7].map((slot, i) => ({
      id: `saved-${i}`, sceneId: `saved-${i}`, imageUrl: `https://cdn.test/persisted-${i}.jpg`, prompt: null,
      caption: `My saved photograph ${i}`, slotIndex: slot, sortOrder: i, isHero: i === 0, focal: { x: .2 + i * .1, y: .7 },
    }));
    const savedNote: VisionNote = { id: 'persisted-note', visionId: 'v1', content: { text: 'A future worth seeing' },
      presentation: { styleId: 'paper_ivory_torn', fontId: 'classic', x: .5, y: .8, width: .2, height: .12, scale: 1, rotation: 0, layerOrder: 2 },
      layoutPositions: { EDITORIAL: { x: .4, y: 4.6 }, SCRAPBOOK: { x: .7, y: 4.8 } }, createdAt: '', updatedAt: '' };
    const payload = { ...data, visionTiles: photographs, visionNotes: [savedNote], visionBoardLayout: boardLayout, visionLayoutWidth: 366 };
    const before = JSON.stringify(payload);
    const estimate = composeVisionBoard({ tiles: photographs, notes: [savedNote], boardLayout, width: 366, fontScale: Dimensions.get('window').fontScale });
    const expected = composeVisionBoard({ tiles: photographs, notes: [savedNote], boardLayout, width: 366, fontScale: Dimensions.get('window').fontScale,
      measured: Object.fromEntries(estimate.measurements.map(m=>[m.key,Math.max(24,m.lineHeight)])) });
    const view = render(<VisionExportTemplate data={payload} width={1080} showMark onAssetsReady={jest.fn()} />);
    for (const text of view.UNSAFE_getAllByType(require('react-native').Text).filter(text => text.props.onTextLayout)) {
      fireEvent(text, 'textLayout', { nativeEvent: { lines: [{ y: 0, height: 24 }] } });
    }
    const scene = mockSceneProps.mock.calls.at(-1)![0] as Record<string, any>;
    expect(scene.layout).toEqual(expected.layout);
    expect(scene.notes).toEqual(expected.notes);
    expect(scene.slotOrder).toEqual(expected.order);
    expect(scene.scene.height / scene.scene.width).toBeCloseTo(expected.ratio);
    expect(scene.displayScale * scene.scene.width).toBe(366);
    expect(scene.focals).toEqual(Object.fromEntries(photographs.map(photo => [photo.sceneId, photo.focal])));
    expect(scene.art.svg).toBe(data.svg);
    expect(scene.interactive).toBeFalsy();
    expect(view.queryByLabelText('Edit photo caption')).toBeNull();
    expect(view.queryByLabelText('Move')).toBeNull();
    expect(JSON.stringify(payload)).toBe(before);
  });

  it('never includes the thumbnail fallback in an export', () => {
    const view = render(<VisionExportTemplate data={data} width={288} showMark onAssetsReady={jest.fn()} />);
    expect(view.UNSAFE_getAllByType(Image).some(image => image.props.source === getVisionShareBackground('canvas').thumbSource)).toBe(false);
  });

  it('rejects a failed full-resolution background instead of declaring its thumbnail ready', () => {
    const onAssetsReady = jest.fn();
    const onAssetsError = jest.fn();
    const view = render(<VisionExportTemplate data={{ ...data, visionNotes: [] }} width={288} showMark={false}
      onAssetsReady={onAssetsReady} onAssetsError={onAssetsError} />);
    fireEvent(view.getByTestId('vision-share-background'), 'error');
    act(() => mockSceneProps.mock.calls.at(-1)?.[0].onPhotoAssetReady('scene-1'));
    expect(onAssetsError).toHaveBeenCalledWith(expect.any(Error));
    expect(onAssetsReady).not.toHaveBeenCalled();
  });

  it('rejects a failed photograph instead of exporting the unavailable placeholder', () => {
    const onAssetsReady = jest.fn();
    const onAssetsError = jest.fn();
    const view = render(<VisionExportTemplate data={{ ...data, visionNotes: [] }} width={288} showMark={false}
      onAssetsReady={onAssetsReady} onAssetsError={onAssetsError} />);
    fireEvent(view.getByTestId('vision-share-background'), 'load');
    act(() => {
      const scene = mockSceneProps.mock.calls.at(-1)?.[0];
      scene.onPhotoAssetError('scene-1');
      scene.onPhotoAssetReady('scene-1');
    });
    expect(onAssetsError).toHaveBeenCalledWith(expect.any(Error));
    expect(onAssetsReady).not.toHaveBeenCalled();
  });

  it('reserves heading space for very long unbroken words without truncating them', () => {
    const intention = 'x'.repeat(200);
    expect(wrappedLineCount(intention, 20)).toBe(10);
    expect(headingReserve(360, intention)).toBeGreaterThan(headingReserve(360, 'A quiet life'));
    const view = render(<VisionExportTemplate data={{ ...data, intention }} width={360} showMark onAssetsReady={jest.fn()} />);
    expect(view.getByText(intention)).toBeTruthy();
  });

  it('keeps a long wrapped heading and annotation inside the remaining board viewport', () => {
    const width = 360;
    const intention = 'x'.repeat(200);
    const reserve = headingReserve(width, intention);
    const boardWidth = width * 0.9;
    const boardArea = { width: boardWidth, height: 640 - reserve - width * 0.15 };
    const boardViewport = detailBoardSizeForWidth(boardWidth, 3);
    const scene = detailBoardSizeForWidth(boardWidth * 1.7, 3);
    const annotation = annotationGeometry('y'.repeat(200), boardViewport, scene, 3);
    const frame = visionBoardExportFrame(scene, selectDetailBoardLayout(3), [], boardArea, width * 0.055, [], [annotation.rect]);
    expect(frame.bounds.top * frame.scale + frame.top).toBeGreaterThanOrEqual(width * 0.055 - 0.001);
    expect(frame.bounds.bottom * frame.scale + frame.top).toBeLessThanOrEqual(boardArea.height - width * 0.055 + 0.001);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(640 - boardArea.height).toBeGreaterThan(reserve);
  });

  it('uses the detail board scene and holds photo/note geometry steady when the Anchor mark is hidden', () => {
    const view = render(<VisionExportTemplate data={data} width={360} showMark onAssetsReady={jest.fn()} />);
    const shown = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    const photoRect = shown.initialRectFor('scene-1');
    expect(shown.layout.count).toBe(8);
    expect(shown.slotOrder.filter(Boolean)).toEqual([tile.sceneId]);
    expect(shown.roster[0].tile).toBe(tile);
    expect(shown.notes[0]).toMatchObject({id:note.id,content:note.content});
    expect(shown.notes[0].presentation.y*shown.scene.height).toBeCloseTo(note.presentation.y*1.25*shown.scene.width);
    expect(shown.detailEdges).toBe(true);
    expect(shown.art.svg).toBe(data.svg);
    expect(shown.showAnchorMark).toBe(true);
    expect(view.getByText('A quiet life')).toBeTruthy();

    view.rerender(<VisionExportTemplate data={data} width={360} showMark={false} onAssetsReady={jest.fn()} />);
    const hidden = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(hidden.showAnchorMark).toBe(false);
    expect(hidden.art.svg).toBe(data.svg);
    expect(hidden.initialRectFor('scene-1')).toEqual(photoRect);
    expect(hidden.notes).toEqual(shown.notes);
    expect(view.getByText('A quiet life')).toBeTruthy();
  });

  it('adapts a legacy single Vision URL to the shared one-photo board scene', () => {
    const legacyData = { ...data, visionTiles: undefined, visionNotes: [], visionAnnotation: null };
    render(<VisionExportTemplate data={legacyData} width={360} showMark onAssetsReady={jest.fn()} />);
    const scene = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(scene.layout.count).toBe(8);
    expect(scene.slotOrder.filter(Boolean)).toHaveLength(1);
    expect(scene.roster).toHaveLength(1);
    expect(scene.roster[0].tile.imageUrl).toBe(tile.imageUrl);
  });

  it('keeps board and heading design geometry canonical across selector, preview, and export widths', () => {
    const view = render(<VisionExportTemplate data={{ ...data, intention: 'A long intention with enough words to wrap across several lines and test stable heading bounds' }} width={56} showMark onAssetsReady={jest.fn()} />);
    const thumbScene = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    const thumbWrapper = view.getByTestId('vision-export-canonical-composition').props.style;
    view.rerender(<VisionExportTemplate data={{ ...data, intention: 'A long intention with enough words to wrap across several lines and test stable heading bounds' }} width={220} showMark onAssetsReady={jest.fn()} />);
    const previewScene = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    const previewWrapper = view.getByTestId('vision-export-canonical-composition').props.style;
    view.rerender(<VisionExportTemplate data={{ ...data, intention: 'A long intention with enough words to wrap across several lines and test stable heading bounds' }} width={1080} showMark onAssetsReady={jest.fn()} />);
    const exportScene = mockSceneProps.mock.calls.at(-1)?.[0] as Record<string, any>;
    const exportWrapper = view.getByTestId('vision-export-canonical-composition').props.style;

    expect(thumbScene.scene).toEqual(previewScene.scene);
    expect(previewScene.scene).toEqual(exportScene.scene);
    expect(thumbScene.layout).toEqual(previewScene.layout);
    expect(previewScene.layout).toEqual(exportScene.layout);
    expect(thumbScene.initialRectFor('scene-1')).toEqual(exportScene.initialRectFor('scene-1'));
    expect(thumbWrapper.width).toBe(360);
    expect(previewWrapper.width).toBe(360);
    expect(exportWrapper.width).toBe(360);
    expect(thumbWrapper.transform).toEqual([{ scale: 56 / 360 }]);
    expect(previewWrapper.transform).toEqual([{ scale: 220 / 360 }]);
    expect(exportWrapper.transform).toEqual([{ scale: 3 }]);
  });
});
