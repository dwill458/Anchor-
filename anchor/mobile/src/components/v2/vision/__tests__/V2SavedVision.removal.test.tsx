import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2SavedVision } from '../V2SavedVision';
import type { V2VisionTile } from '@/adapters/v2/vision';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));

function setup(count: number, persisted = false) {
  const onRemove = jest.fn(async () => true);
  const onReplace = jest.fn(async () => {});
  const tiles = Array.from({ length: count }, (_, i) => ({ sceneId: `photo-${i}`, imageUrl: `https://example.com/${i}.jpg`,
    sourceType: 'USER_UPLOAD', sortOrder: i } as V2VisionTile));
  const view = render(<V2SavedVision visionId={persisted ? 'saved-replace-test' : undefined} anchorIntention="A life with room to create" description="A quiet studio full of finished work."
    tiles={tiles} onBack={jest.fn()} onVisualize={jest.fn()} onChart={jest.fn()} onUpdateDescription={jest.fn(async () => true)}
    onReorder={jest.fn(async () => true)} onRemove={onRemove} onAddPhoto={jest.fn()} onAddGenerate={jest.fn()}
    onReplace={onReplace} onRegenerate={jest.fn()} canGenerateMore onArchive={jest.fn(async () => true)} />);
  fireEvent(view.getByLabelText(persisted ? 'Vision image in position 1 of 8' : `Vision image 1 of ${count}`), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  return { view, onRemove, onReplace };
}

afterEach(() => jest.restoreAllMocks());

it('wires the focused photograph Replace control through the existing production callback', async () => {
  const { view, onReplace, onRemove } = setup(4, true);
  await act(async () => { fireEvent.press(view.getByLabelText('Replace')); });
  expect(onReplace).toHaveBeenCalledTimes(1);
  expect(onReplace).toHaveBeenCalledWith('photo-0');
  expect(onRemove).not.toHaveBeenCalled();
});

it('explains the existing minimum in More and offers no destructive action for the only photo', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { view, onRemove } = setup(1);
  expect(view.queryByLabelText('Remove')).toBeNull();
  fireEvent.press(view.getByLabelText('More'));
  expect(alert).toHaveBeenCalledWith('Photo options', expect.stringContaining('Keep at least one image'), expect.any(Array));
  const options = alert.mock.calls.at(-1)![2]!;
  expect(options.find(button => button.text === 'Remove')).toBeUndefined();
  expect(options.find(button => button.style === 'cancel')).toBeDefined();
  expect(onRemove).not.toHaveBeenCalled();
});

it('confirms removal and invokes the existing handler for the selected photo', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { view, onRemove } = setup(4);
  expect(view.queryByLabelText('Remove')).toBeNull();
  fireEvent.press(view.getByLabelText('More'));
  expect(alert).toHaveBeenCalledWith('Photo options', undefined, expect.any(Array));
  const option = alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Remove');
  expect(option?.style).toBe('destructive');
  expect(onRemove).not.toHaveBeenCalled();
  act(() => { option?.onPress?.(); });
  expect(alert).toHaveBeenCalledWith('Remove image?', expect.any(String), expect.any(Array), expect.any(Object));
  const remove = alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Remove');
  await act(async () => { remove?.onPress?.(); });
  expect(onRemove).toHaveBeenCalledWith('photo-0');
});
