import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VisionBoard, type VisionBoardArrangement, type VisionBoardProps } from '../VisionBoard';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { resolveSlotMap, VISION_SLOT_COUNT } from '../visionBoardSlots';

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
    setup([null, 'a', null, 'b', null, null, 'c', null]);
    expect(lastProps('a').tapes.map((t: any) => t.photo)).toEqual([1]);
    expect(lastProps('b').tapes.map((t: any) => t.photo)).toEqual([3]);
    expect(lastProps('c').tapes.map((t: any) => t.photo)).toEqual([6]);
    expect(lastProps('a').frameVariant).toBe('rough-edge'); expect(lastProps('b').frameVariant).toBe('wide-bottom');
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
  it('Arrange shows the empty positions quietly, and tapping one adds there', () => {
    const { view, props } = setup(['a', 'b']);
    expect(view.queryByTestId('vision-board-slot-2')).toBeNull();      // subtle, and only while editing
    fireEvent.press(view.getByLabelText('Arrange photos'));
    expect(view.getByText('Tap an empty spot to add a photo')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Add a photo to position 3 of 8'));
    expect(props.onAddImage).toHaveBeenCalledWith({ slot: 2 });
  });
  it('Done leaves arranging and hides the indicators again', () => {
    const { view } = setup(['a']);
    fireEvent.press(view.getByLabelText('Arrange photos'));
    expect(view.getByTestId('vision-board-slot-1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Done arranging'));
    expect(view.queryByTestId('vision-board-slot-1')).toBeNull();
  });
});

describe('occupied positions', () => {
  beforeEach(() => { mockPhoto.mockClear(); jest.restoreAllMocks(); });

  it('offer Move, Replace, Reposition, Caption and Remove', () => {
    const { view } = setup(['a', 'b']);
    focusPhoto('a');
    for (const label of ['Move', 'Replace', 'Reposition', 'Caption', 'Remove']) expect(view.getByLabelText(label)).toBeTruthy();
  });
  it('Replace, Caption and Remove act on that photograph', () => {
    const { view, props } = setup(['a', 'b']);
    focusPhoto('b'); fireEvent.press(view.getByLabelText('Replace')); expect(props.onReplace).toHaveBeenCalledWith('b');
    fireEvent.press(view.getByLabelText('Remove')); expect(props.onRemove).toHaveBeenCalledWith('b');
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Caption')); expect(props.onCaptionEdit).toHaveBeenCalledWith('a');
  });
  it('Move into an empty position moves only that photograph', () => {
    const { view, arrangement } = setup(['a', 'b', null, null, 'c']);
    focusPhoto('b'); fireEvent.press(view.getByLabelText('Move'));
    expect(view.getByText('Choose a new position')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Add a photo to position 7 of 8'));
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
  it('Reposition lets the photograph be dragged inside its frame, and Reset or Done end it', () => {
    const { view, arrangement } = setup(['a', 'b']);
    focusPhoto('a'); expect(lastProps('a').repositioning).toBe(false);
    fireEvent.press(view.getByLabelText('Reposition'));
    expect(lastProps('a').repositioning).toBe(true); expect(view.getByText('Drag the photo to reposition it')).toBeTruthy();
    act(() => { lastProps('a').onFocalCommit('a', { x: 0.5, y: 0.2 }); });
    expect(arrangement.onFocalChange).toHaveBeenCalledWith('a', { x: 0.5, y: 0.2 });
    fireEvent.press(view.getByLabelText('Reset')); expect(arrangement.onFocalChange).toHaveBeenCalledWith('a', null);
    fireEvent.press(view.getByLabelText('Done')); expect(lastProps('a').repositioning).toBe(false);
  });
  it('is not changed by taps on the board background while repositioning', () => {
    const { view } = setup(['a']);
    focusPhoto('a'); fireEvent.press(view.getByLabelText('Reposition'));
    expect(view.getByLabelText('Done')).toBeTruthy();
  });
});
