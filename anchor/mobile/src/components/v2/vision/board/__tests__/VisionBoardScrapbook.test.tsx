import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { VisionBoard, type VisionBoardProps } from '../VisionBoard';
import type { V2VisionTile, VisionNote } from '@/adapters/v2/vision';
import { selectDetailBoardLayout } from '../visionBoardLayouts';

// Native shared values keep their identity across renders; the package's default mock recreates them.
jest.mock('react-native-reanimated', () => {
  const mock = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { ...mock, useSharedValue: (initial: any) => require('react').useRef({ value: initial }).current,
    withTiming: (target: any, _config: any, callback?: (finished: boolean) => void) => { callback?.(true); return target; },
    withDelay: (_delay: number, value: any) => value,
  };
});
jest.mock('@/components/v2/anchor/ThreadAura', () => {
  const { View } = require('react-native');
  return { ThreadAura: (props: { variant: string; threadStrength: number | null }) =>
    <View testID={`thread-aura-${props.variant}`} accessibilityLabel={`glow ${props.threadStrength}`} /> };
});
const mockPhoto = jest.fn();
// Records what each print receives, so the tests can check the composition reached the prints.
// Notes are drawn by a canvas-backed renderer; the mocks expose their text so the board's wiring can be asserted.
jest.mock('../VisionBoardNoteElement', () => ({ VisionBoardNoteElement: (props: any) => {
  const { Text, Pressable } = require('react-native');
  return <Pressable testID={`interactive-note-${props.note.id}`} onPress={() => props.onSelect(props.note.id)}><Text>{props.note.content.text}</Text></Pressable>;
} }));
jest.mock('@/components/v2/vision/notes/VisionNoteRenderer', () => ({ VisionNoteRenderer: (props: any) => {
  const { Text } = require('react-native');
  return <Text testID={`readonly-note-${props.text}`}>{props.text}</Text>;
} }));
jest.mock('../VisionBoardPhoto', () => {
  const { View } = require('react-native');
  return { VisionBoardPhoto: (props: { testID?: string; tapes?: unknown[] }) => {
    mockPhoto(props);
    return <View testID={props.testID} />;
  } };
});

const svg = '<svg viewBox="0 0 100 100"><path d="M 12 18 L 78 34 L 20 79" stroke="currentColor" fill="none"/></svg>';

function tiles(count: number): V2VisionTile[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`, sceneId: `p${index}`, imageUrl: `https://example.com/${index}.jpg`, prompt: null,
    sortOrder: index, isHero: index === 0, sourceType: 'AI_GENERATED',
  }) as V2VisionTile);
}

const note: VisionNote = {
  id: 'note-1', visionId: 'vision-1', content: { text: 'Keep the Sunday walks' },
  presentation: { styleId: 'sticky_blush_pink', x: 0.8, y: 0.12, width: 0.3, height: 0.2, rotation: 0, scale: 1, layerOrder: 0 },
  createdAt: '', updatedAt: '',
} as VisionNote;

const baseProps = (count: number, overrides: Partial<VisionBoardProps> = {}): VisionBoardProps => ({
  tiles: tiles(count), intention: 'My real intention', width: 296, reduceMotion: true, canRegenerate: false,
  onReplace: jest.fn(), onRegenerate: jest.fn(), onRemove: jest.fn(), onEditVision: jest.fn(), onReorder: jest.fn(),
  art: { svg, threadStrength: 60 }, ...overrides,
});

describe('Vision board on archival paper with scrapbook prints', () => {
  it('exposes note deletion after selection and clears controls when that note is removed', () => {
    const onNoteDelete = jest.fn();
    const props = baseProps(4, { notes: [note], onNotePresentationChange: jest.fn(), onNoteDelete });
    const view = render(<VisionBoard {...props} />);
    fireEvent.press(view.getByTestId('interactive-note-note-1'));
    fireEvent.press(view.getByLabelText('Delete selected note'));
    expect(onNoteDelete).toHaveBeenCalledWith(note.id);
    view.rerender(<VisionBoard {...props} notes={[]} />);
    expect(view.queryByLabelText('Delete selected note')).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('keeps the %i-photo viewport fixed as notes are added or removed', count => {
    const props = baseProps(count);
    const view = render(<VisionBoard {...props} />);
    const height = StyleSheet.flatten(view.getByTestId('vision-board').props.style).height;
    view.rerender(<VisionBoard {...props} notes={[note, { ...note, id: 'second-note' }]} />);
    expect(StyleSheet.flatten(view.getByTestId('vision-board').props.style).height).toBe(height);
  });
  it('leaves the board transparent, so the one archival sheet behind the screen shows through', () => {
    // The paper is drawn once behind the whole Vision screen (V2SavedVision), not as a rectangle under the board.
    const view = render(<VisionBoard {...baseProps(3)} />);
    expect(view.queryByTestId('vision-board-paper')).toBeNull();
    expect(view.getByTestId('vision-board')).toBeTruthy();
  });

  it.each([0, 1, 3, 5, 8])('renders a board for %i photos with every print in place', count => {
    const view = render(<VisionBoard {...baseProps(count)} />);
    for (let index = 0; index < count; index++) {
      expect(view.getByTestId(`vision-board-photo-p${index}`)).toBeTruthy();
    }
    // Nothing beyond the saved photos is drawn.
    expect(view.queryByTestId(`vision-board-photo-p${count}`)).toBeNull();
  });

  it('shows the empty invitation with no photos', () => {
    const view = render(<VisionBoard {...baseProps(0)} />);
    expect(view.getByText('Bring your future into view.')).toBeTruthy();
  });

  it.each([1, 3, 5, 8])('hands each print the tape strips the composition assigns it, for %i photos', count => {
    mockPhoto.mockClear();
    render(<VisionBoard {...baseProps(count)} />);
    const layout = selectDetailBoardLayout(count);
    expect(layout.decor.length).toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const received = mockPhoto.mock.calls.filter(([props]) => props.testID === `vision-board-photo-p${index}`).at(-1)?.[0];
      expect(received?.tapes ?? []).toEqual(layout.decor.filter(tape => tape.photo === index));
    }
  });

  it('keeps notes on the board alongside the photos', () => {
    const onNotePresentationChange = jest.fn().mockResolvedValue(true);
    const view = render(<VisionBoard {...baseProps(5, { notes: [note], onNotePresentationChange })} />);
    expect(view.getByTestId('interactive-note-note-1')).toBeTruthy();
    expect(view.getByTestId('vision-board-photo-p4')).toBeTruthy();
  });

  it('keeps notes on a board with no photos', () => {
    const onNotePresentationChange = jest.fn().mockResolvedValue(true);
    const view = render(<VisionBoard {...baseProps(0, { notes: [note], onNotePresentationChange })} />);
    expect(view.getByTestId('interactive-note-note-1')).toBeTruthy();
  });

  it('gives the Anchor its glow only when the stored Thread Strength is supplied', () => {
    const withStrength = render(<VisionBoard {...baseProps(3)} />);
    expect(withStrength.getByLabelText('glow 60')).toBeTruthy();
    const without = render(<VisionBoard {...baseProps(3, { art: { svg } })} />);
    expect(without.queryByTestId('thread-aura-board')).toBeNull();
  });

  it('passes a zero Thread Strength through unchanged, so the Anchor shows no glow', () => {
    const view = render(<VisionBoard {...baseProps(3, { art: { svg, threadStrength: 0 } })} />);
    expect(view.getByLabelText('glow 0')).toBeTruthy();
  });
});
