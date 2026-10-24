import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VisionBoard, type VisionBoardArrangement, type VisionBoardProps } from '../VisionBoard';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { resolveSlotMap, VISION_SLOT_COUNT } from '../visionBoardSlots';
import { composeVisionBoard } from '../visionBoardComposition';

jest.mock('react-native-reanimated', () => {
  const mock = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { ...mock, useSharedValue: (initial: any) => require('react').useRef({ value: initial }).current,
    withTiming: (target: any, _config: any, callback?: (finished: boolean) => void) => { callback?.(true); return target; },
    withDelay: (_delay: number, value: any) => value,
  };
});
jest.mock('@/components/v2/anchor/ThreadAura', () => ({ ThreadAura: () => null }));
jest.mock('../VisionBoardNoteElement', () => ({ VisionBoardNoteElement: () => null }));
jest.mock('@/components/v2/vision/notes/VisionNoteRenderer', () => ({ VisionNoteRenderer: () => null }));
const mockPhoto = jest.fn();
jest.mock('../VisionBoardPhoto', () => {
  const { View } = require('react-native');
  return { VisionBoardPhoto: (props: any) => { mockPhoto(props); return <View testID={props.testID} />; } };
});

const svg = '<svg viewBox="0 0 100 100"><path d="M 12 18 L 78 34 L 20 79" stroke="currentColor" fill="none"/></svg>';
const tile = (id: string, index: number): V2VisionTile => ({ id, sceneId: id, imageUrl: `https://example.com/${id}.jpg`, prompt: null, sortOrder: index, isHero: index === 0, sourceType: 'USER_UPLOAD' } as V2VisionTile);
const tilesFor = (ids: string[]) => ids.map(tile);

const lastProps = (id: string) => mockPhoto.mock.calls.filter(([props]) => props.sceneId === id).at(-1)?.[0];
/** Same place to the sub-pixel; the board height moves when the lowest occupied slot does, and that is float noise at most. */
const expectSameRect = (actual: Record<string, number>, expected: Record<string, number>) => {
  for (const key of Object.keys(expected)) expect(actual[key]).toBeCloseTo(expected[key], 6);
};

function setup(slotIds: Array<string | null>, overrides: Partial<VisionBoardProps> = {}, arrangementOverrides: Partial<VisionBoardArrangement> = {}) {
  const ids = slotIds.filter((id): id is string => Boolean(id));
  const stored: Record<string, number> = {};
  slotIds.forEach((id, slot) => { if (id) stored[id] = slot; });
  const arrangement: VisionBoardArrangement = {
    slotMap: resolveSlotMap(ids, stored), focals: {}, onArrange: jest.fn(), onFocalChange: jest.fn(), ...arrangementOverrides,
  };
  const props: VisionBoardProps = {
    tiles: tilesFor(ids), intention: 'My real intention', width: 296, reduceMotion: true, canRegenerate: false, arrangement,
    onReplace: jest.fn(), onRegenerate: jest.fn(), onRemove: jest.fn(), onEditVision: jest.fn(), onReorder: jest.fn(), onAddImage: jest.fn(),
    onCaptionEdit: jest.fn(), art: { svg, threadStrength: 60 }, ...overrides,
  };
  const view = render(<VisionBoard {...props} />);
  return { view, props, arrangement };
}
const focusPhoto = (id: string) => act(() => { lastProps(id).onPress(id); });

describe('slot positions', () => {
  beforeEach(() => { mockPhoto.mockClear(); jest.restoreAllMocks(); });

  it.each(['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const)('keeps the %s controls below the complete photo and note canvas', boardLayout => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const notes = [0, 1, 2].map(i => ({ id: `note-${i}`, visionId: 'vision', content: { text: 'Room for family.' },
      presentation: { styleId: 'sticky_butter_yellow' as const, x: .5, y: .95, width: .3, height: .1, scale: 1, rotation: 0, layerOrder: i }, createdAt: '', updatedAt: '' }));
    const { view, props, arrangement } = setup(ids, { boardLayout, notes });
    const composition = composeVisionBoard({ tiles: props.tiles, notes, width: props.width, boardLayout, slotMap: arrangement.slotMap });
    const row = view.getByTestId('vision-board-controls');
    const rowStyle = StyleSheet.flatten(row.props.style);
    const viewportStyle = StyleSheet.flatten(view.getByTestId('vision-board').props.style);
    expect(rowStyle.top).toBeGreaterThanOrEqual(composition.size.height);
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 220, height: 58 } } });
    const updatedHeight = StyleSheet.flatten(view.getByTestId('vision-board').props.style).height;
    expect(updatedHeight).toBeGreaterThanOrEqual(rowStyle.top + 58 + 8);
    expect(viewportStyle.height).toBeGreaterThan(composition.size.height);
  });

  it.each([
    ['one photograph', ['a']],
    ['three consecutive', ['a', 'b', 'c']],
    ['eight', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']],
    ['nonconsecutive', [null, 'a', null, null, 'b', null, 'c', null]],
    ['only the last slot', [null, null, null, null, null, null, null, 'a']],
  ])('draws each photograph at its own slot: %s', (_name, slotIds) => {
    setup(slotIds as Array<string | null>);
    slotIds.forEach((id, slot) => {
      if (!id) return;
      const props = lastProps(id);
      expect(props.accessibilityLabel).toBe(`Vision image in position ${slot + 1} of ${VISION_SLOT_COUNT}`);
      expect(props.initialRect).not.toBeNull();
    });
  });

  it('keeps every photograph exactly where it is when another is removed, added or moved', () => {
    const rectOf = (id: string) => { const { x, y, width, height, rotation } = lastProps(id).initialRect; return { x, y, width, height, rotation }; };
    const first = setup(['a', null, 'b', null, 'c', null, null, null]);
    const before = { a: rectOf('a'), b: rectOf('b'), c: rectOf('c') };
    mockPhoto.mockClear();
    // b is removed; a and c do not move, and nothing re-flows into the gap.
    first.view.rerender(<VisionBoard {...first.props} tiles={tilesFor(['a', 'c'])} arrangement={{ ...first.arrangement, slotMap: resolveSlotMap(['a', 'c'], { a: 0, c: 4 }) }} />);
    expectSameRect(rectOf('a'), before.a); expectSameRect(rectOf('c'), before.c);
    // A new photograph lands in a chosen slot; the others still do not move.
    mockPhoto.mockClear();
    first.view.rerender(<VisionBoard {...first.props} tiles={tilesFor(['a', 'c', 'n'])} arrangement={{ ...first.arrangement, slotMap: resolveSlotMap(['a', 'c', 'n'], { a: 0, c: 4, n: 7 }) }} />);
    expectSameRect(rectOf('a'), before.a); expectSameRect(rectOf('c'), before.c);
    expect(lastProps('n').accessibilityLabel).toContain('position 8 of 8');
  });

  it('hands each print the tape of its slot and its own frame variant, wherever the other slots are filled', () => {
    setup([null, 'a', null, 'b', null, null, null, 'c']);
    expect(lastProps('a').tapes).toEqual([]);                                   // slot 1 is a torn print: no tape
    expect(lastProps('b').tapes.map((t: any) => t.photo)).toEqual([3]);
    expect(lastProps('c').tapes.map((t: any) => t.photo)).toEqual([7]);
    expect(lastProps('a').treatment).toBe('torn'); expect(lastProps('b').treatment).toBe('polaroid');
    expect(lastProps('b').frameVariant).toBe('wide-bottom');
  });

  it('gives each print the on-screen size of the scene, so captions are sized in the points people see', () => {
    setup(['a']);
    expect(lastProps('a').displayScale).toBeCloseTo(1 / 1.7, 5);
  });

  it('hands the print its saved position inside the frame', () => {
    setup(['a'], {}, { focals: { a: { x: 0.4, y: 0.1 } } });
    expect(lastProps('a').focal).toEqual({ x: 0.4, y: 0.1 });
  });
});

describe('adding to a position', () => {
  beforeEach(() => { mockPhoto.mockClear(); });

  it('Add asks where first, and offers every empty position', () => {
    const { view } = setup(['a', null, 'b']);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(view.getByText('Choose where it goes')).toBeTruthy();
    for (let slot = 0; slot < VISION_SLOT_COUNT; slot += 1) {
      const marker = view.queryByTestId(`vision-board-slot-${slot}`);
      if (slot === 0 || slot === 2) expect(marker).toBeNull(); else expect(marker).toBeTruthy();
    }
  });
  it('tapping an empty position adds to exactly that one', () => {
    const { view, props } = setup(['a', null, 'b']);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Add a photo to position 6 of 8'));
    expect(props.onAddImage).toHaveBeenCalledTimes(1); expect(props.onAddImage).toHaveBeenCalledWith({ slot: 5 });
  });
  it('"Next free spot" is the one-tap default: the lowest free position', () => {
    const { view, props } = setup(['a', null, 'b']);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Use the next free position'));
    expect(props.onAddImage).toHaveBeenCalledWith({ slot: 1 });
  });
  it('can be cancelled without adding anything', () => {
    const { view, props } = setup(['a']);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Cancel'));
    expect(props.onAddImage).not.toHaveBeenCalled(); expect(view.queryByText('Choose where it goes')).toBeNull(); expect(view.queryByTestId('vision-board-slot-1')).toBeNull();
  });
  it.each([[0], [1], [3], [5], [7]])('works with %i photographs, in any combination of positions', count => {
    const slotIds: Array<string | null> = Array.from({ length: VISION_SLOT_COUNT }, (_, slot) => (slot < count ? `p${slot}` : null));
    const { view, props } = setup(slotIds);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    for (let slot = count; slot < VISION_SLOT_COUNT; slot += 1) expect(view.getByTestId(`vision-board-slot-${slot}`)).toBeTruthy();
    fireEvent.press(view.getByLabelText(`Add a photo to position ${VISION_SLOT_COUNT} of ${VISION_SLOT_COUNT}`));
    expect(props.onAddImage).toHaveBeenCalledWith({ slot: VISION_SLOT_COUNT - 1 });
  });
  it('a full board goes straight to the add flow, which still serves notes', () => {
    const slotIds = Array.from({ length: VISION_SLOT_COUNT }, (_, slot) => `p${slot}`);
    const { view, props } = setup(slotIds);
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(props.onAddImage).toHaveBeenCalledWith(); expect(view.queryByText('Choose where it goes')).toBeNull();
  });
  it('has no Arrange button: photos are rearranged by dragging, and empty positions only show while adding', () => {
    const { view, props } = setup(['a', 'b']);
    expect(view.queryByLabelText('Arrange photos')).toBeNull();
    expect(view.queryByTestId('vision-board-slot-2')).toBeNull();
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Add a photo to position 3 of 8'));
    expect(props.onAddImage).toHaveBeenCalledWith({ slot: 2 });
  });
});

describe('occupied positions', () => {
  beforeEach(() => { mockPhoto.mockClear(); jest.restoreAllMocks(); });

  it('offers Move, Replace, Reposition and Caption directly, with Remove inside More', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { view } = setup(['a', 'b']);
    focusPhoto('a');
    for (const label of ['Move', 'Replace', 'Reposition', 'Caption', 'More']) expect(view.getByLabelText(label)).toBeTruthy();
    expect(view.queryByLabelText('Remove')).toBeNull();
    fireEvent.press(view.getByLabelText('More'));
    expect(alert).toHaveBeenCalledWith('Photo options', undefined, expect.arrayContaining([
      expect.objectContaining({ text: 'Remove', style: 'destructive', onPress: expect.any(Function) }),
    ]));
  });
  it('Replace, Caption and Remove act on that photograph', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { view, props } = setup(['a', 'b']);
    focusPhoto('b'); fireEvent.press(view.getByLabelText('Replace')); expect(props.onReplace).toHaveBeenCalledWith('b');
    fireEvent.press(view.getByLabelText('More'));
    const remove = alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Remove');
    act(() => { remove?.onPress?.(); });
    expect(props.onRemove).toHaveBeenCalledWith('b');
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Caption')); expect(props.onCaptionEdit).toHaveBeenCalledWith('a');
  });
  it('explains the minimum in More and excludes Remove for the final photograph', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { view, props } = setup(['a']);
    focusPhoto('a');
    for (const label of ['Move', 'Replace', 'Reposition', 'Caption', 'More']) expect(view.getByLabelText(label)).toBeTruthy();
    fireEvent.press(view.getByLabelText('More'));
    expect(alert).toHaveBeenCalledWith('Photo options', expect.stringContaining('Keep at least one image'), expect.any(Array));
    expect(alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Remove')).toBeUndefined();
    expect(props.onRemove).not.toHaveBeenCalled();
  });
  it('Move into an empty position moves only that photograph', () => {
    const { view, arrangement } = setup(['a', 'b', null, null, 'c']);
    focusPhoto('b'); fireEvent.press(view.getByLabelText('Move'));
    expect(view.getByText('Choose a new position')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Move photo to position 7 of 8'));
    expect(arrangement.onArrange).toHaveBeenCalledWith(['a', null, null, null, 'c', null, 'b', null].map((v, i) => (i === 4 ? 'c' : v)));
  });
  it('Move onto an occupied position asks before swapping, and never overwrites', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { view, arrangement } = setup(['a', 'b', null, 'c']);
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Move'));
    fireEvent.press(view.getByLabelText('Swap with the photo in position 4 of 8'));
    expect(alert).toHaveBeenCalledWith('Swap photos?', expect.any(String), expect.any(Array));
    expect(arrangement.onArrange).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    act(() => { buttons.find(button => button.text === 'Swap')?.onPress?.(); });
    expect(arrangement.onArrange).toHaveBeenCalledWith(['c', 'b', null, 'a', null, null, null, null]);
  });
  it('cancelling the swap changes nothing', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { view, arrangement } = setup(['a', 'b']);
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Move')); fireEvent.press(view.getByLabelText('Swap with the photo in position 2 of 8'));
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; style?: string }>;
    expect(buttons.find(button => button.style === 'cancel')).toBeTruthy(); expect(arrangement.onArrange).not.toHaveBeenCalled();
  });
  it('a drag that lands on another position is committed as a new arrangement, empty slots included', () => {
    const { arrangement } = setup(['a', null, 'b']);
    act(() => { lastProps('a').onOrderCommit(['', 'a', 'b', '', '', '', '', '']); });
    expect(arrangement.onArrange).toHaveBeenCalledWith([null, 'a', 'b', null, null, null, null, null]);
  });
  it('Reposition previews dragging and Reset locally, then saves automatic crop once on Done', () => {
    const { view, arrangement } = setup(['a', 'b']);
    focusPhoto('a'); expect(lastProps('a').repositioning).toBe(false);
    fireEvent.press(view.getByLabelText('Reposition'));
    expect(lastProps('a').repositioning).toBe(true); expect(view.getByText('Drag the photo to reposition it')).toBeTruthy();
    act(() => { lastProps('a').onFocalCommit('a', { x: 0.5, y: 0.2 }); });
    expect(lastProps('a').focal).toEqual({ x: 0.5, y: 0.2 });
    expect(arrangement.onFocalChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Reset'));
    expect(lastProps('a').focal).toBeNull();
    expect(arrangement.onFocalChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Done'));
    expect(arrangement.onFocalChange).toHaveBeenCalledTimes(1);
    expect(arrangement.onFocalChange).toHaveBeenCalledWith('a', null);
    expect(lastProps('a').repositioning).toBe(false);
  });
  it('saves only the latest previewed focal point when Done is pressed', () => {
    const { view, arrangement } = setup(['a']);
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Reposition'));
    act(() => { lastProps('a').onFocalCommit('a', { x: .2, y: .4 }); });
    act(() => { lastProps('a').onFocalCommit('a', { x: .6, y: .7 }); });
    expect(lastProps('a').focal).toEqual({ x: .6, y: .7 });
    expect(arrangement.onFocalChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Done'));
    expect(arrangement.onFocalChange).toHaveBeenCalledTimes(1);
    expect(arrangement.onFocalChange).toHaveBeenCalledWith('a', { x: .6, y: .7 });
  });
  it('Cancel restores the saved crop after dragging or Reset and sends no mutation', () => {
    const saved = { x: .4, y: .1 };
    const { view, arrangement } = setup(['a'], {}, { focals: { a: saved } });
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Reposition'));
    act(() => { lastProps('a').onFocalCommit('a', { x: .8, y: .9 }); });
    expect(lastProps('a').focal).toEqual({ x: .8, y: .9 });
    fireEvent.press(view.getByLabelText('Reset'));
    expect(lastProps('a').focal).toBeNull();
    fireEvent.press(view.getByLabelText('Cancel'));
    expect(lastProps('a').focal).toEqual(saved);
    expect(lastProps('a').repositioning).toBe(false);
    expect(arrangement.onFocalChange).not.toHaveBeenCalled();
  });
  it('is not changed by taps on the board background while repositioning', () => {
    const { view } = setup(['a']);
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Reposition'));
    expect(view.getByLabelText('Done')).toBeTruthy();
  });
});
