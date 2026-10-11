import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { VisionBoardScene } from '../VisionBoardScene';
import type { VisionNote } from '@/adapters/v2/vision';

const mockCard = jest.fn();
const mockPhoto = jest.fn();
const mockRenderer = jest.fn();
jest.mock('../VisionBoardNoteElement', () => ({ VisionBoardNoteElement: (props: any) => {
  const { Text } = require('react-native');
  return <Text testID={`interactive-note-${props.note.id}`}>{props.note.content.text}</Text>;
} }));
jest.mock('@/components/v2/vision/notes/VisionNoteRenderer', () => ({ VisionNoteRenderer: (props: any) => {
  mockRenderer(props);
  const { Text } = require('react-native');
  return <Text testID={`readonly-note-${props.text}`}>{props.text}</Text>;
} }));
jest.mock('../VisionBoardIntentionCard', () => ({ VisionBoardIntentionCard: (props: any) => { mockCard(props); return null; } }));
jest.mock('../VisionBoardPhoto', () => ({ VisionBoardPhoto: (props: any) => { mockPhoto(props); return null; } }));

const note: VisionNote = {
  id: 'note-1', visionId: 'vision-1', content: { text: 'A little reminder' },
  presentation: { styleId: 'sticky_blush_pink', x: .5, y: .5, width: .3, height: .3, rotation: 0, scale: 1, layerOrder: 0 },
  createdAt: '', updatedAt: '',
};
const props = (overrides: Record<string, unknown> = {}) => ({
  scene: { width: 300, height: 400 }, roster: [], entering: new Set<string>(),
  layout: { count: 0, photos: [], card: { x: .5, y: .5, width: .2, aspectRatio: 1, rotation: 0, zIndex: 40 }, decor: [] as [] },
  shared: { cameraScale: { value: 1 } } as any, initialRectFor: () => null,
  intention: 'Keep going', reduceMotion: true, notes: [note], ...overrides,
});

describe('VisionBoardScene note rendering', () => {
  it('can omit the intention card for the photos-only Visualize surface without altering saved notes', () => {
    mockCard.mockClear();
    render(<VisionBoardScene {...props({ showIntentionCard: false })} />);
    expect(mockCard).not.toHaveBeenCalled();
    expect(screen.getByTestId('readonly-note-A little reminder')).toBeTruthy();
    expect(note.content.text).toBe('A little reminder');
  });
  it('keeps notes visible in read-only scene renderers without gesture handlers', () => {
    mockRenderer.mockClear();
    render(<VisionBoardScene {...props()} />);
    expect(screen.getByTestId('readonly-note-A little reminder')).toBeTruthy();
    expect(mockRenderer).toHaveBeenCalledWith(expect.objectContaining({ presentation: expect.objectContaining({ layerOrder: 20 }) }));
  });

  it('uses interactive note elements only when both mutation handlers are present', () => {
    render(<VisionBoardScene {...props({ onNoteSelect: jest.fn(), onNotePresentationChange: jest.fn() })} />);
    expect(screen.getByTestId('interactive-note-note-1')).toBeTruthy();
  });

  it('can hide the Anchor mark while preserving the intention card', () => {
    mockCard.mockClear();
    render(<VisionBoardScene {...props({ showAnchorMark: false })} />);
    expect(mockCard).toHaveBeenCalledWith(expect.objectContaining({ hideMark: true, intention: 'Keep going' }));
  });

  it('forwards photo asset readiness for share rendering', () => {
    const onPhotoAssetReady = jest.fn();
    const tile = { sceneId: 'photo-1', imageUrl: 'https://example.test/photo.jpg', sourceType: 'USER_UPLOAD' } as any;
    render(<VisionBoardScene {...props({ roster: [{ tile, exiting: false }], layout: { count: 1, photos: [{ aspectRatio: 1 }], card: { x: .5, y: .5, width: .2, aspectRatio: 1, rotation: 0, zIndex: 40 }, decor: [] }, initialRectFor: () => ({ x: 0, y: 0, width: 100, height: 100 }), onPhotoAssetReady })} />);
    expect(mockPhoto).toHaveBeenCalledWith(expect.objectContaining({ onPhotoAssetReady }));
  });
});
