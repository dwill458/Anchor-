import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { V2SavedVision } from '../V2SavedVision';
import type { V2VisionTile } from '@/adapters/v2/vision';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));

function setup(count: number) {
  const onRemove = jest.fn(async () => true);
  const tiles = Array.from({ length: count }, (_, i) => ({ sceneId: `photo-${i}`, imageUrl: `https://example.com/${i}.jpg`,
    sourceType: 'USER_UPLOAD', sortOrder: i } as V2VisionTile));
  const view = render(<V2SavedVision anchorIntention="A life with room to create" description="A quiet studio full of finished work."
    tiles={tiles} onBack={jest.fn()} onVisualize={jest.fn()} onChart={jest.fn()} onUpdateDescription={jest.fn(async () => true)}
    onReorder={jest.fn(async () => true)} onRemove={onRemove} onAddPhoto={jest.fn()} onAddGenerate={jest.fn()}
    onReplace={jest.fn(async () => {})} onRegenerate={jest.fn()} canGenerateMore onArchive={jest.fn(async () => true)} />);
  fireEvent(view.getByLabelText(`Vision image 1 of ${count}`), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  return { view, onRemove };
}

afterEach(() => jest.restoreAllMocks());

it('explains the existing minimum immediately when removing the only photo', () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { view, onRemove } = setup(1);
  fireEvent.press(view.getByLabelText('Remove'));
  expect(alert).toHaveBeenCalledWith('Keep one image', expect.stringContaining('Add another image'));
  expect(onRemove).not.toHaveBeenCalled();
});

it('confirms removal and invokes the existing handler for the selected photo', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { view, onRemove } = setup(4);
  fireEvent.press(view.getByLabelText('Remove'));
  expect(alert).toHaveBeenCalledWith('Remove image?', expect.any(String), expect.any(Array), expect.any(Object));
  const remove = alert.mock.calls.at(-1)?.[2]?.find(button => button.text === 'Remove');
  await act(async () => { remove?.onPress?.(); });
  expect(onRemove).toHaveBeenCalledWith('photo-0');
});
